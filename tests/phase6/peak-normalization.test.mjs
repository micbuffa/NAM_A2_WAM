import test from 'node:test';
import assert from 'node:assert/strict';
import {peakCorrection,PeakNormalization} from '../../examples/wam/source-separation/PeakNormalization.js';
import {MultitrackEngine} from '../../examples/wam/source-separation/MultitrackEngine.js';
import {ProgressiveMultitrackEngine} from '../../examples/wam/source-separation/ProgressiveMultitrackEngine.js';
import {MultitrackSession} from '../../examples/wam/source-separation/MultitrackSession.js';
import {SeparationWorkflow} from '../../examples/wam/source-separation/SeparationWorkflow.js';
function context(){
  const param=()=>({value:1,setTargetAtTime(value){this.value=value;}}),node=()=>({connections:new Set(),gain:param(),pan:param(),connect(to){this.connections.add(to);return to;},disconnect(){this.connections.clear();},stop(){},start(...args){this.started=args;}});
  return {state:'running',currentTime:0,destination:{},resume:async()=>{},createGain:node,createStereoPanner:node,createBufferSource:node};
}
function track(id,...channels){const pcm=channels.map(c=>Float32Array.from(c));return {id,buffer:{numberOfChannels:pcm.length,length:pcm[0].length,sampleRate:44100,duration:pcm[0].length/44100,getChannelData:i=>pcm[i]}};}
function fixture(tracks=[track('a',[.2,-.4],[.3,-.1])],options={}){const ctx=context(),engine=new MultitrackEngine(ctx);engine.load(tracks);engine.outputNode.gain.value=.7;const session=new MultitrackSession(tracks),normalization=new PeakNormalization(engine,session,options);engine.sync(session.tracks);return {ctx,engine,session,normalization,cleanup(){normalization.destroy();engine.destroy();}};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('peak correction attenuates clipping, boosts quiet audio with a cap, and never boosts silence',()=>{
  const high=peakCorrection(2),quiet=peakCorrection(.001);near(2*high.gain,10**(-1/20));assert.ok(high.gain<1);assert.equal(quiet.limited,true);near(quiet.gainDb,24);
  assert.equal(peakCorrection(0).gain,1);assert.equal(peakCorrection(1e-9).silent,true);
  for(const args of [[NaN],[-1],[Infinity],[1,{targetDb:1}],[1,{targetDb:NaN}]])assert.throws(()=>peakCorrection(...args));
});
test('normalization measures the stereo sum, preserves stem balance/PCM and applies one independent bus gain',async()=>{
  const tracks=[track('a',[.2,-.4],[.3,-.1]),track('b',[-.2,.2],[-.1,.5])],before=tracks.map(t=>[...t.buffer.getChannelData(0)]),f=fixture(tracks);
  const r=await f.normalization.analyze();near(r.peak,.4*.7);near(r.gain*r.peak,10**(-1/20));near(f.engine.normalizationGain,r.gain);
  assert.deepEqual(tracks.map(t=>[...t.buffer.getChannelData(0)]),before);assert.deepEqual(f.session.tracks.map(t=>t.volume),[1,1]);assert.equal(f.engine.outputNode.gain.value,.7);
  await f.engine.play();assert.ok(f.engine.voices.every(v=>v.pan.connections.has(f.engine.normalizationNode)));assert.ok(f.engine.normalizationNode.connections.has(f.engine.outputNode));
  const voices=[...f.engine.voices];f.normalization.setEnabled(false);assert.equal(f.engine.normalizationGain,1);f.normalization.setEnabled(true);near(f.engine.normalizationGain,r.gain);assert.deepEqual(f.engine.voices,voices);f.cleanup();
});
test('opposite phase cancels to silence; pan and solo affect the measured peak',async()=>{
  const f=fixture([track('a',[.5,-.5],[.5,-.5]),track('b',[-.5,.5],[-.5,.5])]);
  assert.equal((await f.normalization.analyze()).silent,true);assert.equal(f.normalization.enabled,false);assert.equal(f.engine.normalizationGain,1);
  f.session.updateTrack('b',{muted:true});near((await f.normalization.analyze()).peak,.35);
  f.session.updateTrack('a',{pan:1});near((await f.normalization.analyze()).peak,.7);
  f.session.updateTrack('b',{muted:false,solo:true});near((await f.normalization.analyze()).peak,.35);f.cleanup();
});
test('mix edits remove stale correction; view, zoom, transport and A/B changes preserve it',async()=>{
  const f=fixture();await f.normalization.analyze();const result=f.normalization.result;
  f.session.setZoom(4);f.session.setViewMode('mix');f.engine.setLoopRegion(0,2/44100);await f.engine.play();f.engine.pause();
  assert.equal(f.normalization.result,result);assert.equal(f.normalization.enabled,true);
  f.session.updateTrack('a',{volume:.3});assert.equal(f.normalization.result,null);assert.equal(f.engine.normalizationGain,1);
  await f.normalization.analyze();f.engine.outputNode.gain.value=.5;f.engine.changed();assert.equal(f.normalization.result,null);f.cleanup();
});
test('cancel/reset and superseded requests ignore late results even when compute ignores abort',async()=>{
  const pending=[],f=fixture(undefined,{compute:()=>new Promise(resolve=>pending.push(resolve))});
  const first=f.normalization.analyze();f.normalization.reset();pending[0]({peak:.2,availableFrames:2});assert.equal(await first,null);assert.equal(f.engine.normalizationGain,1);
  const second=f.normalization.analyze(),third=f.normalization.analyze({targetDb:-6});pending[1]({peak:.8,availableFrames:2});assert.equal(await second,null);
  pending[2]({peak:.4,availableFrames:2});assert.equal((await third).targetDb,-6);assert.equal(f.normalization.result.targetDb,-6);f.cleanup();
});
test('editing mix or destroying a deck during analysis cannot apply late gain',async()=>{
  let resolve;const f=fixture(undefined,{compute:()=>new Promise(r=>resolve=r)}),pending=f.normalization.analyze();f.session.updateTrack('a',{pan:.5});resolve({peak:.1,availableFrames:2});assert.equal(await pending,null);assert.equal(f.engine.normalizationGain,1);
  const next=f.normalization.analyze();f.normalization.destroy();resolve({peak:.1,availableFrames:2});assert.equal(await next,null);assert.equal(f.engine.normalizationGain,1);await assert.rejects(f.normalization.analyze(),/fermé/);f.engine.destroy();
});
test('progressive normalization waits for completion or retained partial result and analyzes all available frames',async()=>{
  const ctx=context(),engine=new ProgressiveMultitrackEngine(ctx);engine.startStream({roles:['bass'],totalFrames:4});const session=new MultitrackSession(engine.tracks),n=new PeakNormalization(engine,session);
  const t=track('bass-0',[.2,.5],[.1,.5]);engine.append(0,[t]);assert.equal(n.available,false);await assert.rejects(n.analyze(),/fin/);
  engine.finish(true);assert.equal(n.available,true);near((await n.analyze()).peak,.5);assert.equal(engine.normalizationGain,n.result.gain);n.destroy();engine.destroy();
});
test('invalid PCM or incomplete measurement leaves unity gain and reports failure; invalid target preserves an existing result',async()=>{
  const f=fixture([track('a',[NaN],[0])]);await assert.rejects(f.normalization.analyze(),/PCM/);assert.equal(f.engine.normalizationGain,1);assert.equal(f.normalization.status,'error');f.cleanup();
  const g=fixture(undefined,{compute:async()=>({peak:.2,availableFrames:1})});await assert.rejects(g.normalization.analyze(),/incomplet/);assert.equal(g.engine.normalizationGain,1);g.cleanup();
  const h=fixture();await h.normalization.analyze();const result=h.normalization.result;await assert.rejects(h.normalization.analyze({targetDb:NaN}));assert.equal(h.normalization.result,result);h.cleanup();
});
test('same-duration PCM replacement invalidates a previous analysis',async()=>{
  const f=fixture();await f.normalization.analyze();f.engine.load([track('a',[.1,.1],[.1,.1])]);assert.equal(f.normalization.result,null);assert.equal(f.engine.normalizationGain,1);f.cleanup();
});
test('original and instruments keep independent corrections across switching; user global gain stays unchanged',async()=>{
  const a=fixture();
  const engine=new MultitrackEngine(a.ctx);engine.load([track('a',[.1,.1],[.1,.1])]);engine.outputNode.gain.value=.7;const session=new MultitrackSession(engine.tracks),n=new PeakNormalization(engine,session);
  const original={engine:a.engine,session:a.session},result={engine,session};
  const flow=new SeparationWorkflow();flow.setOriginal(original);await a.normalization.analyze();const before=a.engine.normalizationGain;await flow.begin(result);await flow.showResult();assert.equal(engine.normalizationGain,1);await n.analyze();assert.notEqual(engine.normalizationGain,before);await flow.showOriginal();near(a.engine.normalizationGain,before);assert.equal(a.normalization.enabled,true);n.destroy();a.normalization.destroy();flow.destroy();
});


test('target preference is deck-local, validated, and clears the old correction before reanalysis',async()=>{
  const f=fixture();await f.normalization.analyze();f.normalization.setTargetDb(-6);assert.equal(f.engine.normalizationGain,1);assert.equal(f.normalization.targetDb,-6);assert.equal(f.normalization.result,null);
  const result=await f.normalization.analyze();assert.equal(result.targetDb,-6);const before=f.normalization.getState();assert.throws(()=>f.normalization.setTargetDb(5));assert.deepEqual(f.normalization.getState(),before);
  f.session.updateTrack('a',{pan:.1});assert.equal(f.normalization.status,'stale');f.cleanup();
});
