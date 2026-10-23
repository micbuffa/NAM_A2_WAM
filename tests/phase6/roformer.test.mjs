import {StreamPublisher} from '../../examples/wam/source-separation/StreamTransport.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {roformerStft,roformerIstft,ROFORMER_ROLES} from '../../examples/wam/source-separation/RoformerDSP.js';
import {RoformerCoreModel} from '../../examples/wam/source-separation/RoformerCoreModel.js';
test('Roformer STFT agrees with independent DFT at the reflected left edge',()=>{
 const a=Float32Array.from([.2,.8,-.4,.3,-.1,.6,.9,-.7]),{real,imag,frames}=roformerStft([a,a],{n:8,hop:2});
 const reflected=[a[4],a[3],a[2],a[1],a[0],a[1],a[2],a[3]];
 for(let k=0;k<5;k++){let r=0,m=0;for(let i=0;i<8;i++){const value=reflected[i]*(.5-.5*Math.cos(2*Math.PI*i/8));r+=value*Math.cos(2*Math.PI*k*i/8);m-=value*Math.sin(2*Math.PI*k*i/8);}assert.ok(Math.abs(real[k*frames]-r)<1e-6);assert.ok(Math.abs(imag[k*frames]-m)<1e-6);}
});
test('STFT/iSTFT preserves nonzero boundaries and near-Nyquist content in both channels',()=>{
 for(const length of [1,17,4097]){
  const input=[Float32Array.from({length},(_,i)=>.2+Math.cos(2*Math.PI*1023*i/2048)*.3),Float32Array.from({length},(_,i)=>Math.sin(i*.13)*.4)];
  const s=roformerStft(input),output=roformerIstft(s.real,s.imag,{channels:2,frames:s.frames,length});
  for(let c=0;c<2;c++)for(let i=0;i<length;i++)assert.ok(Math.abs(input[c][i]-output[c][i])<1e-6,`${length}/${c}/${i}`);
 }
});
test('Roformer rejects malformed FFT, PCM and spectrogram contracts',()=>{
 assert.throws(()=>roformerStft([new Float32Array(1),new Float32Array(1)],{n:7}));
 assert.throws(()=>roformerStft([Float32Array.of(NaN),Float32Array.of(1)]));
 assert.throws(()=>roformerIstft(new Float32Array(1),new Float32Array(1)));
 assert.deepEqual(ROFORMER_ROLES,['bass','drums','other','vocals','guitar','piano']);
});
test('model adapter uses fixed 4s contract, crops the tail and releases tensors on malformed outputs',async()=>{
 let released=0;class Tensor{constructor(type,data,dims){Object.assign(this,{type,data,dims});}dispose(){released++;}}
 const core=new RoformerCoreModel({run:async inputs=>{assert.deepEqual(inputs.spec_real.dims,[1,2,1025,345]);assert.equal(inputs.spec_real.data.length,2*1025*345);return {out_spec_real:new Tensor('float32',new Float32Array(1),[1])};}},Tensor);
 await assert.rejects(core.separate([Float32Array.of(.1),Float32Array.of(.2)]),/incompatible/);assert.equal(released,3);
 await assert.rejects(core.separate([new Float32Array(176401),new Float32Array(176401)]),/invalide/);
});
test('Roformer worker publishes twelve aligned channels including the final overlap tail',async()=>{
 const {readFile}=await import('node:fs/promises'),{planChunks,OverlapAssembler}=await import('../../examples/wam/source-separation/ChunkTools.js');
 const source=(await readFile(new URL('../../examples/wam/source-separation/roformer-worker.js',import.meta.url),'utf8')).replace(/^import .*;$/mg,'').replaceAll('import.meta.url',"'http://localhost/roformer-worker.js'");
 const messages=[],calls=[];
 class Core{async separate(channels){calls.push(channels[0].slice());return Array.from({length:12},(_,i)=>new Float32Array(channels[0].length).fill(i/20));}}
 const ort={env:{versions:{web:'test'}},Tensor:()=>{},InferenceSession:{create:async()=>({release:async()=>{}})}};
 const handle=new Function('ort','configureOnnxRuntime','RoformerCoreModel','ROFORMER_FRAMES','ROFORMER_ROLES','planChunks','OverlapAssembler','postMessage','performance','StreamPublisher',`let onmessage;${source};return onmessage;`)(ort,()=>{},Core,176400,ROFORMER_ROLES,planChunks,OverlapAssembler,m=>messages.push(m),performance,class extends StreamPublisher{constructor(config,options){super(config,{...options,post:m=>messages.push(m),yieldControl:()=>Promise.resolve()});}});
 await handle({data:{type:'run',left:new Float32Array(1),right:new Float32Array(1)}});assert.equal(messages.at(-1).type,'error');
 await handle({data:{type:'prepare',weights:new ArrayBuffer(4),backend:'wasm'}});assert.equal(messages.at(-1).type,'prepared');assert.ok(calls[0].every(v=>v===0));
 const length=44100*6+17;await handle({data:{type:'run',left:new Float32Array(length),right:new Float32Array(length)}});
 const chunks=messages.filter(m=>m.type==='stream-chunk');let committed=0;for(const c of chunks){assert.equal(c.startFrame,committed);assert.equal(c.stems.length,12);committed+=c.stems[0].length;assert.equal(c.roles[4],'guitar');assert.ok(c.stems.every((a,i)=>a.every(v=>Math.abs(v-i/20)<1e-6)));}
 assert.equal(committed,length);assert.equal(chunks.length,7);assert.equal(chunks[0].stems[0].length,44100);assert.equal(messages.at(-1).type,'done');
});
test('prepared runner selects the Roformer worker and validates six-source streams without a Demucs restart',async()=>{
 const {PreparedDemucsRunner}=await import('../../examples/wam/source-separation/PreparedDemucsRunner.js');let selected,count=0;
 const model={id:'sw',version:'v1',runtime:'bs-roformer-onnx',frames:176400,roles:ROFORMER_ROLES,files:[{sha256:'pin'}]};
 const runner=new PreparedDemucsRunner({manager:{cache:{get:async()=>({files:[new ArrayBuffer(4)]})},verifyRecord:async()=>true},workerFactory:m=>{
  selected=m;return {terminate(){},postMessage(data){queueMicrotask(()=>{
   if(data.type==='prepare'){assert.equal(data.frames,176400);this.onmessage({data:{type:'prepared'}});}
   else{const stems=Array.from({length:12},()=>new Float32Array(data.left.length));this.onmessage({data:{type:'chunk',startFrame:0,sampleRate:44100,stems}});this.onmessage({data:{type:'done',backend:'webgpu'}});}
  });}};
 }});
 await runner.prepare(model,'webgpu');const result=await runner.separate(model,[Float32Array.of(1),Float32Array.of(2)],{onChunk:c=>{assert.equal(c.roles[4],'guitar');count++;}});
 assert.equal(selected.runtime,'bs-roformer-onnx');assert.equal(result.frames,176400);assert.equal(result.profile,'quality');assert.equal(count,1);runner.cancel();
});
test('prepared fallback never splices GPU and CPU stems or restarts after cancellation',async()=>{
 const {PreparedDemucsRunner}=await import('../../examples/wam/source-separation/PreparedDemucsRunner.js');
 const model={id:'sw',version:'v',frames:176400,roles:ROFORMER_ROLES,files:[{sha256:'pin'}]};
 for(const published of [false,true]){
  let provider,count=0;
  const runner=new PreparedDemucsRunner({manager:{cache:{get:async()=>({files:[new ArrayBuffer(4)]})},verifyRecord:async()=>true},workerFactory:()=>({terminate(){},postMessage(data){queueMicrotask(()=>{
   if(data.type==='prepare'){provider=data.backend;count++;this.onmessage({data:{type:'prepared'}});return;}
   if(provider==='webgpu'){
    if(published)this.onmessage({data:{type:'chunk',startFrame:0,sampleRate:44100,stems:Array.from({length:12},()=>new Float32Array(1))}});
    this.onmessage({data:{type:'error',message:'GPU lost'}});
   }else{this.onmessage({data:{type:'chunk',startFrame:0,sampleRate:44100,stems:Array.from({length:12},()=>new Float32Array(1))}});this.onmessage({data:{type:'done',backend:'wasm'}});}
  });}})});
  await runner.prepare(model,'webgpu');
  const result=runner.separate(model,[Float32Array.of(1),Float32Array.of(2)],{backend:'webgpu',fallback:true});
  if(published){await assert.rejects(result,/GPU lost/);assert.equal(count,1);}else{assert.equal((await result).backend,'wasm');assert.equal(count,2);}
  runner.cancel();
 }
});
test('validated SW manifest pins provenance and offers dedicated guitar as an explicit preference on a supported GPU',async()=>{
 const {readFile}=await import('node:fs/promises'),{backendPolicy,preferredModel}=await import('../../examples/wam/source-separation/BackendPolicy.js');
 const base=new URL('../../examples/wam/source-separation/',import.meta.url),models=JSON.parse(await readFile(new URL('models.json',base))).models;
 const m=models.find(m=>m.runtime==='bs-roformer-onnx'),pin=JSON.parse(await readFile(new URL('research/bs-roformer-sw.json',base))).files[0];
 assert.deepEqual(m.roles,ROFORMER_ROLES);assert.equal(m.files[0].sha256,pin.lfs.sha256);assert.equal(m.files[0].size,pin.size);assert.equal(m.frames,176400);assert.match(m.license.name,/non précisés/);
 assert.equal(preferredModel(models,{webgpu:true},'guitar',{objective:'guitar'}).id,m.id);assert.equal(backendPolicy(m,{webgpu:false},'webgpu').backend,'wasm');assert.equal(preferredModel(models,{webgpu:false},'guitar',{objective:'guitar'}).id,'htdemucs_6s');
});
