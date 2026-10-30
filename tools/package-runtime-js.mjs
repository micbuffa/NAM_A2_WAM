import {readFile,writeFile,readdir,rename,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const exists=async path=>{try{await stat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const files=async root=>{const paths=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())paths.push(...await files(path));else if(entry.isFile())paths.push(path);}return paths;};
export const runtimeJsName=name=>name.replace(/\.mjs$/,'.js');

// Only generated distributions are transformed. Verify upstream bytes first,
// retain their provenance, and regenerate hashes for the delivered JS modules.
export async function packageRuntimeJs(root){
 const all=await files(root),modules=all.filter(path=>path.endsWith('.mjs')&&path.includes('/vendor/onnxruntime-'));
 const names=[...new Set(modules.map(path=>path.slice(path.lastIndexOf('/')+1)))];
 const manifests=[];
 const webnn=join(root,'research/webnn-runtime.json'),production=join(root,'vendor/onnxruntime-web/integrity.json');
 if(await exists(webnn)){
  const manifest=JSON.parse(await readFile(webnn,'utf8')),base=join(root,'vendor/onnxruntime-webnn');
  if(await exists(base)){
   for(const [name,info]of Object.entries(manifest.files)){const bytes=await readFile(join(base,name));if(bytes.length!==info.bytes||digest(bytes)!==info.sha256)throw Error(`Upstream WebNN integrity mismatch: ${name}`);}
   manifests.push({path:webnn,base,manifest,kind:'webnn'});
  }
 }
 if(await exists(production)){
  const manifest=JSON.parse(await readFile(production,'utf8')),base=join(root,'vendor/onnxruntime-web');
  for(const [name,hash]of Object.entries(manifest)){if(digest(await readFile(join(base,name)))!==hash)throw Error(`Upstream WebGPU integrity mismatch: ${name}`);}
  manifests.push({path:production,base,manifest,kind:'webgpu'});
 }
 for(const path of modules)if(await exists(runtimeJsName(path)))throw Error(`Runtime JS filename collision: ${path}`);
 for(const path of all.filter(path=>/\.(?:js|mjs|html)$/.test(path))){
  const original=await readFile(path,'utf8');let code=original;
  // Replace filenames, never the ORT wasmPaths.mjs API property.
  for(const name of names)code=code.replaceAll(name,runtimeJsName(name));
  if(code!==original)await writeFile(path,code);
 }
 for(const path of modules)await rename(path,runtimeJsName(path));
 for(const {path,base,manifest,kind}of manifests){
  const delivered={};
  for(const name of Object.keys(kind==='webnn'?manifest.files:manifest)){
   const output=runtimeJsName(name),bytes=await readFile(join(base,output));
   delivered[output]=kind==='webnn'?{bytes:bytes.length,sha256:digest(bytes)}:digest(bytes);
  }
  if(kind==='webnn')await writeFile(path,JSON.stringify({...manifest,upstreamFiles:manifest.files,files:delivered,distributionPackaging:'mjs-to-js-v1: module filenames and references rewritten; upstreamFiles describe original package bytes'},null,2)+'\n');
  else{
   await writeFile(join(base,'upstream-integrity.json'),JSON.stringify(manifest,null,2)+'\n');
   await writeFile(path,JSON.stringify(delivered,null,2)+'\n');
  }
 }
 return modules.map(path=>runtimeJsName(path));
}
