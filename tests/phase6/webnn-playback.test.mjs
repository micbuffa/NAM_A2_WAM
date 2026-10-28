import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {backendPolicy} from '../../examples/wam/source-separation/BackendPolicy.js';
import {detectCapabilities} from '../../examples/wam/source-separation/Capabilities.js';
import {webnnPlaybackConfig,backendLabel} from '../../examples/wam/source-separation/WebNNPlayback.js';
import {PreparedDemucsRunner} from '../../examples/wam/source-separation/PreparedDemucsRunner.js';
import {createWebnnPlaybackSession} from '../../examples/wam/source-separation/WebNNRuntime.js';
import {planChunks,OverlapAssembler} from '../../examples/wam/source-separation/ChunkTools.js';
const runtimeFetch=async()=>({ok:true,json:async()=>({version:'1.30.0',files:Object.fromEntries(['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'].map(name=>[name,{bytes:1,sha256:'6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d'}]))}),arrayBuffer:async()=>new Uint8Array([0]).buffer});
const demucs={id:'test',version:'v1',runtime:'demucs-onnx-core',roles:['drums','bass','other','vocals'],files:[],backends:['wasm','webgpu']};
test('WebNN keys select supported models explicitly, never replace GPU defaults or enable ORT/preview models',async()=>{
 for(const device of ['cpu','gpu','npu']){
  const backend=`webnn-${device}`;assert.equal(backendPolicy(demucs,{webnn:true},backend).backend,backend);
  assert.equal(webnnPlaybackConfig(demucs,backend).deviceType,device);assert.match(backendLabel(backend),/expérimental/);
 }
 assert.equal(backendPolicy(demucs,{webnn:false},'webnn-gpu').backend,'wasm');
 assert.equal(backendPolicy({...demucs,profile:'preview'},{webnn:true},'webnn-gpu').webnn,false);
 assert.equal(backendPolicy({...demucs,runtime:'demucs-ort-wasm'},{webnn:true},'webnn-gpu').webnn,false);
 assert.equal(backendPolicy(demucs,{webnn:true,webgpu:true},'webgpu').backend,'webgpu');
 assert.equal((await detectCapabilities({ml:{}})).webnn,true);
 assert.equal(webnnPlaybackConfig(demucs,'webnn-gpu').frames,343980);
});
test('prepared runner keys CPU/GPU/NPU separately and sends model configuration to dedicated worker',async()=>{
 const workers=[],messages=[],manager={cache:{get:async()=>({files:[new ArrayBuffer(4)]})},verifyRecord:async()=>true};
 const runner=new PreparedDemucsRunner({manager,workerFactory:(model,backend)=>{
  const worker={backend,terminate(){this.terminated=true;},postMessage(message){messages.push(message);queueMicrotask(()=>this.onmessage({data:{type:'prepared'}}));}};workers.push(worker);return worker;
 }});
 await runner.prepare(demucs,'webnn-gpu');assert.equal(messages[0].webnn.frames,343980);
 await runner.prepare(demucs,'webnn-gpu');assert.equal(workers.length,1);
 await runner.prepare(demucs,'webnn-cpu');assert.equal(workers[0].terminated,true);assert.equal(messages[1].webnn.deviceType,'cpu');runner.cancel();
});
test('runtime refuses absent API before loading assets and destroys context after failed compilation',async()=>{
 await assert.rejects(createWebnnPlaybackSession(new ArrayBuffer(1),'gpu',{navigatorImpl:{}}),/WebNN absent/);
 let destroyed=false;
 const deps={navigatorImpl:{ml:{createContext:async()=>({destroy(){destroyed=true;},dispatch(){}})}},Builder:class{},
 fetchImpl:runtimeFetch,importRuntime:async()=>({env:{wasm:{}},InferenceSession:{create:async()=>{throw Error('compile failed');}}})};
 await assert.rejects(createWebnnPlaybackSession(new ArrayBuffer(1),'gpu',deps),/compile failed/);assert.equal(destroyed,true);
});
test('real WebNN worker publishes aligned full-length PCM for arbitrary input and 4/6 roles through existing stream transport',async()=>{
 const code=(await readFile(new URL('../../examples/wam/source-separation/webnn-playback-worker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 for(const roles of [4,6]){
  const messages=[],self={};let released=0;
  class Core{constructor(){this.sources=Array.from({length:roles},(_,i)=>`r${i}`);this.roles=this.sources;}
   async separate(channels){return Array.from({length:roles*2},()=>new Float32Array(channels[0].length).fill(.1));}}
  const context=vm.createContext({self,ArrayBuffer,Float32Array,Number,Error,performance,setInterval,clearInterval,planChunks,OverlapAssembler,
   postMessage:m=>messages.push(m),createWebnnPlaybackSession:async()=>({session:{},ort:{Tensor:class{},env:{versions:{web:'1.30.0'}}},guard:p=>p,evidence:()=>({webnnDispatches:1}),release:async()=>released++}),
   OnnxCoreModel:Core,RoformerCoreModel:Core,separateTracks:async(model,{channelData})=>Object.fromEntries(model.sources.map(role=>[role,{channelData:channelData.map(c=>new Float32Array(c.length).fill(.1))}])),
   StreamPublisher:class{async publish(m){messages.push(m);}}});vm.runInContext(code,context);
  await self.onmessage({data:{type:'prepare',weights:new ArrayBuffer(1),backend:'webnn-gpu',webnn:{deviceType:'gpu',runtime:roles===4?'demucs-onnx-core':'bs-roformer-onnx',frames:roles===4?343980:176400}}});
  assert.equal(messages.at(-1).type,'prepared');
  const length=400000;await self.onmessage({data:{type:'run',left:new Float32Array(length),right:new Float32Array(length)}});
  assert.equal(messages.at(-1).type,'done');let committed=0;
  for(const chunk of messages.filter(m=>m.type==='chunk')){assert.equal(chunk.startFrame,committed);assert.equal(chunk.stems.length,roles*2);assert.ok(chunk.stems.every(c=>c.every(Number.isFinite)));committed+=chunk.stems[0].length;}
  assert.equal(committed,length);
  await self.onmessage({data:{type:'run',left:new Float32Array(0),right:new Float32Array(0)}});assert.equal(messages.at(-1).type,'error');assert.equal(released,1);
 }
});
test('WebNN errors only restart WASM when authorized and before any published PCM; cancellation never retries',async()=>{
 for(const mode of ['fallback','disabled','partial','cancel']){
  const backends=[],manager={cache:{get:async()=>({files:[new ArrayBuffer(4)]})},verifyRecord:async()=>true};
  const runner=new PreparedDemucsRunner({manager,workerFactory:(model,backend)=>{
   backends.push(backend);const worker={terminate(){},postMessage(message){queueMicrotask(()=>{
    if(message.type==='prepare'){worker.onmessage({data:{type:'prepared'}});return;}
    if(mode==='cancel'){runner.cancel();return;}
    if(backend.startsWith('webnn')){
     if(mode==='partial')worker.onmessage({data:{type:'chunk',startFrame:0,sampleRate:44100,stems:Array.from({length:8},()=>new Float32Array(1))}});
     worker.onmessage({data:{type:'error',message:'lost'}});
    }else{worker.onmessage({data:{type:'chunk',startFrame:0,sampleRate:44100,stems:Array.from({length:8},()=>new Float32Array(2))}});worker.onmessage({data:{type:'done'}});}
   });}};return worker;
  }});
  await runner.prepare(demucs,'webnn-npu');
  const operation=runner.separate(demucs,[new Float32Array(2),new Float32Array(2)],{backend:'webnn-npu',fallback:mode!=='disabled'});
  if(mode==='fallback'){const result=await operation;assert.equal(result.backend,'wasm');assert.equal(result.fallbackReason,'lost');assert.deepEqual(backends,['webnn-npu','wasm']);}
  else{await assert.rejects(operation,mode==='cancel'?{name:'AbortError'}:/lost/);assert.deepEqual(backends,['webnn-npu']);}
  runner.cancel();
 }
});
test('lost WebNN context rejects inference and releases session and context',async()=>{
 let lose;const lost=new Promise(resolve=>lose=resolve);let released=0,destroyed=0;
 const context={lost,dispatch(){},destroy(){destroyed++;}};
 const runtime=await createWebnnPlaybackSession(new ArrayBuffer(1),'npu',{
  navigatorImpl:{ml:{createContext:async()=>context}},Builder:class{},fetchImpl:runtimeFetch,
  importRuntime:async()=>({env:{wasm:{}},InferenceSession:{create:async()=>({release:async()=>released++})}}),
 });
 const operation=runtime.guard(new Promise(()=>{}));lose({message:'device unavailable'});await assert.rejects(operation,/context lost/);
 await runtime.release();assert.equal(released,1);assert.equal(destroyed,1);
});
test('runtime rejects missing or modified assets before importing executable code',async()=>{
 for(const response of [{ok:false},{ok:true,arrayBuffer:async()=>new Uint8Array([1]).buffer}]){
  let imported=false;
  const fetchImpl=async url=>String(url).endsWith('webnn-runtime.json')?runtimeFetch():response;
  await assert.rejects(createWebnnPlaybackSession(new ArrayBuffer(1),'gpu',{navigatorImpl:{ml:{}},Builder:class{},fetchImpl,importRuntime:async()=>{imported=true;}}),/Runtime WebNN absent|Intégrité/);
  assert.equal(imported,false);
 }
});
