import test from 'node:test';
import assert from 'node:assert/strict';
import {SeparationWorkflow} from '../../examples/wam/source-separation/SeparationWorkflow.js';
import {MultitrackEngine} from '../../examples/wam/source-separation/MultitrackEngine.js';
import {ProgressiveMultitrackEngine} from '../../examples/wam/source-separation/ProgressiveMultitrackEngine.js';
import {MultitrackSession} from '../../examples/wam/source-separation/MultitrackSession.js';
import {transportState} from '../../examples/wam/source-separation/SeparationProgress.js';
function context(){
  const routes=new Set(),nodes=[];
  const param=()=>({value:0,setTargetAtTime(v){this.value=v;}});
  const destination={};
  const node=()=>{const n={gain:param(),pan:param(),connect(to){if(to===destination)routes.add(n);return to;},disconnect(){routes.delete(n);},start(...args){this.started=args;},stop(){this.stopped=true;}};nodes.push(n);return n;};
  return {state:'running',destination,currentTime:0,routes,nodes,resume:async()=>{},createGain:node,createStereoPanner:node,createBufferSource:node};
}
const tracks=(seconds=10,roles=['bass','guitar'])=>roles.map((role,i)=>({id:`${role}-${i}`,role,buffer:{duration:seconds,length:seconds*44100,sampleRate:44100}}));
function deck(ctx,{progressive=false,duration=10,roles=['bass','guitar']}={}){
  const engine=progressive?new ProgressiveMultitrackEngine(ctx):new MultitrackEngine(ctx);
  if(progressive)engine.startStream({roles,totalFrames:duration*44100});else engine.load(tracks(duration,roles));
  engine.outputNode.gain.value=.7;
  const session=new MultitrackSession(engine.tracks);engine.sync(session.tracks);
  return {engine,session,title:'test'};
}
function fixture(){const ctx=context(),activations=[],flow=new SeparationWorkflow({onActivate:d=>activations.push(d)}),original=deck(ctx,{duration:30,roles:['original']});flow.setOriginal(original);return {ctx,flow,original,activations};}
test('import exposes full original without any model; candidate stays disconnected and original transport remains usable',async()=>{
  const {ctx,flow,original}=fixture();assert.equal(original.engine.duration,30);assert.equal(transportState(original.engine).disabled,false);
  await original.engine.play();const voice=original.engine.voices[0];const result=deck(ctx,{progressive:true});await flow.begin(result);
  assert.equal(flow.active,original);assert.equal(original.engine.voices[0],voice);assert.equal(voice.source.stopped,undefined);assert.equal(ctx.routes.size,1);assert.ok(!ctx.routes.has(result.engine.outputNode));flow.destroy();assert.equal(ctx.routes.size,0);
});
test('first playable block replaces original at its latest position, preserving playing, zoom, loop, gain and pan',async()=>{
  const {ctx,flow,original}=fixture();original.session.zoom=4;Object.assign(original.session.tracks[0],{volume:.4,pan:-.3});original.engine.setLoop(false);original.engine.outputNode.gain.value=.6;
  await original.engine.play();const oldVoices=original.engine.voices.slice();const result=deck(ctx,{progressive:true});await flow.begin(result);ctx.currentTime=2.03;
  result.engine.append(0,tracks(4));assert.equal(await flow.tryActivate(),true);assert.equal(flow.active,result);assert.ok(Math.abs(result.engine.offset-2)<1e-9);assert.equal(result.engine.playing,true);assert.equal(result.engine.loop,false);assert.equal(result.session.zoom,4);assert.equal(result.engine.outputNode.gain.value,.6);
  assert.deepEqual(result.engine.voices.map(v=>v.gain.gain.value),[.4,.4]);assert.deepEqual(result.engine.voices.map(v=>v.pan.pan.value),[-.3,-.3]);assert.ok(oldVoices.every(v=>v.source.stopped));assert.equal(ctx.routes.size,1);assert.ok(ctx.routes.has(result.engine.outputNode));flow.destroy();
});
test('paused original remains paused at the same position after switching',async()=>{
  const {ctx,flow,original}=fixture();original.engine.seek(2);const result=deck(ctx);await flow.begin(result);await flow.tryActivate();assert.equal(result.engine.offset,2);assert.equal(result.engine.playing,false);assert.equal(result.engine.voices.length,0);flow.destroy();
});
test('position beyond an excerpt does not jump automatically; explicit selection restarts that excerpt',async()=>{
  const {ctx,flow,original}=fixture();original.engine.seek(15);const result=deck(ctx);await flow.begin(result);assert.equal(await flow.tryActivate(),false);assert.equal(flow.active,original);assert.equal(original.engine.position,15);await flow.showResult();assert.equal(flow.active,result);assert.equal(result.engine.position,0);assert.equal(result.engine.playing,false);flow.destroy();
});
test('blocks too close to the playhead defer replacement until enough audio is published',async()=>{
  const {ctx,flow,original}=fixture();original.engine.seek(3.95);const result=deck(ctx,{progressive:true});await flow.begin(result);result.engine.append(0,tracks(4));assert.equal(await flow.tryActivate(),false);result.engine.append(4*44100,tracks(4));assert.equal(await flow.tryActivate(),true);assert.equal(result.engine.position,3.95);flow.destroy();
});
test('cancel before any audio keeps original voices intact and releases the candidate',async()=>{
  const {ctx,flow,original}=fixture();await original.engine.play();const voice=original.engine.voices[0],result=deck(ctx,{progressive:true});await flow.begin(result);await flow.fail();assert.equal(flow.active,original);assert.equal(original.engine.voices[0],voice);assert.ok(result.engine.destroyed);assert.equal(flow.result,null);assert.equal(ctx.routes.size,1);flow.destroy();
});
test('failure after replacement restores original at current position and keeps partial stems available explicitly',async()=>{
  const {ctx,flow,original}=fixture();await original.engine.play();const result=deck(ctx,{progressive:true});await flow.begin(result);result.engine.append(0,tracks(4));await flow.tryActivate();ctx.currentTime=2.06;result.engine.finish(true);await flow.fail();assert.equal(flow.active,original);assert.ok(Math.abs(original.engine.position-2.03)<1e-8);assert.equal(original.engine.playing,true);assert.equal(flow.available(),4);assert.equal(ctx.routes.size,1);await flow.showResult();assert.equal(flow.active,result);flow.destroy();
});
test('manual return to original prevents subsequent chunks from stealing playback',async()=>{
  const {ctx,flow,original}=fixture(),result=deck(ctx,{progressive:true});await flow.begin(result);result.engine.append(0,tracks(4));await flow.tryActivate();result.session.updateTrack('bass-0',{volume:.2,solo:true});result.session.setViewMode('mix');await flow.showOriginal();result.engine.append(4*44100,tracks(4));assert.equal(await flow.tryActivate(),false);assert.equal(flow.active,original);await flow.showResult();assert.equal(result.session.tracks[0].volume,.2);assert.equal(result.session.tracks[0].solo,true);assert.equal(result.session.viewMode,'mix');assert.equal(ctx.routes.size,1);flow.destroy();
});
test('new import disposes original and stems and retains only one route',async()=>{
  const {ctx,flow,original}=fixture(),result=deck(ctx);await flow.begin(result);await flow.tryActivate();const replacement=deck(ctx,{duration:60,roles:['original']});flow.setOriginal(replacement);assert.ok(original.engine.destroyed);assert.ok(result.engine.destroyed);assert.equal(flow.result,null);assert.equal(flow.active,replacement);assert.equal(ctx.routes.size,1);flow.destroy();
});
test('different AudioContext is rejected before replacing the active route',async()=>{
  const {ctx,flow,original}=fixture(),other=deck(context());await assert.rejects(flow.begin(other),/AudioContext/);assert.equal(flow.active,original);assert.equal(ctx.routes.size,1);other.engine.destroy();flow.destroy();
});
test('return to original cancels a pending separated play instead of allowing a late double start',async()=>{
  const {ctx,flow,original}=fixture();await original.engine.play();const result=deck(ctx);await flow.begin(result);let resolve;ctx.resume=()=>new Promise(r=>resolve=r);
  const pending=flow.tryActivate();const resumeCandidate=resolve;
  const back=flow.showOriginal();const resumeOriginal=resolve;resumeCandidate();resumeOriginal();await Promise.all([pending,back]);assert.equal(flow.active,original);assert.equal(result.engine.playing,false);assert.equal(original.engine.playing,true);assert.equal(ctx.routes.size,1);flow.destroy();
});

test('seek to original end stays at the end while paused even with loop enabled, then explicit Play restarts',async()=>{
  const {ctx,flow,original}=fixture();original.engine.seek(30);assert.equal(original.engine.position,30);const result=deck(ctx);await flow.begin(result);assert.equal(await flow.tryActivate(),false);assert.equal(flow.active,original);await original.engine.play();assert.equal(original.engine.offset,0);flow.destroy();
});

test('automatic transition can be deferred to preserve mixer focus; explicit selection remains available',async()=>{
  const {ctx,flow,original}=fixture(),result=deck(ctx);flow.canAutoSwitch=()=>false;await flow.begin(result);assert.equal(await flow.tryActivate(),false);assert.equal(flow.active,original);await flow.showResult();assert.equal(flow.active,result);flow.destroy();
});

test('A/B transfers in seconds to a compatible excerpt and preserves original bounds when excerpt is shorter',async()=>{
  const {ctx,flow,original}=fixture();original.engine.setLoopRegion(2,6);
  const result=deck(ctx);await flow.begin(result);await flow.showResult();assert.deepEqual(result.engine.loopBounds,{start:2,end:6});
  await flow.showOriginal();original.engine.setLoopRegion(20,25);await flow.showResult();assert.deepEqual(original.engine.loopBounds,{start:20,end:25});assert.ok(result.engine.loopBounds.end<=result.engine.duration);flow.destroy();
});

test('confirmed model change replaces active stems by empty lanes, disposes old result and preserves original',async()=>{
 const {ctx,flow,original}=fixture(),old=deck(ctx,{progressive:true});
 await flow.begin(old);old.engine.append(0,tracks(3));await flow.tryActivate();await old.engine.play();
 const roles=['drums','bass','other','vocals','guitar','piano'],next=deck(ctx,{progressive:true,duration:30,roles});
 flow.resetResult(next);
 assert.equal(flow.original,original);assert.equal(flow.active,next);assert.equal(flow.result,next);
 assert.equal(old.engine.destroyed,true);assert.equal(next.engine.availableFrames,0);assert.equal(next.engine.playing,false);
 assert.equal(next.engine.position,0);assert.deepEqual(next.session.tracks.map(t=>t.role),roles);
 assert.equal(transportState(next.engine).disabled,true);assert.equal(ctx.routes.size,1);assert.ok(ctx.routes.has(next.engine.outputNode));
 assert.equal(await flow.tryActivate(),false);await flow.showOriginal();assert.equal(flow.active,original);flow.destroy();
});
