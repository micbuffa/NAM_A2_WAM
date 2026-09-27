import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioLevel} from '../../examples/wam/AudioLevel.js';
import {FxRack} from '../../examples/wam/FxRack.js';
import {FxChain} from '../../examples/wam/FxChain.js';
import {loadDefaultAsset} from '../../src/shared/defaultAssets.js';

class Node extends EventTarget {
  constructor(){super();this.connections=new Set();this.gain={value:1,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}};this.state={parameterValues:{bypass:{id:'bypass',value:0}},value:0};this.routingMode='auto';this.listeners=new Set();}
  connect(to){this.connections.add(to);return to;}
  disconnect(to){to?this.connections.delete(to):this.connections.clear();}
  getState(){return structuredClone(this.state);}
  setState(s){this.state=structuredClone(s);if(s.routingMode)this.routingMode=s.routingMode;}
  setParameterValues(values){Object.assign(this.state.parameterValues,values);}
  getModelSnapshot(){return {rawMetadata:{gear_type:this.gear||'amp_cab'}};}
  addModelListener(fn){this.listeners.add(fn);} removeModelListener(fn){this.listeners.delete(fn);}
  addChangeListener(){return ()=>{};}
  setRoutingMode(mode){this.routingMode=mode;this.dispatchEvent(new Event('routing-mode'));}
  destroy(){this.destroyed=true;}
}
function plugin(){return {audioNode:new Node(),guiCalls:0,async createGui(){this.guiCalls++;return {remove(){}};},destroyGui(){}};}
async function setup(){
  const record={name:'Delay',entryUrl:'https://example.test/wam/delay/index.js',catalogue:{uri:'./delay/index.js'}};
  const registry={catalogueUrl:'https://example.test/wam/plugins.json',records:[record],async instantiate(r,{state}){const p=plugin();if(state)p.audioNode.setState(state);return p;}};
  const chain=new FxChain({context:{currentTime:0,state:'running',createGain:()=>new Node(),createStereoPanner:()=>{const node=new Node();node.pan={...node.gain,value:0};return node;},createChannelSplitter:()=>new Node(),createAnalyser:()=>Object.assign(new Node(),{getFloatTimeDomainData(data){data.fill(0);}})},registry,groupId:'test'});
  const nam=plugin(),cab=plugin();await chain.initialize(nam,cab);return {chain,nam,cab,record};
}
test('headless chain applies AUTO and uses a single ordered route',async()=>{
  const {chain,nam,cab}=await setup();assert.equal(nam.guiCalls+cab.guiCalls,0);
  assert.equal(cab.audioNode.state.parameterValues.bypass.value,1);
  nam.audioNode.gear='amp';for(const listener of nam.audioNode.listeners)listener();await chain.applyRouting();
  assert.equal(cab.audioNode.state.parameterValues.bypass.value,0);
  assert.equal(chain.edges.length,3);assert.equal(chain.input.connections.size,2);
  assert.equal(chain.entries[0].input.channelInterpretation,'speakers');
});
test('same effect instances keep independent state, bypass and lazy editors across restoration',async()=>{
  const {chain,record}=await setup();const a=await chain.insert(record,'nam'),b=await chain.insert(record);
  assert.notEqual(a.id,b.id);a.plugin.audioNode.state.value=11;b.plugin.audioNode.state.value=29;
  await chain.setBypass(a.id,true);assert.equal(b.bypass,false);
  const [gui1,gui2]=await Promise.all([chain.getGui(a.id),chain.getGui(a.id)]);assert.equal(gui1,gui2);assert.equal(a.plugin.guiCalls,1);assert.equal(b.plugin.guiCalls,0);
  const state=await chain.getState();a.plugin.audioNode.state.value=99;
  await chain.setState(state);const restoredA=chain.find(a.id),restoredB=chain.find(b.id);
  assert.equal(restoredA.plugin.audioNode.state.value,11);assert.equal(restoredB.plugin.audioNode.state.value,29);
  assert.equal(restoredA.bypass,true);assert.equal(restoredB.bypass,false);assert.equal(restoredA.plugin.guiCalls,0);
  state.entries.find(e=>e.id===a.id).state.value=-1;assert.equal(restoredA.plugin.audioNode.state.value,11);
  await chain.remove(a.id);assert.equal(restoredA.plugin.audioNode.destroyed,true);assert.equal(restoredB.plugin.audioNode.destroyed,undefined);
  assert.equal(chain.edges.length,chain.entries.length+1);
});
test('missing effects retain their state as dry placeholders and failed insertion keeps chain intact',async()=>{
  const {chain,record}=await setup();const e=await chain.insert(record);const state=await chain.getState();
  chain.registry.records=[];await chain.setState(state);assert.equal(chain.find(e.id).plugin,undefined);assert.equal(chain.find(e.id).dry.gain.value,1);
  assert.deepEqual((await chain.getState()).entries.at(-1).state,state.entries.at(-1).state);
  chain.registry.instantiate=async()=>{throw Error('import failed');};const before=[...chain.entries];await assert.rejects(chain.insert(record));assert.deepEqual(chain.entries,before);
});
test('removed instance cannot publish an asynchronously created GUI',async()=>{
  const {chain,record}=await setup();const e=await chain.insert(record);let resolve;
  e.plugin.createGui=()=>new Promise(r=>resolve=r);const pending=chain.getGui(e.id);await Promise.resolve();await chain.remove(e.id);resolve({});await assert.rejects(pending,/removed/);
});
test('nonvisual defaults do not overwrite provided state or a concurrent restore',async()=>{
  let fetches=0;await loadDefaultAsset({getState:()=>({model:{data:'restored'}})},'nam','https://example.test/models-manifest.json',()=>{fetches++;});assert.equal(fetches,0);
  const node={assetRevision:0,getState:()=>({}),loadModelText(){throw Error('must not replace restore');}};
  const fetchImpl=async url=>String(url).endsWith('json')?{ok:true,json:async()=>({assets:[{category:'guitar',provenance:{toneId:80705},relativePath:'model.nam',filename:'model.nam'}]})}:{ok:true,text:async()=>{node.assetRevision++;return '{}';}};
  await loadDefaultAsset(node,'nam','https://example.test/models-manifest.json',fetchImpl);
});

test('reordering preserves running instances, parameters and GUI, and rejects stale targets',async()=>{
  const {chain,record}=await setup();const a=await chain.insert(record),b=await chain.insert(record);
  a.plugin.audioNode.state.value=42;const gui=await chain.getGui(a.id);
  await chain.move(a.id,'nam');assert.equal(chain.entries[0],a);
  assert.equal(await chain.getGui(a.id),gui);assert.equal(a.plugin.audioNode.state.value,42);
  assert.equal(a.plugin.guiCalls,1);assert.equal(a.plugin.audioNode.destroyed,undefined);
  await chain.move('nam');assert.equal(chain.entries.at(-1).id,'nam');
  for(let i=0;i<chain.entries.length-1;i++)assert.ok(chain.entries[i].output.connections.has(chain.entries[i+1].input));
  const order=[...chain.entries];await assert.rejects(chain.move(b.id,'gone'));assert.deepEqual(chain.entries,order);
  await chain.move(a.id,a.id);assert.deepEqual(chain.entries,order);
});
test('graph transitions preserve output gain and removed analysis taps are cleaned up',async()=>{
  const {chain,record}=await setup();chain.setOutputDb(-18);
  const gain=chain.output.gain.value,entry=await chain.insert(record);
  await chain.move(entry.id,'nam');await chain.remove(entry.id);
  assert.equal(chain.output.gain.value,gain);assert.equal(chain.transitionGain.gain.value,1);
  assert.equal(entry.meter.splitter.connections.size,0);
  assert.equal(chain.setOutputDb(99),12);assert.throws(()=>chain.setOutputDb(NaN));
  chain.destroy();assert.equal(chain.input.connections.size,0);assert.equal(chain.output.connections.size,0);
});

test('meter detects opposite-phase stereo, clipping and suspended silence without an output path',()=>{
  let amplitude=.5,index=0;
  const context={state:'running',createChannelSplitter:()=>new Node(),createAnalyser(){const polarity=index++?-1:1;return Object.assign(new Node(),{getFloatTimeDomainData(data){data.fill(polarity*amplitude);}});}};
  const source=new Node(),meter=new AudioLevel(context,source);
  let value=meter.read();assert.ok(Math.abs(value.db+6.0206)<.001);assert.equal(value.peak,.5);
  amplitude=1.2;assert.ok(meter.read().peak>1);
  context.state='suspended';value=meter.read();assert.equal(value.peak,0);assert.equal(value.db,-120);
  for(let i=0;i<100;i++)value=meter.read();assert.ok(value.level<.000001);
  assert.ok(meter.analysers.every(node=>node.connections.size===0));meter.destroy();assert.equal(source.connections.size,0);
});

test('dropping a card on another swaps first/second and nonadjacent instances',async()=>{
  const {chain,record}=await setup();const effect=await chain.insert(record);
  const [nam,cab]=chain.entries;const gui=await chain.getGui(effect.id);
  await chain.swap(nam.id,cab.id);assert.deepEqual(chain.entries,[cab,nam,effect]);
  await chain.swap(cab.id,effect.id);assert.deepEqual(chain.entries,[effect,nam,cab]);
  assert.equal(await chain.getGui(effect.id),gui);
  const order=[...chain.entries];await chain.swap(effect.id,effect.id);assert.deepEqual(chain.entries,order);
  await assert.rejects(chain.swap(effect.id,'missing'));assert.deepEqual(chain.entries,order);
  for(let i=0;i<chain.entries.length-1;i++)assert.ok(chain.entries[i].output.connections.has(chain.entries[i+1].input));
});

async function setupRack(){
  const {chain:a,record}=await setup();
  const source=Object.assign(new EventTarget(),{mode:'live',liveInput:{channelCount:2},trimDb:{file:-18,live:0},setTrimDb(db,mode){this.trimDb[mode]=db;},setSecondary(target,channel){this.secondary={target,channel};}});
  const rack=new FxRack({context:a.context,a,source,createLane:async()=>{const b=new FxChain({context:a.context,registry:a.registry,groupId:'test'});await b.initialize(plugin(),plugin(),'b-');return b;}});
  return {rack,a,source,record};
}
test('two lanes share source and replace/remove the one junction without recreating instances',async()=>{
  const {rack,a,source,record}=await setupRack();await rack.setVisible(true);
  const b=rack.b;assert.equal(rack.enabledB,true);assert.ok(source.secondary.target===rack.physicalB);
  await rack.setEnabledB(true);assert.equal(rack.mixDb,-6);
  const extra=await a.insert(record);await rack.connectRoute(1);
  const firstTap=a.entries[0].output;assert.ok(firstTap.connections.has(b.input));assert.equal(source.secondary.target,null);
  await rack.connectRoute(2);assert.ok(!firstTap.connections.has(b.input));assert.ok(a.entries[1].output.connections.has(b.input));
  assert.equal(a.edges.length,a.entries.length+1);assert.equal(rack.b,b);
  await rack.setMutedA(true);assert.equal(rack.gateA.gain.value,0);assert.equal(rack.gateB.gain.value,1);assert.equal(rack.mixDb,0);
  await rack.removeRoute();assert.equal(rack.route,null);assert.equal(rack.visible,true);assert.equal(rack.enabledB,false);
  assert.ok(!a.entries[1].output.connections.has(b.input));assert.equal(source.secondary.target,rack.physicalB);
  await rack.connectRoute(0);assert.ok(a.input.connections.has(b.input));
  await rack.setVisible(false);assert.ok(!a.input.connections.has(b.input));assert.equal(rack.gateB.gain.value,0);
  assert.ok(!b.output.connections.has(rack.gateB));assert.equal(source.secondary.target,null);
  await rack.setVisible(true);assert.equal(rack.b,b);assert.equal(rack.route.index,0);assert.equal(b.entries[0].plugin.audioNode.destroyed,undefined);
  assert.ok(a.input.connections.has(b.input));assert.ok(b.output.connections.has(rack.gateB));assert.equal(rack.enabledB,true);
});
test('junction survives insertion/removal and AUTO follows the actual shared prefix',async()=>{
  const {rack,a,record}=await setupRack();await rack.setVisible(true);await rack.connectRoute(1);
  const inserted=await a.insert(record,'nam');assert.equal(rack.route.index,2);
  await a.remove(inserted.id);assert.equal(rack.route.index,1);
  await rack.b.setBypass('b-nam',true);await rack.a.applyRouting();assert.equal(rack.b.find('b-cabinet').bypass,true);
  await rack.connectRoute(0);await rack.a.applyRouting();assert.equal(rack.b.find('b-cabinet').bypass,false);
  await rack.removeRoute();assert.equal(rack.b.find('b-cabinet').bypass,false);
});
test('rack state roundtrip and v1 migration keep IDs isolated and invalid restore leaves topology intact',async()=>{
  const {rack,a}=await setupRack();const legacy=await a.getState();await rack.setVisible(true);await rack.connectRoute(2);await rack.setEnabledB(true);
  rack.setInputDbB(-9);rack.b.setOutputDb(-12);const saved=await rack.getState();
  await rack.removeRoute();await rack.setState(saved);assert.equal(rack.route.index,2);assert.equal(rack.inputDbB,-9);assert.equal(rack.b.outputDb,-12);
  const bad=structuredClone(saved);bad.b.entries[0].id='nam';await assert.rejects(rack.setState(bad),/Duplicate/);assert.equal(rack.route.index,2);
  await rack.setState(legacy);assert.equal(rack.visible,false);assert.equal(rack.route,null);
});
test('unavailable B channels never fall back to input 1 or enable monitoring',async()=>{
  const {rack,source}=await setupRack();source.liveInput.channelCount=1;await rack.setVisible(true);
  assert.equal(source.secondary.target,null);await assert.rejects(rack.setEnabledB(true),/available/);
  await rack.setChannelB(0);await rack.setEnabledB(true);assert.equal(source.secondary.channel,0);
  source.mode=null;source.dispatchEvent(new Event('change'));assert.equal(rack.enabledB,false);assert.equal(source.secondary.target,null);
});

test('NAM editor bypass and automation refresh Cabinet AUTO from the actual path',async()=>{
  const {chain,nam,cab}=await setup();
  assert.equal(cab.audioNode.state.parameterValues.bypass.value,1);
  nam.audioNode.dispatchEvent(new CustomEvent('bypass-change',{detail:{id:'bypass',value:1}}));
  await chain.pending;
  assert.equal(chain.find('nam').bypass,true);
  assert.equal(cab.audioNode.state.parameterValues.bypass.value,0);
  nam.audioNode.dispatchEvent(new CustomEvent('wam-automation',{detail:{data:{id:'bypass',value:0}}}));
  await chain.pending;
  assert.equal(cab.audioNode.state.parameterValues.bypass.value,1);
});

test('hide disconnects independent B input and output; show resumes the selected input without recreating plugins',async()=>{
  const {rack,source}=await setupRack();await rack.setVisible(true);
  const b=rack.b,entries=[...b.entries];rack.b.setOutputDb(-9);
  await rack.setVisible(false);
  assert.equal(source.secondary.target,null);assert.ok(!rack.physicalB.connections.has(b.input));
  assert.ok(!b.output.connections.has(rack.gateB));assert.equal(rack.mixDb,0);
  await rack.setVisible(true);
  assert.equal(rack.enabledB,true);assert.equal(source.secondary.channel,1);
  assert.ok(rack.physicalB.connections.has(b.input));assert.ok(b.output.connections.has(rack.gateB));
  assert.deepEqual(b.entries,entries);assert.equal(b.outputDb,-9);assert.equal(rack.mixDb,-6);
});

test('hidden split roundtrip retains its junction but has no active B path until shown',async()=>{
  const {rack,a,source}=await setupRack();source.mode='file';await rack.setVisible(true);
  await rack.connectRoute(1);assert.equal(rack.enabledB,true);
  await rack.setVisible(false);const saved=await rack.getState();await rack.setState(saved);
  assert.equal(rack.visible,false);assert.equal(rack.enabledB,false);assert.equal(rack.route.index,1);
  assert.equal(rack.tap,null);assert.ok(!rack.b.output.connections.has(rack.gateB));
  await rack.setVisible(true);assert.equal(rack.enabledB,true);
  assert.equal(rack.tap,a.entries[0].output);assert.equal(rack.mixDb,-6);
});

test('per-lane pan is independent, bounded, retained when hiding, and backwards compatible in state',async()=>{
  const {rack,a}=await setupRack();await rack.setVisible(true);
  rack.setPan('a',-1);rack.setPan('b',.65);
  assert.equal(rack.pannerA.pan.value,-1);assert.equal(rack.pannerB.pan.value,.65);
  assert.ok(rack.gateA.connections.has(rack.pannerA));assert.ok(rack.pannerB.connections.has(rack.mix));
  assert.equal(a.outputMeter.source,rack.pannerA);assert.equal(rack.b.outputMeter.source,rack.pannerB);
  assert.throws(()=>rack.setPan('a',NaN));assert.throws(()=>rack.setPan('b',2));
  const saved=await rack.getState();await rack.setVisible(false);await rack.setVisible(true);
  assert.equal(rack.panB,.65);rack.setPan('a',0);await rack.setState(saved);assert.equal(rack.panA,-1);
  const bad={...saved,panA:3};await assert.rejects(rack.setState(bad),/pan/);assert.equal(rack.panA,-1);
  delete saved.panA;delete saved.panB;await rack.setState(saved);assert.equal(rack.panA,0);assert.equal(rack.panB,0);
});

function registerCore(chain){
  const records=['nam','cabinet'].map(role=>({role,name:role,entryUrl:`https://example.test/${role}/index.js`,catalogue:{uri:`https://example.test/${role}/index.js`}}));
  chain.registry.records.push(...records);return records;
}
test('amp and cabinets can be removed, reinserted multiple times and restored, including empty chains',async()=>{
  const {chain}=await setup();const [amp,cab]=registerCore(chain);
  await chain.remove('nam');await chain.remove('cabinet');assert.equal(chain.entries.length,0);assert.equal(chain.edges.length,1);
  const empty=await chain.getState();const n1=await chain.insert(amp),c1=await chain.insert(cab),n2=await chain.insert(amp),c2=await chain.insert(cab);
  assert.equal(n1.kind,'nam');assert.equal(c1.kind,'cabinet');assert.notEqual(n1.id,n2.id);
  n1.plugin.audioNode.gear='amp';n2.plugin.audioNode.gear='amp_cab';await chain.applyRouting();
  assert.equal(c1.bypass,false);assert.equal(c2.bypass,true);
  const saved=await chain.getState();await chain.setState(empty);assert.equal(chain.entries.length,0);
  await chain.setState(saved);assert.deepEqual(chain.entries.map(e=>e.kind),['nam','cabinet','nam','cabinet']);
  assert.equal(new Set(chain.entries.map(e=>e.plugin.audioNode)).size,4);
  await chain.setState(empty);chain.registry.records=[];await chain.setState(saved);
  assert.equal(chain.entries.length,4);assert.ok(chain.entries.every(e=>!e.plugin&&e.dry.gain.value===1));
  assert.deepEqual((await chain.getState()).entries.map(e=>e.state),saved.entries.map(e=>e.state));
});
test('cabinet-only B inherits A amp at the split and survives removing/readding amps',async()=>{
  const {rack,a}=await setupRack();const [amp]=registerCore(a);await rack.setVisible(true);
  await rack.b.remove('b-nam');await rack.connectRoute(1);await rack.a.applyRouting();
  assert.deepEqual(rack.b.entries.map(e=>e.kind),['cabinet']);assert.equal(rack.b.entries[0].bypass,true);
  await a.remove('nam');await rack.pending;assert.equal(rack.route.index,0);assert.equal(rack.b.entries[0].bypass,false);
  await a.insert(amp,a.entries[0].id,'before');await rack.pending;
  assert.equal(rack.route.index,1);assert.equal(rack.b.entries[0].bypass,true);
  const saved=await rack.getState();await rack.b.remove('b-cabinet');await rack.setState(saved);
  assert.deepEqual(rack.b.entries.map(e=>e.kind),['cabinet']);
});
