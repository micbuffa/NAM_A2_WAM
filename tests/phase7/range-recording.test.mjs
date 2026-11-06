import test from 'node:test';import assert from 'node:assert/strict';
import {RangeCapture,recordingRange} from '../../examples/wam/projects/recording/RangeCapture.js';
import {monoHeader} from '../../examples/wam/projects/recording/TakePCM.js';
import {readDI} from '../../examples/wam/projects/recording/PunchTake.js';
import {CaptureWriter} from '../../examples/wam/projects/recording/CaptureWriter.js';
import {RingBuffer} from '../../examples/wam/source-separation/vendor/ringbuf/index.js';
import {ProjectPlayer} from '../../examples/wam/projects/ProjectPlayer.js';
const rate=8000;
const meta=(mode='cycle')=>({sampleRate:rate,startProjectFrame:2,compensationFrames:2,rangeRecording:{mode,startFrame:2,endFrame:6,transportStartFrame:mode==='punch'?0:2}});
const pcm=async audio=>new Float32Array((await audio.arrayBuffer()).slice(44));
test('unchecked Loop punches from a pre-A transport position; checked Loop starts at A',()=>{
 assert.deepEqual(recordingRange({enabled:false,start:1,end:2},.5,rate),{mode:'punch',startFrame:8000,endFrame:16000,transportStartFrame:4000});
 assert.equal(recordingRange({enabled:true,start:1,end:2},.5,rate).transportStartFrame,8000);
 assert.equal(recordingRange({enabled:false,start:1,end:2},1.5,rate).startFrame,12000);
 assert.throws(()=>recordingRange({start:1,end:2},2,rate),/before B/);assert.equal(recordingRange({start:0,end:0},0,rate),null);
});
test('cycle boundaries use compensated frames across arbitrary packets; retain last three complete plus incomplete',async()=>{
 const take=new RangeCapture(meta());
 // latency samples, then six passes with a different exact signal each, then half a pass.
 const raw=Float32Array.from([9,9,...[1,2,3,4,5,6].flatMap(v=>[v,v,v,v]),7,7]);
 for(let i=0;i<raw.length;i+=3)take.append(raw.subarray(i,i+3));
 assert.equal(take.finish(raw.length),6);assert.deepEqual(take.options.map(t=>[t.number,t.complete]),[[4,true],[5,true],[6,true],[7,false]]);
 const out=await take.render(6,null);assert.deepEqual(await pcm(out.audio),new Float32Array([0,0,6,6,6,6]));
 assert.equal(out.rangeTake.contentFrames,4);assert.equal(out.capturedFrames,28);
 const partial=await take.render(7,null);assert.deepEqual(await pcm(partial.audio),new Float32Array([0,0,7,7]));await assert.rejects(take.render(1,null),/no longer/);
});
test('punch drops pre-A and latency input and retains exact original audio outside the chosen interval',async()=>{
 const take=new RangeCapture(meta('punch')),raw=Float32Array.of(9,9,9,9,.5,.5,.5,.5);take.append(raw);assert.equal(take.finish(8),1);
 const old=new Blob([monoHeader(8,rate),Float32Array.of(1,2,3,4,5,6,7,8)]),out=await take.render(1,await readDI(old,rate));
 assert.deepEqual(await pcm(out.audio),new Float32Array([1,2,.5,.5,.5,.5,7,8]));assert.equal(out.edit.startFrame,2);assert.equal(out.rangeTake.complete,true);
});
test('manual Stop keeps a first partial take, or refuses if no audio reached A',()=>{
 const take=new RangeCapture(meta('punch'));take.append(Float32Array.of(9,9,9,9,.5));assert.equal(take.finish(5),1);assert.equal(take.options[0].complete,false);
 const empty=new RangeCapture(meta('punch'));empty.append(Float32Array.of(9,9));assert.throws(()=>empty.finish(2),/No audio/);
});
test('producer ends a punch exactly inside a quantum, without overflow or timer-based cropping',()=>{
 const storage=RingBuffer.getStorageForCapacity(128,Float32Array),control=new SharedArrayBuffer(12),writer=new CaptureWriter({storage,control,startFrame:3,maxFrames:100,stopAfterFrames:5});
 writer.process(Float32Array.of(0,0,0,1,2,3,4,5),0,8);assert.equal(writer.frames,5);assert.equal(writer.stopped,true);assert.equal(new Int32Array(control)[2],0);
 writer.process(new Float32Array(8),8,8);const output=new Float32Array(5);new RingBuffer(storage,Float32Array).pop(output);assert.deepEqual(output,Float32Array.of(1,2,3,4,5));
});
function player(){const node=()=>({gain:{setTargetAtTime(){}},connect(){return this;},disconnect(){}}),scheduled=[];const context={sampleRate:rate,currentTime:0,createGain:node,createBufferSource:()=>({...node(),start:(...args)=>scheduled.push(args),stop(){}})};const p=new ProjectPlayer(context,{timers:{setTimeout:()=>1,clearTimeout(){}}});for(const id of [1,2])p.channels.set(id,{buffer:{duration:10},playback:node(),voices:new Set()});return{p,context,scheduled};}
test('punch transport passes B without wrapping or stopping, cycle transport wraps and excludes the armed track',()=>{
 const {p,context}=player();p.loop={enabled:false,start:1,end:2};p.startRecording(.1,0,1,{mode:'punch',startFrame:8000,endFrame:16000});
 assert.equal(p.looping,false);assert.equal(p.channels.get(1).voices.size,2);context.currentTime=2.5;assert.equal(p.position,2.4);p.finishRecording();assert.equal(p.playing,true);assert.equal(p.position,2.4);p.pause();
 p.loop={enabled:true,start:1,end:2};p.startRecording(3,1,1,{mode:'cycle',startFrame:8000,endFrame:16000});context.currentTime=4.25;assert.equal(p.position,1.25);assert.equal(p.channels.get(1).voices.size,0);assert.equal(p.channels.get(2).voices.size,1);p.pause();
});

test('auditioning retained loop alternatives updates one audio command, Original stays exact, and disposal breaks predecessor links',async()=>{
 const {StudioRecording}=await import('../../examples/wam/projects/recording/StudioRecording.js'),{RecordingHistory}=await import('../../examples/wam/projects/recording/RecordingHistory.js'),{StudioHistory}=await import('../../examples/wam/projects/StudioHistory.js'),{LoopReview}=await import('../../examples/wam/projects/recording/LoopReview.js');
 const before={id:1,name:'Solo',audio:{url:'/original'},presetSnapshot:{version:2,a:{}},volume:80,pan:0,updatedAt:'base'},project={id:2,tracks:[before]};
 const w={owned:true,project,saved:{tracks:[structuredClone(before)]},accountLoadEpoch:1,selectedId:1,player:{position:0,base:{pause(){},seek(){}}},timeline:{setWave(){}},render(){},report(){},$:()=>null};
 const r=Object.create(StudioRecording.prototype);Object.assign(r,{workspace:w,context:{sampleRate:rate},pending:new Map(),state:'idle',releaseMeter(){},render(){}});r.takeHistory=new RecordingHistory(r);w.history=new StudioHistory({changed:()=>r.takeHistory.collect()});
 const active={trackId:1,before,beforeTake:null,beforeWave:null,project,epoch:1,metadata:{sampleRate:rate,compensationFrames:0,capturePresetSnapshot:{version:2,a:{}},rangeRecording:{mode:'cycle',startFrame:2,endFrame:6}}};
 const result=number=>({audio:new Blob(['raw'+number]),frames:8,capturedFrames:100,peaks:Float32Array.of(.5),rangeTake:{takeNumber:number},loopSelection:number,loopOptions:[{number:1,complete:true,frames:4},{number:2,complete:false,frames:2}],takeLimit:3});
 const version=r.buildVersion(active,result(1));project.tracks=[version.track];r.pending.set(1,version.take);version.history=r.takeHistory.remember(before,version.track,version.take,null,null,version.wave);
 let released=false;const review=r.loopReview=new LoopReview(r,{selectLoopTake:async number=>result(number),destroy(){released=true;}},active,result(1),version);
 await review.choose(0);assert.equal(project.tracks[0].audio.url,'/original');
 await review.choose(2);const takes=new Map();review.takeChoices(takes);
 assert.deepEqual(takes.get(1).options,[[0,'Original'],[1,'Take 1 · 0.00 s'],[2,'Take 2 · 0.00 s · incomplete']]);assert.equal(takes.get(1).value,2);
 const take=r.pending.get(1);assert.equal(take.metadata.rangeTake.takeNumber,2);assert.equal(w.history.entries.length,1);assert.equal(w.history.cursor,1);
 await review.choose(0);await review.choose(1);assert.equal(w.history.entries.length,1);assert.equal(r.pending.get(1).metadata.rangeTake.takeNumber,1);assert.equal(take.file,null);
 w.history.clear();assert.equal(released,true);assert.equal(r.pending.get(1).linkPreviousId,null);r.takeHistory.clear();
});

test('new take decoding does not clamp the intended audition position to zero',()=>{
 const {p}=player();p.channels.get(1).key='loading-take';p.channels.get(1).buffer=null;p.channels.get(2).buffer=null;
 p.seek(1.25);assert.equal(p.position,1.25);p.seek(Infinity);assert.equal(p.position,0);
 p.channels.get(1).buffer={duration:2};p.seek(3);assert.equal(p.position,2);
});
test('metronome cycles the same project-grid beats, with count-in only once',async()=>{
 const {Metronome}=await import('../../examples/wam/projects/recording/Metronome.js');const context={currentTime:0},clicks=[];
 const metro=new Metronome(context,null,{schedule:()=>1,cancel(){}});metro.click=(at,accent)=>clicks.push({at,accent});metro.enabled=true;
 metro.start({when:0,bpm:120,offset:.25,cycleSeconds:.75,countInBars:0});
 for(let t=0;t<2;t+=.025){context.currentTime=t;metro.pump();}
 assert.deepEqual(clicks.map(c=>Number(c.at.toFixed(2))),[.25,1,1.75]);metro.stop();
 context.currentTime=0;clicks.length=0;metro.start({when:0,bpm:120,offset:.25,cycleSeconds:.75,countInBars:1});
 for(let t=0;t<4;t+=.025){context.currentTime=t;metro.pump();}
 assert.deepEqual(clicks.map(c=>Number(c.at.toFixed(2))),[0,.5,1,1.5,2.25,3,3.75]);metro.stop();
});

test('manual Stop drains the compensation tail once and never extends a punch B deadline',async()=>{
 const {readFile}=await import('node:fs/promises'),vm=await import('node:vm');
 const script=(await readFile(new URL('../../examples/wam/projects/recording/capture-processor.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 for(const stopAfterFrames of [null,6]){
   const messages=[];let Processor;
   class WamProcessor{constructor(){this.port={postMessage:m=>messages.push(m)};}}
   const scope={CaptureWriter,currentFrame:0,webAudioModules:{getModuleScope:()=>({WamProcessor})},registerProcessor:(id,klass)=>Processor=klass};vm.createContext(scope);vm.runInContext(script,scope);
   const p=new Processor(),storage=RingBuffer.getStorageForCapacity(128,Float32Array),control=new SharedArrayBuffer(12);
   await p._onMessage({data:{type:'capture-start',sessionId:'take',storage,control,startFrame:0,maxFrames:100,stopAfterFrames}});
   p.process([[Float32Array.of(1,2,3,4)]],[[new Float32Array(4)]]);
   await p._onMessage({data:{type:'capture-stop',sessionId:'take',tailFrames:stopAfterFrames?3:2}});assert.equal(p.writer.stopped,false);
   scope.currentFrame=4;p.process([[Float32Array.of(5,6,7,8)]],[[new Float32Array(4)]]);assert.equal(p.writer.frames,6);assert.equal(p.writer.stopped,true);
   await p._onMessage({data:{type:'capture-stop',sessionId:'take',tailFrames:2}});assert.equal(messages.filter(m=>m.type==='capture-stopped').length,1);
 }
});
