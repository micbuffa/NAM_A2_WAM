// Native WebNN only: no ONNX parser, ONNX Runtime, or neural WASM fallback.
import {sha256,EXPERIMENT_MODELS} from './WebNNExperiment.js';
export const DIRECT_WEBNN_OPERATIONS=new Set(['add','sub','mul','div','matmul','erf','sigmoid','sqrt','neg','tanh','reshape','transpose','gemm','conv2d','convTranspose2d','instanceNormalization','layerNormalization','reduceMean','reduceL2','softmax','gather','split','slice','concat','expand','clamp','pad']);
const types={float32:Float32Array,int32:Int32Array,int64:BigInt64Array,uint8:Uint8Array,float16:Uint16Array};
const elements=shape=>shape.reduce((n,x)=>n*x,1);
function descriptor(d){if(!types[d?.dataType]||!Array.isArray(d.shape)||d.shape.some(x=>!Number.isSafeInteger(x)||x<1)||!Number.isSafeInteger(elements(d.shape)))throw Error('Invalid direct WebNN tensor descriptor.');return{dataType:d.dataType,shape:d.shape};}
export function validateDirectRecipe(recipe,bytes){
 if(recipe?.format!=='direct-webnn-graph-v1'||!Array.isArray(recipe.operations)||!recipe.operations.length||!recipe.inputs||!recipe.outputs||!recipe.constants)throw Error('Invalid direct WebNN graph recipe.');
 // Object.keys reorders integer-like names (Demucs output "5073"). Preserve ONNX declaration order in arrays.
 for(const [key,entries]of [['inputNames',recipe.inputs],['outputNames',recipe.outputs]])if(recipe[key]!==undefined){
  const names=recipe[key];if(!Array.isArray(names)||names.length!==Object.keys(entries).length||new Set(names).size!==names.length||names.some(name=>typeof name!=='string'||!Object.hasOwn(entries,name)))throw Error('Invalid direct WebNN '+key+' order.');
 }
 const values=new Set();
 for(const [name,d]of Object.entries(recipe.inputs)){descriptor(d);if(!name||typeof d.id!=='string'||values.has(d.id))throw Error('Duplicate direct WebNN input.');values.add(d.id);}
 for(const [key,c]of Object.entries(recipe.constants)){
  descriptor(c);const size=types[c.dataType].BYTES_PER_ELEMENT;
  if(values.has(key)||!Number.isSafeInteger(c.offset)||c.offset<0||c.offset%size||c.bytes!==elements(c.shape)*size||c.offset+c.bytes>bytes)throw Error('Invalid direct WebNN constant span.');values.add(key);
 }
 const reference=value=>{if(typeof value==='string'&&!values.has(value))throw Error('Unknown direct WebNN operand: '+value);if(Array.isArray(value))value.forEach(reference);};
 const options=value=>{if(value&&typeof value==='object'){if(Object.hasOwn(value,'operand'))reference(value.operand);else Object.values(value).forEach(options);}};
 for(const row of recipe.operations){
  if(!DIRECT_WEBNN_OPERATIONS.has(row.op)||!Array.isArray(row.args)||!Array.isArray(row.outputs)||!row.outputs.length)throw Error('Unsupported direct WebNN recipe operation: '+row.op);
  row.args.forEach(reference);options(row.options);
  for(const key of row.outputs){if(typeof key!=='string'||values.has(key))throw Error('Duplicate graph operand.');values.add(key);}
 }
 for(const d of Object.values(recipe.outputs)){descriptor(d);reference(d.id);if(d.dataType!=='float32')throw Error('Direct audio graph must output float32.');}
 return recipe;
}
export async function loadDirectWebNNModel(model,{fetchImpl=fetch,measure=async(_name,fn)=>fn()}={}){
 const read=async url=>{const r=await fetchImpl(url);if(!r.ok)throw Error('Direct WebNN export missing. Run tools/export-direct-webnn.py and rebuild the distribution.');return r.arrayBuffer();};
 let recipeBytes,index,entry;
 await measure('graphRecipeFetchMs',async()=>{
  index=JSON.parse(new TextDecoder().decode(await read(new URL('./model-assets/direct-webnn/index.json',import.meta.url))));entry=index.models?.[model];
  if(index.format!=='direct-webnn-index-v1'||!entry||entry.sourceSha256!==EXPERIMENT_MODELS[model]?.sha256)throw Error('Direct WebNN export does not match the pinned model.');
  recipeBytes=await read(new URL(entry.graph.url,import.meta.url));
 });
 let recipe;
 await measure('graphRecipeVerifyMs',async()=>{
  if(recipeBytes.byteLength!==entry.graph.bytes||await sha256(recipeBytes)!==entry.graph.sha256)throw Error('Direct graph recipe integrity mismatch.');
  recipe=JSON.parse(new TextDecoder().decode(recipeBytes));if(recipe.provenance?.sourceSha256!==entry.sourceSha256)throw Error('Direct graph source identity mismatch.');
 });
 // Pin the asset location; the exported weights URL is a basename.
 const weights=await measure('weightsFetchMs',()=>read(new URL(`./model-assets/direct-webnn/${model}.weights.bin`,import.meta.url)));
 await measure('weightsHashMs',async()=>{if(weights.byteLength!==entry.weights.bytes||weights.byteLength!==recipe.weights.bytes||await sha256(weights)!==entry.weights.sha256||entry.weights.sha256!==recipe.weights.sha256)throw Error('Direct WebNN weights integrity mismatch.');});
 validateDirectRecipe(recipe,weights.byteLength);return{recipe,weights,indexEntry:entry};
}
export class DirectAudioTensor{
 constructor(type,data,dims){this.type=type;this.data=data;this.dims=dims;}
 dispose(){}
}
// Shared operator construction; diagnostics may select ancestors or replace cut edges with inputs.
export function constructDirectOperands(builder,recipe,weights,{indices=null,externalInputs={},onProgress=()=>{}}={}){
 const values=new Map(),rows=indices===null?[...recipe.operations.entries()]:indices.map(i=>[i,recipe.operations[i]]);
 const needed=indices===null?null:new Set();
 const collect=v=>{if(typeof v==='string')needed?.add(v);else if(Array.isArray(v))v.forEach(collect);};
 const collectOptions=v=>{if(v&&typeof v==='object'){if(Object.hasOwn(v,'operand'))collect(v.operand);else Object.values(v).forEach(collectOptions);}};
 if(needed)for(const [,row]of rows){row.args.forEach(collect);collectOptions(row.options);}
   const missing=[...new Set(rows.map(([,row])=>row.op))].filter(op=>typeof builder[op]!=='function');
   if(missing.length)throw Error('This WebNN build lacks required operations: '+missing.join(', ')+'. No ONNX Runtime or WASM fallback was used.');
   for(const [name,d]of Object.entries(recipe.inputs))if(!needed||needed.has(d.id))values.set(d.id,builder.input(name,descriptor(d)));
   for(const [id,d]of Object.entries(externalInputs))values.set(id,builder.input('cut_'+id,descriptor(d)));
   for(const [key,c]of Object.entries(recipe.constants))if(!needed||needed.has(key))values.set(key,builder.constant(descriptor(c),new types[c.dataType](weights,c.offset,elements(c.shape))));
   const arg=v=>Array.isArray(v)?v.map(arg):typeof v==='string'?values.get(v):v;
   const option=v=>v&&typeof v==='object'?(Object.hasOwn(v,'operand')?values.get(v.operand):Array.isArray(v)?v.map(option):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,option(x)]))):v;
   for(const [index,row]of rows){
    try{
     const args=row.args.map(arg);args.push({...option(row.options??{}),label:row.sourceLabel??`${row.op}:${index}`});
     const result=builder[row.op](...args),outputs=Array.isArray(result)?result:[result];
     if(outputs.length!==row.outputs.length||outputs.some(v=>!v))throw Error('Invalid operator output count.');
     if(row.checkShape&&String(outputs[0].shape)!==String(row.checkShape))throw Error(`Shape ${outputs[0].shape} differs from ${row.checkShape}.`);
     row.outputs.forEach((key,i)=>values.set(key,outputs[i]));
    }catch(error){throw Error(`Direct WebNN node ${index} ${row.op} (${row.sourceLabel}): ${error.message}`);}
    if(index%100===0)onProgress(index,recipe.operations.length);
   }
 return values;
}
export async function createDirectWebNNSession(context,recipe,weights,{Builder=globalThis.MLGraphBuilder,onPhase=()=>{},onProgress=()=>{},onStep=()=>{}}={}){
 validateDirectRecipe(recipe,weights.byteLength);
 let graph;const tensors=[];let released=false,busy=false;
 const pendingReads=new Set();
 const step=(name,details={})=>{if(name==='readTensor-pending')pendingReads.add(details.tensor);if(name==='readTensor-complete')pendingReads.delete(details.tensor);try{onStep({name,...details,pendingReads:[...pendingReads],atMs:performance.now()});}catch{/* Diagnostics must not alter native execution. */}};
 const timed=async(name,fn)=>{const t=performance.now();try{return await fn();}finally{onPhase(name,performance.now()-t);}};
 try{
  const builder=new Builder(context),values=new Map();
  await timed('graphConstructionMs',async()=>{
   const constructed=constructDirectOperands(builder,recipe,weights,{onProgress});
   for(const [key,value]of constructed)values.set(key,value);
  });
  const outputs=Object.fromEntries(Object.entries(recipe.outputs).map(([name,d])=>{
   const value=values.get(d.id);if(String(value.shape)!==String(d.shape)||value.dataType!==d.dataType)throw Error('Direct WebNN output descriptor mismatch: '+name);return[name,value];
  }));
  graph=await timed('nativeGraphBuildMs',()=>builder.build(outputs));values.clear();weights=null;
  const inputs={},outputTensors={};
  await timed('tensorAllocationMs',async()=>{
   for(const [name,d]of Object.entries(recipe.inputs)){const t=await context.createTensor({...descriptor(d),writable:true});tensors.push(t);inputs[name]=t;}
   for(const [name,d]of Object.entries(recipe.outputs)){const t=await context.createTensor({...descriptor(d),readable:true});tensors.push(t);outputTensors[name]=t;}
  });
  return{inputNames:[...(recipe.inputNames??Object.keys(inputs))],outputNames:[...(recipe.outputNames??Object.keys(outputs))],implementation:'direct-webnn',
   async run(feeds){
    if(released||busy)throw Error('Direct WebNN session unavailable.');busy=true;
    try{
     for(const [name,d]of Object.entries(recipe.inputs)){const feed=feeds[name];if(feed?.type!==d.dataType||String(feed.dims)!==String(d.shape)||feed.data.length!==elements(d.shape))throw Error('Invalid direct WebNN feed: '+name);step('writeTensor',{tensor:name});context.writeTensor(inputs[name],feed.data);}
     step('dispatch');context.dispatch(graph,inputs,outputTensors);
     const out={};await Promise.all(Object.entries(outputTensors).map(async([name,tensor])=>{step('readTensor-pending',{tensor:name});const bytes=await context.readTensor(tensor);step('readTensor-complete',{tensor:name});const d=recipe.outputs[name];const data=new Float32Array(bytes);if(data.length!==elements(d.shape))throw Error('Invalid WebNN read size.');out[name]=new DirectAudioTensor('float32',data,d.shape);}));return out;
    }finally{busy=false;}
   },
   async release(){if(busy)throw Error('Direct WebNN dispatch is active.');if(released)return;released=true;for(const tensor of tensors)tensor.destroy();graph.destroy();}
  };
 }catch(error){for(const tensor of tensors)try{tensor.destroy();}catch{}try{graph?.destroy();}catch{}throw error;}
}

export function describeDirectWebNNFailure(error){
 if(error?.message?.includes('Failed to get compiled graph devices'))return{classification:'native-coreml-compute-plan',applicationStage:'MLGraphBuilder.build',explanation:'This message is emitted by Chromium Core ML when loading its native MLComputePlan reports an error. Graph specialization or device planning failed; JavaScript does not receive the detailed NSError.',neededEvidence:'Native browser/Core ML error log, or an isolated failing graph; do not infer unsupported NPU or invalid weights from this message alone.',source:'https://github.com/chromium/chromium/blob/main/services/webnn/coreml/graph_impl_coreml.mm',fixed:false};
 return null;
}
