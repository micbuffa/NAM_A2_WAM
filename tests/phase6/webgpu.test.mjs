import test from 'node:test';
import assert from 'node:assert/strict';
import {OnnxDemucsRunner} from '../../examples/wam/source-separation/OnnxDemucsRunner.js';
import {OnnxCoreModel} from '../../examples/wam/source-separation/OnnxCoreModel.js';
import {backendPolicy} from '../../examples/wam/source-separation/BackendPolicy.js';
import {compareAudio} from '../../examples/wam/source-separation/AudioComparison.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const model={id:'htdemucs_4s_onnx',runtime:'demucs-onnx-core',roles:['drums','bass','other','vocals'],backends:['wasm','webgpu'],files:[{sha256:'x'}]};
const input=()=>[new Float32Array(8),new Float32Array(8)];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup({respond,status='installed',timeoutMs=1000,keepAlive=false}={}) {
  const workers=[];let checks=0;
  const manager={getStatus:async()=>{checks++;return {state:status};},cache:{get:async()=>({files:[new ArrayBuffer(1)]})}};
  const runner=new OnnxDemucsRunner({manager,timeoutMs,keepAlive,workerFactory:()=>{
    const index=workers.length;
    if(index)assert.equal(workers[index-1].terminated,true);
    const w={postMessage(message){this.message=message;queueMicrotask(()=>respond?.(w,index));},terminate(){this.terminated=true;},send(data){this.onmessage({data});}};workers.push(w);return w;
  }});
  return {runner,workers,checks:()=>checks};
}
const block=(backend='webgpu',startFrame=0,n=8)=>({type:'chunk',backend,startFrame,sampleRate:44100,chunkIndex:0,totalChunks:1,stems:Array.from({length:8},()=>new Float32Array(n).fill(.1))});
const success=w=>{w.send(block(w.message.backend));w.send({type:'done',backend:w.message.backend,elapsedMs:2});};
test('GPU runner publishes aligned four-stem blocks without mutating input, terminates worker and checks cache once',async()=>{
  const {runner,workers,checks}=setup({respond:success}),chunks=[],events=[],channels=input();
  const result=await runner.separate(model,channels,{onChunk:x=>chunks.push(x),onProgress:x=>events.push(x)});
  assert.equal(result.backend,'webgpu');assert.equal(checks(),1);assert.equal(chunks.length,1);assert.equal(chunks[0].roles,model.roles);
  assert.equal(events.filter(e=>e.phase==='track-complete').length,4);assert.equal(channels[0].length,8);assert.notEqual(workers[0].message.left,channels[0]);assert.equal(workers[0].terminated,true);
});
test('GPU failure before publishing falls back to a fresh CPU worker with the same model',async()=>{
  const {runner,workers}=setup({respond:(w,i)=>i===0?w.send({type:'error',message:'device lost'}):success(w)}),events=[];
  const result=await runner.separate(model,input(),{onProgress:x=>events.push(x)});
  assert.equal(result.backend,'wasm');assert.equal(result.fallbackReason,'device lost');
  assert.deepEqual(workers.map(w=>w.message.backend),['webgpu','wasm']);assert.equal(events.filter(e=>e.phase==='fallback').length,1);
});
test('no silent fallback when disabled, on CPU, or after any audio was published',async()=>{
  for(const options of [{fallback:false},{backend:'wasm'},{}]) {
    const {runner,workers}=setup({respond:w=>{if(!('fallback' in options)&&!options.backend)w.send(block('webgpu',0,4));w.send({type:'error',message:'lost'});}});
    await assert.rejects(runner.separate(model,input(),options),/lost/);assert.equal(workers.length,1);
  }
});
test('cancel interrupts a worker, never starts CPU fallback, and stale messages cannot affect a later run',async()=>{
  const {runner,workers}=setup();const first=runner.separate(model,input());await flush();
  runner.cancel();await assert.rejects(first,{name:'AbortError'});assert.equal(workers.length,1);
  const chunks=[],second=runner.separate(model,input(),{onChunk:c=>chunks.push(c)});await flush();
  workers[0].send(block());assert.equal(chunks.length,0);success(workers[1]);await second;assert.equal(chunks.length,1);
});
test('cancellation during cache read and concurrent requests do not create workers',async()=>{
  let resolve;const manager={getStatus:()=>new Promise(r=>resolve=r),cache:{get:async()=>({files:[new ArrayBuffer(1)]})}};
  const runner=new OnnxDemucsRunner({manager,workerFactory:()=>{throw Error('should not start');}});
  const pending=runner.separate(model,input());await assert.rejects(runner.separate(model,input()),/déjà/);runner.cancel();resolve({state:'installed'});await assert.rejects(pending,{name:'AbortError'});
});
test('unresponsive initialization hits a deadline and releases the worker',async()=>{
  const {runner,workers}=setup({timeoutMs:5});await assert.rejects(runner.separate(model,input(),{fallback:false}),/ne répond plus/);assert.equal(workers[0].terminated,true);
});
test('invalid backend, model, excessive duration or absent cache never starts inference',async()=>{
  await assert.rejects(setup().runner.separate({...model,runtime:'legacy'},input()),/invalide/);
  await assert.rejects(setup().runner.separate(model,input(),{backend:'cuda'}),/invalide/);
  // Duration guard without allocating two 24-hour PCM arrays. The old 60 s
  // excerpt restriction was lifted by the validated progressive pipeline.
  class OversizedChannel extends Float32Array { get length() { return 86400 * 44100 + 1; } }
  await assert.rejects(setup().runner.separate(model,[new OversizedChannel(1),new OversizedChannel(1)]),/24 h maximum/);
  const {runner,workers}=setup({status:'missing'});await assert.rejects(runner.separate(model,input()),/Téléchargez/);assert.equal(workers.length,0);
});
test('invalid, incomplete, nonfinite and out-of-order output never reaches the player',async()=>{
  for(const data of [{...block(),startFrame:2},{...block(),backend:'wasm'},{...block(),sampleRate:48000},{...block(),stems:Array.from({length:8},()=>new Float32Array(8).fill(NaN))},{type:'done',backend:'webgpu'}]){
    const {runner}=setup({respond:w=>w.send(data)});await assert.rejects(runner.separate(model,input(),{fallback:false,onChunk:()=>assert.fail('invalid audio published')}));
  }
});
test('backend policy offers GPU only for a validated model and a working device',()=>{
  assert.equal(backendPolicy(model,{webgpu:true},'webgpu').backend,'webgpu');
  assert.equal(backendPolicy(model,{webgpu:false},'webgpu').backend,'wasm');
  assert.equal(backendPolicy({...model,runtime:'demucs-ort-wasm'},{webgpu:true},'webgpu').gpu,false);
  assert.equal(backendPolicy(model,{webgpu:true},'wasm').backend,'wasm');
});
test('core adapter maps opaque input/output names and frees tensors after copying',async()=>{
  const allocated=[];class Tensor {constructor(type,data,dims){this.data=data;this.dims=dims;allocated.push(this);}dispose(){this.disposed=true;}}
  let feeds;const outputs={c:new Tensor('float32',new Float32Array([1,2]),[2]),d:new Tensor('float32',new Float32Array([3,4]),[2])};
  const session={inputNames:['a','b'],outputNames:['c','d'],run:async x=>{feeds=x;return outputs;}};
  const model=new OnnxCoreModel(session,Tensor),signal={data:new Float32Array([.1,.2]),shape:[2]};
  const result=await model.forward(signal,signal);assert.deepEqual(Object.keys(feeds),['a','b']);assert.deepEqual([...result.outX.data],[1,2]);assert.notEqual(result.outX.data,outputs.c.data);assert.ok(allocated.every(t=>t.disposed));
  assert.equal(model.validLength(1),343980);assert.throws(()=>model.validLength(343981));assert.throws(()=>new OnnxCoreModel({...session,inputNames:[]},Tensor),/incompatible/);
});
test('core adapter frees inputs even if inference fails',async()=>{
  const tensors=[];class Tensor{constructor(){tensors.push(this);}dispose(){this.disposed=true;}}
  const model=new OnnxCoreModel({inputNames:['a','b'],outputNames:['c','d'],run:async()=>{throw Error('GPU failure');}},Tensor);
  await assert.rejects(model.forward({},{}) ,/GPU failure/);assert.ok(tensors.every(t=>t.disposed));
});
test('audio comparison measures error and rejects mismatched lengths, NaN and large differences',()=>{
  assert.equal(compareAudio([new Float32Array([1,2])],[new Float32Array([1,2])]).withinTolerance,true);
  const result=compareAudio([new Float32Array([1,2])],[new Float32Array([1.1,1.9])]);assert.equal(result.withinTolerance,false);assert.ok(result.rmsError>.09&&result.rmsError<.11);
  assert.throws(()=>compareAudio([new Float32Array(2)],[new Float32Array(1)]));assert.throws(()=>compareAudio([new Float32Array([NaN])],[new Float32Array(1)]));
});
test('runtime, DSP and model provenance are pinned and local; weights stay out of distribution',async()=>{
  const base=new URL('../../examples/wam/source-separation/',import.meta.url);
  const ort=await import(new URL('vendor/onnxruntime-web/ort.webgpu.min.mjs',base));assert.equal(ort.env.versions.web,'1.22.0');
  const manifest=JSON.parse(await readFile(new URL('models.json',base))),m=manifest.models.find(m=>m.runtime==='demucs-onnx-core');
  assert.equal(m.files[0].sha256,'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748');assert.equal(m.files[0].size,174263526);assert.match(m.license.name,/personnel\/recherche/);
  const integrity=JSON.parse(await readFile(new URL('vendor/onnxruntime-web/integrity.json',base)));
  for(const [name,hash] of Object.entries(integrity))assert.equal(createHash('sha256').update(await readFile(new URL(`vendor/onnxruntime-web/${name}`,base))).digest('hex'),hash);
});

test('FFT inverse keeps explicit stereo length after centering and reconstructs both channels',async()=>{
  const {stft,istft,hannWindow}=await import('../../examples/wam/source-separation/vendor/demucs-js/apply.js');
  const n=8192,data=Float32Array.from({length:n*2},(_,i)=>.1*Math.sin(2*Math.PI*(i<n?11:27)*(i%n)/n));
  const window=hannWindow(1024),z=stft({data,shape:[2,n]},1024,256,window);
  for(const explicit of [n,null]) {
    const result=istft(z,1024,256,window,true,explicit,true);
    assert.deepEqual(result.shape,[2,n]);assert.ok(result.data.every(Number.isFinite));
    let error=0;for(let i=0;i<data.length;i++)error=Math.max(error,Math.abs(data[i]-result.data[i]));assert.ok(error<1e-6,`max error ${error}`);
  }
});
test('full Demucs window has a finite last channel through its final sample',async()=>{
  const {spec,ispec}=await import('../../examples/wam/source-separation/vendor/demucs-js/apply.js');
  const n=343980,data=Float32Array.from({length:n*2},(_,i)=>.1*Math.sin(2*Math.PI*(i<n?220:440)*(i%n)/44100));
  const z=spec({data,shape:[1,2,n]}),out=ispec(z,n);
  assert.deepEqual(out.shape,[1,2,n]);assert.equal(out.data.length,data.length);assert.ok(out.data.every(Number.isFinite));
  for(const c of [0,1]) {
    let error=0;for(let i=4096;i<n-4096;i++)error=Math.max(error,Math.abs(out.data[c*n+i]-data[c*n+i]));assert.ok(error<1e-5);
    assert.ok(Math.abs(out.data[(c+1)*n-1])<.2);
  }
});

test('invalid audio and cache failures never masquerade as GPU failures with a CPU retry',async()=>{
  const {runner,workers}=setup({respond:w=>w.send({...block(),sampleRate:48000})});await assert.rejects(runner.separate(model,input()),/invalide/);assert.equal(workers.length,1);
  const broken=new OnnxDemucsRunner({manager:{getStatus:async()=>({state:'installed'}),cache:{get:async()=>{throw Error('storage unavailable');}}},workerFactory:()=>assert.fail('No worker for a storage failure')});
  await assert.rejects(broken.separate(model,input()),/storage unavailable/);
});

test('ORT configuration initializes absent profiling state and keeps CPU independent of GPU features',async()=>{
  const {configureOnnxRuntime}=await import('../../examples/wam/source-separation/OnnxRuntimeConfig.js');
  const ort={env:{wasm:{},webgpu:{}}};let events=0;
  const enabled=configureOnnxRuntime(ort,'https://example.org/app/onnx-worker.js',{diagnostics:true,adapter:{features:new Set(['timestamp-query'])},onProfile:()=>events++});
  assert.equal(enabled,true);assert.equal(ort.env.webgpu.profiling.mode,'default');ort.env.webgpu.profiling.ondata({});assert.equal(events,1);
  assert.equal(ort.env.wasm.numThreads,1);assert.equal(ort.env.wasm.proxy,false);assert.equal(ort.env.wasm.wasmPaths,'https://example.org/app/vendor/onnxruntime-web/');
  assert.equal(configureOnnxRuntime(ort,'https://example.org/app/onnx-worker.js'),false);assert.equal(ort.env.webgpu.profiling.mode,'off');
});


test('Studio reuses a successful quality session only for the same model and backend, and stop releases it', async () => {
  const {runner,workers}=setup({respond:success,keepAlive:true});
  await runner.separate(model,input(),{backend:'wasm'});
  assert.equal(workers[0].terminated,undefined);
  await runner.separate(model,input(),{backend:'wasm'});
  assert.equal(workers.length,1);
  await runner.separate(model,input(),{backend:'webgpu'});
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminated,true);
  runner.cancel();assert.equal(workers[1].terminated,true);
});


test('full input validation stays in the worker rather than scanning a whole song on the UI thread', async () => {
  class WorkerValidatedChannel extends Float32Array { every() { assert.fail('UI scanned the song'); } }
  const {runner}=setup({respond:success});
  await runner.separate(model,[new WorkerValidatedChannel(8),new WorkerValidatedChannel(8)]);
  const {runInNewContext}=await import('node:vm');
  const source=(await readFile(new URL('../../examples/wam/source-separation/onnx-worker.js',import.meta.url),'utf8'))
    .replace(/^import .*;$/mg,'').replaceAll('import.meta.url',"'http://localhost/onnx-worker.js'");
  const messages=[],scope={Float32Array,ArrayBuffer,performance,postMessage:m=>messages.push(m)};
  runInNewContext(source,scope);
  await scope.onmessage({data:{weights:new ArrayBuffer(1),left:new Float32Array([NaN]),right:new Float32Array([0]),backend:'webgpu'}});
  assert.equal(messages[0].type,'error');assert.equal(messages[0].code,'INVALID_AUDIO');
});

test('WebNN admission failure falls back only before any published block; evidence is required',async()=>{
 const f=setup({respond:(w,i)=>i===0?w.send({type:'error',message:'strict per-role audio parity failed'}):success(w)});
 const r=await f.runner.separate(model,input(),{backend:'webnn-npu'});assert.equal(r.backend,'wasm');assert.match(r.fallbackReason,/parity/);
 const evidence={runtimeVersion:'1.30.0',validatedBlocks:1,dispatches:2,strictParity:true,effectiveHardware:'unknown'};
 const good=setup({respond:w=>{w.send({...block('webnn-cpu'),evidence});w.send({type:'done',backend:'webnn-cpu',evidence});}});
 assert.deepEqual((await good.runner.separate(model,input(),{backend:'webnn-cpu'})).evidence,evidence);
 const bad=setup({respond:w=>{w.send({...block('webnn-gpu'),evidence});w.send({type:'error',message:'context lost'});}});
 await assert.rejects(bad.runner.separate(model,input(),{backend:'webnn-gpu'}),/context lost/);assert.equal(bad.workers.length,1);
 const missing=setup({respond:w=>{w.send(block('webnn-gpu'));w.send({type:'done',backend:'webnn-gpu'});}});
 await assert.rejects(missing.runner.separate(model,input(),{backend:'webnn-gpu'}),/evidence/);
});
