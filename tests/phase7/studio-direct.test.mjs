import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {isDirectWebNN,studioBackendOptions,validateWebNNSelection,validateDirectEvidence} from '../../examples/wam/source-separation/StudioWebNN.js';
import {contextGuard} from '../../examples/wam/source-separation/WebNNAdmission.js';
import {planChunks,OverlapAssembler} from '../../examples/wam/source-separation/ChunkTools.js';
import {segmentPlans} from '../../examples/wam/source-separation/SegmentSettings.js';
import {StreamPublisher} from '../../examples/wam/source-separation/StreamTransport.js';
import {PreparedDemucsRunner} from '../../examples/wam/source-separation/PreparedDemucsRunner.js';
const models=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/studio-models.json',import.meta.url))).models;
const proof={implementation:'direct-webnn',verifiedModel:true,dispatches:1,graphSha256:'a'.repeat(64),weightsSha256:'b'.repeat(64),effectiveHardware:'unknown'};
test('direct devices are disabled without API and admitted for both model identities when available',()=>{
 for(const modelId of models.map(m=>m.id))for(const device of ['cpu','gpu','npu']){
  const backend='webnn-direct-'+device;assert.equal(isDirectWebNN(backend),true);validateWebNNSelection(modelId,backend);
  assert.equal(studioBackendOptions({webnn:false,modelId}).find(o=>o.value===backend).disabled,true);
  assert.equal(studioBackendOptions({webnn:true,modelId}).find(o=>o.value===backend).disabled,false);
 }
 assert.equal(validateDirectEvidence(proof),true);assert.equal(validateDirectEvidence({...proof,dispatches:0}),false);
});
test('real native Worker protocol prepares and streams four/six roles with dispatch evidence and computed waveform envelopes',async()=>{
 const code=(await readFile(new URL('../../examples/wam/source-separation/direct-webnn-worker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 for(const model of models){
  const messages=[];let dispatch;const session={run:async()=>dispatch({name:'dispatch'}),release:async()=>{}};
  class Core{constructor(s){this.session=s;this.sources=model.roles;this.roles=model.roles;}async separate(channels){await this.session.run();return model.roles.flatMap((_,i)=>channels.map(c=>new Float32Array(c.length).fill((i+1)/100)));}}
  const scope={Float32Array,ArrayBuffer,performance,navigator:{ml:{createContext:async()=>({destroy(){}})}},MLGraphBuilder:class{},isDirectWebNN,contextGuard,segmentPlans,planChunks,OverlapAssembler,OnnxCoreModel:Core,RoformerCoreModel:Core,DirectAudioTensor:class{},loadDirectWebNNModel:async()=>({recipe:{},weights:new ArrayBuffer(1),indexEntry:{graph:{sha256:proof.graphSha256},weights:{sha256:proof.weightsSha256}}}),createDirectWebNNSession:async(_c,_r,_w,options)=>{dispatch=options.onStep;return session;},postMessage:m=>messages.push(structuredClone(m)),setTimeout};
  scope.StreamPublisher=class extends StreamPublisher{constructor(config,options){super(config,{...options,post:m=>scope.postMessage(m)});}};
  scope.separateTracks=async(core,audio)=>{const pcm=await core.separate(audio.channelData);return Object.fromEntries(model.roles.map((role,i)=>[role,{channelData:pcm.slice(i*2,i*2+2)}]));};scope.self=scope;vm.runInNewContext(code,scope);
  await scope.onmessage({data:{type:'prepare',backend:'webnn-direct-gpu',modelId:model.id}});assert.equal(messages.at(-1).type,'prepared');
  await scope.onmessage({data:{type:'run',left:new Float32Array(120),right:new Float32Array(120)}});
  assert.equal(messages.at(-1).type,'done');assert.equal(validateDirectEvidence(messages.at(-1).evidence),true);
  const packet=messages.find(m=>m.type==='stream-chunk');assert.equal(packet.stems.length,model.roles.length*2);assert.equal(packet.peaks.length,model.roles.length);assert.equal(packet.frames,120);
  assert.ok(packet.peaks.every(p=>p.some(x=>x>0)));assert.equal(packet.startFrame,0);
  scope.navigator.ml=null;await scope.onmessage({data:{type:'prepare',backend:'webnn-direct-cpu',modelId:model.id}});assert.equal(messages.at(-1).type,'error');
 }
});
test('prepared native runner avoids ONNX cache, rejects missing evidence and cancellation does not restart CPU',async()=>{
 let worker,withProof=true;
 const manager={cache:{get(){throw Error('must not download ONNX');}}};
 const runner=new PreparedDemucsRunner({manager,workerFactory:()=>worker={terminate(){},postMessage(data){queueMicrotask(()=>{
  if(data.type==='prepare')return this.onmessage({data:{type:'prepared'}});
  const stems=Array.from({length:8},()=>new Float32Array(120));this.onmessage({data:{type:'chunk',startFrame:0,sampleRate:44100,stems,evidence:withProof?proof:null}});this.onmessage({data:{type:'done',evidence:proof}});
 });}}});
 await runner.prepare(models[0],'webnn-direct-cpu');const result=await runner.separate(models[0],[new Float32Array(120),new Float32Array(120)],{backend:'webnn-direct-cpu'});assert.equal(result.backend,'webnn-direct-cpu');
 withProof=false;await assert.rejects(runner.separate(models[0],[new Float32Array(120),new Float32Array(120)],{backend:'webnn-direct-cpu',fallback:true}),/evidence/);runner.cancel();assert.equal(runner.isPrepared(models[0],'webnn-direct-cpu'),false);
});
