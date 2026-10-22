// Track rows of the Projects timeline (TONELAB mockup): name + rename, M/S/I,
// volume fader and pan knob on the left, the audio lane on the right. Rows are
// built once per track list and updated in place, so a fader keeps its drag.
// Each lane draws its file's waveform with the WaveSurfer renderer, on the
// shared time axis of the bar ruler; the playhead crosses every lane.
import {instrumentLabel, panLabel, rulerBars, usesPreset, volumeLabel} from './ProjectsModel.js';

const element = (tag, className, properties = {}) => Object.assign(document.createElement(tag), {className, ...properties});

export class ProjectTimeline {
  // root: carries the playhead and bar grid variables; ruler: the bar numbers.
  // onSelect(id); onChange(id, fields); onEdit(id): rename dialog; onMonitor(id): toggle input monitoring;
  // onSeek(seconds); createRenderer(options): a WaveSurfer renderer.
  constructor(list, {root, ruler, onSelect, onChange, onEdit, onMonitor, onSeek, createRenderer}) {
    Object.assign(this, {list, root, ruler, onSelect, onChange, onEdit, onMonitor, onSeek, createRenderer});
    this.rows = new Map();
    this.waves = new Map(); // track id -> {peaks, duration} or {state: 'loading' | 'error'}
    this.length = {bars: 16, seconds: 32};
    this.position = 0;
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.renderRuler()).observe(ruler);
  }

  // presetName(track): what the row says about the track's tone.
  render(tracks, {selectedId = null, editable = false, presetName = () => ''} = {}) {
    this.presetName = presetName;
    for (const row of this.rows.values()) row.renderer?.destroy();
    this.rows = new Map(tracks.map((track) => [track.id, this.row(track, editable)]));
    this.list.replaceChildren(...[...this.rows.values()].map((row) => row.root));
    for (const track of tracks) this.update(track, track.id === selectedId);
    for (const id of this.rows.keys()) this.drawWave(id);
  }

  // The timeline's length ({bars, seconds}, from timelineLength()).
  setLength(length) {
    if (length.seconds === this.length.seconds && this.ruler.childElementCount) return;
    this.length = length;
    this.root.style.setProperty('--bars', length.bars);
    this.renderRuler();
    for (const id of this.rows.keys()) this.placeClip(id);
    this.setPosition(this.position);
  }

  // A track's decoded audio ({peaks, duration}), or {state: 'loading' | 'error'}.
  setWave(id, wave) {
    if (wave) this.waves.set(id, wave);
    else this.waves.delete(id);
    this.drawWave(id);
  }

  setPosition(seconds) {
    this.position = seconds;
    this.root.style.setProperty('--playhead', String(Math.min(1, seconds / this.length.seconds)));
    for (const [id, row] of this.rows) {
      const duration = this.waves.get(id)?.duration;
      if (duration && row.renderer) row.renderer.renderProgress(Math.min(1, seconds / duration), false);
    }
  }

  renderRuler() {
    const marks = rulerBars(this.length.bars, this.ruler.clientWidth || 600);
    this.ruler.replaceChildren(...marks.map(({bar, fraction}) => {
      const mark = element('span', '', {textContent: bar});
      mark.style.left = `${fraction * 100}%`;
      return mark;
    }), element('i', 'playhead'));
  }

  placeClip(id) {
    const row = this.rows.get(id);
    const duration = this.waves.get(id)?.duration;
    if (row && duration) row.clip.style.width = `${Math.min(100, (duration / this.length.seconds) * 100)}%`;
  }

  drawWave(id) {
    const row = this.rows.get(id);
    if (!row) return;
    const wave = this.waves.get(id);
    row.clip.hidden = !wave?.peaks;
    row.note.hidden = Boolean(wave?.peaks);
    row.note.textContent = !row.track.audio ? 'No audio file' : wave?.state === 'error' ? `${row.track.audio.filename} · not loaded`
      : `${row.track.audio.filename} · loading…`;
    row.lane.classList.toggle('empty', !row.track.audio || wave?.state === 'error');
    if (!wave?.peaks) return;
    this.placeClip(id);
    row.clipName.textContent = row.track.audio.filename;
    // Canvas colours: --tl-accent-muted, then --tl-accent once played.
    row.renderer ??= this.createRenderer({container: row.wave, height: 46, waveColor: '#91a675', progressColor: '#c7f65b',
      cursorWidth: 0, fillParent: true, minPxPerSec: 0, normalize: true, autoScroll: false, autoCenter: false, hideScrollbar: true,
      interact: false, dragToSeek: false, barWidth: 2, barGap: 1, barRadius: 1});
    const {peaks, duration} = wave;
    const data = {duration, length: peaks.length, numberOfChannels: 1, sampleRate: peaks.length / duration, getChannelData: () => peaks};
    void Promise.resolve(row.renderer.render(data)).then(() => this.setPosition(this.position));
  }

  update(track, selected) {
    const row = this.rows.get(track.id);
    if (!row) return;
    row.root.classList.toggle('selected', selected);
    row.root.classList.toggle('muted', track.mute);
    row.root.setAttribute('aria-current', String(selected));
    row.name.textContent = track.name;
    for (const [control, label] of row.labels) control.setAttribute('aria-label', `${label} ${track.name}`);
    row.meta.textContent = [instrumentLabel(track.instrument), usesPreset(track.instrument) && (this.presetName(track) || 'No preset')]
      .filter(Boolean).join(' · ');
    row.icon.setAttribute('name', usesPreset(track.instrument) ? 'guitar' : 'audio');
    for (const [key, button] of Object.entries(row.modes)) {
      button.classList.toggle('active', Boolean(track[key]));
      button.setAttribute('aria-pressed', String(Boolean(track[key])));
    }
    row.modes.inputMonitoring.disabled = !usesPreset(track.instrument);
    row.modes.inputMonitoring.title = usesPreset(track.instrument)
      ? 'Input monitoring: play your guitar through this track’s preset' : 'Input monitoring is for guitar and bass tracks';
    if (Number(row.volume.value) !== track.volume) row.volume.value = track.volume;
    if (Number(row.pan.value) !== track.pan) row.pan.value = track.pan;
    row.volumeValue.textContent = volumeLabel(track.volume);
    row.volume.setAttribute('aria-valuetext', volumeLabel(track.volume));
    row.pan.setAttribute('aria-valuetext', panLabel(track.pan));
    row.panValue.textContent = track.pan === 0 ? 'C' : `${track.pan < 0 ? 'L' : 'R'}${Math.abs(track.pan)}`;
    const audioChanged = row.track.audio?.url !== track.audio?.url || row.track.audio?.byteSize !== track.audio?.byteSize;
    row.track = track;
    if (audioChanged) this.drawWave(track.id);
  }

  row(track, editable) {
    const {id} = track;
    const root = element('li', 'track-row');
    root.dataset.trackId = id;
    root.onclick = () => this.onSelect(id);

    const label = element('div', 'track-label');
    const icon = document.createElement('tl-icon');
    icon.setAttribute('size', '16');
    const badge = element('span', 'track-icon');
    badge.append(icon);
    const strip = element('div', 'track-strip');
    const labels = []; // [control, verb]: aria-labels follow renames
    const title = element('div', 'track-title-row');
    const name = element('strong', 'track-name');
    title.append(name);
    if (editable) {
      const rename = document.createElement('tl-icon-button');
      Object.entries({icon: 'edit', size: 'sm', variant: 'ghost', 'aria-label': `Edit ${track.name}`, title: 'Edit track'})
        .forEach(([key, value]) => rename.setAttribute(key, value));
      rename.onclick = (event) => { event.stopPropagation(); this.onSelect(id); this.onEdit(id); };
      title.append(rename);
      labels.push([rename, 'Edit']);
    }
    const meta = element('small', 'track-meta');

    const controls = element('div', 'track-controls');
    const modeGroup = element('div', 'track-modes');
    modeGroup.setAttribute('role', 'group');
    labels.push([modeGroup, 'Modes of']);
    const mode = (key, text, label, toggle) => {
      const button = element('button', `track-mode track-mode-${text.toLowerCase()}`, {type: 'button', textContent: text});
      button.title = label;
      labels.push([button, label]);
      button.onclick = (event) => { event.stopPropagation(); this.onSelect(id); toggle(); };
      modeGroup.append(button);
      return button;
    };
    const modes = {
      mute: mode('mute', 'M', 'Mute', () => this.onChange(id, {mute: !this.rows.get(id).modes.mute.classList.contains('active')})),
      solo: mode('solo', 'S', 'Solo', () => this.onChange(id, {solo: !this.rows.get(id).modes.solo.classList.contains('active')})),
      inputMonitoring: mode('inputMonitoring', 'I', 'Input monitoring', () => this.onMonitor(id)),
    };

    const volume = element('input', '', {type: 'range', min: 0, max: 100, step: 1, value: track.volume});
    labels.push([volume, 'Volume for']);
    volume.oninput = () => this.onChange(id, {volume: Number(volume.value)});
    volume.ondblclick = () => this.onChange(id, {volume: 80});
    const fader = document.createElement('tl-slider');
    fader.className = 'track-volume';
    fader.append(volume);
    const volumeValue = element('output', 'track-volume-value');

    const pan = element('input', '', {type: 'range', min: -100, max: 100, step: 1, value: track.pan});
    labels.push([pan, 'Pan for']);
    pan.oninput = () => this.onChange(id, {pan: Number(pan.value)});
    pan.ondblclick = () => this.onChange(id, {pan: 0});
    const knob = document.createElement('tl-knob');
    knob.setAttribute('size', 'sm');
    knob.className = 'track-pan';
    knob.title = 'Pan · double-click to center';
    const panValue = element('output', '', {slot: 'value'});
    knob.append(pan, panValue);

    for (const control of [fader, knob]) control.onclick = (event) => { event.stopPropagation(); this.onSelect(id); };
    const volumeGroup = element('div', 'track-volume-group');
    volumeGroup.append(fader, volumeValue);
    controls.append(modeGroup, volumeGroup, knob);
    strip.append(title, meta, controls);
    label.append(badge, strip);

    const lane = element('div', 'track-lane');
    const area = element('div', 'track-lane-area');
    const clip = element('div', 'track-clip', {hidden: true});
    const clipName = element('span', 'track-clip-name');
    const wave = element('div', 'track-wave');
    clip.append(clipName, wave);
    const note = element('span', 'track-lane-note');
    area.append(clip, note, element('i', 'playhead'));
    area.onclick = (event) => {
      const rect = area.getBoundingClientRect();
      if (rect.width) this.onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * this.length.seconds);
    };
    lane.append(area);
    root.append(label, lane);
    return {root, track, icon, name, meta, modes, volume, volumeValue, pan, panValue, lane, clip, clipName, wave, note, labels};
  }
}
