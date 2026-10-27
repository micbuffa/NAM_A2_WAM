import {StudioHistory, editState, editCommand, historyShortcut} from './StudioHistory.js';
import {audioImportDialog, importDestinationFields} from './AudioImportDialog.js';
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
import {AudioImportWatcher, importActive} from './AudioImportWatcher.js';
import {StudioMixExporter, exportRange, mixExportAvailability} from './StudioMixExporter.js';
import {SeparationPersistence} from './SeparationPersistence.js';
import {StudioSeparationView} from './StudioSeparationView.js';
import {ProjectTimeline} from './ProjectTimeline.js';
import {AUDIO_ACCEPT, BPM_RANGE, INSTRUMENTS, barBeat, clampBpm, defaultTrackName, describeProject, formatClock, groupProjects, projectTrackCount, timelineTracks,
  initials, instrumentLabel, originLabel, liveTrackId, loopAround, loopFromBars, loopLabel, loopToBars, moveTrack, rememberLoop, rememberedLoop, nameFromFile, orderChanged, shareSummary, plural, presetFields, presetValue, projectOptionLabel, timelineLength, toggleMonitoring,
  trackChanges, twoDigits, usesTrackPreset, withInstrument} from './ProjectsModel.js';

const LAST_PROJECT_KEY = 'nam-a2-wam.project';
const LOOPS_KEY = 'nam-a2-wam.project-loops'; // each project's loop, in bars (this browser only)

// The shared-project email links to the rack with ?project=<id>: that project
// becomes the one to open (after signing in too) and the URL drops the
// parameter. Returns whether there was one.
export function takeLinkedProject({location = globalThis.location, history = globalThis.history, storage = globalThis.localStorage} = {}) {
  const url = new URL(location.href);
  const id = url.searchParams.get('project');
  if (!id) return false;
  try { storage?.setItem(LAST_PROJECT_KEY, id); } catch { /* Opens the last project instead. */ }
  url.searchParams.delete('project');
  history.replaceState(history.state, '', url);
  return true;
}
// The saved tracks, in the order of the current ones.
const moveAll = (saved, current) => current.map((track) => saved.find((entry) => entry.id === track.id)).filter(Boolean);

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
    this.history = new StudioHistory({changed: () => this.renderHistory()});
    this.isMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');
    this.$('projectUndo').onclick = () => this.runHistory(false);
    this.$('projectRedo').onclick = () => this.runHistory(true);
    root.addEventListener?.('keydown', event => {
      const action = historyShortcut(event, {mac: this.isMac, visible: Boolean(this.$('projectTimeline').offsetParent), blocked: this.historyBlocked});
      if (!action || !this.history[action === 'undo' ? 'undoLabel' : 'redoLabel']) return;
      event.preventDefault(); void this.runHistory(action === 'redo');
    });
    this.timeline = new ProjectTimeline(this.$('projectTracks'), {
      root: this.$('projectTimeline'), ruler: this.$('projectRuler'), createRenderer,
      onSeek: (seconds) => this.player?.seek(seconds),
      onLoop: (region) => this.setLoop({enabled: true, ...region}),
      onSelect: (id) => this.select(id),
      onChange: (id, fields) => this.updateTrack(id, fields),
      onEdit: (id) => this.editTrackDialog(id),
      onDelete: (id) => this.deleteTrack(id),
      onGestureStart: key => { if (this.historyGesture?.key !== key) this.historyGesture = {key}; },
      onGestureEnd: () => { this.historyGesture = null; },
      onMove: (id, index) => {
        this.selectedId = id;
        const visible=moveTrack(this.displayTracks,id,index), order=[...this.project.tracks];
        let next=0;
        this.setTracks(order.map(track=>visible.some(entry=>entry.id===track.id)?visible[next++]:track), {label: 'Reorder track'});
      },
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
    this.mixExporter = new StudioMixExporter({api});
    if (this.$('studioUseMix')) this.$('studioUseMix').onclick = () => this.useMixInTone();
    if (this.$('studioRetryAudio')) this.$('studioRetryAudio').onclick = () => {
      for (const track of this.displayTracks) if (this.player?.channels.get(track.id)?.error) this.timeline.setWave(track.id,{state:'loading'});
      void this.player?.retryFailed();
    };
    this.$('projectShare').onclick = () => this.shareDialog();
    this.$('projectLeave').onclick = () => this.leave();
    this.$('projectResetMix').onclick = () => this.setTracks(structuredClone(this.saved.tracks));
    this.$('projectAddTrack').onclick = () => { this.separation?.show('original'); return this.addTrackDialog(); };
    this.$('projectsEmptyAction').onclick = () => this.emptyAction?.();
    this.$('inspectorPreset').onchange = (event) => this.updateTrack(this.selectedId, presetFields(event.target.value));
    this.$('inspectorEditPreset').onclick = () => this.editPresetInTone();
    this.$('projectPlay').onclick = () => (this.player?.playing ? this.player.pause() : this.player?.play());
    this.$('projectRewind').onclick = () => this.player?.stop();
    this.$('projectLoop').onclick = () => this.toggleLoop();
    this.$('projectLoopReset').onclick = () => this.player?.duration && this.setLoop({enabled: false, start: 0, end: 0});
    // L toggles the loop while the timeline is shown, unless typing in a field.
    root.addEventListener?.('keydown', (event) => {
      if (event.key.toLowerCase() !== 'l' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable]') || !this.$('projectTimeline').offsetParent) return;
      event.preventDefault();
      this.toggleLoop();
    });
    player?.addEventListener('statechange', () => this.renderTransport());
    player?.addEventListener('load', ({detail: {id, buffer}}) => {
      const stored = this.project?.tracks.find(track => track.id === id)?.waveform;
      this.timeline.setWave(id, {peaks: stored ? Float32Array.from(stored.peaks) : buildWaveformPeaks([buffer], buffer.length), duration: buffer.duration});
      this.renderLength();
    });
    player?.addEventListener('error', ({detail: {id, error}}) => {
      this.timeline.setWave(id, {state: 'error'});
      const track = this.project?.tracks.find((entry) => entry.id === id);
      this.report(`${track?.audio?.filename ?? 'Audio'} not loaded: ${error.message}`, true);
    });
    if (player && this.$('studioSeparation')) {
      this.separationView = new StudioSeparationView(this);
      this.separation = this.separationView.controller;
      this.persistence = new SeparationPersistence({api});
    }
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
      this.history?.clear();
      const unset = (tracks) => tracks.map((track) => (track.presetId === id ? {...track, presetId: null, presetName: null} : track));
      this.saved.tracks = unset(this.saved.tracks);
      if (this.project.tracks.some((track) => track.presetId === id)) this.setTracks(unset(this.project.tracks), {label: null});
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
  get displayTracks() { return this.separation?.viewTracks ?? timelineTracks(this.project); }
  get pendingSeparation() { return Boolean(this.owned && this.separation?.result?.engine.complete && this.separation.result.engine.availableFrames); }
  get selectedTrack() { return this.displayTracks.find((track) => track.id === this.selectedId) ?? null; }

  // Unsaved edits of an owned project.
  get dirty() {
    if (!this.owned || !this.saved) return false;
    return this.project.name !== this.saved.name || this.project.bpm !== this.saved.bpm
      || orderChanged(this.saved.tracks, this.project.tracks) || trackChanges(this.saved.tracks, this.project.tracks).length > 0;
  }

  async load() {
    this.accountLoadEpoch=(this.accountLoadEpoch??0)+1;
    this.saving = false;
    this.history?.clear();
    this.audioImportDialog?.close();
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

  async open(id, {confirm = true, historyLabel = null} = {}) {
    if (this.saving) return this.renderPicker();
    if (confirm && this.dirty && String(id) !== String(this.project?.id)) {
      const discard = await confirmDialog({title: 'Discard unsaved changes?', message: `“${this.project.name}” has unsaved changes.`,
        confirmLabel: 'Discard'});
      if (!discard) return this.render();
    }
    if (confirm && String(id) !== String(this.project?.id) && !await this.confirmPreviewDiscard()) return this.render();
    try {
      const epoch=this.accountLoadEpoch,accountId=this.account?.user?.id;
      const project=await this.api.getProject(id);
      if(epoch!==this.accountLoadEpoch || accountId!==this.account?.user?.id)return;
      this.setProject(project, {historyLabel});
      this.remember(id);
    } catch (error) {
      this.report(`Project not opened: ${error.message}`, true);
    }
    this.render();
    this.dispatchEvent(new CustomEvent('change', {detail: {project: this.project}}));
  }

  async confirmSavedMixDiscard() {
    if (!this.dirty) return true;
    const project = this.project, epoch = this.accountLoadEpoch;
    const discard = await confirmDialog({title:'Discard unsaved mix?', message:'Save project first to keep your mixer changes.',confirmLabel:'Discard changes'});
    if (this.project !== project || this.accountLoadEpoch !== epoch) return false;
    if (discard) this.history?.clear();
    return discard;
  }

  async confirmPreviewDiscard() {
    if (this.saving) return false;
    if (!this.separation?.result && !this.separation?.busy) return true;
    return confirmDialog({title: 'Leave instrument preview?', confirmLabel: 'Continue', message: 'This stops the separation and discards its temporary preview, which is only in RAM. Your saved project and original audio are preserved.'});
  }

  setProject(project, {historyLabel = null, preserveHistory = false} = {}) {
    const beforeLayout = historyLabel && this.history && project?.id === this.project?.id ? this.layoutState() : null;
    if (!beforeLayout && !preserveHistory) this.history?.clear();
    this.historyGesture = null;
    if (project?.id !== this.project?.id) {
      this.mixExporter?.invalidate();
      if (this.$?.('studioExportRange')) this.$('studioExportRange').value='song';
      this.separation?.stop({reset: true});
      this.player?.stop();
      this.player?.setLoop(loopFromBars(project && rememberedLoop(this.loops(), project.id), project?.bpm));
    }
    this.project = project;
    this.saved = project && structuredClone(project);
    if (beforeLayout) this.rememberLayout(beforeLayout, historyLabel);
    this.separation?.restore(project);
    if (!project?.tracks.some((track) => track.id === this.selectedId)) this.selectedId = project?.tracks[0]?.id ?? null;
  }

  // Local edit of the open project (name, bpm): saved by save().
  edit(attributes) {
    if (this.saving || this.history?.busy) return;
    const before = this.historyState();
    const bars = loopToBars(this.player?.loop, this.project.bpm);
    Object.assign(this.project, attributes);
    // The loop keeps its bars at the new tempo.
    if (this.player && this.player.loop.end > this.player.loop.start) this.player.setLoop(loopFromBars(bars, this.project.bpm));
    this.rememberEdit(before, 'Edit project');
    this.render();
  }

  // The live guitar follows the selection (liveTrackId()).
  select(id) {
    if (id === this.selectedId || this.saving) return;
    this.selectedId = id;
    for (const track of this.displayTracks) this.timeline.update(track, track.id === id);
    this.syncPlayer();
    this.renderInspector();
  }

  // Local edit of a track; the row is updated in place (a fader keeps its drag).
  updateTrack(id, fields) {
    if (this.saving || this.history?.busy) return;
    if (this.separation?.updateTrack(id, fields)) {
      this.timeline.update(this.separation.result.tracks.find(track => track.id === id), id === this.selectedId);
      this.renderInspector();
      return;
    }
    const track = this.project.tracks.find(entry => entry.id === id);
    const field = Object.keys(fields)[0];
    const verb = {volume: 'Volume', pan: 'Pan', mute: 'Mute', solo: 'Solo', presetId: 'Preset', factoryPreset: 'Preset'}[field] ?? 'Edit';
    this.setTracks(this.project.tracks.map((track) => (track.id === id ? {...track, ...fields} : track)), {label: `${verb} ${track?.name ?? 'track'}`});
  }

  setTracks(tracks, {label = 'Edit tracks'} = {}) {
    if (this.saving || this.history?.busy) return;
    const before = this.historyState();
    this.project.tracks = tracks;
    if (this.separation) this.separation.projectTracks = tracks;
    if (this.separation?.savedTracks) this.separation.savedTracks.splice(0, this.separation.savedTracks.length, ...timelineTracks(this.project));
    this.rememberEdit(before, label);
    this.timeline.order(this.displayTracks);
    for (const track of tracks) this.timeline.update(track, track.id === this.selectedId);
    this.syncPlayer();
    this.renderHeader();
    this.renderInspector();
    this.dispatchEvent(new CustomEvent('tracks', {detail: {tracks}}));
  }

  async save() {
    if (this.saving || (!this.dirty && !this.pendingSeparation)) return;
    this.saving = true;
    this.render();
    try {
      const {project, saved} = this;
      if (project.name !== saved.name || project.bpm !== saved.bpm) {
        Object.assign(saved, await this.api.updateProject(project.id, {name: project.name, bpm: project.bpm}), {tracks: saved.tracks});
      }
      if (orderChanged(saved.tracks, project.tracks)) {
        await this.api.reorderTracks(project.id, project.tracks.map((track) => track.id));
        saved.tracks = moveAll(saved.tracks, project.tracks);
      }
      for (const {id, changes} of trackChanges(saved.tracks, project.tracks)) {
        const track = await this.api.updateTrack(project.id, id, changes);
        saved.tracks = saved.tracks.map((entry) => (entry.id === id ? track : entry));
      }
      if (this.pendingSeparation) {
        const c = this.separation, result = c.result;
        const full = await this.persistence.save(result, c.models.find(model => model.id === result.modelId), c.effectiveBackend ?? c.backend,
          ({index,total,role,phase}) => c.setStatus(`Saving instruments · ${index+1}/${total} · ${role} · ${phase}`, index/total*100));
        // Sign-out/account changes can occur while an upload is in flight.
        // Never reopen the previous account's project from a late response.
        if (this.project !== project) throw Error('Project changed during saving; reopen it to check the saved result.');
        c.stop({reset:true});
        this.setProject(full, {historyLabel: 'Separate instruments'});
      }
      this.replaceSummary(this.project);
      this.report('Project and audio saved');
    } catch (error) {
      this.separation?.setStatus(`Save interrupted: ${error.message}. Instruments remain in RAM; use Save project to retry.`);
      this.report(`Project not saved: ${error.message}`, true);
    }
    this.saving = false;
    this.render();
  }

  async useMixInTone() {
    if (!this.owned || this.saving || this.pendingSeparation || this.separation?.busy) return;
    if (this.dirty) { await this.save(); if (this.dirty) return; }
    const project = this.project;
    this.saving = true; this.render();
    try {
      const range = exportRange(this.player.duration, this.player.loop, this.$('studioExportRange').value);
      const entry = await this.mixExporter.export({project,tracks:this.displayTracks,channels:this.player.channels,range,
        separationId:null, selection:this.$('studioExportRange').value},
        (status,progress=null)=>this.separation?.setStatus(status,progress));
      if (this.project !== project) throw Error('Project changed during export. Reopen its backing from the library.');
      const full = await this.api.getProject(project.id);
      if (this.project !== project) throw Error('Project changed during export.');
      this.setProject(full, {preserveHistory: true});this.replaceSummary(full);
      await this.onUseMix?.(entry);
      this.report(`Backing track saved${entry.manifest.attenuation<1 ? ' · level reduced to prevent clipping' : ''}`);
    } catch(error) {
      this.separation?.setStatus(`Mix export stopped: ${error.message}`);
      this.report(error.message,true);
    } finally { this.saving = false; this.render(); }
  }

  chooseImportDestination(options = {}) {
    return audioImportDialog({project:this.project,...options});
  }

  async importFromTone(track, file = null, {destination = null} = {}) {
    if (this.importingTone || this.saving || !await this.ensureSignedIn() || !await this.confirmSavedMixDiscard() || !await this.confirmPreviewDiscard()) return false;
    if (this.importingTone) return false;
    this.importingTone = true;
    const epoch=this.accountLoadEpoch, accountId=this.account?.user?.id;
    try {
      if (!destination) {
        const selection = await this.chooseImportDestination({name:track.title});
        if (!selection) return false;
        destination = selection.destination;
      }
      if(epoch!==this.accountLoadEpoch || accountId!==this.account?.user?.id)return false;
      this.separation?.stop({reset:true});
      const project = await this.api.importBacking({...destination, ...(file ? {title:track.title} : {id:track.id})}, file);
      if(epoch!==this.accountLoadEpoch || accountId!==this.account?.user?.id)return false;
      if (!this.projects.some(entry=>entry.id===project.id)) this.projects.unshift(project);
      this.setProject(project, {historyLabel: 'Import audio'});this.replaceSummary(project);this.remember(project.id);this.render();
      this.report('Audio ready in Studio.');
      void this.separationView?.chooseModel({sourceId:project.importedTrackId,allowUnseparated:true});return true;
    } catch(error) { this.report(`Audio not imported: ${error.message}`,true);return false; }
    finally {this.importingTone=false;}
  }

  async create({name, bpm}) {
    const project = await this.api.createProject({name, bpm});
    this.projects.unshift({...project, trackCount: 0});
    await this.open(project.id, {confirm: false});
    return project;
  }

  // A shared viewer stops seeing the project (the owner can share it again).
  async leave() {
    const {project} = this;
    const owner = project.owner?.name || 'Its owner';
    const confirmed = await confirmDialog({title: 'Leave project?', confirmLabel: 'Leave',
      message: `“${project.name}” will no longer be listed for you. ${owner} can share it with you again.`});
    if (!confirmed) return;
    try {
      await this.api.leaveProject(project.id);
      this.report(`You left “${project.name}”`);
      await this.load();
    } catch (error) {
      this.report(`Project not left: ${error.message}`, true);
    }
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
  async addTrack({name, instrument, origin = 'personal', file}) {
    const {project} = this;
    const track = await this.api.createTrack(project.id, {name, instrument, origin}, file);
    project.tracks = [...project.tracks, track];
    this.saved.tracks = [...this.saved.tracks, structuredClone(track)];
    this.selectedId = track.id;
    this.replaceSummary(project);
    this.rememberVisibility(track.id, true, `Add ${track.name}`, Boolean(track.audio));
    this.render();
    return track;
  }

  async deleteTrack(id, {confirm = confirmDialog} = {}) {
    const project = this.project, epoch = this.accountLoadEpoch;
    const track = timelineTracks(project).find(entry => entry.id === id);
    if (!this.owned || this.saving || this.separation?.busy || this.separation?.result || !track) return;
    const confirmed = await confirm({title: 'Delete track?', confirmLabel: 'Delete',
      message: `Remove “${track.name}” from the timeline and mix? Its audio is kept in history. You can restore it from Options.`});
    if (!confirmed || this.project !== project || this.accountLoadEpoch !== epoch || this.saving || this.separation?.busy || this.separation?.result) return;
    if (await this.mutateTrackVisibility(id, false)) this.rememberVisibility(id, false, `Delete ${track.name}`, Boolean(track.audio));
  }

  async restoreTrack(id) {
    if (!this.owned || this.saving || this.separation?.busy || this.separation?.result || !this.project?.tracks.some(track => track.id === id && track.removedAt)) return;
    const track = this.project.tracks.find(track => track.id === id);
    if (await this.mutateTrackVisibility(id, true)) this.rememberVisibility(id, true, `Restore ${track.name}`, Boolean(track.audio));
  }

  async mutateTrackVisibility(id, restore) {
    const project = this.project, epoch = this.accountLoadEpoch;
    this.saving = true;
    this.render();
    try {
      const changed = await this.api[restore ? 'restoreTrack' : 'deleteTrack'](project.id, id);
      if (this.project !== project || this.accountLoadEpoch !== epoch) return;
      // Keep unsaved names and mixer settings; only the removal is saved now.
      const merge = tracks => tracks.map(track => track.id === id ? {...track,
        removedAt: changed.removedAt, timelineVisible: changed.timelineVisible, inputMonitoring: false} : track);
      project.tracks = merge(project.tracks);
      this.saved.tracks = merge(this.saved.tracks);
      this.separation?.restore(project);
      if (!timelineTracks(project).some(track => track.id === this.selectedId)) this.selectedId = timelineTracks(project)[0]?.id ?? null;
      this.replaceSummary(project);
      this.report(restore ? 'Track restored' : 'Track removed · Undo or restore it from Options');
      return true;
    } catch (error) {
      if (this.project === project && this.accountLoadEpoch === epoch) this.report(`Track not ${restore ? 'restored' : 'removed'}: ${error.message}`, true);
    } finally {
      if (this.project === project && this.accountLoadEpoch === epoch) { this.saving = false; this.render(); }
    }
  }

  renderRemovedTracks() {
    const container = this.$('studioRemovedTracks');
    if (!container) return;
    const tracks = this.project?.tracks.filter(track => track.removedAt) ?? [];
    container.hidden = !this.owned || !tracks.length;
    const select = this.$('studioRemovedTrack'), selected = select.value;
    select.replaceChildren(...tracks.map(track => element('option', {value: String(track.id), textContent: track.name})));
    if (tracks.some(track => String(track.id) === selected)) select.value = selected;
    const button = this.$('studioRestoreTrack');
    select.disabled = button.disabled = Boolean(this.saving || this.separation?.busy || this.separation?.result);
    button.onclick = () => this.restoreTrack(Number(select.value));
  }

  layoutState() {
    return {activeSeparationId: this.project?.activeSeparationId ?? null,
      tracks: this.project.tracks.filter(track => track.origin !== 'mix').map(track => ({id: track.id, visible: track.timelineVisible !== false, removed: Boolean(track.removedAt)}))};
  }

  rememberLayout(before, label) {
    const after = this.layoutState(), projectId = this.project.id, epoch = this.accountLoadEpoch;
    const changes = after.tracks.flatMap(next => {
      const previous = before.tracks.find(track => track.id === next.id) ?? {id: next.id, visible: false, removed: this.project.tracks.find(track => track.id === next.id)?.origin !== 'stem'};
      return previous.visible === next.visible && previous.removed === next.removed ? [] : [{id: next.id,
        before: {visible: previous.visible, removed: previous.removed}, after: {visible: next.visible, removed: next.removed}}];
    });
    if (!changes.length) return;
    const apply = async redo => {
      if (this.project?.id !== projectId || this.accountLoadEpoch !== epoch) throw Error('Project changed.');
      const result = await this.api.setTrackVisibility(projectId, {changes: redo ? changes : changes.map(change => ({id: change.id, before: change.after, after: change.before})),
        beforeSeparationId: redo ? before.activeSeparationId : after.activeSeparationId,
        afterSeparationId: redo ? after.activeSeparationId : before.activeSeparationId});
      if (this.project?.id !== projectId || this.accountLoadEpoch !== epoch) throw Error('Project changed.');
      const merge = tracks => tracks.map(track => {
        const changed = result.tracks.find(entry => entry.id === track.id);
        return changed ? {...track, timelineVisible: changed.timelineVisible, removedAt: changed.removedAt, inputMonitoring: false} : track;
      });
      this.project.tracks = merge(this.project.tracks); this.saved.tracks = merge(this.saved.tracks);
      this.project.activeSeparationId = this.saved.activeSeparationId = result.activeSeparationId;
      this.separation?.restore(this.project);
      this.selectedId = timelineTracks(this.project)[0]?.id ?? null;
      this.replaceSummary(this.project); this.render();
    };
    this.history.record({label, audio: true, undo: () => apply(false), redo: () => apply(true)});
  }

  get historyBlocked() {
    return !this.owned || Boolean(this.saving || this.history?.busy || this.separation?.busy || this.separation?.result);
  }

  historyState() {
    return this.history && this.project && this.owned ? editState(this.project, this.player?.loop) : null;
  }

  rememberEdit(before, label) {
    if (!before || !label || this.historyBlocked) return;
    const projectId = this.project.id, epoch = this.accountLoadEpoch;
    this.history.record(editCommand(before, this.historyState(), {label, group: this.historyGesture,
      apply: (patch, side) => {
        if (this.project?.id !== projectId || this.accountLoadEpoch !== epoch) throw Error('Project changed.');
        this.applyHistoryPatch(patch, side);
      }}));
  }

  applyHistoryPatch(patch, side) {
    if (!patch) return;
    for (const change of patch.tracks) if (!this.project.tracks.some(track => track.id === change.id)) throw Error('Track changed; reopen the project.');
    for (const [field, values] of Object.entries(patch.project)) this.project[field] = values[side];
    this.project.tracks = this.project.tracks.map(track => {
      const change = patch.tracks.find(entry => entry.id === track.id);
      return change ? {...track, ...Object.fromEntries(Object.entries(change.fields).map(([key, values]) => [key, values[side]]))} : track;
    });
    if (patch.order) {
      const ids = patch.order[side], current = this.project.tracks;
      this.project.tracks = [...ids.map(id => current.find(track => track.id === id)).filter(Boolean), ...current.filter(track => !ids.includes(track.id))];
    }
    if (patch.loop && this.player) {
      this.player.setLoop(patch.loop[side]);
      try { this.storage?.setItem(LOOPS_KEY, JSON.stringify(rememberLoop(this.loops(), this.project.id, loopToBars(this.player.loop, this.project.bpm)))); } catch { /* Browser storage unavailable. */ }
    }
    if (this.separation) {
      this.separation.projectTracks = this.project.tracks;
      this.separation.savedProject = this.project;
      if (this.separation.savedTracks) this.separation.savedTracks.splice(0, this.separation.savedTracks.length, ...timelineTracks(this.project));
    }
    this.render();
  }

  async runHistory(redo) {
    if (this.historyBlocked) return false;
    this.historyGesture = null;
    const project = this.project, epoch = this.accountLoadEpoch;
    this.saving = true; this.render();
    try { return await this.history.step(redo); }
    catch (error) { this.report(`Cannot ${redo ? 'redo' : 'undo'}: ${error.message}`, true); return false; }
    finally { if (this.project === project && this.accountLoadEpoch === epoch) { this.saving = false; this.render(); } }
  }

  renderHistory() {
    if (!this.history) return;
    for (const [id, redo] of [['projectUndo', false], ['projectRedo', true]]) {
      const button = this.$(id); if (!button) continue;
      const label = redo ? this.history.redoLabel : this.history.undoLabel;
      const name = redo ? 'Redo' : 'Undo';
      const shortcut = this.isMac ? (redo ? '⌘⇧Z' : '⌘Z') : (redo ? 'Ctrl+Shift+Z / Ctrl+Y' : 'Ctrl+Z');
      button.hidden = !this.owned;
      button.disabled = this.historyBlocked || !label;
      button.setAttribute('aria-label', label ? `${name}: ${label}` : name);
      button.setAttribute('title', `${name}${label ? `: ${label}` : ''} (${shortcut})`);
      button.setAttribute('aria-keyshortcuts', this.isMac ? (redo ? 'Meta+Shift+Z' : 'Meta+Z') : (redo ? 'Control+Shift+Z Control+Y' : 'Control+Z'));
    }
  }

  rememberVisibility(id, restore, label, audio) {
    if (!this.history || this.history.busy) return;
    const projectId = this.project.id, epoch = this.accountLoadEpoch;
    const apply = async visible => {
      if (this.project?.id !== projectId || this.accountLoadEpoch !== epoch) throw Error('Project changed.');
      if (!await this.mutateTrackVisibility(id, visible)) throw Error('Track change was not applied.');
    };
    this.history.record({label, audio, undo: () => apply(!restore), redo: () => apply(restore)});
  }

  editPresetInTone() {
    if (!this.selectedTrack || !usesTrackPreset(this.selectedTrack)) return;
    const value = presetValue(this.selectedTrack);
    if (value) this.onEditPreset(value.startsWith('account:') ? value.slice(8) : value);
  }

  // Dialogs ------------------------------------------------------------------

  async createProjectDialog() {
    if (!(await this.ensureSignedIn()) || !await this.confirmPreviewDiscard()) return;
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
    if (!await this.ensureSignedIn()) return;
    const {dialog, body} = createDialog({title:'Import audio'});
    const local = button('Import from a file', {primary:true});
    const youtube = button('Import from YouTube');
    const done = button('Close');
    local.onclick=()=>{dialog.close();void this.importFileDialog();};
    youtube.onclick=()=>{dialog.close();void this.youtubeImportDialog();};
    done.onclick=()=>dialog.close();
    body.append(element('p',{textContent:'Add audio to a project, with or without instrument separation.'}),actionsRow(local),actionsRow(youtube),actionsRow(done));
    dialog.showModal();
  }

  async youtubeImportDialog({onImported = null} = {}) {
    if (!await this.ensureSignedIn()) return;
    const {dialog,body,id}=createDialog({title:'Import from YouTube'});
    const form=element('form');
    const destination=importDestinationFields({project:this.project,id,name:'YouTube audio'});
    const url=element('input',{id:`${id}-url`,type:'url',required:true,placeholder:'https://www.youtube.com/watch?v=…',autocomplete:'off'});
    const label=element('label',{htmlFor:url.id,textContent:'Video URL'});
    const start=button('Import audio',{type:'submit',primary:true});
    const cancel=button('Cancel import'),open=button(onImported ? 'Use in Tone' : 'Open in Studio',{primary:true}),close=button('Close');
    const status=element('p',{role:'status',textContent:'Checking server…'});
    const progress=element('progress',{max:100,hidden:true});
    const provenance=element('p',{className:'host-help'});
    let job=null,available=false,pending=false,closed=false;
    const render=value=>{
      job=value;const active=importActive(job);
      status.textContent=(onImported && job?.state==='ready' ? 'Audio ready. Use in Tone to load it without separation.' : job?.message || job?.state) || 'Ready. Up to 30 minutes / 100 MiB. Import audio you are allowed to use.';
      progress.hidden=!active;
      if(Number.isFinite(job?.progress))progress.value=job.progress;else progress.removeAttribute('value');
      start.disabled=!available||active||pending;url.disabled=active||pending;destination.root.inert=active||pending;
      cancel.hidden=!active;cancel.disabled=pending;
      open.hidden=job?.state!=='ready'||!job.projectId;
      provenance.textContent=job?.metadata?.title ? `${job.metadata.title} · ${job.metadata.url}` : '';
    };
    const watcher=new AudioImportWatcher({api:this.api,onChange:render});
    this.audioImportDialog?.close();this.audioImportDialog=dialog;
    form.append(label,url,destination.root,actionsRow(start));
    body.append(form,status,progress,provenance,actionsRow(cancel,open,close));
    close.onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{closed=true;watcher.stop();if(this.audioImportDialog===dialog)this.audioImportDialog=null;},{once:true});
    cancel.onclick=async()=>{
      pending=true;render(job);watcher.stop();
      try{const value=await this.api.cancelAudioImport(job.id);if(!closed)watcher.watch(value);}
      catch(error){if(!closed)job={...job,state:'error',message:error.message};}
      finally{pending=false;if(!closed)render(job);}
    };
    form.onsubmit=async event=>{
      event.preventDefault();if(start.disabled)return;
      pending=true;render(job);
      try{const value=await this.api.startAudioImport(url.value.trim(),destination.read());if(!closed)watcher.watch(value);}
      catch(error){if(!closed)status.textContent=error.message;}
      finally{pending=false;if(!closed){start.disabled=!available||importActive(job);url.disabled=importActive(job);}}
    };
    open.onclick=async()=>{
      if (onImported) {
        if (pending || job?.state !== 'ready') return;
        const imported = job, epoch = this.accountLoadEpoch;
        pending = true; open.disabled = true; status.textContent = 'Loading audio in Tone…';
        try {
          await onImported(imported);
          if (this.accountLoadEpoch === epoch && !closed) dialog.close();
        } catch (error) { if (!closed) status.textContent = error.message; }
        finally { pending = false; if (!closed) open.disabled = false; }
        return;
      }
      if(await this.confirmSavedMixDiscard() && await this.confirmPreviewDiscard()) {
        const target=job.projectId;dialog.close();
        try{this.projects=await this.api.listProjects();this.separation?.stop({reset:true});await this.open(target,{confirm:false,historyLabel:'Import YouTube audio'});if(this.project?.id===target)void this.separationView?.chooseModel({sourceId:job.sourceTrackId,allowUnseparated:true});}
        catch(error){this.report(error.message,true);}
      }
    };
    dialog.showModal();start.disabled=true;cancel.hidden=open.hidden=true;
    try{
      const [capabilities,jobs]=await Promise.all([this.api.audioImportCapabilities(),this.api.listAudioImports()]);
      if(closed)return;
      available=capabilities.available;
      const recent=jobs.find(importActive)||jobs[0];
      if(recent)watcher.watch(recent);else render(null);
      if(!available)status.textContent='YouTube import is unavailable on this server. Rails needs yt-dlp, Node.js and FFmpeg; a static deployment cannot download YouTube audio.';
    }catch(error){if(!closed)status.textContent=error.message;}
  }

  async importFileDialog() {
    if (!await this.ensureSignedIn()) return;
    const epoch=this.accountLoadEpoch,accountId=this.account?.user?.id;
    const selection = await this.chooseImportDestination({fileRequired:true});
    if (!selection?.file || epoch!==this.accountLoadEpoch || accountId!==this.account?.user?.id) return;
    await this.importFromTone({title:nameFromFile(selection.file.name)},selection.file,{destination:selection.destination});
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
    if (values) this.setTracks(this.project.tracks.map((entry) => (entry.id === id ? withInstrument({...entry, name: values.name}, values.instrument) : entry)), {label: `Edit ${track.name}`});
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
      this.report('Studio is available on the online rack, with an account.', true);
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
    this.separationView?.render();
  }

  // The player follows the open project's tracks and mix; lanes wait for their audio.
  syncPlayer() {
    const tracks = this.displayTracks.filter(track => track.id > 0);
    const retained = [...tracks, ...(this.separation?.result?.tracks ?? [])];
    for (const id of [...this.timeline.waves.keys()]) if (!retained.some((track) => track.id === id)) this.timeline.setWave(id, null);
    for (const track of tracks) if (track.audio && !this.timeline.waves.has(track.id)) this.timeline.setWave(track.id, track.waveform ? {peaks:Float32Array.from(track.waveform.peaks),duration:track.waveform.duration} : {state:'loading'});
    const liveId = liveTrackId(tracks, this.selectedId);
    this.player?.setTracks(tracks, liveId);
    if (this.separation?.mode === 'stems') this.player.syncPreview(this.separation.viewTracks ?? []);
    this.tones?.setTracks(tracks, this.project?.id, liveId);
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
    play.disabled = player?.ready === false || !player?.duration;
    play.setAttribute('icon', playing ? 'pause' : 'play');
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    play.setAttribute('aria-pressed', String(playing));
    play.title = playing ? 'Pause' : 'Play';
    this.$('projectRewind').disabled = !player?.duration;
    const loop = player?.loop ?? {enabled: false, start: 0, end: 0};
    const loopButton = this.$('projectLoop');
    loopButton.disabled = !player?.duration;
    loopButton.setAttribute('aria-pressed', String(loop.enabled));
    loopButton.querySelector('span').textContent = loop.enabled ? 'On' : 'Off';
    const region = loopLabel(loop, this.project?.bpm ?? BPM_RANGE.default);
    loopButton.title = `Loop (L)${region ? ` · ${region}` : ''} · drag on the bar ruler to choose the bars`;
    this.$('projectLoopReset').disabled = !player?.duration || !(loop.end > loop.start);
    this.timeline.setLoop(loop);
    this.renderMixExport();
    this.renderPosition();
    if (playing && !this.frame) {
      const tick = () => {
        this.renderPosition();
        this.frame = this.player.playing ? requestAnimationFrame(tick) : null;
      };
      this.frame = requestAnimationFrame(tick);
    }
  }

  // The loop button and L: on/off, or a 4-bar loop at the playhead when none is drawn.
  toggleLoop() {
    const {player} = this;
    if (!player?.duration) return;
    if (player.loop.end > player.loop.start) return this.setLoop({enabled: !player.loop.enabled});
    return this.setLoop({enabled: true, ...loopAround(player.position, this.timeline.length)});
  }

  // Changes the player's loop and remembers it for the open project.
  setLoop(changes) {
    if (this.history?.busy || this.saving) return;
    const before = this.historyState();
    const playing = this.player.setLoop(changes);
    if (this.player.preview) return playing;
    const loops = rememberLoop(this.loops(), this.project.id, loopToBars(this.player.loop, this.project.bpm));
    try { this.storage?.setItem(LOOPS_KEY, JSON.stringify(loops)); } catch { /* Not remembered. */ }
    this.rememberEdit(before, 'Loop A/B');
    return playing;
  }

  loops() {
    try { return JSON.parse(this.storage?.getItem(LOOPS_KEY) ?? '[]'); } catch { return []; }
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
    select.disabled = this.saving || !this.projects.length;
    this.$('projectCount').textContent = this.projects.length ? twoDigits(this.projects.length) : '';
    this.$('projectTrackCount').textContent = twoDigits(this.displayTracks.length);
    this.$('projectBpm').textContent = this.project ? String(this.project.bpm) : '—';
    this.$('projectNew').disabled = this.saving || !this.available;
    this.$('projectImport').disabled = this.saving || !this.available;
  }

  renderMixExport() {
    const button=this.$('studioUseMix'),range=this.$('studioExportRange');
    if (!button) return;
    range.hidden=!this.owned;
    range.closest('label').hidden=!this.owned;
    button.hidden=!this.owned || Boolean(this.separation?.busy || this.pendingSeparation);
    const state=mixExportAvailability({owned:this.owned,working:this.saving,separating:this.separation?.busy,pending:this.pendingSeparation,
      tracks:this.displayTracks,channels:this.player?.channels ?? new Map(),toneReady:typeof this.onUseMix === 'function'});
    button.disabled=!state.ready;button.title=state.message;
    const help=this.$('studioExportHelp');
    if(help){
      help.hidden=!this.owned || Boolean(this.separation?.busy) || state.ready;
      help.textContent=this.pendingSeparation ? 'Save project to keep these instruments and use the mix in Tone.' : state.message;
    }
    const retry=this.$('studioRetryAudio');
    if(retry){retry.hidden=!this.owned || !state.failedIds.length;retry.disabled=Boolean(this.saving);}

    range.disabled=Boolean(this.saving);
  }

  renderHeader() {
    const {dirty, owned} = this;
    const description = describeProject(this.project, {dirty, previewTracks: this.separation?.result && this.separation.mode === 'stems' ? this.separation.viewTracks : null});
    this.$('projectKicker').textContent = description?.kicker ?? 'Studio';
    this.$('projectTitle').textContent = this.project?.name ?? 'Studio';
    this.$('projectMeta').textContent = description?.meta ?? 'Record and mix your ideas track by track.';
    this.$('projectEdit').hidden = !owned;
    const state = this.$('projectSaveState');
    state.hidden = !this.project;
    state.textContent = description?.saveState ?? '';
    state.setAttribute('tone', dirty ? 'warning' : owned ? 'success' : 'neutral');
    this.$('projectShare').hidden = !owned;
    this.$('projectLeave').hidden = owned || !this.project;
    // A shared viewer's mix is never saved: it can go back to the owner's.
    this.$('projectResetMix').hidden = owned || !this.project || !trackChanges(this.saved?.tracks, this.project.tracks).length;
    this.$('projectShare').title = shareSummary(this.project?.shares) || 'Share this project read-only';
    this.$('projectSave').hidden = !owned;
    this.$('projectSave').disabled = this.saving || this.separation?.busy || (!dirty && !this.pendingSeparation);
    this.$('projectEdit').disabled = this.$('projectAddTrack').disabled = this.saving;
    if (this.saving) state.textContent = this.history?.busy ? 'Updating project…' : 'Saving audio…';
    this.$('projectAddTrack').hidden = !owned;
    this.$('projectTrackCount').textContent = twoDigits(this.displayTracks.length);
    this.renderMixExport();
    this.renderRemovedTracks();
    this.renderHistory();
  }

  renderEmpty() {
    const empty = this.$('projectsEmpty');
    empty.hidden = Boolean(this.project);
    this.$('projectTimeline').hidden = !this.project;
    if (this.project) return;
    const [title, text, action, run] = !this.available
      ? ['Studio lives on the online rack', 'Sign in on the online rack to keep projects and their audio in your account.', null]
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
    const tracks = this.displayTracks;
    this.timeline.render(tracks, {selectedId: this.selectedId, editable: this.owned && !this.separation?.result, presetName: (track) => this.toneLabel(track)});
    this.$('projectTimelineTempo').textContent = this.project ? `${this.project.bpm} BPM · 4/4` : '';
    this.$('projectTracksEmpty').hidden = tracks.length > 0;
    this.$('projectTracksEmpty').textContent = this.owned ? 'No tracks yet: add one from an audio file.' : 'This project has no tracks yet.';
  }

  renderInspector() {
    const track = this.selectedTrack;
    this.$('trackInspector').hidden = !track;
    if (!track) return;
    const index = this.displayTracks.indexOf(track);
    this.$('inspectorTrackName').textContent = track.name;
    this.$('inspectorTrackNumber').textContent = `Track ${twoDigits(index + 1)}`;
    this.$('inspectorTrackMeta').textContent = [originLabel(track), instrumentLabel(track.instrument), track.audio?.filename ?? 'No audio file'].join(' · ');
    const imported=this.$('inspectorImportHelp');
    if(imported){
      const metadata=track.importMetadata;
      imported.hidden=!metadata;
      imported.textContent=metadata?.kind==='youtube' ? `YouTube source: ${metadata.url} · ${metadata.duration} s` : metadata?.kind==='studio_mix' ? `Imported from Studio project ${metadata.sourceProjectId}, mix ${metadata.sourceTrackId}.` : metadata?.kind==='bundled' ? 'Imported from the Tone backing library.' : metadata ? 'Imported from a local file.' : '';
    }
    const tone = usesTrackPreset(track);
    this.$('inspectorPresetField').hidden = !tone;
    this.$('inspectorEditPreset').hidden = !tone || !this.owned;
    this.$('inspectorEditPreset').disabled = !presetValue(track);
    this.$('inspectorPresetHelp').textContent = !tone ? 'Accompaniment audio plays as recorded. Presets are reserved for your personal guitar and bass parts.'
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
    if (!usesTrackPreset(track)) return '';
    const name = this.presetName(track);
    const state = name && this.tones?.status(track.id)?.state;
    return state === 'loading' ? `${name} (loading…)` : state === 'error' ? `${name} (not loaded)` : name;
  }

  toneHelp(track) {
    if (!presetValue(track)) return 'Without a preset, the track plays its recorded audio as is.';
    if (this.tones?.status(track.id)?.state === 'error') return 'This preset could not be loaded: the track plays dry.';
    if (track.inputMonitoring) return 'Input monitoring: your live guitar plays through this preset, in place of the recording.';
    if (liveTrackId(this.project.tracks, this.selectedId) === track.id) {
      return track.audio ? 'Your live guitar plays through this preset, over the recording (I: in place of it).'
        : 'Your live guitar plays through this preset.';
    }
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
      tracks: undefined, activeSeparationId: project.activeSeparationId, trackCount: projectTrackCount(project)};
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
    const {dialog, body, id} = createDialog({title, eyebrow: 'Studio', className: 'project-dialog'});
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
// {file, name, instrument, origin} (file may be null unless fileRequired), or null.
function trackDialog({title, confirmLabel, intro, nameLabel, eyebrow = 'Studio', fileRequired = false, defaultName = null, initialOrigin = 'personal'}) {
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
    const origin = element('select', {id: `${id}-origin`});
    origin.append(new Option('My personal part (DI guitar / bass)', 'personal'), new Option('Accompaniment audio (no preset)', 'original'));
    origin.value = initialOrigin;
    if (initialOrigin === 'original') instrument.value = 'other';
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
    form.append(element('p', {textContent: intro}), drop, ...field(nameLabel, nameInput), ...field('Track type', origin), instrumentLabel$, wrapper,
      formActions(dialog, confirmLabel));
    body.append(form);
    dialog.addEventListener('close', () => {
      const file = fileInput.files[0] ?? null;
      resolve(dialog.returnValue === 'ok' && (file || !fileRequired) ? {file, name: nameInput.value.trim(), instrument: instrument.value, origin: origin.value} : null);
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
    const note = element('p', {className: 'host-help', textContent: 'Only personal guitar and bass parts play through a tone preset. Accompaniment audio keeps its recorded sound.'});
    form.append(element('p', {textContent: 'Choose a clear name for this part in your arrangement.'}), ...field('Track name', nameInput),
      instrumentLabel$, wrapper, note, formActions(dialog, 'Apply', onDelete, 'Delete track'));
    body.append(form);
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok' && nameInput.value.trim()
      ? {name: nameInput.value.trim(), instrument: instrument.value} : null), {once: true});
    dialog.showModal();
    nameInput.select();
  });
}
