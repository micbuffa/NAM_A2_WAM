import test from 'node:test';
import {OnnxCoreModel} from '../../examples/wam/source-separation/OnnxCoreModel.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDirectWebNNSession,DirectAudioTensor,validateDirectRecipe,loadDirectWebNNModel,describeDirectWebNNFailure} from '../../examples/wam/source-separation/DirectWebNN.js';
const recipe=()=>({format:'direct-webnn-graph-v1',inputs:{audio:{id:'i0',shape:[2],dataType:'float32'}},outputs:{result:{id:'v0',shape:[2],dataType:'float32'}},constants:{c0:{shape:[2],dataType:'float32',offset:0,bytes:8}},operations:[{op:'add',args:['i0','c0'],outputs:['v0'],checkShape:[2],sourceLabel:'test-add'}]});
function fake(){
 const events=[];
 class Builder{
  input(name,d){return{...d,evaluate:feeds=>feeds[name]};}
  constant(d,values){return{...d,evaluate:()=>values};}
  add(a,b){return{shape:a.shape,dataType:a.dataType,evaluate:feeds=>a.evaluate(feeds).map((v,i)=>v+b.evaluate(feeds)[i])};}
  async build(outputs){events.push('build');return{outputs,destroy(){events.push('graph-destroy');}};}
 }
 const context={async createTensor(d){return{...d,destroy(){events.push('tensor-destroy');}};},writeTensor(t,data){events.push('write');t.data=data;},dispatch(g,inputs,outputs){events.push('dispatch');for(const [name,operand]of Object.entries(g.outputs))outputs[name].data=operand.evaluate(Object.fromEntries(Object.entries(inputs).map(([n,t])=>[n,t.data])));},async readTensor(t){events.push('read');return t.data.slice().buffer;}};
 return{Builder,context,events};
}
test('direct session builds and dispatches only native WebNN, then reads exact output and releases graph/tensors',async()=>{
 const {Builder,context,events}=fake(),phases=[],steps=[],states=[];
 const session=await createDirectWebNNSession(context,recipe(),new Float32Array([.25,.5]).buffer,{Builder,onPhase:(phase,ms)=>phases.push([phase,ms]),onStep:state=>{steps.push(state.name);states.push(state);}});
 const out=await session.run({audio:new DirectAudioTensor('float32',new Float32Array([1,2]),[2])});
 assert.deepEqual([...out.result.data],[1.25,2.5]);assert.deepEqual(out.result.dims,[2]);assert.deepEqual(steps,['writeTensor','dispatch','readTensor-pending','readTensor-complete']);assert.deepEqual(states[2].pendingReads,['result']);assert.deepEqual(states[3].pendingReads,[]);assert.deepEqual(events.slice(0,4),['build','write','dispatch','read']);
 assert.deepEqual(phases.map(([p])=>p),['graphConstructionMs','nativeGraphBuildMs','tensorAllocationMs']);
 await session.release();assert.equal(events.filter(x=>x==='tensor-destroy').length,2);assert.equal(events.filter(x=>x==='graph-destroy').length,1);await session.release();await assert.rejects(session.run({}),/unavailable/);
});
test('unsupported native operations and bad feed shapes fail explicitly; no substitute backend is executed',async()=>{
 const {Builder,context}=fake(),g=recipe();g.operations[0].op='erf';g.operations[0].args=['i0'];
 await assert.rejects(createDirectWebNNSession(context,g,new ArrayBuffer(8),{Builder}),/lacks required operations: erf/);
 const session=await createDirectWebNNSession(context,recipe(),new ArrayBuffer(8),{Builder});
 await assert.rejects(session.run({audio:new DirectAudioTensor('float32',new Float32Array(3),[3])}),/Invalid direct WebNN feed/);await session.release();
});
test('partial tensor-allocation failures release created resources and recipe corruption is rejected',async()=>{
 const {Builder,context,events}=fake();let count=0;const create=context.createTensor;context.createTensor=async d=>{if(++count===2)throw Error('out of memory');return create(d);};
 await assert.rejects(createDirectWebNNSession(context,recipe(),new ArrayBuffer(8),{Builder}),/out of memory/);assert.equal(events.filter(x=>x==='tensor-destroy').length,1);assert.ok(events.includes('graph-destroy'));
 for(const mutate of [g=>g.constants.c0.offset=1,g=>g.constants.c0.bytes=20,g=>g.operations[0].args[0]='missing',g=>g.operations[0].op='constructor',g=>g.operations[0].outputs=['i0']]){const g=recipe();mutate(g);assert.throws(()=>validateDirectRecipe(g,8));}
});
test('exported full models contain only allowed WebNN recipes and verified raw weights; no browser ONNX/ORT fetch',async()=>{
 const base=new URL('../../examples/wam/source-separation/',import.meta.url),paths=[];
 const fetchImpl=async url=>{paths.push(String(url));const data=await readFile(url);return{ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.length)};};
 for(const key of ['demucs4','roformer6']){
  const result=await loadDirectWebNNModel(key,{fetchImpl});assert.equal(result.recipe.provenance.numericalQualification.includes('pending'),true);assert.ok(result.recipe.operations.length>1000);assert.deepEqual(new Set(result.recipe.outputNames),new Set(Object.keys(result.recipe.outputs)));if(key==='demucs4')assert.deepEqual(result.recipe.outputNames,['output','5073']);assert.equal(result.recipe.weights.bytes,result.weights.byteLength);
  assert.ok(result.recipe.operations.every(row=>row.op!=='reshape'||!Object.hasOwn(result.recipe.constants,row.args[0])));
  for(const row of result.recipe.operations.filter(row=>['conv2d','convTranspose2d'].includes(row.op)))assert.ok(Object.hasOwn(result.recipe.constants,row.args[1]));
  const used=new Set();result.recipe.operations.forEach(row=>{row.args.flat(Infinity).filter(x=>typeof x==='string').forEach(x=>used.add(x));});
  for(const c of Object.values(result.recipe.constants))assert.notEqual(c.shape.includes(0),true);
 }
 assert.ok(paths.every(path=>!path.includes('onnxruntime')&&!path.endsWith('.onnx')));
 const code=await readFile(new URL('DirectWebNN.js',base),'utf8');assert.doesNotMatch(code,/import\(/);assert.doesNotMatch(code,/InferenceSession/);
});
test('Demucs uses equivalent static slices while Roformer scalar gather indices preserve rank zero',async()=>{
 for(const key of ['demucs4','roformer6']){
  const g=JSON.parse(await readFile(new URL(`../../examples/wam/source-separation/model-assets/direct-webnn/${key}.graph.json`,import.meta.url)));
  if(key==='demucs4'){assert.equal(g.operations.filter(row=>row.op==='gather').length,0);assert.equal(g.operations.filter(row=>row.sourceLabel?.endsWith('/static-selection-slice')).length,26);assert.match(g.provenance.staticScalarGather,/native validation pending/);}
  else assert.ok(g.operations.filter(row=>row.op==='gather').some(row=>g.constants[row.args[1]].shape.length===0));
 }
});

test('native Core ML compute-plan errors are classified without claiming that the graph or device is fixed',()=>{
 const error=new Error("Failed to execute 'build' on 'MLGraphBuilder': Failed to get compiled graph devices.");const result=describeDirectWebNNFailure(error);assert.equal(result.classification,'native-coreml-compute-plan');assert.equal(result.fixed,false);assert.match(result.neededEvidence,/Native browser/);assert.equal(describeDirectWebNNFailure(new Error('Unknown operator')),null);
});

test('real Demucs adapter and direct session preserve declared outputs despite numeric JSON key enumeration',async()=>{
 const {Builder:Base,context}=fake();
 class Builder extends Base{reshape(a,shape){return{...a,shape};}}
 const g={format:'direct-webnn-graph-v1',inputNames:['mix','spec'],outputNames:['output','5073'],inputs:{mix:{id:'mix',shape:[16],dataType:'float32'},spec:{id:'spec',shape:[8],dataType:'float32'}},outputs:{output:{id:'spectral',shape:[1,4,4,1,1],dataType:'float32'},'5073':{id:'temporal',shape:[1,4,2,1],dataType:'float32'}},constants:{},operations:[{op:'reshape',args:['mix',[1,4,4,1,1]],outputs:['spectral']},{op:'reshape',args:['spec',[1,4,2,1]],outputs:['temporal']}]};
 assert.deepEqual(Object.keys(g.outputs),['5073','output']); // The exact cause of the browser reconstruction failure.
 const session=await createDirectWebNNSession(context,JSON.parse(JSON.stringify(g)),new ArrayBuffer(0),{Builder});
 assert.deepEqual(session.outputNames,['output','5073']);
 const adapter=new OnnxCoreModel(session,DirectAudioTensor);
 const result=await adapter.forward({data:new Float32Array(16).fill(3),shape:[16]},{data:new Float32Array(8).fill(7),shape:[8]});
 assert.deepEqual(result.outX.shape,[1,4,4,1,1]);assert.deepEqual(result.outXt.shape,[1,4,2,1]);assert.equal(result.outX.data[0],3);assert.equal(result.outXt.data[0],7);await session.release();
 for(const names of [['output','output'],['5073'],['output','unknown']])assert.throws(()=>validateDirectRecipe({...g,outputNames:names},0),/outputNames order/);
});
