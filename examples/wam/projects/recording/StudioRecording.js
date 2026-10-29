import {confirmDialog} from '../../account/dialogs.js';
import {RecordingCalibration, DEFAULT_RECORDING_COMPENSATION_MS} from './RecordingCalibration.js';
import {DIRecorder} from './DIRecorder.js';
import {usesTrackPreset} from '../ProjectsModel.js';

// First capture milestone: one mono take on an empty personal track. Existing
// audio is never overwritten; lossless takes remain in RAM until Save project.
export class StudioRecording {
  constructor(workspace, {context, groupId, source, rack, enableLive, beginCalibration, lock = () => {}}) {
    Object.assign(this, {workspace, context, groupId, source, rack, enableLive, lock});
    this.armedId = null; this.state = 'idle'; this.pending = new Map();
    const $ = workspace.$;
    $('recordMonitor').onclick = () => this.act(() => this.monitor());
    $('recordCurrentTone').onclick = () => this.act(() => this.monitor(true));
    $('recordDiscard').onclick = () => this.act(() => this.discard());
    $('recordArm').onclick = () => this.act(() => this.arm());
    $('projectRecord').onclick = () => this.act(() => this.start());
    $('projectRecordStop').onclick = () => this.act(() => this.stop());
    if ($('recordCalibrate')) this.calibration = new RecordingCalibration(this, {beginCalibration});
    this.sourceChanged = () => {
      if (this.calibration?.running) this.calibration.cancel('Audio input changed. Calibration cancelled.');
      else if (this.busy) this.abort(Error('Audio input changed. Recording discarded; previous audio is unchanged.'));
      this.armedId = null; if (this.calibration) this.calibration.configurationChanged(); else workspace.$('recordCompensation').value = String(DEFAULT_RECORDING_COMPENSATION_MS); this.render();
    };
    source.addEventListener('change', this.sourceChanged);
    this.beforeUnload = event => { if (this.busy || this.pending.size) { event.preventDefault(); event.returnValue = ''; } };
    globalThis.addEventListener?.('beforeunload', this.beforeUnload);
    this.render();
  }
  get busy() { return ['preparing', 'recording', 'finalizing', 'calibrating'].includes(this.state); }
  get eligible() {
    const w = this.workspace, track = w.selectedTrack;
    return w.owned && track && track.origin === 'personal' && usesTrackPreset(track) && !track.audio && !this.pending.has(track.id)
      && this.pending.size < 2 && !w.saving && !w.separation?.busy && (!w.separation?.result || w.separation.result.engine.complete);
  }
  async act(operation) { try { await operation(); } catch (error) { this.workspace.report(error.message, true); } this.render(); }
  async monitor(useCurrent = false) {
    if (!this.eligible || this.busy) return;
    const w = this.workspace, project = w.project, id = w.selectedId;
    await this.enableLive();
    if (w.project !== project || w.selectedId !== id || !this.eligible) return;
    await this.context.resume();
    let fields = {};
    const track = w.selectedTrack;
    if (useCurrent || (!track.presetSnapshot && !track.factoryPreset && !track.presetId)) {
      const state = structuredClone(await this.rack.getState());
      if (state.enabledB && !state.route) throw Error('Independent dual inputs cannot be captured as one mono DI. Use a single input or a routed dual chain.');
      if (new TextEncoder().encode(JSON.stringify(state)).length > 8 * 1024 ** 2) throw Error('This preset snapshot exceeds the 8 MiB project limit. Choose a smaller preset before recording.');
      fields = {presetSnapshot: state, snapshotId: crypto.randomUUID(), presetId: null, factoryPreset: null};
    }
    w.setTracks(w.project.tracks.map(track => ({...track, ...(track.id === id ? fields : {}), inputMonitoring: track.id === id})));
    this.render();
  }
  async arm() {
    if (this.armedId === this.workspace.selectedId) { this.armedId = null; return; }
    if (!this.eligible) return;
    if (!DIRecorder.supported()) throw Error('Recording needs SharedArrayBuffer and an isolated page. Open the Rails host with COOP/COEP headers.');
    // A stopped result can become the backing, instead of permanently blocking R.
    const id = this.workspace.selectedId, projectId = this.workspace.project?.id;
    await this.workspace.prepareRecordingBacking?.();
    if (this.workspace.selectedId !== id || this.workspace.project?.id !== projectId || !this.eligible) return;
    await this.monitor();
    if (this.eligible && this.source.liveInput) this.armedId = this.workspace.selectedId;
  }
  setState(state) {
    const wasBusy = this.busy;
    this.state = state;
    if (wasBusy && !this.busy && this.disabled) { for (const [element, value] of this.disabled) element.disabled = value; this.disabled = null; }
    this.workspace.player.recordingLock = this.busy;
    if (wasBusy && !this.busy) this.workspace.render();
    this.lock(this.busy); this.render();
  }
  async waitForBacking() {
    const player = this.workspace.player;
    const pending = () => [...player.channels.values()].filter(channel => channel.key && !channel.buffer);
    if (!pending().length) return;
    await new Promise((resolve, reject) => {
      const changed = () => {
        const waiting = pending(), failed = waiting.find(channel => channel.error);
        if (failed) finish(Error('Backing audio could not load. Retry loading audio before recording.'));
        else if (!waiting.length) finish();
      };
      const finish = error => { clearTimeout(timer); player.removeEventListener('statechange', changed); error ? reject(error) : resolve(); };
      const timer = setTimeout(() => finish(Error('Backing audio is still loading. Try recording again when ready.')), 60000);
      player.addEventListener('statechange', changed); changed();
    });
  }
  async waitForTone(id) {
    const tones = this.workspace.tones;
    if (tones?.status(id)?.state === 'ready') return;
    await new Promise((resolve, reject) => {
      const changed = () => { const state = tones?.status(id)?.state; if (state === 'ready') finish(); else if (state === 'error') finish(Error('Track preset could not be loaded.')); };
      const finish = error => { clearTimeout(timer); tones?.removeEventListener('change', changed); error ? reject(error) : resolve(); };
      const timer = setTimeout(() => finish(Error('Track preset is still loading. Try recording again when ready.')), 30000);
      tones?.addEventListener('change', changed); changed();
    });
  }
  async start() {
    const w = this.workspace;
    if (!this.eligible || this.armedId !== w.selectedId || this.busy) return;
    const track = w.selectedTrack, project = w.project, epoch = w.accountLoadEpoch;
    w.player.base.pause();
    const startProjectFrame = Math.round(w.player.position * this.context.sampleRate);
    const ms = Number(w.$('recordCompensation').value);
    if (!Number.isFinite(ms) || ms < 0 || ms > 2000) throw Error('Compensation must be between 0 and 2000 ms.');
    const metadata = {version: 1, sessionId: crypto.randomUUID(), sampleRate: this.context.sampleRate, channels: 1, startProjectFrame,
      ...(this.calibration?.metadata(ms) ?? {compensationFrames: Math.round(ms * this.context.sampleRate / 1000), calibration: ms ? 'manual' : 'uncalibrated'}), inputChannel: this.source.liveInput?.channelIndex ?? 0};
    const active = this.active = {trackId: track.id, before: structuredClone(track), project, epoch, metadata};
    this.frames = 0; this.setState('preparing');
    try {
      await this.context.resume(); await this.waitForBacking(); await this.waitForTone(track.id);
      if (this.active !== active) return;
      metadata.capturePresetSnapshot = structuredClone(await w.tones.tones.get(track.id).rack.getState());
      metadata.capturePresetSnapshot.sourceTrim = {...metadata.capturePresetSnapshot.sourceTrim, live: this.source.trimDb.live};
      if (this.active !== active || w.project !== project || w.accountLoadEpoch !== epoch) return;
      this.tap = this.source.createDITap();
      this.recorder = new DIRecorder({context: this.context, groupId: this.groupId});
      this.recorder.addEventListener('progress', ({detail}) => {
        if (this.active !== active || this.state !== 'recording') return;
        this.frames = detail.frames;
        // Only newly changed fixed-position peak bins, never a whole-take envelope.
        w.timeline.appendRecording(track.id, detail);
        w.renderLength(); this.render();
      });
      this.recorder.addEventListener('error', ({detail}) => this.abort(detail));
      await this.recorder.prepare(metadata);
      if (this.active !== active) return;
      const when = (Math.ceil(this.context.currentTime * metadata.sampleRate) + Math.round(.15 * metadata.sampleRate)) / metadata.sampleRate;
      this.recorder.start(this.tap.node, Math.round(when * metadata.sampleRate));
      w.player.base.startRecording(when, startProjectFrame / metadata.sampleRate);
      this.frames = 0; this.setState('recording');
      this.deviceTrack = this.source.liveStream?.getAudioTracks()[0];
      this.ended = () => this.abort(Error('Audio device disconnected. Recording discarded.'));
      this.deviceTrack?.addEventListener('ended', this.ended);
    } catch (error) { this.abort(error); }
  }
  async stop() {
    if (this.state === 'preparing') { this.abort(); return; }
    if (this.state !== 'recording') return;
    const active = this.active;
    this.setState('finalizing'); this.workspace.player.base.pause();
    try {
      const result = await this.recorder.stop();
      if (this.active !== active) return;
      const metadata = {...active.metadata, frames: result.frames, capturedFrames: result.capturedFrames};
      const file = new File([result.audio], `guitar-${metadata.sessionId}.wav`, {type: 'audio/wav'});
      const peak = result.peaks.reduce((maximum, value) => Math.max(maximum, value), 0);
      const take = {file, metadata, peak, before: active.before, url: URL.createObjectURL(file), expectedUpdatedAt: this.workspace.saved.tracks.find(t => t.id === active.trackId).updatedAt};
      this.pending.set(active.trackId, take);
      const tracks = active.project.tracks.map(track => track.id === active.trackId ? {...track,
        audio: {url: take.url, filename: file.name, contentType: 'audio/wav', byteSize: file.size},
        recording: metadata, presetSnapshot: structuredClone(metadata.capturePresetSnapshot), snapshotId: metadata.sessionId, presetId: null, factoryPreset: null, inputMonitoring: false} : track);
      this.cleanup(); this.armedId = null; this.setState('idle');
      this.workspace.setTracks(tracks, {label: null});
      this.workspace.timeline.setWave(active.trackId, {peaks: result.peaks, duration: result.frames / metadata.sampleRate, recordingSessionId: metadata.sessionId});
      // Audition from the take's beginning, not a few samples before its end.
      this.workspace.player.base.seek(metadata.startProjectFrame / metadata.sampleRate);
      this.workspace.report(peak > .00001 ? 'DI take ready in RAM. Press Play to listen, then Save project.' : 'The take contains silence. Check the selected input/channel before recording again.', peak <= .00001);
    } catch (error) { this.abort(error); }
  }
  async discard() {
    const w = this.workspace, id = w.selectedId, take = this.pending.get(id), project = w.project;
    if (!take || this.busy || w.saving) return;
    if (!await confirmDialog({title: 'Discard unsaved take?', message: 'This take exists only in RAM. The track will become empty again.', confirmLabel: 'Discard take'})) return;
    if (this.pending.get(id) !== take || w.project !== project || this.busy || w.saving) return;
    this.pending.delete(id); URL.revokeObjectURL(take.url);
    const fields = Object.fromEntries(['audio', 'recording', 'presetSnapshot', 'snapshotId', 'presetId', 'factoryPreset'].map(key => [key, take.before[key] ?? null]));
    w.setTracks(project.tracks.map(track => track.id === id ? {...track, ...fields} : track), {label: null});
    w.timeline.setWave(id, null); w.render();
  }
  cleanup() {
    this.active = null;
    this.deviceTrack?.removeEventListener('ended', this.ended);
    this.recorder?.destroy(); this.recorder = null; this.tap?.release(); this.tap = null;
  }
  abort(error) {
    if (!this.active) return;
    const id = this.active.trackId;
    this.workspace.player.base.pause(); this.cleanup(); this.armedId = null; this.setState('idle');
    this.workspace.timeline.setWave(id, null);
    if (error) this.workspace.report(error.message, true);
  }
  clear() {
    this.calibration?.clear(); this.abort(); this.armedId = null;
    for (const take of this.pending.values()) URL.revokeObjectURL(take.url);
    this.pending.clear();
  }
  async save() {
    const w = this.workspace, project = w.project, epoch = w.accountLoadEpoch;
    for (const [id, take] of this.pending) {
      const track = await w.api.saveRecording(project.id, id, take.metadata, take.file, take.expectedUpdatedAt);
      if (w.project !== project || w.accountLoadEpoch !== epoch) throw Error('Account or project changed during saving.');
      // Keep local mixer edits; only replace audio/provenance fields from the server.
      const fields = {audio: track.audio, recording: track.recording, presetSnapshot: track.presetSnapshot, snapshotId: track.snapshotId, updatedAt: track.updatedAt};
      project.tracks = project.tracks.map(t => t.id === id ? {...t, ...fields} : t);
      w.saved.tracks = w.saved.tracks.map(t => t.id === id ? {...t, ...fields, presetId: null, factoryPreset: null} : t);
      this.pending.delete(id);
      const release = () => URL.revokeObjectURL(take.url);
      if (w.player?.base?.adoptAudioReference) w.player.base.adoptAudioReference(id, take.url, track.audio, release);
      else release();
    }
  }
  render() {
    const w = this.workspace, $ = w.$, track = w.selectedTrack, eligible = this.eligible;
    if (!$('recordPanel')) return;
    if ($('recordTrackName')) $('recordTrackName').textContent = track?.name ?? '';
    for (const [id, row] of w.timeline?.rows ?? []) if (row.arm) {
      const armed = this.armedId === id;
      row.arm.disabled = this.busy || !w.owned || Boolean(row.track.audio) || this.pending.size >= 2;
      row.arm.classList.toggle('active', armed); row.arm.setAttribute('aria-pressed', String(armed));
    }
    $('recordPanel').hidden = !w.owned || !usesTrackPreset(track ?? {});
    $('recordMonitor').disabled = $('recordCurrentTone').disabled = !eligible || this.busy;
    $('recordArm').disabled = !eligible || this.busy;
    $('recordArm').textContent = this.armedId === track?.id ? 'R · Armed' : w.separation?.result?.engine.complete ? 'R · Keep instruments & arm' : 'R · Arm track';
    $('recordArm').setAttribute('aria-pressed', String(this.armedId === track?.id));
    $('projectRecord').disabled = !eligible || this.busy || this.armedId !== track?.id;
    $('projectRecordStop').disabled = !['preparing', 'recording'].includes(this.state);
    $('recordCompensation').disabled = this.busy;
    $('recordDiscard').hidden = !this.pending.has(track?.id); $('recordDiscard').disabled = this.busy || w.saving;
    if (this.pending.has(track?.id)) { $('inspectorPreset').disabled = true; $('inspectorEditPreset').disabled = true; }
    $('recordStatus').textContent = this.busy ? `${this.state === 'recording' ? 'Recording DI' : this.state === 'preparing' ? 'Preparing capture' : this.state === 'calibrating' ? 'Calibrating latency' : 'Finalizing take'} · ${((this.frames ?? 0) / this.context.sampleRate).toFixed(1)} s`
      : this.pending.has(track?.id) ? `Take in RAM · ${this.pending.get(track.id).peak > .00001 ? `peak ${(20 * Math.log10(this.pending.get(track.id).peak)).toFixed(1)} dBFS · Play to listen` : 'silence detected: check input/channel'} · Save project to keep it.` : track?.audio ? 'Recording on existing audio will be added in a later stage. Add an empty personal track.'
      : this.pending.size >= 2 ? 'Two takes are already in RAM. Save project before recording another track.'
      : `${this.source.liveInput?.label ?? 'Input not enabled'} · input ${(this.source.liveInput?.channelIndex ?? 0) + 1} · ${this.calibration?.active ? this.calibration.statusLabel : 'manual compensation (uncalibrated)'}`;
    this.calibration?.render();
    for (const id of ['projectSelect', 'projectNew', 'projectImport', 'projectAddTrack', 'projectEdit', 'projectShare', 'projectLeave', 'projectSave', 'projectUndo', 'projectRedo', 'projectPlay', 'projectRewind', 'projectLoop', 'projectLoopReset', 'inspectorPreset', 'inspectorEditPreset']) {
      if (this.busy && $(id)) { this.disabled ??= new Map(); if (!this.disabled.has($(id))) this.disabled.set($(id), $(id).disabled); $(id).disabled = true; }
    }
    if ($('studioUseMix') && this.busy) $('studioUseMix').disabled = true;
    for (const id of ['projectTracks', 'projectRuler', 'studioSeparation']) if ($(id)) $(id).inert = this.busy;
  }
}
