import {recordingRange} from './RangeCapture.js';
import {LoopReview} from './LoopReview.js';
import {RecordingHistory,RECORDING_FIELDS} from './RecordingHistory.js';
import {confirmDialog} from '../../account/dialogs.js';
import {RecordingCalibration, DEFAULT_RECORDING_COMPENSATION_MS} from './RecordingCalibration.js';
import {DIRecorder} from './DIRecorder.js';
import {Metronome} from './Metronome.js';
import {liveTrackId, timelineTracks, usesTrackPreset} from '../ProjectsModel.js';

export function armShortcut(event,{visible=true,busy=false,dialog=false}={}) {
  return typeof event.key==='string' && event.key.toLowerCase()==='r' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target?.closest?.('input,textarea,select,[contenteditable]') && visible && !busy && !dialog;
}

// Mono takes overwrite only the captured interval after successful finalization.
// Immutable prior versions remain available through bounded Undo/Redo.
export class StudioRecording {
  constructor(workspace, {context, groupId, source, rack, enableLive, beginCalibration, monitoringChanged = () => {}, lock = () => {}}) {
    Object.assign(this, {workspace, context, groupId, source, rack, enableLive, lock, monitoringChanged});
    this.armedId = null; this.state = 'idle'; this.pending = new Map();this.takeHistory=new RecordingHistory(this);
    this.metronome = new Metronome(context, workspace.player.output);
    this.metronome.addEventListener('tick',()=>{
      if(this.state==='counting' && this.context.currentTime>=this.metronome.recordAt)this.setState('recording');
      else this.render();
    });
    const $ = workspace.$;
    if($('projectMetronome'))$('projectMetronome').onclick=()=>{this.metronome.enabled=!this.metronome.enabled;this.render();};
    if($('projectCountIn'))$('projectCountIn').onchange=()=>{if(!this.busy)this.metronome.countInBars=Number($('projectCountIn').value);};
    $('recordCurrentTone').onclick = () => this.act(() => this.monitor(true));
    $('recordDiscard').onclick = () => this.act(() => this.discard());
    for(const [id,after] of [['recordCompareBefore',false],['recordCompareAfter',true]])if($(id))$(id).onclick=()=>this.act(()=>this.takeHistory.compare(after));
    if($('recordLoopTake'))$('recordLoopTake').onchange=()=>this.act(()=>this.loopReview?.choose(Number($('recordLoopTake').value)));
    $('projectRecord').onclick = () => this.act(() => this.start());
    $('projectRecordStop').onclick = () => this.act(() => this.stopTransport());
    if ($('recordCalibrate')) this.calibration = new RecordingCalibration(this, {beginCalibration});
    this.sourceChanged = () => {
      if (this.calibration?.running) this.calibration.cancel('Audio input changed. Calibration cancelled.');
      else if (this.busy) this.abort(Error('Audio input changed. Recording discarded; previous audio is unchanged.'));
      this.armedId = null; this.releaseMeter(); if (this.calibration) this.calibration.configurationChanged(); else workspace.$('recordCompensation').value = String(DEFAULT_RECORDING_COMPENSATION_MS); this.render();
    };
    source.addEventListener('change', this.sourceChanged);
    this.beforeUnload = event => { if (this.busy || this.pending.size || this.loopReview) { event.preventDefault(); event.returnValue = ''; } };
    globalThis.addEventListener?.('beforeunload', this.beforeUnload);
    this.render();
  }
  get busy() { return ['preparing', 'counting', 'recording', 'finalizing', 'calibrating'].includes(this.state); }
  get eligible() { return this.canArm(this.workspace.selectedTrack); }
  canArm(track) {
    const w = this.workspace;
    return w.owned && track && track.origin === 'personal' && !track.removedAt && usesTrackPreset(track)
      && (this.pending.has(track.id)||this.pending.size < 2) && !w.history?.busy && !w.saving && !w.separation?.busy && (!w.separation?.result || w.separation.result.engine.complete);
  }
  async act(operation) { try { await operation(); } catch (error) { this.workspace.report(error.message, true); } this.render(); }
  async monitor(useCurrent = false) {
    if (this.busy) {
      if(!useCurrent && ['counting','recording'].includes(this.state) && this.armedId===this.workspace.selectedId) {
        const w=this.workspace,id=w.selectedId;
        w.project.tracks=w.project.tracks.map(t=>({...t,inputMonitoring:t.id===id?!t.inputMonitoring:false}));
        const tracks=timelineTracks(w.project);
        if(w.separation){w.separation.projectTracks=w.project.tracks;if(w.separation.savedTracks)w.separation.savedTracks.splice(0,w.separation.savedTracks.length,...tracks);}
        w.player.base.setTracks(tracks,liveTrackId(tracks,id));
        for(const track of w.project.tracks)w.timeline.update(track,track.id===id);
        this.render();
      }
      return;
    }
    if (!this.eligible) return;
    if (!useCurrent && this.workspace.selectedTrack.inputMonitoring) {
      const id=this.workspace.selectedId;
      this.workspace.setTracks(this.workspace.project.tracks.map(t=>t.id===id?{...t,inputMonitoring:false}:t));
      return;
    }
    return this.prepareInput(useCurrent, useCurrent ? null : true);
  }
  async prepareInput(useCurrent = false, audible = null) {
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
    w.setTracks(w.project.tracks.map(track => ({...track, ...(track.id === id ? fields : {}), inputMonitoring: audible === null ? Boolean(track.inputMonitoring) : audible && track.id === id})));
    this.render();
  }
  async arm() {
    if(this.busy)return;
    if (this.armedId === this.workspace.selectedId) { this.armedId = null; this.releaseMeter(); return; }
    if (!this.eligible) return;
    if (!DIRecorder.supported()) throw Error('Recording needs SharedArrayBuffer and an isolated page. Open the Rails host with COOP/COEP headers.');
    // A stopped result can become the backing, instead of permanently blocking R.
    const id = this.workspace.selectedId, projectId = this.workspace.project?.id;
    await this.workspace.prepareRecordingBacking?.();
    if (this.workspace.selectedId !== id || this.workspace.project?.id !== projectId || !this.eligible) return;
    await this.prepareInput();
    if (this.eligible && this.source.liveInput) {
      this.armedId = this.workspace.selectedId;
      this.releaseMeter(); this.meterTap = this.source.createDITap?.();
    }
  }
  releaseMeter() { this.meterTap?.release(); this.meterTap = null; }
  meterSource(id) {
    return id === this.armedId && (!this.workspace.player.playing || ['preparing','counting','recording'].includes(this.state)) ? this.meterTap?.node : null;
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
  async stopTransport() {
    if(['preparing','counting','recording'].includes(this.state))return this.stop();
    if(!this.busy)this.workspace.player.stop();
  }
  async start() {
    const w = this.workspace;
    if(this.busy||w.separation?.result)return;
    // The transport records the armed track, even after selecting another row.
    if(!this.busy&&this.armedId!=null&&this.canArm(w.project?.tracks.find(t=>t.id===this.armedId)))w.select?.(this.armedId);
    if (!this.eligible || this.armedId !== w.selectedId || this.busy) return;
    const track = w.selectedTrack, project = w.project, epoch = w.accountLoadEpoch;
    const range=recordingRange(w.player.loop,w.player.position,this.context.sampleRate);
    this.loopReview?.close();
    w.player.base.pause();
    const startProjectFrame = range?.transportStartFrame ?? Math.round(w.player.position * this.context.sampleRate);
    const ms = Number(w.$('recordCompensation').value);
    if (!Number.isFinite(ms) || ms < 0 || ms > 2000) throw Error('Compensation must be between 0 and 2000 ms.');
    const metadata = {version: 1, sessionId: crypto.randomUUID(), sampleRate: this.context.sampleRate, channels: 1, startProjectFrame, ...(range?{rangeRecording:range}:{}),
      ...(this.calibration?.metadata(ms) ?? {compensationFrames: Math.round(ms * this.context.sampleRate / 1000), calibration: ms ? 'manual' : 'uncalibrated'}), inputChannel: this.source.liveInput?.channelIndex ?? 0};
    const active = this.active = {trackId: track.id, before: structuredClone(track), beforeTake:this.pending.get(track.id), beforeWave:w.timeline.waves?.get(track.id)??null, project, epoch, metadata};
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
        if (this.state === 'counting' && this.context.currentTime >= this.metronome.recordAt) this.setState('recording');
        if (this.active !== active || this.state !== 'recording') return;
        this.frames = detail.frames;
        if(detail.rangePass&&active.rangePass!==detail.rangePass){active.rangePass=detail.rangePass;this.seedWave(active);}
        active.liveTakeLimit=detail.takeLimit;
        // Only newly changed fixed-position peak bins, never a whole-take envelope.
        w.timeline.appendRecording(track.id, detail);
        w.renderLength(); this.render();
      });
      this.recorder.addEventListener('autostop',()=>{void this.act(()=>this.stop(true));});
      this.recorder.addEventListener('error', ({detail}) => this.abort(detail));
      let baseAudio=null;
      if(active.before.audio){
        baseAudio=active.beforeTake?.file;
        if(!baseAudio){const response=await fetch(active.before.audio.url,{credentials:'same-origin'});if(!response.ok)throw Error('The existing DI could not be loaded. Previous audio is unchanged.');baseAudio=await response.blob();}
      }
      if(this.active!==active)return;
      await this.recorder.prepare(metadata,{baseAudio});
      if(this.active!==active)return;
      active.baseWave=this.recorder.baseWave;
      if(active.baseWave||range)this.seedWave(active);
      if (this.active !== active) return;
      const when = Math.round((this.metronome?.start({bpm:project.bpm,signature:project.timeSignature,offset:startProjectFrame/metadata.sampleRate,cycleSeconds:range?.mode==='cycle'?(range.endFrame-range.startFrame)/metadata.sampleRate:null}) ?? this.context.currentTime+.15)*metadata.sampleRate)/metadata.sampleRate;
      if(this.metronome)this.metronome.recordAt=when;
      this.recorder.start(this.tap.node, Math.round(when * metadata.sampleRate));
      w.player.base.startRecording(when, startProjectFrame / metadata.sampleRate,track.id,range);
      this.frames = 0; this.setState(this.metronome?.countBeats ? 'counting' : 'recording');
      this.deviceTrack = this.source.liveStream?.getAudioTracks()[0];
      this.ended = () => this.abort(Error('Audio device disconnected. Recording discarded.'));
      this.deviceTrack?.addEventListener('ended', this.ended);
    } catch (error) { this.abort(error); }
  }
  seedWave(active){
    const wave=active.baseWave,rate=active.metadata.sampleRate,range=active.metadata.rangeRecording;
    this.workspace.timeline.setWave(active.trackId,{...wave,peaks:Array.from(wave?.peaks??[]),sampleRate:rate,peakFrames:1024,live:true,preserveTail:true,duration:Math.max(wave?.duration??0,(range?.endFrame??0)/rate)});
  }
  async stop(automatic=false) {
    if(automatic&&this.state==='counting'&&this.context.currentTime>=this.metronome.recordAt)this.state='recording';
    if (['preparing','counting'].includes(this.state)) { this.abort(); return; }
    if (this.state !== 'recording') return;
    const active = this.active;
    this.setState('finalizing');
    const continuePlayback=automatic&&active.metadata.rangeRecording?.mode==='punch';
    if(!continuePlayback)this.workspace.player.base.pause();else this.workspace.player.base.finishRecording();
    try {
      const result = await this.recorder.stop();
      if (this.active !== active) return;
      const version=this.buildVersion(active,result),cycle=active.metadata.rangeRecording?.mode==='cycle',recorder=this.recorder;
      this.cleanup({retain:cycle});this.armedId=null;this.setState('idle');
      this.pending.set(active.trackId,version.take);
      this.workspace.setTracks(active.project.tracks.map(track=>track.id===active.trackId?version.track:track),{label:null});
      this.workspace.timeline.setWave(active.trackId,version.wave);
      this.takeHistory??=new RecordingHistory(this);
      version.history=this.takeHistory.remember(active.before,version.track,version.take,active.beforeTake,active.beforeWave,version.wave);
      if(cycle)this.loopReview=new LoopReview(this,recorder,active,result,version);
      if(!continuePlayback)this.workspace.player.base.seek((active.metadata.rangeRecording?.startFrame??active.metadata.startProjectFrame)/active.metadata.sampleRate);
      this.render();this.workspace.report(cycle?'Loop takes ready. Choose Original or a take, press Play to compare, then Save project.':continuePlayback?'A/B recording finished. Playback continues after B. Save project to keep the take.':'DI take ready in RAM. Compare Before / After, then Save project.');
    } catch (error) { this.abort(error); }
  }
  buildVersion(active,result){
    const {rangeRecording,...capture}=active.metadata;
    const metadata={...capture,frames:result.frames,capturedFrames:result.capturedFrames,...(result.edit?{edit:result.edit}:{}),...(result.rangeTake?{rangeTake:result.rangeTake}:{})};
    metadata.sessionId=crypto.randomUUID();
    const file=new File([result.audio],`guitar-${metadata.sessionId}.wav`,{type:'audio/wav'}),baseline=this.workspace.saved.tracks.find(t=>t.id===active.trackId);
    const take={file,metadata,peak:result.recordedPeak??result.peaks.reduce((max,v)=>Math.max(max,v),0),before:active.before,url:URL.createObjectURL(file),expectedUpdatedAt:baseline.updatedAt,replaceChecksum:baseline.audio?.checksum??null};
    const current=active.project.tracks.find(t=>t.id===active.trackId);
    const track={...current,audio:{url:take.url,filename:file.name,contentType:'audio/wav',byteSize:file.size},recording:metadata,recordingVersionId:null,presetSnapshot:structuredClone(metadata.capturePresetSnapshot),snapshotId:metadata.sessionId,presetId:null,factoryPreset:null,...(active.before.audio?Object.fromEntries(['presetSnapshot','snapshotId','presetId','factoryPreset'].map(key=>[key,active.before[key]??null])):{})};
    const wave={peaks:result.peaks,duration:result.frames/metadata.sampleRate,recordingSessionId:metadata.sessionId};
    return {take,track,wave};
  }
  async discard() {
    const w=this.workspace,id=w.selectedId,take=this.pending.get(id),project=w.project;
    if(!take||this.busy||w.saving)return;
    if(!await confirmDialog({title:'Discard unsaved take?',message:'Restore the last saved audio and sound on this track? You can undo this discard while it remains in the two-operation audio history.',confirmLabel:'Discard take'}))return;
    if(this.pending.get(id)!==take||w.project!==project||this.busy||w.saving)return;
    const epoch=w.accountLoadEpoch,before=structuredClone(w.selectedTrack),saved=w.saved.tracks.find(t=>t.id===id),after={...before,...Object.fromEntries(RECORDING_FIELDS.map(key=>[key,saved[key]??null]))};
    this.pending.delete(id);w.setTracks(project.tracks.map(t=>t.id===id?after:t),{label:null});w.timeline.setWave(id,null);
    const history=this.takeHistory??=new RecordingHistory(this),previous=history.version(before,take),next=history.version(after);
    w.history?.record({label:`Discard take ${before.name}`,audio:true,recordingTakes:[take],recordingVersions:[previous,next],undo:()=>history.apply(previous,project,epoch,id),redo:()=>history.apply(next,project,epoch,id)});
    history.collect();w.render();
  }
  cleanup({retain=false}={}) {
    this.active = null; this.metronome?.stop(); this.releaseMeter();
    this.deviceTrack?.removeEventListener('ended', this.ended);
    if(retain)this.recorder?.releaseInput();else this.recorder?.destroy(); this.recorder = null; this.tap?.release(); this.tap = null;
  }
  abort(error) {
    if (!this.active) return;
    const id = this.active.trackId,beforeWave=this.active.beforeWave;
    this.workspace.player.base.pause(); this.cleanup(); this.armedId = null; this.setState('idle');
    this.workspace.timeline.setWave(id, beforeWave??null);
    if (error) this.workspace.report(error.message, true);
  }
  clear() {
    this.loopReview?.close();
    this.calibration?.clear(); this.abort(); this.armedId = null; this.releaseMeter();
    if(this.takeHistory)this.takeHistory.clear();else for (const take of this.pending.values()) URL.revokeObjectURL(take.url);
    this.pending.clear();
  }
  async save() {
    const w = this.workspace, project = w.project, epoch = w.accountLoadEpoch;
    for (const [id, take] of this.pending) {
      const baseline=w.saved.tracks.find(t=>t.id===id);
      const track = await w.api.saveRecording(project.id, id, take.metadata, take.file, take.expectedUpdatedAt,take.replaceChecksum);
      if (w.project !== project || w.accountLoadEpoch !== epoch) throw Error('Account or project changed during saving.');
      // Keep local mixer edits; only replace audio/provenance fields from the server.
      const fields = {audio: track.audio, recording: track.recording, recordingVersionId:track.recordingVersionId, updatedAt: track.updatedAt};
      project.tracks = project.tracks.map(t => t.id === id ? {...t, ...fields} : t);
      w.saved.tracks = w.saved.tracks.map(t => t.id === id ? {...t, ...fields, presetSnapshot:track.presetSnapshot,snapshotId:track.snapshotId,presetId: null, factoryPreset: null} : t);
      if(this.takeHistory)this.takeHistory.published(take,track,baseline);else take.savedTrack=track;take.file=null;
      this.pending.delete(id);take.adopting=true;
      const release = () => {take.adopting=false;URL.revokeObjectURL(take.url);};
      if (w.player?.base?.adoptAudioReference) w.player.base.adoptAudioReference(id, take.url, track.audio, release);
      else release();
    }
  }
  render() {
    this.monitoringChanged?.();
    const w = this.workspace, $ = w.$, track = w.selectedTrack, eligible = this.eligible;
    if (!$('projectRecord')) return;
    this.takeHistory?.renderComparison?.();
    this.loopReview?.render();
    const armedTrack=w.project?.tracks.find(t=>t.id===this.armedId&&!t.removedAt),recordable=this.canArm(armedTrack)&&!w.separation?.result,statusTrack=armedTrack??track;
    const lockControl=control=>{if(!control)return;this.disabled??=new Map();if(!this.disabled.has(control))this.disabled.set(control,control.disabled);control.disabled=true;};
    // Keep only the armed track's speaker available during a take. Disabling
    // the entire list would make it impossible to cut feedback while recording.
    if(w.timeline)w.timeline.locked=this.busy;
    for (const [id, row] of w.timeline?.rows ?? []) {
      const armed=this.armedId===id,monitor=row.modes?.inputMonitoring;
      if(row.lane)row.lane.inert=this.busy;
      row.root?.classList.toggle('armed',armed);row.root?.classList.toggle('recording',armed&&['counting','recording'].includes(this.state));
      if(this.busy)for(const control of [...(row.structuralControls??[]),...Object.values(row.modes??{}),row.volume,row.pan]){
        if(control!==monitor||!armed||!['counting','recording'].includes(this.state))lockControl(control);
      }
      if(monitor){
        monitor.disabled=Boolean(w.saving||w.separation?.busy||row.structuralLocked)||(this.busy?!(armed&&['counting','recording'].includes(this.state)):!usesTrackPreset(row.track));
        monitor.title=monitor.disabled&&this.busy?'Monitoring is available only on the armed track during capture.':'Input monitoring: '+(row.track.inputMonitoring?'on':'off')+' · independent from arming';
      }
      if(row.arm){
        row.arm.disabled=row.structuralLocked||this.busy||!this.canArm(row.track);
        row.arm.title=row.structuralLocked||w.separation?.busy?'Stop separation and save its instruments before arming.':row.track.audio?'Record replaces the captured interval (Undo available). A/B limits the recorded interval; Loop keeps multiple takes.':this.pending.size>=2?'Save pending takes before arming another track.':`${armed?'Disarm':'Arm'} ${row.track.name} (R) · input ${(this.source.liveInput?.channelIndex??0)+1}`;
        row.arm.classList.toggle('active',armed);row.arm.setAttribute('aria-pressed',String(armed));
      }
    }
    const showContext=w.owned&&(this.busy||armedTrack||usesTrackPreset(track??{})||this.pending.size);
    if($('recordStatusBar'))$('recordStatusBar').hidden=!showContext;
    if($('recordTrackName')){$('recordTrackName').textContent=armedTrack?.name??(usesTrackPreset(track??{})?track.name:'Recording');$('recordTrackName').title=$('recordTrackName').textContent;}
    if($('recordSettingsTrack'))$('recordSettingsTrack').textContent=track?`Selected track: ${track.name}`:'Select a personal guitar or bass track.';
    $('recordCurrentTone').disabled=!eligible||this.busy;
    if($('recordOptions')){$('recordOptions').hidden=!w.owned;$('recordOptions').disabled=this.busy||w.saving;}
    $('projectRecord').hidden=!w.owned;
    $('projectRecord').disabled=!recordable||this.busy;
    $('projectRecord').setAttribute('aria-pressed',String(['counting','recording'].includes(this.state)));
    const ab=w.player.loop,rangeLabel=ab&&ab.end-ab.start>=.05?(ab.enabled?'A/B loop · multiple takes':'A/B punch · playback continues after B'):'Free recording · until Stop';
    $('projectRecord').title=w.separation?.result?'Save the separated instruments before recording.':recordable?`Record to ${armedTrack.name} · ${rangeLabel} · count-in ${this.metronome?.countInBars??1} bar(s)`:'Arm a personal guitar or bass track using its microphone icon (R).';
    $('projectRecordStop').disabled=this.busy?!['preparing','counting','recording'].includes(this.state):!w.player?.playing&&!(w.player?.position>0);
    $('projectRecordStop').title=this.busy?'Stop recording (during count-in: cancel take)':'Stop playback';
    if($('projectMetronome')){$('projectMetronome').setAttribute('aria-pressed',String(Boolean(this.metronome?.enabled)));$('projectMetronome').title='Click during the take: '+(this.metronome?.enabled?'on':'off');}
    if($('projectCountIn'))$('projectCountIn').disabled=this.busy;
    if($('projectTimelineTempo'))$('projectTimelineTempo').disabled=this.busy;
    $('recordCompensation').disabled = this.busy;
    $('recordDiscard').hidden = !this.pending.has(track?.id); $('recordDiscard').disabled = this.busy || w.saving;
    $('recordStatus').textContent = this.busy ? `${this.state === 'counting' ? `Count-in · ${this.metronome.count || 'Get ready'}` : this.state === 'recording' ? `Recording DI${this.active?.metadata.rangeRecording?.mode==='cycle'?` · take ${this.active.rangePass??1} · last ${this.active.liveTakeLimit??3} complete takes retained`:this.active?.metadata.rangeRecording?' · A/B punch':''}` : this.state === 'preparing' ? 'Preparing capture' : this.state === 'calibrating' ? 'Calibrating latency' : 'Finalizing take'} · ${((this.frames ?? 0) / this.context.sampleRate).toFixed(1)} s`
      : this.pending.has(statusTrack?.id) ? `Take in RAM · ${this.pending.get(statusTrack.id).peak > .00001 ? `peak ${(20 * Math.log10(this.pending.get(statusTrack.id).peak)).toFixed(1)} dBFS · Play to listen` : 'silence detected: check input/channel'} · Save project to keep it.` : statusTrack?.audio ? 'Ready · A/B limits recording; Loop records multiple takes · Undo keeps two audio operations.'
      : this.pending.size >= 2 ? 'Two takes are already in RAM. Save project before recording another track.'
      : `${armedTrack?'Armed · ':''}${this.source.liveInput?.label ?? 'Input not enabled'} · input ${(this.source.liveInput?.channelIndex ?? 0) + 1} · ${this.calibration?.active ? this.calibration.statusLabel : 'manual compensation (uncalibrated)'}`;
    if(this.state==='recording'&&this.active?.metadata.rangeRecording?.mode==='punch'&&w.player.position<this.active.metadata.rangeRecording.startFrame/this.context.sampleRate)$('recordStatus').textContent='Playing before A · recording will be kept only between A and B';
    if(!this.busy&&!armedTrack&&!usesTrackPreset(track??{})&&this.pending.size)$('recordStatus').textContent=`${this.pending.size} take(s) in RAM · Select a personal track to edit its sound · Save project to keep audio.`;
    if($('recordStatus'))$('recordStatus').title=$('recordStatus').textContent;
    this.calibration?.render();
    for (const id of ['projectNew', 'projectImport', 'projectAddTrack', 'projectEdit', 'projectShare', 'projectLeave', 'projectSave', 'projectUndo', 'projectRedo', 'projectPlay', 'projectRewind', 'projectLoop', 'projectLoopReset']) {
      if (this.busy && $(id)) { this.disabled ??= new Map(); if (!this.disabled.has($(id))) this.disabled.set($(id), $(id).disabled); $(id).disabled = true; }
    }
    if ($('studioUseMix') && this.busy) $('studioUseMix').disabled = true;
    if($('projectTracks'))$('projectTracks').inert=Boolean(w.saving);
    for (const id of ['projectRuler','studioSeparation']) if($(id))$(id).inert=this.busy||Boolean(w.saving);
  }
}
