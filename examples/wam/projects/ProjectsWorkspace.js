// Projects workspace (TONELAB mockup): the sidebar project picker and track
// inspector, the project header, the track timeline and their dialogs.
// Projects live in the Rails account (/api/projects): the static distribution
// and guests get an explanation. Creating, importing, adding and deleting are
// saved at once; name, tempo and track edits (mix, preset, rename) stay local
// until "Save project". Shared projects are read-only: their mix can be tried
// but is never saved. The transport plays the open project (ProjectPlayer);
// it keeps playing in Tone, to play along with the live guitar. Guitar and
// bass tracks play through their preset (TrackTones, attached once the rack
// engine is up).
import {actionsRow, button, confirmDialog, createDialog} from '../account/dialogs.js';
import {FACTORY_PRESETS} from '../account/FactoryPresets.js';
import {buildWaveformPeaks} from '../source-separation/CompactWaveform.js';
import {ProjectTimeline} from './ProjectTimeline.js';
import {AUDIO_ACCEPT, BPM_RANGE, INSTRUMENTS, barBeat, clampBpm, defaultTrackName, describeProject, formatClock, groupProjects,
  initials, instrumentLabel, nameFromFile, shareSummary, plural, presetFields, presetValue, projectOptionLabel, timelineLength, toggleMonitoring,
  trackChanges, twoDigits, usesPreset, withInstrument} from './ProjectsModel.js';

const LAST_PROJECT_KEY = 'nam-a2-wam.project';
const element = (tag, properties = {}) => Object.assign(document.createElement(tag), properties);

export class ProjectsWorkspace extends EventTarget {
  // api: AccountApi (null without accounts); account: Account (sign in/out);
  // requestSignIn(): opens the sign-in dialog; report(text, error): toasts;
  // onEditPreset(value): loads "factory:…" or an account preset id in Tone;
  // player: ProjectPlayer; createRenderer(options): a WaveSurfer renderer;
  // liveInputEnabled(): whether the live guitar is on (for input monitoring).
  constructor({api = null, account = null, requestSignIn = () => {}, report = () => {}, onEditPreset = () => {}, player = null,
    createRenderer, liveInputEnabled = () => true, root = document, storage = globalThis.localStorage}) {
    super();
    Object.assign(this, {api, account, requestSignIn, report, onEditPreset, player, storage});
    this.$ = (id) => root.getElementById(id);
    this.projects = [];
    this.project = null;
    this.saved = null; // the project as last loaded or saved
    this.selectedId = null;
    this.presets = []; // the user's account presets, for the inspector
    this.timeline = new ProjectTimeline(this.$('projectTracks'), {
      root: this.$('projectTimeline'), ruler: this.$('projectRuler'), createRenderer,
      onSeek: (seconds) => this.player?.seek(seconds),
      onSelect: (id) => this.select(id),
      onChange: (id, fields) => this.updateTrack(id, fields),
      onEdit: (id) => this.editTrackDialog(id),
      onMonitor: (id) => {
        this.setTracks(toggleMonitoring(this.project.tracks, id));
        if (this.selectedTrack?.inputMonitoring && !liveInputEnabled()) this.report('Input monitoring: enable live input to play through this track.', true);
      },
    });
    this.$('projectSelect').onchange = (event) => this.open(event.target.value);
    this.$('projectNew').onclick = () => this.createProjectDialog();
    this.$('projectImport').onclick = () => this.importAudioDialog();
    this.$('projectEdit').onclick = () => this.editProjectDialog();
    this.$('projectSave').onclick = () => this.save();
    this.$('projectShare').onclick = () => this.shareDialog();
    this.$('projectResetMix').onclick = () => this.setTracks(structuredClone(this.saved.tracks));
    this.$('projectAddTrack').onclick = () => this.addTrackDialog();
    this.$('projectsEmptyAction').onclick = () => this.emptyAction?.();
    this.$('inspectorPreset').onchange = (event) => this.updateTrack(this.selectedId, presetFields(event.target.value));
    this.$('inspectorEditPreset').onclick = () => this.editPresetInTone();
    this.$('projectPlay').onclick = () => (this.player?.playing ? this.player.pause() : this.player?.play());
    this.$('projectRewind').onclick = () => this.player?.stop();
    player?.addEventListener('statechange', () => this.renderTransport());
    player?.addEventListener('load', ({detail: {id, buffer}}) => {
      this.timeline.setWave(id, {peaks: buildWaveformPeaks([buffer], buffer.length), duration: buffer.duration});
      this.renderLength();
    });
    player?.addEventListener('error', ({detail: {id, error}}) => {
      this.timeline.setWave(id, {state: 'error'});
      const track = this.project?.tracks.find((entry) => entry.id === id);
      this.report(`${track?.audio?.filename ?? 'Audio'} not loaded: ${error.message}`, true);
    });
    account?.addEventListener('change', () => this.load());
  }

  // TrackTones: one rack per guitar or bass track with a preset.
  attachTones(tones) {
    this.tones = tones;
    tones.addEventListener('change', ({detail: {id}}) => {
      const track = this.project?.tracks.find((entry) => entry.id === id);
      if (track) this.timeline.update(track, id === this.selectedId);
      if (id === this.selectedId) this.renderInspector();
    });
    tones.addEventListener('error', ({detail: {id, error}}) => {
      const track = this.project?.tracks.find((entry) => entry.id === id);
      this.report(`${track?.name ?? 'Track'}: preset not loaded (${error.message}); the track plays dry.`, true);
    });
    this.syncPlayer();
  }

  // A preset of mine was created, saved, renamed or deleted in Tone: the
  // inspector lists it again, and its tracks play it as saved. A deleted
  // preset leaves its tracks without one, as the server does.
  async presetChanged({action, id, state}) {
    if (action === 'delete' && this.project) {
      const unset = (tracks) => tracks.map((track) => (track.presetId === id ? {...track, presetId: null, presetName: null} : track));
      this.saved.tracks = unset(this.saved.tracks);
      if (this.project.tracks.some((track) => track.presetId === id)) this.setTracks(unset(this.project.tracks));
    }
    if (action === 'update' && state) this.tones?.refresh(`account:${id}`);
    try { this.presets = await this.api.listPresets(); }
    catch (error) { return this.report(`Presets not refreshed: ${error.message}`, true); }
    for (const track of this.project?.tracks ?? []) this.timeline.update(track, track.id === this.selectedId);
    this.renderInspector();
  }

  get available() { return Boolean(this.api?.available && this.account); }
  get signedIn() { return Boolean(this.account?.signedIn); }
  get owned() { return Boolean(this.project?.owned); }
  get selectedTrack() { return this.project?.tracks.find((track) => track.id === this.selectedId) ?? null; }

  // Unsaved edits of an owned project.
  get dirty() {
    if (!this.owned || !this.saved) return false;
    return this.project.name !== this.saved.name || this.project.bpm !== this.saved.bpm
      || trackChanges(this.saved.tracks, this.project.tracks).length > 0;
  }

  async load() {
    this.setProject(null);
    this.projects = [];
    this.presets = [];
    if (this.available && this.signedIn) {
      try { [this.projects, this.presets] = await Promise.all([this.api.listProjects(), this.api.listPresets()]); }
      catch (error) { this.report(`Projects not loaded: ${error.message}`, true); }
    }
    const remembered = this.remembered();
    const first = this.projects.find((project) => String(project.id) === remembered) || this.projects[0];
    if (first) await this.open(first.id, {confirm: false});
    else this.render();
  }

  async open(id, {confirm = true} = {}) {
    if (confirm && this.dirty && String(id) !== String(this.project?.id)) {
      const discard = await confirmDialog({title: 'Discard unsaved changes?', message: `“${this.project.name}” has unsaved changes.`,
        confirmLabel: 'Discard'});
      if (!discard) return this.render();
    }
    try {
      this.setProject(await this.api.getProject(id));
      this.remember(id);
    } catch (error) {
      this.report(`Project not opened: ${error.message}`, true);
    }
    this.render();
    this.dispatchEvent(new CustomEvent('change', {detail: {project: this.project}}));
  }

  setProject(project) {
    if (project?.id !== this.project?.id) this.player?.stop();
    this.project = project;
    this.saved = project && structuredClone(project);
    if (!project?.tracks.some((track) => track.id === this.selectedId)) this.selectedId = project?.tracks[0]?.id ?? null;
  }

  // Local edit of the open project (name, bpm): saved by save().
  edit(attributes) {
    Object.assign(this.project, attributes);
    this.render();
  }

  select(id) {
    if (id === this.selectedId) return;
    this.selectedId = id;
    for (const track of this.project.tracks) this.timeline.update(track, track.id === id);
    this.renderInspector();
  }

  // Local edit of a track; the row is updated in place (a fader keeps its drag).
  updateTrack(id, fields) {
    this.setTracks(this.project.tracks.map((track) => (track.id === id ? {...track, ...fields} : track)));
  }

  setTracks(tracks) {
    this.project.tracks = tracks;
    for (const track of tracks) this.timeline.update(track, track.id === this.selectedId);
    this.syncPlayer();
    this.renderHeader();
    this.renderInspector();
    this.dispatchEvent(new CustomEvent('tracks', {detail: {tracks}}));
  }

  async save() {
    if (!this.dirty) return;
    const save = this.$('projectSave');
    save.disabled = true;
    try {
      const {project, saved} = this;
      if (project.name !== saved.name || project.bpm !== saved.bpm) {
        Object.assign(saved, await this.api.updateProject(project.id, {name: project.name, bpm: project.bpm}), {tracks: saved.tracks});
      }
      for (const {id, changes} of trackChanges(saved.tracks, project.tracks)) {
        const track = await this.api.updateTrack(project.id, id, changes);
        saved.tracks = saved.tracks.map((entry) => (entry.id === id ? track : entry));
      }
      this.replaceSummary(project);
      this.report('Project saved');
    } catch (error) {
      this.report(`Project not saved: ${error.message}`, true);
    }
    this.render();
  }

  async create({name, bpm}) {
    const project = await this.api.createProject({name, bpm});
    this.projects.unshift({...project, trackCount: 0});
    await this.open(project.id, {confirm: false});
    return project;
  }

  async destroy() {
    const {project} = this;
    const confirmed = await confirmDialog({title: 'Delete project?', confirmLabel: 'Delete',
      message: `“${project.name}”, its ${plural(project.tracks.length, 'track')} and their audio files will be deleted.`});
    if (!confirmed) return;
    try {
      await this.api.deleteProject(project.id);
      this.report(`“${project.name}” deleted`);
      await this.load();
    } catch (error) {
      this.report(`Project not deleted: ${error.message}`, true);
    }
  }

  // Added and deleted tracks are saved at once; the saved copy follows, so
  // other unsaved edits stay unsaved.
  async addTrack({name, instrument, file}) {
    const {project} = this;
    const track = await this.api.createTrack(project.id, {name, instrument}, file);
    project.tracks = [...project.tracks, track];
    this.saved.tracks = [...this.saved.tracks, structuredClone(track)];
    this.selectedId = track.id;
    this.replaceSummary(project);
    this.render();
    return track;
  }

  async deleteTrack(id) {
    const track = this.project.tracks.find((entry) => entry.id === id);
    const confirmed = await confirmDialog({title: 'Delete track?', confirmLabel: 'Delete',
      message: `“${track.name}”${track.audio ? ` and its audio file ${track.audio.filename}` : ''} will be deleted.`});
    if (!confirmed) return;
    try {
      await this.api.deleteTrack(this.project.id, id);
      this.project.tracks = this.project.tracks.filter((entry) => entry.id !== id);
      this.saved.tracks = this.saved.tracks.filter((entry) => entry.id !== id);
      if (this.selectedId === id) this.selectedId = this.project.tracks[0]?.id ?? null;
      this.replaceSummary(this.project);
      this.report(`“${track.name}” deleted`);
    } catch (error) {
      this.report(`Track not deleted: ${error.message}`, true);
    }
    this.render();
  }

  editPresetInTone() {
    const value = presetValue(this.selectedTrack ?? {});
    if (value) this.onEditPreset(value.startsWith('account:') ? value.slice(8) : value);
  }

  // Dialogs ------------------------------------------------------------------

  async createProjectDialog() {
    if (!(await this.ensureSignedIn())) return;
    const values = await projectDialog({title: 'Create a project', confirmLabel: 'Create project',
      intro: 'A new project starts empty: add tracks from audio files.'});
    if (!values) return;
    try {
      await this.create(values);
      this.report(`“${values.name}” created`);
    } catch (error) {
      this.report(`Project not created: ${error.message}`, true);
    }
  }

  async editProjectDialog() {
    if (!this.owned) return;
    const values = await projectDialog({title: 'Edit project', confirmLabel: 'Apply', name: this.project.name, bpm: this.project.bpm,
      intro: 'Update the project name and tempo, then save the project.', onDelete: () => this.destroy()});
    if (values) this.edit(values);
  }

  async importAudioDialog() {
    if (!(await this.ensureSignedIn())) return;
    const values = await trackDialog({title: 'Import audio as a project', confirmLabel: 'Import project', fileRequired: true,
      nameLabel: 'Project name', intro: 'The file is uploaded to your account and becomes the first track of a new project.'});
    if (!values) return;
    const {file, instrument} = values;
    const name = values.name || nameFromFile(file.name);
    this.report(`Uploading ${file.name}…`);
    try {
      const project = await this.api.createProject({name, bpm: BPM_RANGE.default});
      this.projects.unshift({...project, trackCount: 0});
      try {
        await this.api.createTrack(project.id, {name: nameFromFile(file.name), instrument}, file);
      } catch (error) {
        this.report(`“${name}” was created, but the audio was not uploaded: ${error.message}`, true);
      }
      await this.open(project.id, {confirm: false});
      this.replaceSummary(this.project);
      this.report(`“${name}” imported`);
    } catch (error) {
      this.report(`Audio not imported: ${error.message}`, true);
    }
  }

  async addTrackDialog() {
    if (!this.owned) return;
    const values = await trackDialog({title: 'Add a track', confirmLabel: 'Add track', eyebrow: this.project.name,
      nameLabel: 'Track name', defaultName: (instrument) => defaultTrackName(instrument, this.project.tracks),
      intro: 'Choose the instrument and the audio file of this part. The file can also be added later.'});
    if (!values) return;
    if (values.file) this.report(`Uploading ${values.file.name}…`);
    try {
      const track = await this.addTrack({...values, name: values.name || defaultTrackName(values.instrument, this.project.tracks)});
      this.report(`${track.name} added`);
    } catch (error) {
      this.report(`Track not added: ${error.message}`, true);
    }
  }

  async editTrackDialog(id) {
    const track = this.project.tracks.find((entry) => entry.id === id);
    if (!track || !this.owned) return;
    const values = await editTrackDialog({track, eyebrow: this.project.name, onDelete: () => this.deleteTrack(id)});
    if (values) this.setTracks(this.project.tracks.map((entry) => (entry.id === id ? withInstrument({...entry, name: values.name}, values.instrument) : entry)));
  }

  // Read-only shares, saved at once: add by account email, remove per person.
  async shareDialog() {
    if (!this.owned) return;
    const {project} = this;
    project.shares ??= [];
    const {dialog, body, id} = createDialog({title: 'Share project', eyebrow: project.name, className: 'project-dialog share-dialog'});
    const form = element('form', {className: 'share-add'});
    const email = element('input', {id: `${id}-email`, type: 'email', required: true, placeholder: 'name@example.com', autocomplete: 'off'});
    const submit = button('Share', {type: 'submit', primary: true});
    const row = element('div', {className: 'share-add-row'});
    row.append(email, submit);
    const error = element('p', {className: 'share-error', role: 'alert', hidden: true});
    form.append(element('label', {htmlFor: email.id, textContent: 'Email of their account'}), row, error);
    const heading = element('h3', {className: 'share-list-title'});
    const list = element('ul', {className: 'share-list'});
    const empty = element('p', {className: 'host-help', textContent: 'Only you can open this project.'});
    const done = button('Done', {value: 'done'});
    done.onclick = () => dialog.close();
    const changed = () => {
      this.replaceSummary(project);
      this.renderHeader();
      renderList();
    };
    const renderList = () => {
      heading.textContent = `People with access · ${twoDigits(project.shares.length)}`;
      empty.hidden = project.shares.length > 0;
      list.replaceChildren(...project.shares.map((share) => {
        const item = element('li', {className: 'share-person'});
        const who = share.name || share.email;
        const text = element('span', {className: 'share-person-text'});
        text.append(element('strong', {textContent: who}));
        if (who !== share.email) text.append(element('small', {textContent: share.email}));
        const role = document.createElement('tl-badge');
        role.setAttribute('variant', 'eyebrow');
        role.textContent = 'Read-only';
        const remove = document.createElement('tl-icon-button');
        Object.entries({icon: 'close', size: 'sm', variant: 'ghost', 'aria-label': `Stop sharing with ${who}`, title: 'Stop sharing'})
          .forEach(([key, value]) => remove.setAttribute(key, value));
        remove.onclick = async () => {
          remove.setAttribute('disabled', '');
          try {
            await this.api.unshareProject(project.id, share.id);
            project.shares = project.shares.filter((entry) => entry.id !== share.id);
            this.report(`${who} no longer has access to “${project.name}”`);
            changed();
          } catch (failure) {
            remove.removeAttribute('disabled');
            this.report(`Access not removed: ${failure.message}`, true);
          }
        };
        item.append(element('span', {className: 'share-avatar', textContent: initials(who), ariaHidden: 'true'}), text, role, remove);
        return item;
      }));
    };
    form.onsubmit = async (event) => {
      event.preventDefault();
      error.hidden = true;
      submit.disabled = true;
      try {
        const share = await this.api.shareProject(project.id, email.value.trim());
        project.shares = [...project.shares, share];
        this.report(`“${project.name}” shared with ${share.name || share.email}`);
        email.value = '';
        changed();
      } catch (failure) {
        error.textContent = failure.message;
        error.hidden = false;
      } finally {
        submit.disabled = false;
        email.focus();
      }
    };
    body.append(element('p', {textContent: 'People you share with can open this project, play it and try their own mix, but cannot change it.'}),
      form, heading, list, empty, actionsRow(done));
    renderList();
    dialog.showModal();
    email.focus();
    await new Promise((resolve) => dialog.addEventListener('close', resolve, {once: true}));
  }

  async ensureSignedIn() {
    if (!this.available) {
      this.report('Projects are available on the online rack, with an account.', true);
      return false;
    }
    if (this.signedIn) return true;
    await this.requestSignIn();
    return this.signedIn;
  }

  // Rendering ----------------------------------------------------------------

  render() {
    this.renderPicker();
    this.renderHeader();
    this.renderEmpty();
    this.renderTracks();
    this.renderInspector();
    this.syncPlayer();
  }

  // The player follows the open project's tracks and mix; lanes wait for their audio.
  syncPlayer() {
    const tracks = this.project?.tracks ?? [];
    for (const id of [...this.timeline.waves.keys()]) if (!tracks.some((track) => track.id === id)) this.timeline.setWave(id, null);
    for (const track of tracks) if (track.audio && !this.timeline.waves.has(track.id)) this.timeline.setWave(track.id, {state: 'loading'});
    this.player?.setTracks(tracks);
    this.tones?.setTracks(tracks, this.project?.id);
    this.renderLength();
    this.renderTransport();
  }

  renderLength() {
    if (this.project) this.timeline.setLength(timelineLength(this.player?.duration ?? 0, this.project.bpm));
  }

  renderTransport() {
    const {player} = this;
    const playing = Boolean(player?.playing);
    const play = this.$('projectPlay');
    play.disabled = !player?.duration;
    play.setAttribute('icon', playing ? 'pause' : 'play');
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    play.setAttribute('aria-pressed', String(playing));
    play.title = playing ? 'Pause' : 'Play';
    this.$('projectRewind').disabled = !player?.duration;
    this.renderPosition();
    if (playing && !this.frame) {
      const tick = () => {
        this.renderPosition();
        this.frame = this.player.playing ? requestAnimationFrame(tick) : null;
      };
      this.frame = requestAnimationFrame(tick);
    }
  }

  renderPosition() {
    const seconds = this.player?.position ?? 0;
    this.$('projectClock').textContent = formatClock(seconds);
    this.$('projectBarBeat').textContent = barBeat(seconds, this.project?.bpm ?? BPM_RANGE.default);
    this.timeline.setPosition(seconds);
  }

  renderPicker() {
    const select = this.$('projectSelect');
    const {mine, shared} = groupProjects(this.projects);
    const group = (label, projects) => {
      const optgroup = element('optgroup', {label});
      optgroup.append(...projects.map((project) => new Option(projectOptionLabel(project), project.id)));
      return optgroup;
    };
    select.replaceChildren(...[mine.length && group('My projects', mine), shared.length && group('Shared with me', shared)].filter(Boolean));
    if (!this.projects.length) select.append(new Option(this.signedIn ? 'No projects yet' : 'Sign in to see your projects', ''));
    select.value = this.project ? String(this.project.id) : '';
    select.disabled = !this.projects.length;
    this.$('projectCount').textContent = this.projects.length ? twoDigits(this.projects.length) : '';
    this.$('projectTrackCount').textContent = twoDigits(this.project?.tracks.length ?? 0);
    this.$('projectBpm').textContent = this.project ? String(this.project.bpm) : '—';
    this.$('projectNew').disabled = !this.available;
    this.$('projectImport').disabled = !this.available;
  }

  renderHeader() {
    const {dirty, owned} = this;
    const description = describeProject(this.project, {dirty});
    this.$('projectKicker').textContent = description?.kicker ?? 'Projects';
    this.$('projectTitle').textContent = this.project?.name ?? 'Projects';
    this.$('projectMeta').textContent = description?.meta ?? 'Record and mix your ideas track by track.';
    this.$('projectEdit').hidden = !owned;
    const state = this.$('projectSaveState');
    state.hidden = !this.project;
    state.textContent = description?.saveState ?? '';
    state.setAttribute('tone', dirty ? 'warning' : owned ? 'success' : 'neutral');
    this.$('projectShare').hidden = !owned;
    // A shared viewer's mix is never saved: it can go back to the owner's.
    this.$('projectResetMix').hidden = owned || !this.project || !trackChanges(this.saved?.tracks, this.project.tracks).length;
    this.$('projectShare').title = shareSummary(this.project?.shares) || 'Share this project read-only';
    this.$('projectSave').hidden = !owned;
    this.$('projectSave').disabled = !dirty;
    this.$('projectAddTrack').hidden = !owned;
    this.$('projectTrackCount').textContent = twoDigits(this.project?.tracks.length ?? 0);
  }

  renderEmpty() {
    const empty = this.$('projectsEmpty');
    empty.hidden = Boolean(this.project);
    this.$('projectTimeline').hidden = !this.project;
    if (this.project) return;
    const [title, text, action, run] = !this.available
      ? ['Projects live on the online rack', 'Sign in on the online rack to keep projects and their audio in your account.', null]
      : !this.signedIn
        ? ['Sign in to use projects', 'Projects and their audio are kept in your account, and can be shared read-only with other users.',
          'Sign in', () => this.requestSignIn()]
        : ['Create your first project', 'Start an empty project, or import an audio file as its first track.',
          'New project', () => this.createProjectDialog()];
    this.$('projectsEmptyTitle').textContent = title;
    this.$('projectsEmptyText').textContent = text;
    const action$ = this.$('projectsEmptyAction');
    action$.hidden = !action;
    action$.textContent = action ?? '';
    this.emptyAction = run;
  }

  renderTracks() {
    const tracks = this.project?.tracks ?? [];
    this.timeline.render(tracks, {selectedId: this.selectedId, editable: this.owned, presetName: (track) => this.toneLabel(track)});
    this.$('projectTimelineTempo').textContent = this.project ? `${this.project.bpm} BPM · 4/4` : '';
    this.$('projectTracksEmpty').hidden = tracks.length > 0;
    this.$('projectTracksEmpty').textContent = this.owned ? 'No tracks yet: add one from an audio file.' : 'This project has no tracks yet.';
  }

  renderInspector() {
    const track = this.selectedTrack;
    this.$('trackInspector').hidden = !track;
    if (!track) return;
    const index = this.project.tracks.indexOf(track);
    this.$('inspectorTrackName').textContent = track.name;
    this.$('inspectorTrackNumber').textContent = `Track ${twoDigits(index + 1)}`;
    this.$('inspectorTrackMeta').textContent = [instrumentLabel(track.instrument), track.audio?.filename ?? 'No audio file'].join(' · ');
    const tone = usesPreset(track.instrument);
    this.$('inspectorPresetField').hidden = !tone;
    this.$('inspectorEditPreset').hidden = !tone || !this.owned;
    this.$('inspectorEditPreset').disabled = !presetValue(track);
    this.$('inspectorPresetHelp').textContent = !tone ? 'Tone presets apply to guitar and bass tracks.'
      : this.toneHelp(track);
    if (tone) this.renderPresetSelect(track);
  }

  renderPresetSelect(track) {
    const select = this.$('inspectorPreset');
    const value = presetValue(track);
    const group = (label, options) => {
      const optgroup = element('optgroup', {label});
      optgroup.append(...options);
      return optgroup;
    };
    const options = [new Option('No preset', '')];
    if (this.owned) {
      options.push(group('Factory', FACTORY_PRESETS.map((preset) => new Option(`${preset.name} · ${preset.category}`, preset.id))));
      if (this.presets.length) options.push(group('My presets', this.presets.map((preset) => new Option(preset.name, `account:${preset.id}`))));
    } else if (value) {
      options.push(new Option(this.presetName(track), value));
    }
    select.replaceChildren(...options);
    select.value = value;
    select.disabled = !this.owned;
  }

  // The row's preset, with the state of its rack.
  toneLabel(track) {
    const name = this.presetName(track);
    const state = name && this.tones?.status(track.id)?.state;
    return state === 'loading' ? `${name} (loading…)` : state === 'error' ? `${name} (not loaded)` : name;
  }

  toneHelp(track) {
    if (!presetValue(track)) return 'Without a preset, the track plays its recorded audio as is.';
    if (this.tones?.status(track.id)?.state === 'error') return 'This preset could not be loaded: the track plays dry.';
    if (track.inputMonitoring) return 'Input monitoring: your live guitar plays through this preset, in place of the recording.';
    return this.owned ? 'The recorded DI plays through this preset.' : 'Preset chosen by the project owner; the DI plays through it.';
  }

  presetName(track) {
    if (track.factoryPreset) return FACTORY_PRESETS.find((preset) => preset.id === track.factoryPreset)?.name ?? track.factoryPreset;
    if (track.presetId) return this.presets.find((preset) => preset.id === track.presetId)?.name ?? track.presetName ?? 'Account preset';
    return '';
  }

  // Helpers ------------------------------------------------------------------

  replaceSummary(project) {
    const index = this.projects.findIndex((entry) => entry.id === project.id);
    if (index >= 0) this.projects[index] = {...this.projects[index], name: this.saved?.name ?? project.name, bpm: this.saved?.bpm ?? project.bpm,
      trackCount: project.tracks?.length ?? this.projects[index].trackCount};
  }

  remembered() {
    try { return this.storage?.getItem(LAST_PROJECT_KEY) ?? null; } catch { return null; }
  }

  remember(id) {
    try { this.storage?.setItem(LAST_PROJECT_KEY, String(id)); } catch { /* Not remembered. */ }
  }
}

const field = (labelText, control) => [element('label', {htmlFor: control.id, textContent: labelText}), control];

function instrumentSelect(id, value = 'guitar') {
  const select = element('select', {id});
  select.append(...INSTRUMENTS.map(({id: instrument, label}) => new Option(label, instrument)));
  select.value = value;
  const wrapper = document.createElement('tl-select');
  wrapper.append(select);
  wrapper.id = `${id}-wrapper`;
  return {select, wrapper};
}

function formActions(dialog, confirmLabel, onDelete, deleteLabel) {
  const cancel = button('Cancel', {value: 'cancel'});
  cancel.onclick = () => dialog.close('cancel');
  const actions = actionsRow(cancel, button(confirmLabel, {type: 'submit', primary: true, value: 'ok'}));
  if (onDelete) {
    const remove = button(deleteLabel);
    remove.classList.add('tl-btn-danger', 'project-dialog-delete');
    remove.onclick = () => { dialog.close('cancel'); onDelete(); };
    actions.prepend(remove);
  }
  return actions;
}

// Name + tempo. Resolves {name, bpm}, or null when cancelled.
function projectDialog({title, confirmLabel, intro, name = '', bpm = BPM_RANGE.default, onDelete = null}) {
  return new Promise((resolve) => {
    const {dialog, body, id} = createDialog({title, eyebrow: 'Projects', className: 'project-dialog'});
    const form = element('form', {method: 'dialog'});
    const nameInput = element('input', {id: `${id}-name`, required: true, maxLength: 120, value: name, placeholder: 'e.g. Late night ideas',
      autocomplete: 'off'});
    const bpmInput = element('input', {id: `${id}-bpm`, type: 'number', required: true, min: BPM_RANGE.min, max: BPM_RANGE.max, step: 1, value: bpm});
    const tempo = element('div', {className: 'project-bpm-field'});
    tempo.append(bpmInput, element('strong', {textContent: 'BPM'}));
    const [tempoLabel] = field('Tempo', bpmInput);
    form.append(element('p', {textContent: intro}), ...field('Project name', nameInput), tempoLabel, tempo,
      formActions(dialog, confirmLabel, onDelete, 'Delete project'));
    body.append(form);
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok' && nameInput.value.trim()
      ? {name: nameInput.value.trim(), bpm: clampBpm(bpmInput.value)} : null), {once: true});
    dialog.showModal();
    nameInput.select();
  });
}

// Audio file + name + instrument (Import audio, Add track). Resolves
// {file, name, instrument} (file may be null unless fileRequired), or null.
function trackDialog({title, confirmLabel, intro, nameLabel, eyebrow = 'Projects', fileRequired = false, defaultName = null}) {
  return new Promise((resolve) => {
    const {dialog, body, id} = createDialog({title, eyebrow, className: 'project-dialog'});
    const form = element('form', {method: 'dialog'});
    const fileInput = element('input', {id: `${id}-file`, type: 'file', accept: AUDIO_ACCEPT, required: fileRequired});
    const drop = element('label', {className: 'audio-upload-field', htmlFor: fileInput.id});
    const formats = `MP3, WAV, M4A, AIFF, OGG or FLAC · up to 100 MB${fileRequired ? '' : ' · optional'}`;
    const fileName = element('strong', {textContent: 'Choose an audio file'});
    const fileMeta = element('small', {textContent: formats});
    const icon = document.createElement('tl-icon');
    icon.setAttribute('name', 'audio');
    icon.setAttribute('size', '22');
    const text = document.createElement('span');
    text.append(fileName, fileMeta);
    drop.append(fileInput, icon, text);
    const nameInput = element('input', {id: `${id}-name`, maxLength: defaultName ? 80 : 120, autocomplete: 'off'});
    const {select: instrument, wrapper} = instrumentSelect(`${id}-instrument`);
    const placeholder = () => {
      const file = fileInput.files[0];
      nameInput.placeholder = defaultName ? defaultName(instrument.value) : file ? nameFromFile(file.name) : 'Uses the file name by default';
    };
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      fileName.textContent = file?.name ?? 'Choose an audio file';
      fileMeta.textContent = file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : formats;
      placeholder();
    };
    instrument.onchange = placeholder;
    placeholder();
    const [instrumentLabel$] = field('Instrument', instrument);
    form.append(element('p', {textContent: intro}), drop, ...field(nameLabel, nameInput), instrumentLabel$, wrapper,
      formActions(dialog, confirmLabel));
    body.append(form);
    dialog.addEventListener('close', () => {
      const file = fileInput.files[0] ?? null;
      resolve(dialog.returnValue === 'ok' && (file || !fileRequired) ? {file, name: nameInput.value.trim(), instrument: instrument.value} : null);
    }, {once: true});
    dialog.showModal();
  });
}

// Rename + instrument of an existing track. Resolves {name, instrument}, or null.
function editTrackDialog({track, eyebrow, onDelete}) {
  return new Promise((resolve) => {
    const {dialog, body, id} = createDialog({title: 'Edit track', eyebrow, className: 'project-dialog'});
    const form = element('form', {method: 'dialog'});
    const nameInput = element('input', {id: `${id}-name`, required: true, maxLength: 80, value: track.name, placeholder: 'e.g. Chorus rhythm',
      autocomplete: 'off'});
    const {select: instrument, wrapper} = instrumentSelect(`${id}-instrument`, track.instrument);
    const [instrumentLabel$] = field('Instrument', instrument);
    const note = element('p', {className: 'host-help', textContent: 'Only guitar and bass tracks play through a tone preset.'});
    form.append(element('p', {textContent: 'Choose a clear name for this part in your arrangement.'}), ...field('Track name', nameInput),
      instrumentLabel$, wrapper, note, formActions(dialog, 'Apply', onDelete, 'Delete track'));
    body.append(form);
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok' && nameInput.value.trim()
      ? {name: nameInput.value.trim(), instrument: instrument.value} : null), {once: true});
    dialog.showModal();
    nameInput.select();
  });
}
