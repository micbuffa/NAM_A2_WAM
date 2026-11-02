import test from 'node:test';
import assert from 'node:assert/strict';
import {Metronome} from '../../examples/wam/projects/recording/Metronome.js';
import {StudioRecording} from '../../examples/wam/projects/recording/StudioRecording.js';
import {estimateTempo} from '../../examples/wam/projects/TempoAnalysis.js';
import {TempoDetection} from '../../examples/wam/projects/TempoDetection.js';
import {barSeconds,barBeat,timelineLength,loopToBars,loopFromBars} from '../../examples/wam/projects/ProjectsModel.js';
function metronomeFixture(){
 const voices=[],context={currentTime:0,sampleRate:48000,destination:{},createOscillator(){const o={frequency:{},connect:n=>n,disconnect(){this.disconnected=true;},start(t){this.at=t;},stop(t){this.end=t;}};voices.push(o);return o;},createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect:n=>n,disconnect(){}};}};
 let tick;const m=new Metronome(context,context.destination,{schedule:fn=>(tick=fn,1),cancel(){tick=null;}});
 return{m,context,voices,pump(time){context.currentTime=time;tick?.();}};
}
test('one bar count-in shares the capture clock, accents beat one and does not click during take by default',()=>{
 const f=metronomeFixture();assert.equal(f.m.start({when:.2,bpm:120,signature:'4/4'}),2.2);
 for(const t of [.1,.6,1.1,1.6,2.1,2.6])f.pump(t);
 assert.deepEqual(f.voices.map(v=>Number(v.at.toFixed(3))),[.2,.7,1.2,1.7]);assert.deepEqual(f.voices.map(v=>v.frequency.value),[1400,950,950,950]);
 f.m.enabled=true;f.pump(3.1);assert.equal(f.voices.at(-1).at,3.2);
 f.m.stop();assert.ok(f.voices.every(v=>v.disconnected));
});
test('count-in uses signature beats, can be disabled, and cancellation disconnects scheduled clicks',()=>{
 const f=metronomeFixture();assert.equal(f.m.start({when:1,bpm:120,signature:'3/4'}),2.5);
 assert.equal(f.m.start({when:1,bpm:120,signature:'6/8',countInBars:2}),4);
 assert.equal(f.m.start({when:1,bpm:120,signature:'4/4',countInBars:0}),1);f.m.stop();
});
test('project bars, loop coordinates and beat counter agree in 3/4 and 6/8',()=>{
 assert.equal(barSeconds(120,'3/4'),1.5);assert.equal(barSeconds(120,'6/8'),1.5);
 assert.equal(barBeat(1.5,120,'3/4'),'2.1');assert.equal(barBeat(.75,120,'6/8'),'1.4');
 assert.deepEqual(timelineLength(8,120,1,'3/4'),{bars:6,seconds:9});
 assert.deepEqual(loopFromBars(loopToBars({enabled:true,start:1.5,end:6},120,'3/4'),120,'3/4'),{enabled:true,start:1.5,end:6});
});
test('arming prepares an input and meter without enabling speaker monitoring; disarm releases the tap',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'crossOriginIsolated');Object.defineProperty(globalThis,'crossOriginIsolated',{value:true,configurable:true});
 try{
  const r=Object.create(StudioRecording.prototype);let enabled=0,released=0;
  const track={id:4,origin:'personal',instrument:'guitar',presetSnapshot:{a:{entries:[]}},inputMonitoring:false};
  r.state='idle';r.pending=new Map();r.source={liveInput:{},createDITap:()=>({node:{raw:true},release(){released++;}})};
  const w=r.workspace={player:{playing:false},owned:true,selectedId:4,project:{id:9,tracks:[track]},get selectedTrack(){return this.project.tracks[0];},setTracks(t){this.project.tracks=t;}};
  r.enableLive=async()=>{enabled++;};r.context={resume:async()=>{}};r.render=()=>{};
  await r.arm();assert.equal(enabled,1);assert.equal(r.armedId,4);assert.equal(w.selectedTrack.inputMonitoring,false);assert.ok(r.meterSource(4).raw);
  w.player={playing:true};assert.equal(r.meterSource(4),null);r.state='recording';assert.ok(r.meterSource(4).raw);r.state='idle';
  await r.arm();assert.equal(released,1);assert.equal(r.armedId,null);
 }finally{previous?Object.defineProperty(globalThis,'crossOriginIsolated',previous):delete globalThis.crossOriginIsolated;}
});
test('tempo estimates rhythmic pulses, rejects silence/static tones and keeps input samples intact',()=>{
 for(const bpm of [90,120,150]){const sr=8000,pcm=new Float32Array(sr*20),beat=sr*60/bpm;
  for(let t=sr;t<pcm.length;t+=beat)for(let i=0;i<80;i++)if(Math.round(t)+i<pcm.length)pcm[Math.round(t)+i]=Math.exp(-i/15);
  const result=estimateTempo(pcm,sr);assert.ok(result);assert.ok(Math.abs(result.bpm-bpm)<=2,JSON.stringify(result));assert.equal(pcm[8000],1);
 }
 assert.equal(estimateTempo(new Float32Array(160000),8000),null);
 const tone=Float32Array.from({length:160000},(_,i)=>.5*Math.sin(i*2*Math.PI*440/8000));assert.equal(estimateTempo(tone,8000),null);
});
test('tempo worker uses a bounded transfer and ignores late results after cancellation',()=>{
 let worker;const results=[];const detector=new TempoDetection({onResult:r=>results.push(r),workerFactory:()=>worker={postMessage(data,transfer){this.data=data;this.transfer=transfer;},terminate(){this.closed=true;}}});
 const original=new Float32Array(10000);detector.analyse({length:10000,sampleRate:100,getChannelData:()=>original});
 assert.equal(worker.data.pcm.length,6000);assert.equal(worker.transfer[0],worker.data.pcm.buffer);assert.equal(original.length,10000);
 const late=worker.onmessage;detector.cancel();late({data:{result:{bpm:120}}});assert.equal(results.length,0);assert.equal(worker.closed,true);
});

test('speaker can be toggled during capture without changing arm state or calling transport start/pause',async()=>{
 const r=Object.create(StudioRecording.prototype),calls=[];r.state='recording';r.armedId=1;r.render=()=>{};
 const track={id:1,instrument:'guitar',origin:'personal',presetSnapshot:{a:{}},inputMonitoring:false};
 const w=r.workspace={selectedId:1,project:{tracks:[track]},timeline:{update(){}},player:{base:{setTracks(tracks,id){calls.push({monitor:tracks[0].inputMonitoring,id});}}}};
 await r.monitor();await r.monitor();assert.deepEqual(calls,[{monitor:true,id:1},{monitor:false,id:1}]);
 assert.equal(r.armedId,1);assert.equal(r.state,'recording');assert.equal(w.project.tracks[0].inputMonitoring,false);
});

test('ongoing metronome follows the project beat grid when recording from between beats',()=>{
 const f=metronomeFixture();f.m.enabled=true;assert.equal(f.m.start({when:1,bpm:120,signature:'4/4',countInBars:0,offset:.75}),1);
 f.pump(1.15);assert.equal(f.voices[0].at,1.25);assert.equal(f.voices[0].frequency.value,950);
 f.pump(2.15);assert.equal(f.voices.at(-1).at,2.25);assert.equal(f.voices.at(-1).frequency.value,1400);f.m.stop();
});
test('R shortcut arms only in the visible Studio, without stealing typing, dialogs or modified shortcuts',async()=>{
 const {armShortcut}=await import('../../examples/wam/projects/recording/StudioRecording.js');
 assert.equal(armShortcut({key:'r'}),true);
 for(const event of [{key:'r',repeat:true},{key:'r',metaKey:true},{key:'r',ctrlKey:true},{key:'r',target:{closest:()=>true}},{key:'x'}])assert.equal(armShortcut(event),false);
 for(const flags of [{visible:false},{busy:true},{dialog:true}])assert.equal(armShortcut({key:'R'},flags),false);
});
