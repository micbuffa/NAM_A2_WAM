import test from 'node:test';
import assert from 'node:assert/strict';
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
  const chain=new FxChain({context:{currentTime:0,createGain:()=>new Node()},registry,groupId:'test'});
  const nam=plugin(),cab=plugin();await chain.initialize(nam,cab);return {chain,nam,cab,record};
}
test('headless chain applies AUTO and uses a single ordered route',async()=>{
  const {chain,nam,cab}=await setup();assert.equal(nam.guiCalls+cab.guiCalls,0);
  assert.equal(cab.audioNode.state.parameterValues.bypass.value,1);
  nam.audioNode.gear='amp';for(const listener of nam.audioNode.listeners)listener();await chain.applyRouting();
  assert.equal(cab.audioNode.state.parameterValues.bypass.value,0);
  assert.equal(chain.edges.length,3);assert.equal(chain.input.connections.size,1);
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
