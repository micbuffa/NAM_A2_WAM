import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OnnxCoreModel} from '../../examples/wam/source-separation/OnnxCoreModel.js';
import {planChunks,OverlapAssembler} from '../../examples/wam/source-separation/ChunkTools.js';

test('short neural contract uses actual short tensor size while production defaults remain 7.8s',()=>{
 const session={inputNames:['mix','spec'],outputNames:['a','b']};
 const original=new OnnxCoreModel(session,()=>{}),short=new OnnxCoreModel(session,()=>{},{frames:44100});
 assert.equal(original.validLength(44100),343980);assert.equal(short.validLength(44100),44100);assert.equal(short.segment,1);
 assert.throws(()=>short.validLength(44101));assert.throws(()=>new OnnxCoreModel(session,()=>{},{frames:0}));
});
async function lab({missing=false}={}){
 const source=(await readFile(new URL('../../examples/wam/source-separation/low-latency-worker.js',import.meta.url),'utf8')).replace(/^import .*;$/mg,'').replaceAll('import.meta.url',"'http://localhost/worker.js'");
 const messages=[],calls=[],sessions=[];
 const ort={env:{webgpu:{}},Tensor:()=>{},InferenceSession:{async create(){const session={async release(){this.released=true;}};sessions.push(session);return session;}}};
 const separateTracks=async(_m,audio)=>{calls.push(audio.channelData[0].slice());return Object.fromEntries(['drums','bass','other','vocals'].map((role,i)=>[role,{channelData:audio.channelData.map(c=>Float32Array.from(c,v=>v*(i+1)))}]));};
 class Core {sources=['drums','bass','other','vocals'];constructor(_s,_t,{frames}){assert.ok([44100,88200].includes(frames));}}
 const handler=new Function('ort','configureOnnxRuntime','OnnxCoreModel','separateTracks','planChunks','OverlapAssembler','fetch','postMessage','performance','navigator',`let onmessage;${source};return onmessage;`)(ort,()=>{},Core,separateTracks,planChunks,OverlapAssembler,async()=>({ok:!missing,arrayBuffer:async()=>new ArrayBuffer(4)}),m=>messages.push(m),performance,{gpu:{requestAdapter:async()=>({requestDevice:async(options)=>{assert.deepEqual(options.requiredFeatures,[]);return {destroy(){}};}})}});
 return {handler,messages,calls,sessions};
}
test('preparation warms on silence only; reusable session produces aligned progressive packets and full tail',async()=>{
 const f=await lab();await f.handler({data:{type:'prepare',url:'local.onnx',backend:'webgpu'}});
 assert.equal(f.calls.length,1);assert.ok(f.calls[0].every(v=>v===0));assert.equal(f.messages.at(-1).type,'prepared');
 const left=new Float32Array(44100*2+17).fill(.1),right=left.slice();
 for(let run=0;run<2;run++){
  const before=f.messages.length;await f.handler({data:{type:'run',left,right}});
  const packets=f.messages.slice(before).filter(x=>x.type==='chunk');let committed=0;
  for(const p of packets){assert.equal(p.startFrame,committed);assert.equal(p.stems.length,8);committed+=p.stems[0].length;}
  assert.equal(committed,left.length);assert.equal(f.messages.at(-1).type,'done');assert.equal(f.sessions.length,1);
 }
 await f.handler({data:{type:'prepare',url:'local.onnx',backend:'wasm'}});assert.equal(f.sessions[0].released,true);
 await f.handler({data:{type:'prepare',url:'local2.onnx',backend:'wasm',frames:88200}});
 const before=f.messages.length;await f.handler({data:{type:'run',left:new Float32Array(3*44100),right:new Float32Array(3*44100)}});
 const packets=f.messages.slice(before).filter(x=>x.type==='chunk');assert.equal(packets[0].stems[0].length,44100);assert.equal(packets[1].startFrame,44100);
});
test('lab errors do not advertise playable output without a prepared model or local export',async()=>{
 const empty=await lab();await empty.handler({data:{type:'run',left:new Float32Array(1),right:new Float32Array(1)}});assert.equal(empty.messages.at(-1).type,'error');assert.equal(empty.calls.length,0);
 const absent=await lab({missing:true});await absent.handler({data:{type:'prepare',url:'none',backend:'webgpu'}});assert.equal(absent.messages.at(-1).type,'error');assert.equal(absent.sessions.length,0);
});

test('STFT left reflection matches an independent DFT on a nonzero boundary',async()=>{
 const {stft,hannWindow}=await import('../../examples/wam/source-separation/vendor/demucs-js/apply.js');
 const samples=Float32Array.from([.1,.2,.4,.8,.3,.6,.7,.9]),N=8,window=hannWindow(N);
 const result=stft({data:samples,shape:[1,8]},N,2,window,true,true,'reflect');
 const reflected=[samples[4],samples[3],samples[2],samples[1],samples[0],samples[1],samples[2],samples[3]],frames=result.real.shape[2];
 for(let k=0;k<=4;k++){let real=0,imag=0;for(let n=0;n<N;n++){real+=reflected[n]*window[n]*Math.cos(2*Math.PI*k*n/N)/Math.sqrt(N);imag-=reflected[n]*window[n]*Math.sin(2*Math.PI*k*n/N)/Math.sqrt(N);}assert.ok(Math.abs(result.real.data[k*frames]-real)<1e-6);assert.ok(Math.abs(result.imag.data[k*frames]-imag)<1e-6);}
});
