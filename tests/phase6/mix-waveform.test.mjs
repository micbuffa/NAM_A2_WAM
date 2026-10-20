import test from 'node:test';
import assert from 'node:assert/strict';
import {panMatrix,buildMixPeaks,MixWaveformJob} from '../../examples/wam/source-separation/MixWaveform.js';
import {MultitrackSession} from '../../examples/wam/source-separation/MultitrackSession.js';
const buffer=channels=>({length:channels[0].length,numberOfChannels:channels.length,getChannelData:c=>channels[c]});
const track=(id,left,right=left)=>({id,buffer:buffer([Float32Array.from(left),Float32Array.from(right)])});
const settings=(...ids)=>ids.map(id=>({id,volume:1,pan:0,muted:false,solo:false}));
const compute=input=>buildMixPeaks(input,{yieldControl:()=>Promise.resolve(),framesPerTurn:2});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
test('mix sums actual PCM before peaks, so opposite-phase stems cancel rather than doubling envelopes',async()=>{
  const a=track('a',[.5,-.5]),b=track('b',[-.5,.5]);const result=await compute({tracks:[a,b],totalFrames:2,bins:2,settings:settings('a','b')});near(result.peak,0);assert.ok(result.peaks.every(x=>x<1e-7));assert.equal(a.buffer.getChannelData(0)[0],.5);
});
test('volume and common output gain affect peaks without normalizing, clipping or editing PCM',async()=>{
  const input={tracks:[track('a',[1,1]),track('b',[1,1])],totalFrames:2,settings:settings('a','b')};
  let result=await compute({...input,outputGain:.7});near(result.peak,1.4);near(result.peaks[0],1.4);
  input.settings[0].volume=.5;result=await compute({...input,outputGain:.2});near(result.peak,.3);
});
test('mute wins over solo; solo suppresses other stems including when the solo stem is muted',async()=>{
  const input={tracks:[track('a',[.2]),track('b',[.8])],totalFrames:1,settings:settings('a','b')};
  input.settings[0].solo=true;near((await compute(input)).peak,.2);
  input.settings[0].muted=true;near((await compute(input)).peak,0);
  input.settings[0].solo=false;near((await compute(input)).peak,.8);
});
test('stereo pan matches Web Audio crossfeed at center, extremes and intermediate positions',async()=>{
  const input={tracks:[track('a',[.2],[.4])],totalFrames:1,settings:settings('a')};
  for(const [pan,expected] of [[-1,.6],[0,.4],[1,.6],[-.5,.2+.4/Math.sqrt(2)],[.5,.4+.2/Math.sqrt(2)]]){input.settings[0].pan=pan;near((await compute(input)).peak,expected);}
  const mono=panMatrix(1,0);near(mono[0],Math.SQRT1_2);near(mono[2],Math.SQRT1_2);
  assert.throws(()=>panMatrix(3,0));assert.throws(()=>panMatrix(2,NaN));
});
test('pan is applied to stems before summing, so opposite signals panned apart do not cancel',async()=>{
  const mix=settings('a','b');mix[0].pan=-1;mix[1].pan=1;
  const result=await compute({tracks:[track('a',[.5]),track('b',[-.5])],totalFrames:1,settings:mix});near(result.peak,1);
});
test('mono uses equal-power pan and the opposite stereo channel is not lost in peak extraction',async()=>{
  const mono={id:'a',buffer:buffer([Float32Array.of(1)])};near((await compute({tracks:[mono],totalFrames:1,settings:settings('a')})).peak,Math.SQRT1_2);
  near((await compute({tracks:[track('a',[0],[.8])],totalFrames:1,settings:settings('a')})).peak,.8);
});
test('progressive mix keeps published samples at their total-timeline position and future peaks silent',async()=>{
  const first=[track('a',[.2,.3])],second=[track('a',[.4,.5])];const input={tracks:[{id:'a'}],totalFrames:4,bins:4,settings:settings('a')};
  const result=await compute({...input,chunks:[{startFrame:0,tracks:first}]});assert.equal(result.availableFrames,2);assert.equal(result.peaks[2],0);
  const full=await compute({...input,chunks:[{startFrame:0,tracks:first},{startFrame:2,tracks:second}]});assert.deepEqual(full.peaks.slice(0,2),result.peaks.slice(0,2));near(full.peaks[3],.5);
});
test('empty published audio and zero gains yield finite silent peaks',async()=>{
  const result=await compute({tracks:[{id:'a'}],chunks:[],totalFrames:100,settings:settings('a')});assert.equal(result.peak,0);assert.equal(result.availableFrames,0);assert.ok(result.peaks.every(x=>x===0));
});
test('bad alignment, dimensions, settings and nonfinite PCM are refused',async()=>{
  const input={tracks:[track('a',[1])],totalFrames:1,settings:settings('a')};
  for(const patch of [{totalFrames:0},{outputGain:NaN},{settings:[{id:'a',volume:NaN,pan:0}]},{tracks:[track('a',[NaN])]},{chunks:[{startFrame:1,tracks:input.tracks}]},{chunks:[{startFrame:0,tracks:[track('wrong',[1])]}]}])await assert.rejects(compute({...input,...patch}));
});
test('cooperative computation snapshots settings and can be cancelled before touching later frames',async()=>{
  const controller=new AbortController(),mix=settings('a');let calls=0;
  const pending=buildMixPeaks({tracks:[track('a',[1,1,1,1])],totalFrames:4,settings:mix},{signal:controller.signal,framesPerTurn:1,yieldControl:async()=>{calls++;mix[0].volume=0;if(calls===3)controller.abort();}});
  await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,3);
  const changing=settings('a');const snapshot=await buildMixPeaks({tracks:[track('a',[1])],totalFrames:1,settings:changing},{yieldControl:async()=>{changing[0].volume=0;}});near(snapshot.peak,1);
});
test('latest mix request wins; cancellation and out-of-order completion cannot publish a stale waveform',async()=>{
  const pending=[],results=[],errors=[];
  const job=new MixWaveformJob({compute:(_,options)=>new Promise(resolve=>pending.push({resolve,signal:options.signal})),onResult:x=>results.push(x),onError:e=>errors.push(e)});
  const a=job.request({},'a');await Promise.resolve();const b=job.request({},'b');await Promise.resolve();assert.equal(pending[0].signal.aborted,true);pending[1].resolve('new');await b;pending[0].resolve('old');await a;assert.deepEqual(results,['new']);
  assert.equal(job.request({},'b'),undefined);const c=job.request({},'c');await Promise.resolve();job.cancel();pending[2].resolve('cancelled');await c;assert.deepEqual(results,['new']);assert.deepEqual(errors,[]);
});
test('view mode is a reversible session setting; mix parameters, loop and zoom stay unchanged',()=>{
  const session=new MultitrackSession([{id:'a'}]);session.updateTrack('a',{volume:.4,pan:-.6,solo:true});session.setZoom(4);session.setLoop({enabled:false,start:.2,end:.8});const before=session.getState();session.setViewMode('mix');assert.equal(session.getState().viewMode,'mix');session.setViewMode('instruments');assert.deepEqual(session.getState(),before);assert.throws(()=>session.setViewMode('unknown'));
});

test('mix job reports current failures, allows retry and ignores failures of superseded work',async()=>{
  const pending=[],errors=[],results=[];const job=new MixWaveformJob({compute:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),onError:error=>errors.push(error.message),onResult:result=>results.push(result)});
  const first=job.request({},'first');await Promise.resolve();const next=job.request({},'next');await Promise.resolve();pending[0].reject(Error('stale'));await first;pending[1].reject(Error('current'));await next;assert.deepEqual(errors,['current']);
  const retry=job.request({},'next');await Promise.resolve();pending[2].resolve('ok');await retry;assert.deepEqual(results,['ok']);job.cancel();
});
