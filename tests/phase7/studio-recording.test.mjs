import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {RingBuffer} from '../../examples/wam/source-separation/vendor/ringbuf/index.js';
import {CaptureWriter} from '../../examples/wam/projects/recording/CaptureWriter.js';
import {encodeTake, takeLayout, MAX_TAKE_BYTES, IncrementalTake} from '../../examples/wam/projects/recording/TakePCM.js';
import {ProjectPlayer} from '../../examples/wam/projects/ProjectPlayer.js';
import {StudioPlayer} from '../../examples/wam/projects/StudioPlayer.js';
import {StudioRecording} from '../../examples/wam/projects/recording/StudioRecording.js';
import {presetValue, trackChanges} from '../../examples/wam/projects/ProjectsModel.js';
import {mixSources} from '../../examples/wam/projects/StudioMixExporter.js';

const metadata = {sampleRate: 8000, startProjectFrame: 0, compensationFrames: 0, capturedFrames: 4};
function queue(capacity = 2048, startFrame = 0, maxFrames = 10000) {
  const storage = RingBuffer.getStorageForCapacity(capacity, Float32Array), control = new SharedArrayBuffer(12);
  return {storage, control, writer: new CaptureWriter({storage, control, startFrame, maxFrames}), reader: new RingBuffer(storage, Float32Array)};
}
test('DI producer captures exact samples at a scheduled frame across varying quantum lengths', () => {
  const {writer, reader, control} = queue(2048, 3);
  writer.process(Float32Array.of(0,1), 0, 2);
  writer.process(Float32Array.of(2,3,4,5,6), 2, 5);
  writer.process(Float32Array.of(7,8,9), 7, 3);
  writer.stop(); writer.process(Float32Array.of(10), 10, 1);
  const result = new Float32Array(7); assert.equal(reader.pop(result), 7);
  assert.deepEqual([...result], [3,4,5,6,7,8,9]); assert.equal(Atomics.load(new Int32Array(control),0),7);
  assert.equal(Atomics.load(new Int32Array(control),1),1);
});
test('ring overflow, input loss, missed start and frame discontinuity invalidate the take rather than dropping PCM', () => {
  for (const scenario of ['overflow','input','late','gap','limit']) {
    const {writer, control} = queue(3, 0, scenario === 'limit' ? 2 : 100);
    if(scenario==='gap') { writer.process(Float32Array.of(1),0,1); writer.process(Float32Array.of(1),2,1); }
    else writer.process(scenario === 'input' ? null : new Float32Array(4), scenario === 'late' ? 1 : 0, scenario === 'limit' ? 3 : 4);
    assert.equal(Atomics.load(new Int32Array(control),2),1,scenario);
  }
});
test('positive placement pads project zero and applies compensation exactly once without changing DI floats', async () => {
  const result=encodeTake([Float32Array.of(.125,-.5),Float32Array.of(.75,1.25)], {...metadata,startProjectFrame:5,compensationFrames:2});
  assert.equal(result.frames,7); const bytes=await result.audio.arrayBuffer(), view=new DataView(bytes);
  assert.equal(view.getUint32(24,true),8000); assert.equal(view.getUint16(20,true),3);
  assert.deepEqual(Array.from({length:7},(_,i)=>view.getFloat32(44+i*4,true)),[0,0,0,.125,-.5,.75,1.25]);
});
test('negative placement crops pre-zero capture, preserving samples across chunk boundaries',async()=>{
  const result=encodeTake([Float32Array.of(1,2),Float32Array.of(3,4)],{...metadata,compensationFrames:3});
  const view=new DataView(await result.audio.arrayBuffer());assert.equal(result.frames,1);assert.equal(view.getFloat32(44,true),4);
});
test('bad metadata, missing PCM, nonfinite values, empty and oversized takes are rejected',()=>{
  assert.throws(()=>takeLayout({...metadata,compensationFrames:4}),/empty/);
  assert.throws(()=>takeLayout({...metadata,startProjectFrame:MAX_TAKE_BYTES}),/limit/);
  assert.throws(()=>takeLayout({...metadata,startProjectFrame:.5}),/metadata/);
  assert.throws(()=>encodeTake([Float32Array.of(1)],metadata),/lost/);
  assert.throws(()=>encodeTake([Float32Array.of(1,NaN,2,3)],metadata),/invalid/);
});
test('worker drains all accepted frames only after producer StopAck, ignoring stale finish messages',async()=>{
  const {writer, storage, control}=queue(), messages=[];
  const script=(await readFile(new URL('../../examples/wam/projects/recording/capture-worker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  const scope={RingBuffer,IncrementalTake,Float32Array,Int32Array,Atomics,performance:{now:()=>1000},postMessage:data=>messages.push(data),setInterval:()=>1,clearInterval:()=>{}};
  vm.createContext(scope);vm.runInContext(script,scope);
  scope.onmessage({data:{type:'init',sessionId:'a',metadata,storage,control}});
  writer.process(Float32Array.of(.1,.2,.3,.4),0,4);writer.stop();
  scope.onmessage({data:{type:'finish',sessionId:'stale',frames:4}});assert.equal(messages.filter(m=>m.type==='complete').length,0);
  scope.onmessage({data:{type:'finish',sessionId:'a',frames:4}});
  const complete=messages.find(m=>m.type==='complete');assert.equal(complete.capturedFrames,4);assert.equal(complete.audio.size,60);
});
test('worker refuses finalization before producer acknowledgement',async()=>{
  const {storage,control}=queue(), messages=[];
  const script=(await readFile(new URL('../../examples/wam/projects/recording/capture-worker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  const scope={RingBuffer,IncrementalTake,Float32Array,Int32Array,Atomics,performance:{now:()=>1000},postMessage:data=>messages.push(data),setInterval:()=>1,clearInterval:()=>{}};
  vm.createContext(scope);vm.runInContext(script,scope);scope.onmessage({data:{type:'init',sessionId:'a',metadata,storage,control}});
  scope.onmessage({data:{type:'finish',sessionId:'a',frames:0}});assert.match(messages.at(-1).error,/not stopped/);
});
const node=()=>({gain:{value:1,setTargetAtTime(){}},pan:{setTargetAtTime(){}},connect(){return this;},disconnect(){}});
function context() {return {currentTime:1,createGain:node,createStereoPanner:node,createBufferSource(){return {...node(),start(when,offset){this.started=[when,offset];},stop(){}};}};}
test('recording backing playback shares the supplied start clock, ignores looping, and extends an empty project',()=>{
  const ctx=context(),player=new ProjectPlayer(ctx);player.channels.set(1,{buffer:{duration:2},playback:node(),voices:new Set()});
  player.loop={enabled:true,start:0,end:1};player.startRecording(1.5,.5);
  const source=[...player.channels.get(1).voices][0];assert.deepEqual(source.started,[1.5,.5]);assert.equal(player.looping,false);
  ctx.currentTime=5;source.onended();assert.equal(player.playing,true);assert.equal(player.position,4);assert.equal(player.duration,4);
  player.pause();assert.equal(player.position,4);assert.equal(player.recording,false);
  const empty=new ProjectPlayer(ctx);empty.startRecording(5,0);ctx.currentTime=6;assert.equal(empty.position,1);empty.pause();
});
test('Studio transport shortcuts cannot seek, loop, pause or restart during capture',()=>{
  const player=new StudioPlayer(context());player.recordingLock=true;let called=0;
  for(const key of ['play','pause','stop','seek','setLoop'])player.base[key]=()=>called++;
  player.play();player.pause();player.stop();player.seek(10);player.setLoop({enabled:true});assert.equal(called,0);
});
test('snapshot identity is independent of mutable account presets and deep clones do not stay dirty',()=>{
  const track={id:1,presetId:null,factoryPreset:null,presetSnapshot:{version:2,a:{entries:[{id:'amp',gain:.5}]}},snapshotId:'take'};
  assert.equal(presetValue(track),'snapshot:take');assert.deepEqual(trackChanges([track],[structuredClone(track)]),[]);
  const changed=structuredClone(track);changed.presetSnapshot.a.entries[0].gain=.7;
  assert.equal(trackChanges([track],[changed]).length,1);assert.equal(track.presetSnapshot.a.entries[0].gain,.5);
});
test('mix export refuses a snapshot preset until processed DI rendering is qualified',()=>{
  assert.throws(()=>mixSources([{id:1,audio:{},presetSnapshot:{}}],new Map()),/Preset rendering/);
});
test('new-take persistence is retriable; a failed upload keeps the exact WAV and old saved track',async()=>{
  const recording=Object.create(StudioRecording.prototype), file=new File(['raw'],'take.wav',{type:'audio/wav'});
  const old={id:1,audio:null},project={id:2,tracks:[{...old,volume:30}]},saved={tracks:[{...old}]};
  const take={file,metadata:{sessionId:'take'},url:'blob:take',expectedUpdatedAt:'v1'};recording.pending=new Map([[1,take]]);
  recording.workspace={project,saved,accountLoadEpoch:1,api:{saveRecording:async()=>{throw Error('offline');}}};
  await assert.rejects(()=>recording.save(),/offline/);assert.equal(recording.pending.get(1).file,file);assert.equal(saved.tracks[0].audio,null);
  recording.workspace.api.saveRecording=async()=>({id:1,audio:{url:'/saved.wav'},recording:take.metadata,presetSnapshot:{version:2,a:{}},snapshotId:'take',updatedAt:'v2'});
  await recording.save();assert.equal(recording.pending.size,0);assert.equal(project.tracks[0].volume,30);assert.equal(saved.tracks[0].audio.url,'/saved.wav');
});


test('DI tap connects the selected raw channel before trim and releases only its own branch', async () => {
  const {default: SourceManager} = await import('../../examples/wam/SourceManager.js');
  const source=Object.create(SourceManager.prototype),calls=[],raw={connect(...args){calls.push(['connect',...args]);},disconnect(...args){calls.push(['disconnect',...args]);}};
  source.mode='live';source.liveInput={channelIndex:1};source.liveSplitter=raw;source.audioContext={createGain:node};
  const tap=source.createDITap();assert.equal(tap.node.channelCount,1);assert.deepEqual(calls[0],['connect',tap.node,1,0]);
  tap.release();assert.deepEqual(calls[1],['disconnect',tap.node]);source.mode='file';assert.throws(()=>source.createDITap(),/live input/);
});
test('monitoring copies an unsaved current Tone independently and does not arm automatically', async()=>{
  const recording=Object.create(StudioRecording.prototype),state={version:2,a:{entries:[{gain:.4}]}},track={id:1,origin:'personal',instrument:'guitar',audio:null};
  const w={owned:true,selectedId:1,project:{tracks:[track]},get selectedTrack(){return this.project.tracks[0];},setTracks(tracks){this.project.tracks=tracks;}};
  recording.workspace=w;recording.pending=new Map();recording.context={resume:async()=>{}};recording.rack={getState:async()=>state};recording.enableLive=async()=>{};recording.render=()=>{};
  await recording.monitor();const copy=w.selectedTrack.presetSnapshot;assert.notEqual(copy,state);assert.equal(recording.armedId,undefined);assert.equal(w.selectedTrack.inputMonitoring,true);
  state.a.entries[0].gain=.9;assert.equal(copy.a.entries[0].gain,.4);
});
test('first milestone refuses occupied, accompaniment, shared and over-budget track recording',()=>{
  const r=Object.create(StudioRecording.prototype);r.pending=new Map();const track={id:1,origin:'personal',instrument:'guitar'};
  r.workspace={owned:true,selectedTrack:track};assert.equal(r.eligible,true);
  track.audio={url:'/old.wav'};assert.equal(r.eligible,false);delete track.audio;
  track.origin='stem';assert.equal(r.eligible,false);track.origin='personal';
  r.workspace.owned=false;assert.equal(r.eligible,false);r.workspace.owned=true;
  r.pending=new Map([[2,{}],[3,{}]]);assert.equal(r.eligible,false);
});

test('a live waveform renders before an AudioFile exists and survives rebuilding the empty track row',async()=>{
  const {ProjectTimeline}=await import('../../examples/wam/projects/ProjectTimeline.js');
  const timeline=Object.create(ProjectTimeline.prototype),classes=new Set(),rendered=[];
  const row={track:{id:1,audio:null},clip:{style:{}},note:{},lane:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},clipName:{},wave:{}};
  timeline.root={style:{setProperty(){}}};timeline.rows=new Map([[1,row]]);timeline.waves=new Map([[1,{peaks:Float32Array.of(.1,.3,.2),duration:2}]]);timeline.length={seconds:32};timeline.position=1;
  timeline.createRenderer=()=>({render(data){rendered.push(data);},renderProgress(){}});
  timeline.drawWave(1);await Promise.resolve();
  assert.equal(row.clip.hidden,false);assert.equal(row.note.hidden,true);assert.equal(classes.has('empty'),false);
  assert.equal(row.clipName.textContent,'Recording DI…');assert.equal(row.clip.style.width,'6.25%');assert.equal(rendered[0].getChannelData()[1],Math.fround(.3));
  row.renderer=null;timeline.drawWave(1);assert.equal(rendered.length,2);
});

test('every track type has a post-fader meter; voice changes and removed tracks release meter connections',async()=>{
  const {TrackMeters}=await import('../../examples/wam/projects/TrackMeters.js');
  const calls=[],levels=[],makeNode=id=>({connect(a){calls.push(['connect',id,a]);},disconnect(a){calls.push(['disconnect',id,a]);}});
  const meters=Object.create(TrackMeters.prototype);meters.entries=new Map();
  meters.context={state:'running',createAnalyser:()=>({getFloatTimeDomainData(samples){samples.fill(.25);},disconnect(){}})};
  const rows=new Map([[1,{track:{origin:'personal'}}],[2,{track:{origin:'original'}}],[3,{track:{origin:'stem',streamId:'bass'}}]]);
  meters.timeline={rows,setLevel:(id,level)=>levels.push([id,level])};meters.player={channels:new Map([1,2,3].map(id=>[id,{pan:makeNode(id)}]))};
  meters.update();assert.equal(meters.entries.size,3);assert.deepEqual(levels,[[1,.25],[2,.25],[3,.25]]);
  meters.player.preview={voices:[{id:'bass',pan:makeNode('preview')}],normalizationNode:{gain:{value:2}}};levels.length=0;meters.update();assert.deepEqual(levels,[[1,0],[2,0],[3,.5]]);
  rows.delete(3);meters.update();assert.equal(meters.entries.has(3),false);assert.ok(calls.some(call=>call[0]==='disconnect'&&call[1]==='preview'));
});

test('Play isolates recorded audio from live monitoring; pause restores monitoring and Record keeps it',async()=>{
  const c=context();c.resume=async()=>{};const p=new ProjectPlayer(c);
  const input={targets:new Set(),connect(to){this.targets.add(to);},disconnect(to){this.targets.delete(to);}};
  const gain=()=>({value:1,setTargetAtTime(value){this.value=value;}});
  const channel={buffer:{duration:10},playback:{...node(),gain:gain()},gain:{...node(),gain:gain()},pan:node(),voices:new Set(),monitoring:true,insert:{live:node()}};
  p.channels.set(1,channel);p.liveTrack=1;p.setLiveInput(input);assert.equal(p.liveId,1);assert.ok(input.targets.has(channel.insert.live));
  await p.play();assert.equal(p.liveId,null);assert.equal(input.targets.size,0);assert.equal(channel.playback.gain.value,1,'monitoring must not silence the recorded file during Play');
  p.changed();assert.equal(input.targets.size,0,'a UI/mix state refresh must not reconnect live input during playback');
  p.pause();assert.equal(p.liveId,1);assert.ok(input.targets.has(channel.insert.live));assert.equal(channel.playback.gain.value,0);
  p.startRecording(2,0);assert.equal(p.liveId,1);assert.ok(input.targets.has(channel.insert.live));p.pause();
});

test('a completed stopped separation no longer blocks an empty guitar track, active separation still does',()=>{
  const r=Object.create(StudioRecording.prototype);r.pending=new Map();r.workspace={owned:true,selectedTrack:{id:1,origin:'personal',instrument:'guitar'},separation:{busy:false,result:{engine:{complete:true,availableFrames:44100}}}};
  assert.equal(r.eligible,true);r.workspace.separation.busy=true;assert.equal(r.eligible,false);
  r.workspace.separation.busy=false;r.workspace.separation.result.engine.complete=false;assert.equal(r.eligible,false);
});

test('arming promotes stopped instruments before enabling monitoring, but fails safely on save error',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'crossOriginIsolated');
  Object.defineProperty(globalThis,'crossOriginIsolated',{configurable:true,value:true});
  try {
    const r=Object.create(StudioRecording.prototype),calls=[];r.pending=new Map();r.source={liveInput:{}};
    r.workspace={owned:true,selectedId:1,project:{id:2},selectedTrack:{id:1,origin:'personal',instrument:'guitar'},separation:{result:{engine:{complete:true}}},
      async prepareRecordingBacking(){calls.push('publish');this.separation.result=null;}};
    r.monitor=async()=>calls.push('monitor');await r.arm();assert.deepEqual(calls,['publish','monitor']);assert.equal(r.armedId,1);
    r.armedId=null;r.workspace.separation.result={engine:{complete:true}};r.workspace.prepareRecordingBacking=async()=>{throw Error('disk quota');};calls.length=0;
    await assert.rejects(()=>r.arm(),/disk quota/);assert.deepEqual(calls,[]);assert.equal(r.armedId,null);assert.ok(r.workspace.separation.result);
  }finally{previous?Object.defineProperty(globalThis,'crossOriginIsolated',previous):delete globalThis.crossOriginIsolated;}
});

test('recording preparation retains the stopped separation until successful project publication',async()=>{
  const {ProjectsWorkspace}=await import('../../examples/wam/projects/ProjectsWorkspace.js');
  const w=Object.create(ProjectsWorkspace.prototype);w.project={id:2};w.accountLoadEpoch=1;w.report=()=>{};
  const result={engine:{complete:true,availableFrames:44100}};w.separation={result,busy:false};
  let saved=0;w.save=async()=>{saved++;};await assert.rejects(()=>w.prepareRecordingBacking(),/could not be saved/);
  assert.equal(w.separation.result,result);w.save=async()=>{saved++;w.separation.result=null;};await w.prepareRecordingBacking();assert.equal(saved,2);
  w.separation={busy:true,result};await assert.rejects(()=>w.prepareRecordingBacking(),/Stop separation/);
});

test('Stop separation → Add guitar → Arm keeps the guitar and publishes the partial instruments together',async()=>{
  const {ProjectsWorkspace}=await import('../../examples/wam/projects/ProjectsWorkspace.js');
  const {StudioSeparation}=await import('../../examples/wam/projects/StudioSeparation.js');
  const previous=Object.getOwnPropertyDescriptor(globalThis,'crossOriginIsolated');Object.defineProperty(globalThis,'crossOriginIsolated',{configurable:true,value:true});
  try {
    const cxt=context();cxt.resume=async()=>{};
    const player=new StudioPlayer(cxt),w=Object.create(ProjectsWorkspace.prototype);
    const original={id:1,name:'Source',origin:'original',instrument:'other',timelineVisible:true,volume:80,pan:0};
    w.project={id:2,name:'Stopped song',bpm:120,owned:true,tracks:[original]};w.saved=structuredClone(w.project);w.projects=[];w.accountLoadEpoch=1;
    w.render=()=>{};w.report=()=>{};w.rememberVisibility=()=>{};w.player=player;
    w.api={createTrack:async()=>({id:5,name:'My guitar',origin:'personal',instrument:'guitar',timelineVisible:true,volume:80,pan:0,audio:null})};
    const c=w.separation=new StudioSeparation({context:cxt,player});c.restore(w.project);
    const model={id:'four',roles:['drums','bass','other','vocals'],files:[],version:1};c.models=[model];c.backend='wasm';
    let released=0,published=0;
    const engine={complete:true,availableFrames:44100,destroy(){released++;}};
    c.result={projectId:2,modelId:'four',engine,tracks:[{id:-1,name:'Bass preview'}]};c.mode='original';
    await w.addTrack({name:'My guitar',instrument:'guitar'});assert.equal(w.selectedTrack.id,5);
    w.persistence={save:async(result,selected)=>{
      published++;assert.equal(result.engine,engine);assert.equal(selected.id,'four');
      return {...w.project,tracks:[{...original,timelineVisible:false},...model.roles.map((role,i)=>({id:10+i,name:role,origin:'stem',instrument:role,timelineVisible:true,volume:80,pan:0})),w.project.tracks.find(t=>t.id===5)]};
    }};
    const r=w.recording=Object.create(StudioRecording.prototype);r.workspace=w;r.pending=new Map();r.source={liveInput:{}};r.monitor=async()=>{};
    await r.arm();assert.equal(published,1);assert.equal(released,1);assert.equal(c.result,null);assert.equal(r.armedId,5);
    assert.deepEqual(w.displayTracks.map(t=>t.id),[10,11,12,13,5]);assert.equal(w.selectedTrack.name,'My guitar');
  }finally{previous?Object.defineProperty(globalThis,'crossOriginIsolated',previous):delete globalThis.crossOriginIsolated;}
});

test('PCM packets are encoded once, progress sends only dirty peak bins, finalization never rescans PCM',async()=>{
  const t=new IncrementalTake({sampleRate:8000,startProjectFrame:0,compensationFrames:0});
  let sent=0,updates=0;
  for(let i=0;i<80;i++){
    const pcm=new Float32Array(250).fill(.25);t.append(pcm);pcm.fill(.9);
    const delta=t.delta();assert.ok(delta.peaks.length<=2);sent+=delta.peaks.length;updates++;
    assert.equal(delta.frames,(i+1)*250);
  }
  assert.equal(t.encodedFrames,20000);assert.equal(t.chunks,undefined);assert.ok(t.parts.every(part=>part instanceof Blob));
  assert.ok(sent<=Math.ceil(20000/1024)+updates);assert.equal(t.delta(),null);
  const encodedBefore=t.encodedFrames,result=t.finish(20000);assert.equal(t.encodedFrames,encodedBefore);assert.equal(t.parts.length,0);
  const view=new DataView(await result.audio.arrayBuffer());assert.equal(view.getFloat32(44,true),.25);assert.equal(view.getFloat32(44+19999*4,true),.25);
});
test('incremental capture applies padding/cropping across packets and keeps only immutable encoded samples',async()=>{
  for(const offset of [-3,3]){
    const t=new IncrementalTake({sampleRate:8000,startProjectFrame:Math.max(0,offset),compensationFrames:Math.max(0,-offset)});
    t.append(Float32Array.of(1,2));t.append(Float32Array.of(3,4));const r=t.finish(4),v=new DataView(await r.audio.arrayBuffer());
    assert.deepEqual(Array.from({length:r.frames},(_,i)=>v.getFloat32(44+i*4,true)),offset<0?[4]:[0,0,0,1,2,3,4]);
    assert.equal(r.encodedFrames,offset<0?1:4);
  }
});
test('live canvas retains existing canvases/pixels and repaints only newly added or modified columns',async()=>{
  const {LiveWaveform}=await import('../../examples/wam/projects/recording/LiveWaveform.js');
  const clears=[],canvases=[],container={style:{},append(canvas){canvases.push(canvas);}};
  const createCanvas=()=>({style:{},getContext:()=>({scale(){},fillRect(){},clearRect(...args){clears.push(args);}}),remove(){}});
  const renderer=new LiveWaveform(container,{createCanvas,ratio:2});
  const wave={peaks:[.25,.5],peakFrames:100,sampleRate:1000};renderer.render(wave,100);
  const first=canvases[0],oldWidth=first.width;clears.length=0;
  wave.peaks.push(.75);renderer.render(wave,100,2,3);
  assert.equal(canvases.length,1);assert.equal(canvases[0],first);assert.equal(first.width,oldWidth);assert.equal(renderer.fullRepaints,1);
  assert.ok(clears.every(([x,,w])=>x>=20&&x<30&&w===1));assert.equal(renderer.drawnColumns,30);
  clears.length=0;wave.peaks[2]=.9;renderer.render(wave,100,2,3);assert.ok(clears.every(([x])=>x>=20));
  renderer.render(wave,200);assert.equal(renderer.fullRepaints,2,'only a time-axis scale change repaints existing data');
});
test('saved WAV adoption retains one AudioBuffer and does not refetch or redecode, including in-flight loads',async()=>{
  for(const inFlight of [false,true]){
    const c=context();let decodes=0,fetches=0,finishDecode;
    const wait=new Promise(resolve=>finishDecode=resolve),buffer={duration:1};
    c.decodeAudioData=async()=>{decodes++;if(inFlight)await wait;return buffer;};
    const p=new ProjectPlayer(c,{fetchAudio:async()=>{fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};}});
    const original={id:1,volume:80,pan:0,audio:{url:'blob:take',filename:'take.wav',byteSize:4}};
    p.setTracks([original]);await new Promise(resolve=>setTimeout(resolve,0));
    let releases=0;const saved={url:'/saved.wav',filename:'take.wav',byteSize:4};
    assert.equal(p.adoptAudioReference(1,'blob:take',saved,()=>releases++),true);
    p.setTracks([{...original,audio:saved}]);assert.equal(releases,inFlight?0:1);
    finishDecode();await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(p.channels.get(1).buffer,buffer);assert.equal(p.channels.get(1).url,'/saved.wav');
    assert.equal(fetches,1);assert.equal(decodes,1);assert.equal(releases,1);p.destroy();
  }
});
