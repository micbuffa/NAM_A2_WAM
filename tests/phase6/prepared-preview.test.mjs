import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PreparedDemucsRunner} from '../../examples/wam/source-separation/PreparedDemucsRunner.js';
import {preferredModel} from '../../examples/wam/source-separation/BackendPolicy.js';
const manifest=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/models.json',import.meta.url)));
const model=manifest.models.find(m=>m.profile==='preview');
function fixture({invalid=false,hold=false}={}){
 const workers=[],manager={cache:{get:async()=>({files:[new ArrayBuffer(4)]})},verifyRecord:async()=>true};
 const runner=new PreparedDemucsRunner({manager,workerFactory:()=>{
  const worker={terminate(){this.terminated=true;},postMessage(message,transfers){
   const data=structuredClone(message,{transfer:transfers});
   if(hold){this.message=data;return;}
   queueMicrotask(()=>{
    if(this.terminated)return;
    if(data.type==='prepare'){this.onmessage({data:{type:'prepared'}});return;}
    const n=data.left.length;
    this.onmessage({data:{type:'chunk',startFrame:invalid?1:0,sampleRate:44100,stems:Array.from({length:8},()=>new Float32Array(n)),chunkIndex:0,totalChunks:1}});
    this.onmessage({data:{type:'done',elapsedMs:1}});
   });
  }};workers.push(worker);return worker;
 }});return {runner,workers};
}
test('preview is a real verified 2s export, quality remains the preferred default',()=>{
 assert.equal(model.frames,88200);assert.equal(model.files.length,1);assert.match(model.files[0].sha256,/^[a-f0-9]{64}$/);
 assert.notEqual(preferredModel(manifest.models,{webgpu:true}).profile,'preview');
});
test('prepared session survives successive runs; changing backend releases the old worker',async()=>{
 const {runner,workers}=fixture(),channels=[new Float32Array(44100),new Float32Array(44100)];
 await assert.rejects(runner.separate(model,channels),/Préparez/);
 await runner.prepare(model,'webgpu');assert.equal(runner.isPrepared(model,'webgpu'),true);
 for(let i=0;i<2;i++){const chunks=[];await runner.separate(model,channels,{onChunk:c=>chunks.push(c)});assert.equal(chunks[0].stems.length,8);assert.equal(channels[0].length,44100);}
 await runner.prepare(model,'webgpu');assert.equal(workers.length,1);
 await runner.prepare(model,'wasm');assert.equal(workers[0].terminated,true);assert.equal(workers.length,2);runner.cancel();
});
test('invalid progressive packets destroy the session and never reach the player',async()=>{
 const {runner,workers}=fixture({invalid:true});await runner.prepare(model,'webgpu');
 await assert.rejects(runner.separate(model,[new Float32Array(1),new Float32Array(1)],{onChunk:()=>assert.fail('invalid audio published')}),/invalide/);
 assert.equal(workers[0].terminated,true);assert.equal(runner.isPrepared(model,'webgpu'),false);
});
test('cancelling an in-flight preparation rejects and ignores obsolete worker replies',async()=>{
 const {runner,workers}=fixture({hold:true});const preparing=runner.prepare(model,'webgpu');
 await new Promise(r=>setImmediate(r));assert.equal(runner.isPreparing(model,'webgpu'),true);runner.cancel();assert.equal(runner.isPreparing(model,'webgpu'),false);await assert.rejects(preparing,{name:'AbortError'});
 workers[0].onmessage({data:{type:'prepared'}});assert.equal(runner.isPrepared(model,'webgpu'),false);
});
test('worker errors and cancellation during a run release the prepared GPU session',async()=>{
 const {runner,workers}=fixture();await runner.prepare(model,'webgpu');
 workers[0].postMessage=()=>{};const running=runner.separate(model,[new Float32Array(8),new Float32Array(8)]);
 runner.cancel();await assert.rejects(running,{name:'AbortError'});assert.equal(workers[0].terminated,true);
 await runner.prepare(model,'wasm');workers[1].postMessage=()=>queueMicrotask(()=>workers[1].onerror({message:'device lost'}));
 await assert.rejects(runner.separate(model,[new Float32Array(8),new Float32Array(8)],{backend:'wasm'}),/device lost/);assert.equal(workers[1].terminated,true);
});
test('MP3 library retains the actual render provenance independently of future model selection',async()=>{
 const {MediaRepository}=await import('../../examples/wam/source-separation/MediaRepository.js');
 const repo=new MediaRepository();let stored;repo.write=async entry=>{stored=structuredClone(entry);return stored;};
 const renderInfo={modelId:model.id,profile:'preview',neuralFrames:88200,backend:'webgpu'};
 const entry=await repo.putTrack({title:'Song — aperçu rapide — mix.mp3',duration:1,blob:new Blob(['mp3'],{type:'audio/mpeg'}),renderInfo});
 renderInfo.modelId='another selection';assert.equal(entry.renderInfo.modelId,model.id);assert.equal(entry.renderInfo.neuralFrames,88200);assert.equal(entry.mime,'audio/mpeg');
});
test('optional worker diagnostics are delivered separately and never treated as playable PCM',async()=>{
 const {runner,workers}=fixture();await runner.prepare(model,'webgpu');const original=workers[0].postMessage;let enabled;const events=[];
 workers[0].postMessage=function(message,transfers){enabled=message.diagnostics;this.onmessage({data:{type:'diagnostic',phase:'network',edge:'start',at:123}});original.call(this,message,transfers);};
 await runner.separate(model,[new Float32Array(8),new Float32Array(8)],{diagnostics:true,onDiagnostic:e=>events.push(e)});
 assert.equal(enabled,true);assert.equal(events.length,1);assert.equal(events[0].phase,'network');runner.cancel();
});

test('prepared runner forwards bounded stage preparation events without marking model ready early',async()=>{
 const {runner,workers}=fixture({hold:true});const progress=[];const preparing=runner.prepare(model,'webgpu',{onProgress:data=>progress.push(data)});
 // Cache verification precedes Worker creation/prepare dispatch.
 await new Promise(resolve=>setImmediate(resolve));const worker=workers[0];
 for(const event of [{type:'preparation-progress',completed:1,total:72},{type:'preparation-progress',completed:73,total:72},{type:'preparation-progress',completed:1,total:Infinity}])worker.onmessage({data:event});
 assert.equal(progress.length,1);assert.equal(runner.isPrepared(model,'webgpu'),false);
 worker.onmessage({data:{type:'prepared'}});await preparing;assert.equal(runner.isPrepared(model,'webgpu'),true);runner.cancel();
});
test('a stopped GPU session is re-created only on explicit preparation and can separate again',async()=>{
 const {runner,workers}=fixture();await runner.prepare(model,'webgpu');workers[0].postMessage=()=>{};
 const pending=runner.separate(model,[new Float32Array(8),new Float32Array(8)]);const obsoleteReply=workers[0].onmessage;
 runner.cancel();await assert.rejects(pending,{name:'AbortError'});assert.equal(runner.isPrepared(model,'webgpu'),false);assert.equal(workers.length,1);
 await new Promise(r=>setImmediate(r));assert.equal(workers.length,1);
 await runner.prepare(model,'webgpu');let published=0;obsoleteReply({data:{type:'done'}});
 const result=await runner.separate(model,[new Float32Array(8),new Float32Array(8)],{onChunk:()=>published++});assert.equal(result.backend,'webgpu');assert.equal(published,1);assert.equal(workers.length,2);runner.cancel();
});
