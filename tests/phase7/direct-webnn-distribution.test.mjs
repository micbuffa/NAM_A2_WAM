import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectDirectAssets,copyDirectAssets} from '../../tools/direct-webnn-distribution.mjs';
import {EXPERIMENT_MODELS,directWebNNAvailability} from '../../examples/wam/source-separation/DirectWebNNAssets.js';
import {studioBackendOptions} from '../../examples/wam/source-separation/StudioWebNN.js';
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'direct-dist-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function complete(dir){
 const index={format:'direct-webnn-index-v1',models:{}};await mkdir(dir,{recursive:true});
 for(const [key,m]of Object.entries(EXPERIMENT_MODELS)){
  const graph=Buffer.from('{}'),weights=Buffer.from([1,2,3,4]);
  index.models[key]={sourceSha256:m.sha256,graph:{bytes:graph.length},weights:{bytes:weights.length}};
  await writeFile(join(dir,key+'.graph.json'),graph);await writeFile(join(dir,key+'.weights.bin'),weights);
 }
 await writeFile(join(dir,'index.json'),JSON.stringify(index));return index;
}
test('missing exports allow a lightweight distribution; strict mode fails before touching output',async t=>{
 const dir=await fixture(t),source=join(dir,'missing'),output=join(dir,'output');
 const state=await inspectDirectAssets(source);assert.equal(state.available,false);
 await copyDirectAssets(source,output,state);assert.deepEqual(JSON.parse(await readFile(join(output,'index.json'),'utf8')).models,{});
 await assert.rejects(inspectDirectAssets(source,{required:true}),/prepare:direct-webnn.*Previous dist was not replaced/);
 assert.equal((await stat(join(output,'index.json'))).isFile(),true);
});
test('complete pinned exports are included; partial, truncated or incompatible exports cannot be advertised',async t=>{
 const dir=await fixture(t);await complete(dir);
 const ready=await inspectDirectAssets(dir,{required:true});assert.equal(ready.available,true);
 await writeFile(join(dir,'unrelated.tmp'),'do not ship');const out=join(dir,'out');await copyDirectAssets(dir,out,ready);
 assert.equal((await stat(join(out,'demucs4.weights.bin'))).size,4);await assert.rejects(stat(join(out,'unrelated.tmp')),/ENOENT/);
 await writeFile(join(dir,'demucs4.weights.bin'),new Uint8Array(1));assert.equal((await inspectDirectAssets(dir)).available,false);
 await assert.rejects(inspectDirectAssets(dir,{required:true}),/Incomplete/);
 await complete(dir);const index=JSON.parse(await readFile(join(dir,'index.json'),'utf8'));index.models.roformer6.sourceSha256='wrong';await writeFile(join(dir,'index.json'),JSON.stringify(index));assert.equal((await inspectDirectAssets(dir)).available,false);
});
test('an explicit lightweight rebuild removes previous generated weights and has a usable unavailable marker',async t=>{
 const dir=await fixture(t),source=join(dir,'source'),out=join(dir,'dist');await complete(source);await complete(out);
 await copyDirectAssets(source,out,await inspectDirectAssets(source,{exclude:true}));
 await assert.rejects(stat(join(out,'demucs4.weights.bin')),/ENOENT/);
 assert.equal((await directWebNNAvailability(async()=>({ok:true,json:async()=>JSON.parse(await readFile(join(out,'index.json'),'utf8'))}))).available,false);
 await assert.rejects(inspectDirectAssets(source,{required:true,exclude:true}),/not both/);
});
test('availability only reads the index and disables native WebNN without disabling WASM, WebGPU or ONNX→WebNN',async()=>{
 let reads=0;assert.equal((await directWebNNAvailability(async()=>{reads++;return{ok:false};})).available,false);assert.equal(reads,1);
 const choices=studioBackendOptions({webgpu:true,webnn:true,directAvailable:false});
 assert.ok(choices.filter(c=>c.value.startsWith('webnn-direct-')).every(c=>c.disabled));
 assert.ok(choices.filter(c=>!c.value.startsWith('webnn-direct-')).every(c=>!c.disabled));
 assert.equal((await directWebNNAvailability(async()=>{throw Error('offline');})).available,false);
});

import {createHash} from 'node:crypto';
import {prepareDirectCheckpoints} from '../../tools/prepare-direct-webnn.mjs';
test('checkpoint preparation downloads only explicitly, verifies hashes and reuses existing files',async t=>{
 const directory=await fixture(t),bytes=new Uint8Array([10,20,30]);
 const catalogue=['htdemucs_4s_onnx','bs_roformer_sw_6s'].map(id=>({id,files:[{url:'https://test/'+id,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]}));
 let requests=0;const fetchImpl=async()=>{requests++;return new Response(bytes);};
 await prepareDirectCheckpoints({directory,catalogue,fetchImpl,log:()=>{}});assert.equal(requests,2);
 await prepareDirectCheckpoints({directory,catalogue,fetchImpl,log:()=>{}});assert.equal(requests,2);
 await writeFile(join(directory,'third_party/nam-webgpu-probe/htdemucs-core.onnx'),'corrupted');
 await assert.rejects(prepareDirectCheckpoints({directory,catalogue,fetchImpl,log:()=>{}}),/wrong SHA-256/);assert.equal(requests,2);
});
test('failed checkpoint verification leaves no final checkpoint or partial file',async t=>{
 const directory=await fixture(t),catalogue=[{id:'htdemucs_4s_onnx',files:[{url:'https://test',size:3,sha256:'0'.repeat(64)}]}];
 await assert.rejects(prepareDirectCheckpoints({directory,catalogue,fetchImpl:async()=>new Response(new Uint8Array(3)),log:()=>{}}),/integrity failed/);
 await assert.rejects(stat(join(directory,'third_party/nam-webgpu-probe/htdemucs-core.onnx')),/ENOENT/);
});
