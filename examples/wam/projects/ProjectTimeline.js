import {LiveWaveform} from './recording/LiveWaveform.js';
// Track rows of the Projects timeline (TONELAB mockup): name + rename, M/S/I,
// volume fader and pan knob on the left, the audio lane on the right. Rows are
// built once per track list and updated in place, so a fader keeps its drag.
// Each lane draws its file's waveform with the WaveSurfer renderer, on the
// shared time axis of the bar ruler; the playhead crosses every lane. The
// owner reorders tracks by dragging their grip (or with its arrow keys).
// Dragging on the ruler draws the loop region (whole bars, Alt: exact
// positions), shown on the ruler and across every lane; a click seeks.
import {formatClock, instrumentLabel, originLabel, panLabel, resizeLoop, rulerBars, snapLoop, usesTrackPreset, volumeLabel} from './ProjectsModel.js';

const element = (tag, className, properties = {}) => Object.assign(document.createElement(tag), {className, ...properties});

export class ProjectTimeline {
  // root: carries the playhead and bar grid variables; ruler: the bar numbers.
  // onSelect(id); onChange(id, fields); onEdit(id): rename dialog; onMonitor(id): toggle input monitoring;
  // onMove(id, index): reorder; onSeek(seconds); onLoop({start, end}): a drawn loop region;
  // createRenderer(options): a WaveSurfer renderer.
  constructor(list, {root, ruler, onSelect, onChange, onEdit, onEditSound, onDelete, onGestureStart, onGestureEnd, onMonitor, onArm, onMove, onSeek, onLoop, createRenderer}) {
    Object.assign(this, {list, root, ruler, onSelect, onChange, onEdit, onEditSound, onDelete, onGestureStart, onGestureEnd, onMonitor, onArm, onMove, onSeek, onLoop, createRenderer});
    this.rows = new Map();
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
  render(tracks, {selectedId = null, editable = false, presetName = () => ''} = {}) {
    this.presetName = presetName;
    for (const row of this.rows.values()) { row.renderer?.destroy(); row.liveRenderer?.destroy(); }
    this.rows = new Map(tracks.map((track) => [track.id, this.row(track, editable)]));
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
    if (length.seconds === this.length.seconds && this.ruler.childElementCount) return;
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
    wave.duration = timelineFrames / sampleRate;
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
    row.renderer ??= this.createRenderer({container: row.wave, height: 46, waveColor: '#91a675', progressColor: '#c7f65b',
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

  update(track, selected) {
    const row = this.rows.get(track.id);
    if (!row) return;
    row.root.classList.toggle('selected', selected);
    row.root.classList.toggle('muted', track.mute);
    row.root.setAttribute('aria-current', String(selected));
    row.name.textContent = track.name;
    for (const [control, label] of row.labels) control.setAttribute('aria-label', `${label} ${track.name}`);
    row.meta.textContent = [originLabel(track), instrumentLabel(track.instrument), usesTrackPreset(track) && (this.presetName(track) || 'No preset')]
      .filter(Boolean).join(' · ');
    row.icon.setAttribute('name', usesTrackPreset(track) ? 'guitar' : 'audio');
    for (const [key, button] of Object.entries(row.modes)) {
      button.classList.toggle('active', Boolean(track[key]));
      button.setAttribute('aria-pressed', String(Boolean(track[key])));
    }
    if(row.fx)row.fx.hidden=!usesTrackPreset(track);
    row.modes.inputMonitoring.disabled = !usesTrackPreset(track);
    row.modes.inputMonitoring.title = usesTrackPreset(track)
      ? 'Input monitoring: play your guitar through this track’s preset' : 'Input monitoring is for personal guitar and bass parts';
    row.volume.dataset.popupValue = volumeLabel(track.volume);
    if (Number(row.volume.value) !== track.volume) row.volume.value = track.volume;
    if (Number(row.pan.value) !== track.pan) row.pan.value = track.pan;
    row.volume.setAttribute('aria-valuetext', volumeLabel(track.volume));
    row.pan.setAttribute('aria-valuetext', panLabel(track.pan));
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
    const meter = element('div', 'track-level-meter');
    meter.setAttribute('role', 'meter'); meter.setAttribute('aria-label', `Level ${track.name}`);
    meter.setAttribute('aria-valuemin', '-60'); meter.setAttribute('aria-valuemax', '0'); meter.setAttribute('aria-valuenow', '-60');
    meter.setAttribute('aria-valuetext', 'Silence'); meter.append(element('i', 'track-level-fill'));
    label.append(meter);
    const strip = element('div', 'track-strip');
    const labels = []; // [control, verb]: aria-labels follow renames
    const title = element('div', 'track-title-row');
    const name = element('strong', 'track-name');
    title.append(name);
    let fx=null;
    if(editable&&this.onEditSound){
      fx=document.createElement('tl-button');fx.className='track-fx-button';fx.setAttribute('size','sm');fx.setAttribute('variant','ghost');fx.setAttribute('icon','sliders');fx.textContent='FX';fx.title='Edit track sound in Tone';
      fx.onclick=event=>{event.stopPropagation();this.onSelect(id);this.onEditSound(id);};title.append(fx);labels.push([fx,'Edit sound for']);
    }
    if (editable) {
      const rename = document.createElement('tl-icon-button');
      Object.entries({icon: 'edit', size: 'sm', variant: 'ghost', 'aria-label': `Edit ${track.name}`, title: 'Edit track'})
        .forEach(([key, value]) => rename.setAttribute(key, value));
      rename.onclick = (event) => { event.stopPropagation(); this.onSelect(id); this.onEdit(id); };
      title.append(rename);
      labels.push([rename, 'Edit']);
      if (this.onDelete) {
        const remove = document.createElement('tl-icon-button');
        Object.entries({icon: 'trash', size: 'sm', variant: 'ghost', title: 'Delete track'})
          .forEach(([key, value]) => remove.setAttribute(key, value));
        remove.onclick = event => { event.stopPropagation(); this.onDelete(id); };
        title.append(remove);
        labels.push([remove, 'Delete']);
      }
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

    const arm = editable && track.origin === 'personal' && usesTrackPreset(track) && this.onArm
      ? mode('armed', 'R', 'Arm recording', () => this.onArm(id)) : null;

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
      const grip = element('button', 'track-grip', {type: 'button', draggable: true, title: 'Drag to reorder (or use the arrow keys)'});
      const gripIcon = document.createElement('tl-icon');
      gripIcon.setAttribute('name', 'grip');
      gripIcon.setAttribute('size', '16');
      grip.append(gripIcon);
      labels.push([grip, 'Move']);
      grip.onclick = (event) => event.stopPropagation();
      grip.ondragstart = (event) => this.startDrag(event, id);
      grip.ondragend = () => this.endDrag();
      grip.onkeydown = (event) => {
        const step = {ArrowUp: -1, ArrowDown: 1}[event.key];
        if (!step) return;
        event.preventDefault();
        const index = this.ids().indexOf(id) + step;
        if (index >= 0 && index < this.rows.size) this.onMove(id, index);
      };
      label.append(grip);
    }
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
    return {root, track, fx, icon, name, meta, modes, arm, meter, volume, pan, lane, clip, clipName, wave, note, labels};
  }
}
