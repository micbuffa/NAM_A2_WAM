import test from 'node:test';
import assert from 'node:assert/strict';
import {MultitrackEngine} from '../../examples/wam/source-separation/MultitrackEngine.js';
import {ProgressiveMultitrackEngine} from '../../examples/wam/source-separation/ProgressiveMultitrackEngine.js';
import {preferredModel,backendPolicy} from '../../examples/wam/source-separation/BackendPolicy.js';
function context(){
  const param=()=>({setTargetAtTime(){}}),node=()=>({gain:param(),pan:param(),connect(to){return to;},disconnect(){},stop(){},start(...args){this.started=args;}});
  return {currentTime:0,state:'running',resume:async()=>{},createGain:node,createStereoPanner:node,createBufferSource:node,
    createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:i=>data[i]};}};
}
function tracks(ctx,seconds=4,base=0){return ['bass','guitar'].map((role,i)=>{const buffer=ctx.createBuffer(2,44100*seconds,44100);buffer.getChannelData(0).fill(base+i);buffer.getChannelData(1).fill(base+i+.5);return {id:`${role}-${i}`,buffer};});}
const flush=()=>new Promise(r=>setImmediate(r));
test('GPU recommendation prefers validated GPU runtime even when guitar is in other; CPU remains manual and fallback',()=>{
  const cpu={id:'6s',roles:['guitar'],runtime:'legacy',backends:['wasm']},gpu={id:'4s',roles:['other','vocals'],runtime:'demucs-onnx-core',backends:['wasm','webgpu']},invalid={...cpu,id:'unvalidated',backends:['webgpu']};
  assert.equal(preferredModel([cpu,invalid,gpu],{webgpu:true}).id,'4s');
  assert.equal(preferredModel([cpu,gpu],{webgpu:false}).id,'6s');
  assert.equal(preferredModel([cpu,invalid],{webgpu:true}).id,'6s');
  assert.equal(backendPolicy(cpu,{webgpu:true},'webgpu').backend,'wasm');
  assert.equal(backendPolicy(gpu,{webgpu:true},'wasm').backend,'wasm');
  assert.equal(preferredModel([],{webgpu:true}),null);
});
test('native A/B loops use one scheduled clock, preserve mixing and wrap within the region',async()=>{
  const ctx=context(),e=new MultitrackEngine(ctx);e.load(tracks(ctx,10));e.setLoopRegion(2,5);await e.play();
  assert.equal(e.offset,2);assert.deepEqual(e.voices.map(v=>[v.source.started,v.source.loopStart,v.source.loopEnd]),[[[.03,2],2,5],[[.03,2],2,5]]);
  ctx.currentTime=4.03;assert.ok(Math.abs(e.position-3)<1e-8);
  e.pause();assert.ok(Math.abs(e.offset-3)<1e-8);await e.setLoop(false);await e.play();ctx.currentTime+=5;assert.ok(e.position>5);
  e.stop();e.resetLoopRegion();assert.deepEqual(e.loopBounds,{start:0,end:10});e.destroy();
});
test('invalid A/B updates leave active voices and region intact; live edits resume inside new range',async()=>{
  const ctx=context(),e=new MultitrackEngine(ctx);e.load(tracks(ctx,10));e.setLoopRegion(1,4);await e.play();const old=e.voices[0];
  for(const pair of [[4,1],[2,2],[NaN,5],[0,Infinity]])assert.throws(()=>e.setLoopRegion(...pair));
  assert.equal(e.voices[0],old);assert.deepEqual(e.loopBounds,{start:1,end:4});
  await e.setLoopRegion(5,8);assert.equal(e.offset,5);assert.equal(e.playing,true);assert.notEqual(e.voices[0],old);e.destroy();
});
test('progressive region crossing chunks copies the correct stereo samples and loops natively before completion',async()=>{
  const ctx=context(),e=new ProgressiveMultitrackEngine(ctx);e.startStream({roles:['bass','guitar'],totalFrames:12*44100});
  e.append(0,tracks(ctx,4,1));e.append(4*44100,tracks(ctx,4,3));e.setLoopRegion(3,6);await e.play();
  assert.equal(e.complete,false);assert.equal(e.regionPlaying,true);assert.equal(e.voices.length,2);
  const buffer=e.voices[0].source.buffer;assert.equal(buffer.length,3*44100);assert.equal(buffer.getChannelData(0)[0],1);assert.equal(buffer.getChannelData(0)[44100],3);assert.equal(buffer.getChannelData(1)[44100],3.5);
  const cache=e.regionCache;ctx.currentTime=4.03;assert.ok(Math.abs(e.position-4)<1e-8);
  e.append(8*44100,tracks(ctx));assert.equal(e.voices.length,2);e.pause();await e.play();assert.equal(e.regionCache,cache);
  await e.setLoop(false);assert.equal(e.regionPlaying,false);assert.equal(e.voices[0].source.loop,undefined);e.destroy();assert.equal(e.regionCache,null);
});
test('unpublished B waits for audio instead of looping too early; a partial finish clamps the region',async()=>{
  const ctx=context(),e=new ProgressiveMultitrackEngine(ctx);e.startStream({roles:['bass','guitar'],totalFrames:12*44100});e.append(0,tracks(ctx));e.setLoopRegion(2,6);await e.play();
  ctx.currentTime=2.03;e.voices[0].source.onended();assert.equal(e.waiting,true);assert.equal(e.offset,4);
  e.append(4*44100,tracks(ctx));await flush();assert.equal(e.regionPlaying,true);assert.equal(e.offset,4);
  e.pause();e.setLoopRegion(7,11);e.finish(true);assert.deepEqual(e.loopBounds,{start:7,end:8});e.destroy();
});
