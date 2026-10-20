import test from 'node:test';
import assert from 'node:assert/strict';
import {SeparationMixer} from '../../examples/wam/source-separation/SeparationMixer.js';
import {SeparationWorkflow} from '../../examples/wam/source-separation/SeparationWorkflow.js';
import {MultitrackEngine} from '../../examples/wam/source-separation/MultitrackEngine.js';
import {MultitrackSession} from '../../examples/wam/source-separation/MultitrackSession.js';
function fixture(){
  const nodes=[],param=()=>({value:0,setTargetAtTime(value){this.value=value;}});
  const node=()=>{const n={connections:new Set(),gain:param(),pan:param(),connect(to){this.connections.add(to);return to;},disconnect(to){if(to)this.connections.delete(to);else this.connections.clear();},start(){},stop(){}};nodes.push(n);return n;};
  const ctx={destination:{},state:'running',currentTime:0,createGain:node,createStereoPanner:node,createBufferSource:node,createChannelSplitter:node,createAnalyser:()=>({...node(),getFloatTimeDomainData(data){data.fill(.25);}}),resume:async()=>{}};
  const guitar=node(),mixer=new SeparationMixer(ctx,{guitarSource:guitar});return {ctx,nodes,guitar,mixer};
}
test('reuses host post-rack mixer with one final destination and preserves guitar rack connections',()=>{
  const {ctx,nodes,guitar,mixer}=fixture();assert.ok(guitar.connections.has(mixer.routing.guitarPan));assert.ok(mixer.backingInput.connections.has(mixer.globalGain));assert.ok(mixer.globalGain.connections.has(mixer.routing.backingGain));assert.equal(nodes.filter(n=>n.connections.has(ctx.destination)).length,1);assert.ok(mixer.readMixLevel().peak>0);mixer.destroy();assert.equal(nodes.filter(n=>n.connections.has(ctx.destination)).length,0);
});
test('global backing dB and mute affect backing only; state validation is atomic',()=>{
  const {mixer}=fixture();mixer.update({volumeDb:-6});assert.ok(Math.abs(mixer.globalGain.gain.value-10**(-6/20))<1e-9);assert.equal(mixer.routing.guitarGain.gain.value,1);
  mixer.update({muted:true});assert.equal(mixer.globalGain.gain.value,0);assert.equal(mixer.backingWaveformGain(),0);assert.equal(mixer.routing.guitarGain.gain.value,1);mixer.update({muted:false});assert.ok(mixer.backingWaveformGain()>0);
  const before=mixer.getState();assert.throws(()=>mixer.update({volumeDb:2,mix:NaN}));assert.deepEqual(mixer.getState(),before);mixer.destroy();
});
test('balance and guitar pan follow host policy during play and restore full guitar while paused',()=>{
  const {mixer}=fixture(),engine=new EventTarget();engine.playing=true;mixer.setActiveEngine(engine);
  mixer.update({mix:1,guitarPan:-.6});assert.equal(mixer.routing.guitarGain.gain.value,0);assert.equal(mixer.routing.backingGain.gain.value,1);assert.equal(mixer.routing.guitarPan.pan.value,-.6);
  mixer.update({mix:0});assert.equal(mixer.routing.guitarGain.gain.value,1);assert.equal(mixer.routing.backingGain.gain.value,0);assert.equal(mixer.backingWaveformGain(),0);
  mixer.update({mix:.75});assert.equal(mixer.routing.guitarGain.gain.value,.5);engine.playing=false;engine.dispatchEvent(new Event('statechange'));assert.equal(mixer.routing.guitarGain.gain.value,1);mixer.destroy();
});
test('original/stems switches connect only to stable backing input and leave global state and guitar route intact',async()=>{
  const {ctx,mixer,guitar}=fixture();const make=()=>{const engine=new MultitrackEngine(ctx);engine.load([{id:'a',buffer:{duration:10,length:441000,sampleRate:44100}}]);return {engine,session:new MultitrackSession(engine.tracks)};};
  const original=make(),result=make(),workflow=new SeparationWorkflow({destination:mixer.backingInput,onActivate:deck=>mixer.setActiveEngine(deck.engine)});workflow.setOriginal(original);mixer.update({volumeDb:-9,mix:.7,guitarPan:.4,muted:false});const before=mixer.getState();await workflow.begin(result);await workflow.tryActivate();assert.equal(original.engine.outputNode.connections.size,0);assert.ok(result.engine.outputNode.connections.has(mixer.backingInput));assert.ok(!result.engine.outputNode.connections.has(ctx.destination));assert.deepEqual(mixer.getState(),before);assert.ok(guitar.connections.has(mixer.routing.guitarPan));await workflow.showOriginal();assert.equal(result.engine.outputNode.connections.size,0);assert.deepEqual(mixer.getState(),before);workflow.destroy();mixer.destroy();
});
test('old transport subscriptions are removed when source changes and all owned routes are destroyed',()=>{
  const {mixer}=fixture(),a=new EventTarget(),b=new EventTarget();a.playing=true;b.playing=false;mixer.setActiveEngine(a);mixer.setActiveEngine(b);let changes=0;mixer.addEventListener('transport-change',()=>changes++);a.dispatchEvent(new Event('statechange'));assert.equal(changes,0);b.dispatchEvent(new Event('statechange'));assert.equal(changes,1);mixer.destroy();b.dispatchEvent(new Event('statechange'));assert.equal(changes,2);assert.equal(mixer.guitarInput.connections.size,0);
});
