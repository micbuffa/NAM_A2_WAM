import {appendTrackControlGlyphs} from '../ui/TrackControlStyle.js';
import {LiveWaveform} from './recording/LiveWaveform.js';
// Track rows of the Projects timeline (TONELAB mockup): name + rename, M/S/I,
// volume fader and pan knob on the left, the audio lane on the right. Rows are
// built once per track list and updated in place, so a fader keeps its drag.
// Each lane draws its file's waveform with the WaveSurfer renderer, on the
// shared time axis of the bar ruler; the playhead crosses every lane. The
// owner reorders tracks by dragging their icon and name (or with Alt+Up/Down).
// Dragging on the ruler draws the loop region (whole bars, Alt: exact
// positions), shown on the ruler and across every lane; a click seeks.
import {formatClock, instrumentLabel, originLabel, panLabel, recordableTrack, resizeLoop, rulerBars, snapLoop, usesTrackPreset, volumeLabel} from './ProjectsModel.js';

const element = (tag, className, properties = {}) => Object.assign(document.createElement(tag), {className, ...properties});
// A track control that does not apply to this track: invisible and out of reach, but still taking its place.
const placeholder = (button, unused) => {
  button.classList.toggle('track-mode-placeholder', unused);
  button.toggleAttribute('aria-hidden', unused);
  button.tabIndex = unused ? -1 : 0;
  if (unused) button.disabled = true;
};

export class ProjectTimeline {
  // root: carries the playhead and bar grid variables; ruler: the bar numbers.
  // onSelect(id); onChange(id, fields); onEdit(id): rename dialog; onMonitor(id): toggle input monitoring;
  // onMove(id, index): reorder; onSeek(seconds); onLoop({start, end}): a drawn loop region;
  // onTake(id, value): a version picked in the track's take selector (see setTakes);
  // createRenderer(options): a WaveSurfer renderer.
  constructor(list, {root, ruler, onSelect, onChange, onEdit, onDelete, onGestureStart, onGestureEnd, onMonitor, onArm, onMove, onSeek, onLoop, onRetry, onTake, createRenderer}) {
    Object.assign(this, {list, root, ruler, onSelect, onChange, onEdit, onDelete, onGestureStart, onGestureEnd, onMonitor, onArm, onMove, onSeek, onLoop, onRetry, onTake, createRenderer});
    this.rows = new Map();
    this.takes = new Map();
    globalThis.addEventListener?.('nam-appearance-change', () => {
      // Repaint cached envelopes only; transport, PCM and recording append state stay intact.
      for (const [id, row] of this.rows) {
        row.renderer?.destroy(); row.renderer = null;
        row.liveRenderer?.destroy(); row.liveRenderer = null;
        this.drawWave(id);
      }
    });
    this.drag = null; // {id, index}: the track being dragged and where it would land
    list.addEventListener('dragover', (event) => this.dragOver(event));
    list.addEventListener('drop', (event) => {
      if (!this.drag) return;
      event.preventDefault();
      const {id, index} = this.drag;
      const from = this.ids().indexOf(id);
      this.endDrag();
      if (index !== from && index !== from + 1) this.onMove(id, index > from ? index - 1 : index);
    });
    this.waves = new Map(); // track id -> {peaks, duration} or {state: 'loading' | 'error'}
    this.length = {bars: 16, seconds: 32};
    this.position = 0;
    this.loop = {enabled: false, start: 0, end: 0};
    this.anchors = ['A', 'B'].map(name => {
      const anchor = element('button', `loop-anchor loop-anchor-${name.toLowerCase()}`, {type: 'button', textContent: name});
      anchor.dataset.loopAnchor = name;
      anchor.setAttribute('role', 'slider');
      anchor.setAttribute('aria-label', `Loop ${name === 'A' ? 'start A' : 'end B'}`);
      anchor.title = `Drag ${name} to resize the loop · Alt: precise · Arrow keys: move`;
      anchor.onkeydown = event => {
        const current = this.loop.end > this.loop.start ? this.loop : {start: 0, end: this.length.seconds};
        const step = event.altKey ? .1 : this.length.seconds / this.length.bars;
        const position = name === 'A' ? current.start : current.end;
        const seconds = {ArrowLeft: position - step, ArrowRight: position + step, Home: 0, End: this.length.seconds}[event.key];
        if (seconds === undefined) return;
        event.preventDefault(); event.stopPropagation();
        this.onLoop(resizeLoop(current, name, seconds, this.length, {free: event.altKey}));
      };
      return anchor;
    });
    this.loopDrag = null; // {x, from, moved}: a loop being drawn on the ruler
    ruler.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (this.loopDrag) return;
      ruler.setPointerCapture?.(event.pointerId);
      const anchor = event.target.closest?.('[data-loop-anchor]')?.dataset.loopAnchor;
      const rect = ruler.getBoundingClientRect();
      const boundary = anchor === 'A' ? (this.loop.end > this.loop.start ? this.loop.start : 0)
        : (this.loop.end > this.loop.start ? this.loop.end : this.length.seconds);
      this.loopDrag = {x: event.clientX, from: this.timeAt(event), moved: false,
        anchor, loop: {...this.loop}, pointerId: event.pointerId,
        offset: anchor ? event.clientX - (rect.left + boundary / this.length.seconds * rect.width) : 0};
    });
    ruler.addEventListener('pointermove', (event) => {
      const drag = this.loopDrag;
      if (!drag || event.pointerId !== drag.pointerId || (!drag.moved && Math.abs(event.clientX - drag.x) < 4)) return;
      drag.moved = true;
      this.showLoop({enabled: true, ...this.drawnLoop(event)});
    });
    ruler.addEventListener('pointerup', (event) => {
      const drag = this.loopDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      this.loopDrag = null;
      if (drag?.moved) this.onLoop(this.drawnLoop(event, drag));
      else if (!drag.anchor) this.onSeek(drag.from);
    });
    ruler.addEventListener('pointercancel', () => {
      this.loopDrag = null;
      this.showLoop(this.loop);
    });
    ruler.addEventListener('lostpointercapture', () => {
      if (!this.loopDrag) return;
      this.loopDrag = null;
      this.showLoop(this.loop);
    });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { this.renderRuler(); for (const id of this.rows.keys()) if (this.waves.get(id)?.live) this.drawWave(id); }).observe(ruler);
  }

  // presetName(track): what the row says about the track's tone.
  render(tracks, {selectedId = null, editable = false, structuralLock = '', presetName = () => ''} = {}) {
    this.presetName = presetName;
    for (const row of this.rows.values()) { row.renderer?.destroy(); row.liveRenderer?.destroy(); }
    this.rows = new Map(tracks.map((track) => {
      const row = this.row(track, editable); row.structuralLocked = Boolean(structuralLock);
      if (structuralLock) for (const control of row.structuralControls) {
        control.disabled = true; control.draggable = false; control.title = structuralLock;
      }
      return [track.id, row];
    }));
    this.list.replaceChildren(...[...this.rows.values()].map((row) => row.root));
    for (const track of tracks) this.update(track, track.id === selectedId);
    for (const id of this.rows.keys()) this.drawWave(id);
  }

  ids() { return [...this.list.children].map((row) => Number(row.dataset.trackId)); }

  // Rows follow the tracks' order (moved, not rebuilt: waveforms stay drawn).
  order(tracks) {
    if (tracks.map((track) => track.id).join() === this.ids().join()) return;
    const focused = document.activeElement;
    this.list.append(...tracks.map((track) => this.rows.get(track.id)?.root).filter(Boolean));
    if (focused && this.list.contains(focused)) focused.focus();
  }

  startDrag(event, id) {
    if(this.locked){event.preventDefault();return;}
    this.drag = {id, index: null};
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
    const row = this.rows.get(id).root;
    event.dataTransfer.setDragImage?.(row, 24, row.offsetHeight / 2);
    requestAnimationFrame(() => row.classList.add('dragging'));
  }

  // The drop line goes between the rows the pointer is between.
  dragOver(event) {
    if (!this.drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rows = [...this.list.children];
    let index = rows.findIndex((row) => { const rect = row.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2; });
    if (index < 0) index = rows.length;
    if (index === this.drag.index) return;
    this.drag.index = index;
    rows.forEach((row, position) => {
      row.classList.toggle('drop-before', position === index);
      row.classList.toggle('drop-after', index === rows.length && position === rows.length - 1);
    });
  }

  endDrag() {
    this.drag = null;
    for (const row of this.list.children) row.classList.remove('dragging', 'drop-before', 'drop-after');
  }

  // Seconds at a pointer event's position on the ruler.
  timeAt(event) {
    const rect = this.ruler.getBoundingClientRect();
    return rect.width ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * this.length.seconds : 0;
  }

  drawnLoop(event, drag = this.loopDrag) {
    if (drag.anchor) return resizeLoop(drag.loop, drag.anchor, this.timeAt({clientX: event.clientX - drag.offset}), this.length, {free: event.altKey});
    return snapLoop(drag.from, this.timeAt(event), this.length, {free: event.altKey});
  }

  // The player's loop ({enabled, start, end}); a region being drawn stays shown.
  setLoop(loop) {
    this.loop = loop;
    if (!this.loopDrag?.moved) this.showLoop(loop);
  }

  showLoop({enabled, start, end}) {
    const {style, classList} = this.root;
    style.setProperty('--loop-start', String(Math.min(1, start / this.length.seconds)));
    style.setProperty('--loop-end', String(Math.min(1, end / this.length.seconds)));
    classList.toggle('has-loop', end > start);
    classList.toggle('loop-off', !enabled);
    const region = end > start ? {start, end} : {start: 0, end: this.length.seconds};
    for (const [index, anchor] of this.anchors.entries()) {
      const time = index ? region.end : region.start;
      anchor.style.left = `${Math.max(0, Math.min(100, time / this.length.seconds * 100))}%`;
      anchor.setAttribute('aria-valuemin', String(index ? region.start + .05 : 0));
      anchor.setAttribute('aria-valuemax', String(index ? this.length.seconds : region.end - .05));
      anchor.setAttribute('aria-valuenow', String(time));
      anchor.setAttribute('aria-valuetext', formatClock(time));
    }
  }

  // The timeline's length ({bars, seconds}, from timelineLength()).
  setLength(length) {
    if (length.seconds === this.length.seconds && length.bars === this.length.bars && this.ruler.childElementCount) return;
    this.length = length;
    this.root.style.setProperty('--bars', length.bars);
    this.renderRuler();
    for (const id of this.rows.keys()) {
      if (this.waves.get(id)?.live) this.drawWave(id); else this.placeClip(id);
    }
    this.setPosition(this.position);
    this.showLoop(this.loop);
  }

  // A track's decoded audio ({peaks, duration}), or {state: 'loading' | 'error'}.
  setWave(id, wave) {
    if (wave) this.waves.set(id, wave);
    else this.waves.delete(id);
    this.drawWave(id);
  }

  appendRecording(id, packet) {
    const {peakStart, peaks, peakFrames, sampleRate, timelineFrames} = packet;
    if (!Number.isSafeInteger(peakStart) || peakStart < 0 || !Number.isSafeInteger(peakFrames) || peakFrames < 1 || !(sampleRate > 0) || !Number.isSafeInteger(timelineFrames) || timelineFrames < 1) throw Error('Invalid waveform delta.');
    let wave = this.waves.get(id);
    if (!wave?.live) { wave = {live: true, peaks: [], sampleRate, peakFrames, duration: 0}; this.waves.set(id, wave); }
    if (wave.sampleRate !== sampleRate || wave.peakFrames !== peakFrames) throw Error('Waveform scale changed within a take.');
    for (let i = 0; i < peaks.length; i++) wave.peaks[peakStart + i] = peaks[i];
    wave.duration = wave.preserveTail ? Math.max(wave.duration,timelineFrames / sampleRate) : timelineFrames / sampleRate;
    this.drawWave(id, {start: peakStart, end: peakStart + peaks.length});
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
    this.ruler.replaceChildren(element('i', 'loop-region'), ...marks.map(({bar, fraction}) => {
      const mark = element('span', '', {textContent: bar});
      mark.setAttribute('aria-hidden', 'true');
      mark.style.left = `${fraction * 100}%`;
      return mark;
    }), element('i', 'playhead'), ...this.anchors);
    this.showLoop(this.loop);
  }

  placeClip(id) {
    const row = this.rows.get(id);
    const duration = this.waves.get(id)?.duration;
    if (row && duration) row.clip.style.width = `${Math.min(100, (duration / this.length.seconds) * 100)}%`;
  }

  drawWave(id, dirty = null) {
    const row = this.rows.get(id);
    if (!row) return;
    const wave = this.waves.get(id);
    row.clip.hidden = !wave?.peaks;
    row.note.hidden = Boolean(wave?.peaks);
    row.note.textContent = !row.track.audio ? 'No audio file' : wave?.state === 'error' ? `${row.track.audio.filename} · not loaded`
      : `${row.track.audio.filename} · loading…`;
    row.lane.classList.toggle('empty', !wave?.peaks && (!row.track.audio || wave?.state === 'error'));
    if (row.retry) row.retry.hidden = wave?.state !== 'error' || !row.track.audio || !this.onRetry;
    if (!wave?.live && row.liveRenderer) { row.liveRenderer.destroy(); row.liveRenderer = null; }
    if (!wave?.peaks) return;
    this.placeClip(id);
    if (wave.live) {
      row.renderer?.destroy(); row.renderer = null;
      row.clipName.textContent = 'Recording DI…';
      row.liveRenderer ??= new LiveWaveform(row.wave);
      const width = row.lane.clientWidth || row.lane.getBoundingClientRect?.().width || 0;
      row.liveRenderer.render(wave, width / this.length.seconds, dirty?.start ?? 0, dirty?.end ?? wave.peaks.length);
      return;
    }
    row.clipName.textContent = row.track.audio?.filename ?? 'Recording DI…';
    // Canvas colours: --tl-accent-muted, then --tl-accent once played.
    const colours = globalThis.getComputedStyle?.(row.wave);
    row.renderer ??= this.createRenderer({container: row.wave, height: 46, waveColor: colours?.getPropertyValue('--tl-accent-muted').trim() || '#91a675', progressColor: colours?.getPropertyValue('--tl-accent').trim() || '#c7f65b',
      cursorWidth: 0, fillParent: true, minPxPerSec: 0, normalize: true, autoScroll: false, autoCenter: false, hideScrollbar: true,
      interact: false, dragToSeek: false, barWidth: 2, barGap: 1, barRadius: 1});
    const {peaks, duration} = wave;
    const data = {duration, length: peaks.length, numberOfChannels: 1, sampleRate: peaks.length / duration, getChannelData: () => peaks};
    void Promise.resolve(row.renderer.render(data)).then(() => this.setPosition(this.position));
  }

  setLevel(id, peak) {
    const row = this.rows.get(id); if (!row?.meter) return;
    const db = peak > .00001 ? Math.max(-60, 20 * Math.log10(peak)) : -60;
    row.meter.style.setProperty('--track-level', `${Math.min(100, Math.max(0, (db + 60) / 60 * 100))}%`);
    row.meter.classList.toggle('clipping', peak >= 1);
    row.meter.setAttribute('aria-valuenow', String(Math.max(-60, Math.min(0, db))));
    row.meter.setAttribute('aria-valuetext', peak > .00001 ? `${db.toFixed(1)} dBFS` : 'Silence');
  }

  // Unsaved take versions shown on their track: Map of id → {options: [[value, label]], value, disabled, title}.
  // Tracks missing from the map hide their selector.
  setTakes(takes) {
    this.takes = takes;
    for (const id of this.rows.keys()) this.renderTakes(id);
  }

  renderTakes(id) {
    const row = this.rows.get(id), state = this.takes.get(id);
    if (!row?.takes) return;
    row.takes.hidden = !state;
    if (!state) { if (row.takeList.matches?.(':popover-open')) row.takeList.hidePopover(); return; }
    const count = state.options.filter(([value]) => value !== 0).length;
    row.takes.textContent = `${count} take${count > 1 ? 's' : ''}`;
    row.takes.title = state.title ?? '';
    row.takes.disabled = Boolean(state.disabled);
    row.takeList.replaceChildren(...state.options.map(([value, label]) => {
      const item = element('button', '', {type: 'button', textContent: label, disabled: Boolean(state.disabled)});
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(value === state.value));
      item.onclick = (event) => {
        event.stopPropagation(); row.takeList.hidePopover();
        if (value !== state.value) this.onTake?.(id, value);
      };
      return item;
    }));
  }

  // The take list: a popover (top layer, light dismiss, Esc) under the chip, so the clip does not clip it.
  showTakes(id) {
    const row = this.rows.get(id);
    if (!row || row.takes.disabled) return;
    row.takeList.showPopover();
    const anchor = row.takes.getBoundingClientRect(), box = row.takeList.getBoundingClientRect();
    row.takeList.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - box.width - 8))}px`;
    const below = anchor.bottom + 4, above = anchor.top - box.height - 4;
    row.takeList.style.top = `${below + box.height > innerHeight - 8 && above > 8 ? above : below}px`;
    (row.takeList.querySelector('[aria-checked="true"]') ?? row.takeList.firstElementChild)?.focus();
  }

  update(track, selected) {
    const row = this.rows.get(track.id);
    if (!row) return;
    row.root.classList.toggle('selected', selected);
    row.root.classList.toggle('muted', track.mute);
    row.root.setAttribute('aria-current', String(selected));
    row.name.textContent = track.name;
    for (const [control, label] of row.labels) control.setAttribute('aria-label', `${label} ${track.name}`);
    row.menu?.setAttribute('label', `Track actions: ${track.name}`);
    row.meta.textContent = [originLabel(track), instrumentLabel(track.instrument), usesTrackPreset(track) && (this.presetName(track) || 'No preset')]
      .filter(Boolean).join(' · ');
    row.icon.setAttribute('name', usesTrackPreset(track) ? 'guitar' : 'audio');
    for (const [key, button] of Object.entries(row.modes)) {
      button.classList.toggle('active', Boolean(track[key]));
      button.setAttribute('aria-pressed', String(Boolean(track[key])));
    }
    row.name.title=`${track.name} · ${row.meta.textContent}`;
    row.name.setAttribute('aria-description',row.meta.textContent);
    if(!this.locked)row.modes.inputMonitoring.disabled = !usesTrackPreset(track);
    placeholder(row.modes.inputMonitoring, !usesTrackPreset(track));
    if (row.arm) placeholder(row.arm, !recordableTrack(track));
    row.modes.inputMonitoring.title = usesTrackPreset(track)
      ? 'Input monitoring: play your guitar through this track’s preset' : 'Input monitoring is for your own guitar and bass tracks';
    row.volume.dataset.popupValue = volumeLabel(track.volume);
    if (Number(row.volume.value) !== track.volume) row.volume.value = track.volume;
    if (Number(row.pan.value) !== track.pan) row.pan.value = track.pan;
    row.volume.setAttribute('aria-valuetext', volumeLabel(track.volume));
    row.pan.setAttribute('aria-valuetext', panLabel(track.pan));
    const audioChanged = row.track.audio?.url !== track.audio?.url || row.track.audio?.byteSize !== track.audio?.byteSize;
    row.track = track;
    if (audioChanged) this.drawWave(track.id);
    this.renderTakes(track.id);
  }

  row(track, editable) {
    const {id} = track;
    const root = element('li', 'track-row');
    root.dataset.trackId = id;
    root.onclick = () => {if(!this.locked)this.onSelect(id);};

    const label = element('div', 'track-label');
    const icon = document.createElement('tl-icon');
    icon.setAttribute('size', '16');
    const badge = element('span', 'track-icon');
    badge.append(icon);
    // Icon + name: the handle that drags the track to a new place (owner only).
    const handle = element('span', 'track-handle');
    const meter = element('div', 'track-level-meter');
    meter.setAttribute('role', 'meter'); meter.setAttribute('aria-label', `Level ${track.name}`);
    meter.setAttribute('aria-valuemin', '-60'); meter.setAttribute('aria-valuemax', '0'); meter.setAttribute('aria-valuenow', '-60');
    meter.setAttribute('aria-valuetext', 'Silence'); meter.append(element('i', 'track-level-fill'));
    label.append(meter);
    const strip = element('div', 'track-strip');
    const structuralControls = [];
    const labels = []; // [control, verb]: aria-labels follow renames
    const title = element('div', 'track-title-row');
    const name = element('strong', 'track-name');
    handle.append(badge, name);
    title.append(handle);
    // Edit and Delete: in the track's ⋯ menu, at the right end of its title row.
    let menu = null;
    if (editable) {
      menu = document.createElement('tl-menu');
      menu.className = 'track-menu';
      menu.setAttribute('size', 'sm');
      const item = (icon, text, action) => {
        const button = element('button', '', {type: 'button'});
        const glyph = document.createElement('tl-icon');
        glyph.setAttribute('name', icon); glyph.setAttribute('size', '15');
        button.append(glyph, text);
        button.onclick = (event) => { event.stopPropagation(); action(); };
        menu.append(button);
      };
      item('edit', 'Edit track', () => { this.onSelect(id); this.onEdit(id); });
      if (this.onDelete) item('trash', 'Delete track', () => this.onDelete(id));
      menu.onclick = (event) => event.stopPropagation();
      title.append(menu); structuralControls.push(menu);
    }
    const meta = element('small', 'track-meta');

    const controls = element('div', 'track-controls');
    const modeGroup = element('div', 'track-modes');
    modeGroup.setAttribute('role', 'group');
    labels.push([modeGroup, 'Modes of']);
    const mode = (key, text, label, toggle) => {
      const button = element('button', `track-mode track-mode-${text.toLowerCase()}`, {type: 'button', textContent: text});
      button.title = label;
      if (text === 'I' || text === 'R') {
        button.textContent='';appendTrackControlGlyphs(button,text==='I'?'monitor':'arm');
      }
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

    // I and R exist on every track of an editable project but only show on your own guitar and
    // bass tracks; elsewhere they keep their place (see placeholder()), so the faders line up.
    const arm = editable && this.onArm ? mode('armed', 'R', 'Arm recording', () => this.onArm(id)) : null;

    if (arm) structuralControls.push(arm);
    const volume = element('input', '', {type: 'range', min: 0, max: 100, step: 1, value: track.volume});
    labels.push([volume, 'Volume for']);
    volume.oninput = () => {
      volume.dataset.popupValue = volumeLabel(Number(volume.value));
      this.onChange(id, {volume: Number(volume.value)});
    };
    volume.ondblclick = () => this.onChange(id, {volume: 80});
    const fader = document.createElement('tl-slider');
    fader.className = 'track-volume';
    fader.setAttribute('size', 'lg');
    fader.setAttribute('popup', 'Volume');
    fader.append(volume);

    const pan = element('input', '', {type: 'range', min: -100, max: 100, step: 1, value: track.pan});
    labels.push([pan, 'Pan for']);
    pan.oninput = () => this.onChange(id, {pan: Number(pan.value)});
    pan.ondblclick = () => this.onChange(id, {pan: 0});
    const knob = document.createElement('tl-knob');
    knob.setAttribute('size', 'sm');
    knob.toggleAttribute('arc', true);
    knob.setAttribute('popup', 'Pan');
    knob.className = 'track-pan';
    knob.append(pan);

    // A knob's pointer events cross its shadow root; native slider input
    // events and keyboard repeats belong to the same user gesture.
    for (const [control, input, key] of [[fader, volume, 'volume'], [knob, pan, 'pan']]) {
      control.addEventListener('pointerdown', () => this.onGestureStart?.(`${id}:${key}`));
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(type, () => this.onGestureEnd?.());
      let keyboard = false;
      input.onkeydown = event => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) { keyboard = true; this.onGestureStart?.(`${id}:${key}`); } };
      input.onkeyup = input.onblur = () => { keyboard = false; this.onGestureEnd?.(); };
      input.onchange = () => { if (!keyboard) this.onGestureEnd?.(); };
    }

    for (const control of [fader, knob]) control.onclick = (event) => { event.stopPropagation(); this.onSelect(id); };
    controls.append(modeGroup, fader, knob);
    strip.append(title, meta, controls);
    if (editable) {
      handle.draggable = true;
      handle.title = 'Drag to reorder · Alt+↑/↓';
      handle.ondragstart = (event) => this.startDrag(event, id);
      handle.ondragend = () => this.endDrag();
      structuralControls.push(handle);
      // Alt+Up/Down moves the track from any of its controls. Captured first, so a focused
      // fader or knob does not also take the arrow.
      root.addEventListener('keydown', (event) => {
        const step = event.altKey && !event.ctrlKey && !event.metaKey && {ArrowUp: -1, ArrowDown: 1}[event.key];
        if (!step) return;
        event.preventDefault(); event.stopPropagation();
        if (this.locked || this.rows.get(id)?.structuralLocked) return;
        const index = this.ids().indexOf(id) + step;
        if (index >= 0 && index < this.rows.size) this.onMove(id, index);
      }, true);
    }
    label.append(strip);

    const lane = element('div', 'track-lane');
    const area = element('div', 'track-lane-area');
    const clip = element('div', 'track-clip', {hidden: true});
    const clipName = element('span', 'track-clip-name');
    const wave = element('div', 'track-wave');
    const head = element('div', 'track-clip-head');
    head.append(clipName);
    clip.append(head, wave);
    const note = element('span', 'track-lane-note');
    // Shown beside "· not loaded": retries this track's saved audio.
    const retry = element('button', 'track-lane-retry', {type: 'button', textContent: 'Retry', title: 'Retry loading this audio', hidden: true});
    retry.onclick = (event) => { event.stopPropagation(); this.onRetry?.(track.id); };
    // Unsaved recording: "3 takes ▾" before the file name lists the versions (Original, takes) to audition.
    const takes = element('button', 'track-takes', {type: 'button', hidden: true});
    takes.setAttribute('aria-haspopup', 'menu');
    labels.push([takes, 'Takes of']);
    const takeList = element('div', 'track-take-list');
    takeList.popover = 'auto';
    takeList.setAttribute('role', 'menu');
    // A press on the chip while open only closes the list (light dismiss), instead of reopening it.
    let wasOpen = false;
    takes.onpointerdown = () => { wasOpen = takeList.matches(':popover-open'); };
    takes.onclick = (event) => { event.stopPropagation(); if (wasOpen) { wasOpen = false; return; } this.showTakes(track.id); };
    takeList.addEventListener('toggle', (event) => takes.setAttribute('aria-expanded', String(event.newState === 'open')));
    takeList.onkeydown = (event) => {
      const items = [...takeList.querySelectorAll('button:not(:disabled)')], index = items.indexOf(document.activeElement);
      const step = {ArrowDown: 1, ArrowUp: -1}[event.key];
      if (step) { event.preventDefault(); items[(index + step + items.length) % items.length]?.focus(); }
    };
    takeList.onclick = (event) => event.stopPropagation();
    head.prepend(takes);
    area.append(clip, note, retry, takeList, element('i', 'playhead'));
    area.onclick = (event) => {
      if(this.locked)return;
      const rect = area.getBoundingClientRect();
      if (rect.width) this.onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * this.length.seconds);
    };
    lane.append(area);
    root.append(label, lane);
    return {root, track, structuralControls, icon, name, menu, meta, modes, arm, meter, volume, pan, lane, clip, clipName, wave, note, retry, takes, takeList, labels};
  }
}
