import {sha256} from '../../source-separation/ModelDownloadManager.js';
export const BEAT_THIS_SOURCE_SHA='1337dc6c21257ed6b803418efc320df42b5d8eb296ef16648ef60457cd4b9e55';
export const BEAT_THIS_GPU_GRAPH_SHA='7cc392e287c12ce27642fd5f04f0d4dfb47102d20eabe51b466a38a0786b3ba3';
export const BEAT_THIS_GPU_PATCH_SHA='334717a4b3329869e910b677fcbd712096690f5d9d4c65fa6bf8452399de24ff';

export const BEAT_THIS_DYNAMIC_RECIPE_SHA='d75c4f7a8a355a673a8fcc4a2627d44e63f521db0fb96f2e7ae29981fe8dfeb7';
export const BEAT_THIS_DYNAMIC_GRAPH_SHA='51c8c97f3013190b8d49d2f79dc40173f0cd4d7d4e3df598537821ae440a77cb';
export function applyGraphRecipe(source,recipe) {
  if(!(source instanceof ArrayBuffer)||recipe?.version!==1||source.byteLength!==recipe.sourceSize||!Number.isSafeInteger(recipe.targetSize)||recipe.targetSize<1||recipe.targetSize>source.byteLength||!Array.isArray(recipe.parts)||!recipe.parts.length||recipe.parts.length>5000)throw Error('Invalid dynamic graph recipe.');
  const input=new Uint8Array(source),output=new Uint8Array(recipe.targetSize);let written=0;
  for(const part of recipe.parts){
    let bytes;
    if(Object.hasOwn(part,'data')){
      if(Object.hasOwn(part,'offset')||Object.hasOwn(part,'length')||typeof part.data!=='string'||part.data.length>5000000)throw Error('Invalid dynamic graph literal.');
      bytes=Uint8Array.from(atob(part.data),c=>c.charCodeAt(0));
    }else{
      if(!Number.isSafeInteger(part.offset)||!Number.isSafeInteger(part.length)||part.offset<0||part.length<1||part.offset+part.length>input.length)throw Error('Invalid dynamic graph copy.');
      bytes=input.subarray(part.offset,part.offset+part.length);
    }
    if(written+bytes.length>output.length)throw Error('Dynamic graph exceeds target size.');
    output.set(bytes,written);written+=bytes.length;
  }
  if(written!==output.length)throw Error('Dynamic graph target size mismatch.');
  return output.buffer;
}
// Source offsets are bound to one exact model SHA; all unchanged byte ranges,
// including every learned weight, are copied verbatim. No ONNX parser in the UI.
export function applyBytePatch(source,patch) {
  if(!(source instanceof ArrayBuffer)||patch?.version!==1||source.byteLength!==patch.sourceSize||!Number.isSafeInteger(patch.targetSize)||patch.targetSize<1||patch.targetSize>source.byteLength+100000||!Array.isArray(patch.changes)||!patch.changes.length||patch.changes.length>100)throw Error('Invalid Beat This graph patch.');
  const input=new Uint8Array(source),output=new Uint8Array(patch.targetSize);let cursor=0,written=0;
  for(const change of patch.changes){
    const {offset,remove,data}=change;
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(remove)||offset<cursor||remove<0||offset+remove>input.length||typeof data!=='string'||data.length>100000)throw Error('Invalid Beat This patch range.');
    const replacement=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
    const copied=offset-cursor;
    if(written+copied+replacement.length>output.length)throw Error('Beat This patch exceeds target size.');
    output.set(input.subarray(cursor,offset),written);written+=copied;output.set(replacement,written);written+=replacement.length;cursor=offset+remove;
  }
  if(written+input.length-cursor!==output.length)throw Error('Beat This patch target size mismatch.');
  output.set(input.subarray(cursor),written);return output.buffer;
}
// The dynamic export retains Conv/BatchNormalization. Its default NHWC layout
// produced wrong logits on the qualification machine; explicit NCHW passes parity.
export function beatThisSessionOptions(backend,{dynamic=false}={}) {
  if(!['wasm','webgpu'].includes(backend))throw Error('Unsupported Beat This backend.');
  return {executionProviders:[backend==='webgpu'&&dynamic?{name:'webgpu',preferredLayout:'NCHW'}:backend]};
}
export async function prepareBeatThisGraph(source,backend,{fetchImpl=globalThis.fetch.bind(globalThis),frames=1500}={}) {
  if(!Number.isSafeInteger(frames)||frames<14||frames>1500)throw Error('Unsupported Beat This window length.');
  if(!['wasm','webgpu'].includes(backend))throw Error('Unsupported Beat This backend.');
  if(await sha256(source)!==BEAT_THIS_SOURCE_SHA)throw Error('Unexpected Beat This source graph SHA-256.');
  if(frames<1500){
    const response=await fetchImpl(new URL('./beat-this-dynamic-recipe.json',import.meta.url));
    if(!response.ok)throw Error('Beat This dynamic recipe is unavailable.');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength>5000000||await sha256(bytes)!==BEAT_THIS_DYNAMIC_RECIPE_SHA)throw Error('Beat This dynamic recipe SHA-256 mismatch.');
    const recipe=JSON.parse(new TextDecoder().decode(bytes));
    if(recipe.sourceSha256!==BEAT_THIS_SOURCE_SHA||recipe.targetSha256!==BEAT_THIS_DYNAMIC_GRAPH_SHA)throw Error('Unexpected dynamic graph identity.');
    const dynamic=applyGraphRecipe(source,recipe);
    if(await sha256(dynamic)!==BEAT_THIS_DYNAMIC_GRAPH_SHA)throw Error('Beat This dynamic graph SHA-256 mismatch.');
    return {bytes:dynamic,sha256:BEAT_THIS_DYNAMIC_GRAPH_SHA,workaround:recipe.id};
  }
  if(backend==='wasm')return {bytes:source,sha256:BEAT_THIS_SOURCE_SHA,workaround:null};
  const response=await fetchImpl(new URL('./beat-this-webgpu-patch.json',import.meta.url));
  if(!response.ok)throw Error('Beat This WebGPU patch is unavailable.');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>100000||await sha256(bytes)!==BEAT_THIS_GPU_PATCH_SHA)throw Error('Beat This WebGPU patch SHA-256 mismatch.');
  const patch=JSON.parse(new TextDecoder().decode(bytes));
  if(patch.sourceSha256!==BEAT_THIS_SOURCE_SHA||patch.targetSha256!==BEAT_THIS_GPU_GRAPH_SHA)throw Error('Unexpected Beat This patch identity.');
  const patched=applyBytePatch(source,patch);
  if(await sha256(patched)!==BEAT_THIS_GPU_GRAPH_SHA)throw Error('Beat This WebGPU execution graph SHA-256 mismatch.');
  return {bytes:patched,sha256:BEAT_THIS_GPU_GRAPH_SHA,workaround:patch.id};
}
