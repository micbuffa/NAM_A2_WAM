import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {makeLatencyProbe,analyzeLatencyReturn,summarizeLatency,LATENCY_PROTOCOL} from '../../examples/wam/projects/recording/LatencyAnalysis.js';
import {LatencyCapture} from '../../examples/wam/projects/recording/LatencyCapture.js';
import {LatencyProfiles,latencyConfiguration} from '../../examples/wam/projects/recording/LatencyProfiles.js';
import {RecordingCalibration,DEFAULT_RECORDING_COMPENSATION_MS} from '../../examples/wam/projects/recording/RecordingCalibration.js';
import {encodeTake} from '../../examples/wam/projects/recording/TakePCM.js';

const rate=48000,pulseOffset=4800,maxDelayFrames=1800,probe=makeLatencyProbe(rate);
test('recording starts at an unmeasured 14 ms; manual zero/decimal values and explicit calibration still take precedence',()=>{
  const fields=Object.fromEntries(['recordCalibrate','recordUseCalibration','recordResetCalibration','recordCalibrationOutput','recordCompensation','recordCalibrationStatus'].map(id=>[id,{value:'0'}]));
  const context=Object.assign(new EventTarget(),{sampleRate:rate,baseLatency:0,sinkId:''});
  const source={mode:'live',liveInput:{deviceId:'interface',channelIndex:0}};
  const controller=new RecordingCalibration({context,source,busy:false,workspace:{$:id=>fields[id]}},{profiles:{lookup:()=>null}});
  assert.equal(DEFAULT_RECORDING_COMPENSATION_MS,14);assert.equal(fields.recordCompensation.value,'14');
  assert.deepEqual(controller.metadata(14),{compensationFrames:672,calibration:'manual'});
  assert.match(fields.recordCalibrationStatus.textContent,/14 ms \(unmeasured\)/);
  controller.apply(measurement(),controller.configuration);assert.equal(fields.recordCompensation.value,'11');assert.equal(controller.metadata(11).calibration,'loopback');
  fields.recordCompensation.value='0';fields.recordCompensation.oninput();assert.equal(controller.active,null);assert.deepEqual(controller.metadata(0),{compensationFrames:0,calibration:'uncalibrated'});
  controller.configurationChanged();assert.equal(fields.recordCompensation.value,'0');
  fields.recordCompensation.value='14.5';fields.recordCompensation.oninput();assert.equal(controller.metadata(14.5).compensationFrames,696);
  fields.recordResetCalibration.onclick();assert.equal(fields.recordCompensation.value,'14');assert.equal(controller.pendingApply,null);
});
function returned(delay=528,{gain=.7,noise=.0001,echo=false}={}) {
  const samples=new Float32Array(pulseOffset+probe.length+maxDelayFrames+100);let seed=127;
  for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;samples[i]=(seed/2**31)*noise;}
  for(let i=0;i<probe.length;i++) {samples[pulseOffset+delay+i]+=probe[i]*gain;if(echo)samples[pulseOffset+delay+i+150]+=probe[i]*gain;}
  return samples;
}
const analyze=(samples,p=probe,sampleRate=rate)=>analyzeLatencyReturn(samples,p,{sampleRate,pulseOffset,maxDelayFrames});
const good=(frames=528)=>({valid:true,frames,confidence:.99});
const measurement=()=>summarizeLatency(Array.from({length:6},()=>good()),rate);

test('matched filtering finds exact frame delay with noise, inverted polarity, different gains and sample rates',()=>{
  for(const gain of [.03,.7,-.4]){const result=analyze(returned(528,{gain}));assert.equal(result.valid,true,JSON.stringify(result));assert.equal(result.frames,528);assert.equal(result.polarity,Math.sign(gain));}
  for(const sampleRate of [8000,44100,96000]){const p=makeLatencyProbe(sampleRate),samples=new Float32Array(pulseOffset+maxDelayFrames+p.length+10);samples.set(p,pulseOffset+721);const result=analyze(samples,p,sampleRate);assert.equal(result.valid,true);assert.equal(result.frames,721);}
});
test('silence, missing code, clipping, noise, ambiguous echoes and nonfinite input never qualify',()=>{
  const clipped=returned();clipped[100]=1;
  const noCode=Float32Array.from({length:10000},(_,i)=>.01*Math.sin(i*.06));
  for(const samples of [new Float32Array(10000),clipped,noCode,returned(528,{gain:0,noise:.03}),returned(528,{echo:true}),Float32Array.of(NaN)])assert.equal(analyze(samples).valid,false);
});
test('five estimates and independent sixth check reject instability and insufficient valid returns',()=>{
  const stable=[good(528),good(529),good(528),{valid:false},good(527),good(528)];
  const result=summarizeLatency(stable,rate);assert.equal(result.frames,528);assert.equal(result.spreadFrames,2);assert.equal(result.validProbes,4);assert.equal(result.validationResidualFrames,0);
  assert.throws(()=>summarizeLatency([...Array.from({length:5},()=>good()),good(600)],rate),/unstable/);
  assert.throws(()=>summarizeLatency([good(100),good(),good(),good(),good(),good()],rate),/unstable/);
  assert.throws(()=>summarizeLatency([good(),good(),good(),{valid:false},{valid:false},good()],rate),/reliable/);
  assert.throws(()=>summarizeLatency([good()],rate),/incomplete/);
});
test('worklet capture respects absolute frame windows with arbitrary quanta, reports loss, and never monitors input',async()=>{
  const packets=[],settings={startFrame:7,windowFrames:11,intervalFrames:16,count:6},capture=new LatencyCapture(settings,p=>packets.push(p));
  let frame=0;for(const size of [3,5,17,7,29,23,19]){capture.process(Float32Array.from({length:size},(_,i)=>frame+i),frame,size);frame+=size;}
  assert.equal(packets.length,6);for(let i=0;i<6;i++)assert.deepEqual([...packets[i].samples],Array.from({length:11},(_,j)=>7+i*16+j));
  const errors=[];new LatencyCapture(settings,p=>errors.push(p)).process(new Float32Array(12),8,12);assert.equal(errors[0].type,'error');
  const gap=new LatencyCapture(settings,p=>errors.push(p));gap.process(new Float32Array(8),0,8);gap.process(new Float32Array(8),9,8);assert.equal(errors.length,2);
  new LatencyCapture(settings,p=>errors.push(p)).process(undefined,0,12);assert.equal(errors.length,3);
  const code=await readFile(new URL('../../examples/wam/projects/recording/latency-processor.js',import.meta.url),'utf8');let Processor;
  const scope={LatencyCapture,AudioWorkletProcessor:class{constructor(){this.port={postMessage(){}};}},registerProcessor:(id,P)=>Processor=P,currentFrame:0};
  vm.runInNewContext(code.replace(/^import .*;\n/,''),scope);const p=new Processor({processorOptions:settings}),output=new Float32Array(8).fill(.8);
  p.process([[new Float32Array(8).fill(.6)]],[[output]]);assert.ok(output.every(value=>value===0));
});
test('measured delay places a probe on the project clock exactly once; no extra playback shift',async()=>{
  const delay=528,signal=new Float32Array(delay+probe.length+rate*.03);signal.set(probe,delay);
  const result=encodeTake([signal.subarray(0,97),signal.subarray(97)],{sampleRate:rate,startProjectFrame:1000,compensationFrames:delay,capturedFrames:signal.length});
  const view=new DataView(await result.audio.arrayBuffer());
  for(let i=0;i<probe.length;i++)assert.equal(view.getFloat32(44+(1000+i)*4,true),probe[i]);
  assert.equal(result.frames,1000+signal.length-delay);
  const zero=encodeTake([signal],{sampleRate:rate,startProjectFrame:0,compensationFrames:delay,capturedFrames:signal.length});
  assert.equal(new DataView(await zero.audio.arrayBuffer()).getFloat32(44+44*4,true),probe[44]);
});
test('profiles are bounded, local and configuration-specific; corrupt or impossible measurements are ignored',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},profiles=new LatencyProfiles(storage);
  const context={sampleRate:rate,baseLatency:.01,sinkId:'out'},source={liveInput:{deviceId:'in',channelIndex:0}};
  const configuration=latencyConfiguration(context,source,0,'test-browser');
  const value=measurement();assert.equal(profiles.save(configuration,value),true);assert.deepEqual(profiles.lookup(configuration),value);
  for(const changed of [{inputDevice:'other'},{inputChannel:1},{outputDevice:'other'},{outputChannel:1},{sampleRate:44100},{browser:'other'},{baseLatencyFrames:999}])assert.equal(profiles.lookup({...configuration,...changed}),null);
  for(let i=0;i<20;i++)profiles.save({...configuration,inputDevice:String(i)},value);assert.equal(profiles.read().length,12);
  assert.throws(()=>profiles.save(configuration,{...value,frames:-1}),/Invalid/);
  storage.setItem('nam-studio-latency-v1','not json');assert.equal(profiles.lookup(configuration),null);
  const failed=new LatencyProfiles({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});assert.equal(failed.save(configuration,value),false);
});
test('only the current applied measurement labels a take loopback; manual edits and routing changes invalidate it',()=>{
  const controller=Object.create(RecordingCalibration.prototype),source={mode:'live',liveInput:{deviceId:'in',channelIndex:0}},context={sampleRate:rate,baseLatency:0,sinkId:''};
  const fields={recordCalibrationOutput:{value:'0'},recordCompensation:{value:'0'}};
  controller.recording={context,source};controller.$=id=>fields[id];controller.render=()=>{};
  controller.apply(measurement(),controller.configuration);
  assert.equal(controller.metadata(11).calibration,'loopback');assert.equal(controller.metadata(11).compensationFrames,528);
  assert.equal(controller.metadata(12).calibration,'manual');assert.equal(controller.metadata(0).calibration,'uncalibrated');
  source.liveInput.channelIndex=1;controller.configurationChanged();assert.equal(controller.active,null);assert.equal(fields.recordCompensation.value,'14');
  source.liveInput.channelIndex=0;const configuration=controller.configuration;
  controller.pendingApply={measurement:measurement(),configuration};source.mode=null;controller.configurationChanged();assert.ok(controller.pendingApply);
  source.mode='live';controller.configurationChanged();assert.equal(controller.metadata(11).calibration,'loopback');
});

test('worker enforces window order and sends bounded progress followed by a qualified result',async()=>{
  const code=await readFile(new URL('../../examples/wam/projects/recording/latency-worker.js',import.meta.url),'utf8'),sent=[];
  const scope={analyzeLatencyReturn,summarizeLatency,postMessage:data=>sent.push(data)};
  vm.runInNewContext(code.replace(/^import .*;\n/,''),scope);
  scope.onmessage({data:{type:'init',probe,settings:{sampleRate:rate,pulseOffset,maxDelayFrames,count:6}}});
  assert.equal(sent.at(-1).type,'ready');
  scope.onmessage({data:{type:'window',index:2,samples:returned()}});assert.equal(sent.at(-1).type,'error');
  scope.onmessage({data:{type:'init',probe,settings:{sampleRate:rate,pulseOffset,maxDelayFrames,count:6}}});
  for(let index=0;index<6;index++)scope.onmessage({data:{type:'window',index,samples:returned()}});
  assert.equal(sent.filter(m=>m.type==='progress').length,6);assert.equal(sent.at(-1).type,'complete');assert.equal(sent.at(-1).result.frames,528);
});
test('cancelling worklet loading or worker startup releases taps and worker without scheduling probes',async()=>{
  const {LatencyCalibrator}=await import('../../examples/wam/projects/recording/LatencyCalibrator.js');
  for(const phase of ['module','worker']) {
    const context=Object.assign(new EventTarget(),{state:'running',sampleRate:rate,currentTime:0,resume:async()=>{},audioWorklet:{addModule:()=>new Promise(resolve=>{releaseModule=resolve;})}});
    let releaseModule,released=0,terminated=0,posted=0;
    const source=Object.assign(new EventTarget(),{createDITap:()=>({node:{},release(){released++;}})});
    const engine=new LatencyCalibrator({context,source,workerFactory:()=>({postMessage(){posted++;},terminate(){terminated++;}})});
    const task=engine.run();await Promise.resolve();
    if(phase==='worker'){releaseModule();await new Promise(resolve=>setImmediate(resolve));assert.equal(posted,1);}
    engine.cancel('test cancellation');releaseModule();await assert.rejects(task,/test cancellation/);
    assert.equal(engine.active,null);assert.equal(released,phase==='worker'?1:0);assert.equal(terminated,phase==='worker'?1:0);
  }
});
test('a manual adjustment is reset on a different device or output; transient reconnection cannot reuse another profile',()=>{
  const controller=Object.create(RecordingCalibration.prototype),source={mode:'live',liveInput:{deviceId:'one',channelIndex:0}};
  controller.recording={source,context:{sampleRate:rate,sinkId:'out',baseLatency:0}};const fields={recordCalibrationOutput:{value:'0'},recordCompensation:{value:'12'}};
  controller.$=id=>fields[id];controller.render=()=>{};controller.lastConfiguration=controller.configuration;
  source.liveInput.deviceId='two';controller.configurationChanged();assert.equal(fields.recordCompensation.value,'14');
  controller.pendingApply={measurement:measurement(),configuration:controller.configuration};
  source.mode=null;controller.configurationChanged();source.mode='live';source.liveInput.channelIndex=1;controller.configurationChanged();
  assert.equal(controller.active,undefined);assert.equal(controller.pendingApply,null);assert.equal(controller.metadata(0).calibration,'uncalibrated');
});

test('probe level is bounded and explicit; acoustic chirps survive a coloured multi-path return without weakening cable validation',()=>{
  for(const levelDb of [-30,-18,-6]){
    const signal=makeLatencyProbe(rate,{levelDb});assert.ok(Math.abs(Math.max(...signal.map(Math.abs))-10**(levelDb/20))<1e-7);
  }
  assert.throws(()=>makeLatencyProbe(rate,{levelDb:0}),/Invalid/);
  const chirp=makeLatencyProbe(rate,{mode:'acoustic',levelDb:-12}),samples=new Float32Array(pulseOffset+chirp.length+maxDelayFrames+400);
  const response=[[0,.5],[3,.3],[7,.2],[210,.2],[640,-.12]];
  for(const [offset,gain]of response)for(let i=0;i<chirp.length;i++)samples[pulseOffset+528+offset+i]+=chirp[i]*gain;
  for(let i=0;i<samples.length;i++)samples[i]+=.002*Math.sin(i*.013);
  const observed=analyzeLatencyReturn(samples,chirp,{sampleRate:rate,pulseOffset,maxDelayFrames,mode:'acoustic'});
  assert.equal(observed.valid,true,JSON.stringify(observed));assert.ok(Math.abs(observed.frames-528)<=8);
  const summary=summarizeLatency(Array.from({length:6},()=>observed),rate,{mode:'acoustic'});
  assert.equal(summary.protocol,'acoustic-chirp-v1');assert.equal(summary.compensationKind,'acoustic-round-trip');
  const silent=analyzeLatencyReturn(new Float32Array(samples.length),chirp,{sampleRate:rate,pulseOffset,maxDelayFrames,mode:'acoustic'});assert.equal(silent.valid,false);
});
test('acoustic estimates are stored separately and sent as manual compensation, never a cable-certified take',()=>{
  const controller=Object.create(RecordingCalibration.prototype),source={mode:'live',liveInput:{deviceId:'internal',channelIndex:0}};
  controller.recording={source,context:{sampleRate:rate,sinkId:'',baseLatency:0}};controller.mode='acoustic';
  const fields={recordCalibrationOutput:{value:'0'},recordCompensation:{value:'0'}};controller.$=id=>fields[id];controller.render=()=>{};
  const value=summarizeLatency(Array.from({length:6},()=>({...good(),confidence:.4})),rate,{mode:'acoustic'});
  controller.apply(value,controller.configuration);assert.deepEqual(controller.metadata(11),{compensationFrames:528,calibration:'manual'});
  const memory=new Map(),profiles=new LatencyProfiles({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)});
  profiles.save(controller.configuration,value);controller.mode='cable';assert.equal(profiles.lookup(controller.configuration),null);
  assert.equal(controller.metadata(11).calibration,'manual');
});
test('calibration guard cuts both physical inputs and speaker edges while keeping raw analysis taps and presets intact',async()=>{
  const {default:SourceManager}=await import('../../examples/wam/SourceManager.js');
  const {guardCalibrationAudio}=await import('../../examples/wam/projects/recording/CalibrationAudioGuard.js');
  class Node{constructor(){this.edges=[];}connect(to,channel=0){this.edges.push({to,channel});return to;}disconnect(to){this.edges=to?this.edges.filter(e=>e.to!==to):[];}}
  const context={destination:new Node(),createMediaElementSource:()=>new Node(),createGain:()=>new Node()},source=new SourceManager({audioContext:context,wamNode:new Node(),mediaDevices:{},player:{pause(){}}});
  source.mode='live';source.liveSplitter=new Node();source.liveInput={channelCount:2,channelIndex:0};source.liveSplitter.connect(source.sourceTrim,0);
  const secondary=new Node();source.setSecondary(secondary,1);const di=source.createDITap(),old=source.liveSplitter;
  const outputs=[new Node(),new Node()];for(const output of outputs)output.connect(context.destination);
  const release=guardCalibrationAudio({context,source,outputs,disableInput:()=>source.disconnectCurrent()});
  assert.equal(old.edges.length,1);assert.equal(old.edges[0].to,di.node,'only the raw tap receives the microphone');
  for(const output of outputs)assert.equal(output.edges.length,0);
  // Host callbacks, source/channel changes and another raw analyzer cannot reopen A/B.
  source.selectLiveChannel(1);source.setSecondary(secondary,0);const other=source.createLiveTap(0);
  assert.equal(old.edges.some(e=>e.to===source.sourceTrim||e.to===secondary),false);
  assert.ok(old.edges.some(e=>e.to===other.node));
  await release();assert.equal(source.mode,null);assert.equal(source.monitoringHolds,0);assert.equal(old.edges.length,0);
  for(const output of outputs)assert.equal(output.edges.length,1);
  await release();for(const output of outputs)assert.equal(output.edges.length,1,'no double connection on cleanup');
});
test('failed input shutdown cannot restore a feedback route',async()=>{
  const {guardCalibrationAudio}=await import('../../examples/wam/projects/recording/CalibrationAudioGuard.js');
  let connected=1,held=0;
  const output={disconnect(){connected=0;},connect(){connected++;}},source={suspendMonitoring(){held++;return()=>held--;}};
  const release=guardCalibrationAudio({context:{destination:{}},source,outputs:[output],disableInput:async()=>{throw Error('device shutdown failed');}});
  await assert.rejects(release,/shutdown/);assert.equal(connected,0);assert.equal(held,1);
});
test('opening a new live device under a calibration hold cannot feed A/B before analysis starts',async()=>{
  const {default:SourceManager}=await import('../../examples/wam/SourceManager.js');
  class Node{constructor(){this.edges=[];this.gain={setValueAtTime(){}};}connect(to,channel=0){this.edges.push({to,channel});return to;}disconnect(to){this.edges=to?this.edges.filter(e=>e.to!==to):[];}}
  let stopped=false;const track={stop(){stopped=true;},getSettings:()=>({channelCount:2,deviceId:'device'})},stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const context={currentTime:0,createGain:()=>new Node(),createMediaElementSource:()=>new Node(),createMediaStreamSource:()=>new Node(),createChannelSplitter:()=>new Node()};
  const source=new SourceManager({audioContext:context,wamNode:new Node(),player:{pause(){}},mediaDevices:{getUserMedia:async()=>stream}}),b=new Node();
  source.setSecondary(b,1);const release=source.suspendMonitoring();await source.activateLive('device',0);
  assert.equal(source.liveSplitter.edges.length,0);const tap=source.createDITap();assert.equal(source.liveSplitter.edges.length,1);assert.equal(source.liveSplitter.edges[0].to,tap.node);
  await source.disconnectCurrent();release();assert.equal(stopped,true);assert.equal(source.mode,null);assert.equal(source.monitoringHolds,0);
});
test('idle worklet warmup gaps before the scheduled recording frame are not lost capture data',()=>{
  const packets=[],capture=new LatencyCapture({startFrame:100,windowFrames:5,intervalFrames:8,count:6},p=>packets.push(p));
  const windows=capture.windows;capture.arm(100);assert.equal(capture.windows,windows,'arm retains preallocated capture buffers');
  capture.process(new Float32Array(8),0,8);capture.process(new Float32Array(8),64,8);assert.equal(capture.done,false);
  let frame=96;while(frame<150){capture.process(Float32Array.from({length:8},(_,i)=>frame+i),frame,8);frame+=8;}
  assert.equal(packets.length,6);assert.ok(packets.every(p=>p.type==='window'));assert.deepEqual([...packets[0].samples],[100,101,102,103,104]);
});
