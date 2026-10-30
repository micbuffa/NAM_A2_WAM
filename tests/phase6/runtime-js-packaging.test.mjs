import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {packageRuntimeJs} from '../../tools/package-runtime-js.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'runtime-js-'));
 const originals={'ort.all.min.mjs':'const api=env.wasmPaths.mjs; import("./ort-wasm-simd-threaded.jsep.mjs"); export const name="ort.all.min.mjs";', 'ort-wasm-simd-threaded.jsep.mjs':'export const wasm="./ort-wasm-simd-threaded.jsep.wasm";', 'ort-wasm-simd-threaded.jsep.wasm':Buffer.from([0,97,115,109])};
 await mkdir(join(root,'vendor/onnxruntime-webnn'),{recursive:true});await mkdir(join(root,'research'));
 for(const [name,bytes]of Object.entries(originals))await writeFile(join(root,'vendor/onnxruntime-webnn',name),bytes);
 const manifest={version:'1.30.0',packageIntegrity:'pinned upstream',files:Object.fromEntries(Object.entries(originals).map(([name,bytes])=>[name,{bytes:Buffer.byteLength(bytes),sha256:hash(bytes)}]))};
 await writeFile(join(root,'research/webnn-runtime.json'),JSON.stringify(manifest));
 await writeFile(join(root,'worker.js'),'const allowed=["ort.all.min.mjs","ort-wasm-simd-threaded.jsep.mjs"]; import("./vendor/onnxruntime-webnn/ort.all.min.mjs");');
 return{root,originals,manifest};
}
test('distribution JS packaging rewrites runtime entry points, lazy imports and validators while preserving upstream evidence and WASM bytes',async()=>{
 const {root,originals,manifest}=await fixture();
 try{
  await packageRuntimeJs(root);
  const code=await readFile(join(root,'vendor/onnxruntime-webnn/ort.all.min.js'),'utf8');
  assert.match(code,/wasmPaths.mjs/);assert.match(code,/import\("\.\/ort-wasm-simd-threaded.jsep.js"\)/);
  assert.doesNotMatch(await readFile(join(root,'worker.js'),'utf8'),/\.mjs/);
  await assert.rejects(stat(join(root,'vendor/onnxruntime-webnn/ort.all.min.mjs')),/ENOENT/);
  const packaged=JSON.parse(await readFile(join(root,'research/webnn-runtime.json')));
  assert.deepEqual(packaged.upstreamFiles,manifest.files);assert.equal(packaged.packageIntegrity,manifest.packageIntegrity);
  assert.equal(packaged.files['ort.all.min.js'].sha256,hash(code));assert.equal(packaged.files['ort.all.min.js'].bytes,Buffer.byteLength(code));
  assert.deepEqual(await readFile(join(root,'vendor/onnxruntime-webnn/ort-wasm-simd-threaded.jsep.wasm')),originals['ort-wasm-simd-threaded.jsep.wasm']);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('tampered upstream assets fail before any distribution rewriting',async()=>{
 const {root}=await fixture();try{
  await writeFile(join(root,'vendor/onnxruntime-webnn/ort.all.min.mjs'),'tampered');
  await assert.rejects(packageRuntimeJs(root),/Upstream WebNN integrity mismatch/);
  assert.match(await readFile(join(root,'worker.js'),'utf8'),/ort.all.min.mjs/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('production WebGPU modules and integrity hashes are converted independently of WebNN',async()=>{
 const root=await mkdtemp(join(tmpdir(),'runtime-js-gpu-'));try{
  const base=join(root,'vendor/onnxruntime-web');await mkdir(base,{recursive:true});
  const code='import("./ort-wasm-simd-threaded.jsep.mjs");',loader='export const valid=true;';
  const upstream={'ort.webgpu.min.mjs':hash(code),'ort-wasm-simd-threaded.jsep.mjs':hash(loader)};
  await writeFile(join(base,'ort.webgpu.min.mjs'),code);await writeFile(join(base,'ort-wasm-simd-threaded.jsep.mjs'),loader);await writeFile(join(base,'integrity.json'),JSON.stringify(upstream));
  await packageRuntimeJs(root);
  assert.deepEqual(JSON.parse(await readFile(join(base,'upstream-integrity.json'))),upstream);
  const integrity=JSON.parse(await readFile(join(base,'integrity.json')));assert.equal(integrity['ort.webgpu.min.js'],hash(code.replace('.mjs','.js')));
 }finally{await rm(root,{recursive:true,force:true});}
});
