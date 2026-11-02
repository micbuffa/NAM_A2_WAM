import test from 'node:test';
import {OnnxCoreModel} from '../../examples/wam/source-separation/OnnxCoreModel.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {EXPERIMENT_MODELS,sha256} from '../../examples/wam/source-separation/DirectWebNNAssets.js';
import {createDirectWebNNSession,DirectAudioTensor,validateDirectRecipe,loadDirectWebNNModel,describeDirectWebNNFailure} from '../../examples/wam/source-separation/DirectWebNN.js';
// Full exported models are optional generated integration fixtures (~908 MB), not unit fixtures.
// An existing but incomplete directory must still fail; the strict npm command also fails if absent.
const fullModels={skip:!existsSync(new URL('../../examples/wam/source-separation/model-assets/direct-webnn/',import.meta.url)) && process.env.REQUIRE_DIRECT_WEBNN_ASSETS!=='1' && process.env.npm_lifecycle_event!=='test:direct-webnn:assets' ? 'Generated WebNN models absent; run npm run test:direct-webnn:assets after export/build (see README).' : false};
const recipe=()=>({format:'direct-webnn-graph-v1',inputs:{audio:{id:'i0',shape:[2],dataType:'float32'}},outputs:{result:{id:'v0',shape:[2],dataType:'float32'}},constants:{c0:{shape:[2],dataType:'float32',offset:0,bytes:8}},operations:[{op:'add',args:['i0','c0'],outputs:['v0'],checkShape:[2],sourceLabel:'test-add'}]});
async function loaderFixture(model='demucs4') {
 const weights=new Float32Array([.25,.5]).buffer;
 const g={...recipe(),provenance:{sourceSha256:EXPERIMENT_MODELS[model].sha256},weights:{bytes:weights.byteLength,sha256:await sha256(weights)}};
 const encode=value=>new TextEncoder().encode(JSON.stringify(value)).buffer;
 const graph=encode(g),entry={sourceSha256:g.provenance.sourceSha256,graph:{url:`./model-assets/direct-webnn/${model}.graph.json`,bytes:graph.byteLength,sha256:await sha256(graph)},weights:{...g.weights}};
 const index={format:'direct-webnn-index-v1',models:{[model]:entry}},paths=[];
 const files=new Map([['index.json',encode(index)],[`${model}.graph.json`,graph],[`${model}.weights.bin`,weights]]);
 return{g,index,entry,encode,files,paths,fetchImpl:async url=>{
  paths.push(String(url));const bytes=files.get(new URL(url).pathname.split('/').at(-1));
  return{ok:!!bytes,arrayBuffer:async()=>bytes.slice(0)};
 }};
}
test('direct model loader verifies pinned identity, graph and weights using tiny synthetic assets',async()=>{
 const code=await readFile(new URL('../../examples/wam/source-separation/DirectWebNN.js',import.meta.url),'utf8');assert.doesNotMatch(code,/import\(/);assert.doesNotMatch(code,/InferenceSession/);
 for(const model of ['demucs4','roformer6']){
  const f=await loaderFixture(model),phases=[];
  const result=await loadDirectWebNNModel(model,{fetchImpl:f.fetchImpl,measure:async(name,fn)=>{phases.push(name);return fn();}});
  assert.deepEqual(result.recipe,f.g);assert.deepEqual([...new Float32Array(result.weights)],[.25,.5]);
  assert.deepEqual(f.paths.map(url=>new URL(url).pathname.split('/').at(-1)),['index.json',`${model}.graph.json`,`${model}.weights.bin`]);
  assert.ok(f.paths.every(url=>!url.includes('onnxruntime')&&!url.endsWith('.onnx')));
  assert.deepEqual(phases,['graphRecipeFetchMs','graphRecipeVerifyMs','weightsFetchMs','weightsHashMs']);
 }
});
test('direct model loader rejects missing assets, wrong identities and corrupted graph/weights without large model files',async()=>{
 const cases=[
  [f=>f.files.delete('index.json'),/export missing/],
  [f=>{f.entry.sourceSha256='wrong';f.files.set('index.json',f.encode(f.index));},/pinned model/],
  [f=>f.files.set('demucs4.graph.json',new ArrayBuffer(1)),/recipe integrity/],
  [f=>{const b=f.files.get('demucs4.graph.json').slice(0);new Uint8Array(b)[0]^=1;f.files.set('demucs4.graph.json',b);},/recipe integrity/],
  [async f=>{f.g.provenance.sourceSha256='wrong';const b=f.encode(f.g);f.entry.graph={...f.entry.graph,bytes:b.byteLength,sha256:await sha256(b)};f.files.set('demucs4.graph.json',b);f.files.set('index.json',f.encode(f.index));},/source identity/],
  [f=>f.files.delete('demucs4.weights.bin'),/export missing/],
  [f=>f.files.set('demucs4.weights.bin',new ArrayBuffer(1)),/weights integrity/],
  [f=>f.files.set('demucs4.weights.bin',new Float32Array([99,99]).buffer),/weights integrity/]
 ];
 for(const [mutate,message]of cases){const f=await loaderFixture();await mutate(f);await assert.rejects(loadDirectWebNNModel('demucs4',{fetchImpl:f.fetchImpl}),message);}
});
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
test('exported full models contain only allowed WebNN recipes and verified raw weights; no browser ONNX/ORT fetch',fullModels,async()=>{
 const paths=[];
 const fetchImpl=async url=>{paths.push(String(url));const data=await readFile(url);return{ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.length)};};
 for(const key of ['demucs4','roformer6']){
  const result=await loadDirectWebNNModel(key,{fetchImpl});assert.equal(result.recipe.provenance.numericalQualification.includes('pending'),true);assert.ok(result.recipe.operations.length>1000);assert.deepEqual(new Set(result.recipe.outputNames),new Set(Object.keys(result.recipe.outputs)));if(key==='demucs4')assert.deepEqual(result.recipe.outputNames,['output','5073']);assert.equal(result.recipe.weights.bytes,result.weights.byteLength);
  assert.ok(result.recipe.operations.every(row=>row.op!=='reshape'||!Object.hasOwn(result.recipe.constants,row.args[0])));
  for(const row of result.recipe.operations.filter(row=>['conv2d','convTranspose2d'].includes(row.op)))assert.ok(Object.hasOwn(result.recipe.constants,row.args[1]));
  const used=new Set();result.recipe.operations.forEach(row=>{row.args.flat(Infinity).filter(x=>typeof x==='string').forEach(x=>used.add(x));});
  for(const c of Object.values(result.recipe.constants))assert.notEqual(c.shape.includes(0),true);
 }
 assert.ok(paths.every(path=>!path.includes('onnxruntime')&&!path.endsWith('.onnx')));
});
test('Demucs uses equivalent static slices while Roformer scalar gather indices preserve rank zero',fullModels,async()=>{
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
