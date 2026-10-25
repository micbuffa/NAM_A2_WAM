import {webnnContextOptions} from './WebNNDevice.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {webnnAudioParity,webnnSessionOptions} from './WebNNParity.js';
const sha=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
const MODEL_SHA='da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748';
self.onmessage=async({data})=>{
 let session,context,payload;const started=performance.now(),warnings=[],record={runtime:data.runtime,requestedBackend:data.backend,effectiveHardware:'unknown',webnnDispatches:0,dispatchInstrumentation:false,webnnGraphBuilds:0,graphBuildInstrumentation:false,warnings};
 const originalWarn=console.warn;console.warn=(...args)=>{if(warnings.length<30)warnings.push(args.map(String).join(' ').slice(0,600));originalWarn(...args);};
 const phase=text=>self.postMessage({type:'progress',text});
 try{
  if(!['production','lab'].includes(data.runtime)||!['wasm','webnn'].includes(data.backend)||data.runtime==='production'&&data.backend!=='wasm')throw Error('Configuration laboratoire invalide.');
  if(data.channels?.length!==2||!data.channels[0].length||data.channels[0].length>264600||data.channels.some(c=>!(c instanceof Float32Array)||c.length!==data.channels[0].length||!c.every(Number.isFinite)))throw Error('Entrée stéréo de six secondes maximum requise.');
  phase('Vérification des poids locaux');
  const response=await fetch(new URL('../../../third_party/nam-webgpu-probe/htdemucs-core.onnx',import.meta.url));if(!response.ok)throw Error('Poids Demucs4 locaux absents.');const weights=await response.arrayBuffer();if(await sha(weights.slice(0))!==MODEL_SHA)throw Error('SHA du modèle incorrect.');record.modelSha256=MODEL_SHA;
  let ort;
  if(data.runtime==='lab'){
   phase('Vérification du runtime isolé');const manifest=await fetch('./research/webnn-runtime.json').then(r=>r.json()),base=new URL('../../../third_party/nam-webnn-probe/runtime/',import.meta.url);
   for(const [file,info] of Object.entries(manifest.files)){const r=await fetch(new URL(file,base));if(!r.ok)throw Error('Runtime laboratoire absent.');const b=await r.arrayBuffer();if(b.byteLength!==info.bytes||await sha(b)!==info.sha256)throw Error('Intégrité du runtime incorrecte : '+file);}
   ort=await import('../../../third_party/nam-webnn-probe/runtime/ort.all.min.mjs');ort.env.wasm.wasmPaths=base.href;record.runtimeManifest=manifest;
  }else {ort=await import('./vendor/onnxruntime-web/ort.webgpu.min.mjs');ort.env.wasm.wasmPaths=new URL('./vendor/onnxruntime-web/',import.meta.url).href;}
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='warning';record.runtimeVersion=ort.env.versions.web;
  if(data.backend==='webnn'){
   if(!navigator.ml||!self.MLGraphBuilder)throw Error('WebNN absent dans ce Worker. Ouvrir le diagnostic dans Canary.');
   record.contextRequestedOptions=webnnContextOptions(data.deviceType);context=await navigator.ml.createContext(record.contextRequestedOptions);record.reportedAccelerated=typeof context.accelerated==='boolean'?context.accelerated:null;
   try{const dispatch=context.dispatch;context.dispatch=function(...args){record.webnnDispatches++;return dispatch.apply(this,args);};record.dispatchInstrumentation=context.dispatch!==dispatch;}catch{}
   try{const Native=self.MLGraphBuilder;self.MLGraphBuilder=class extends Native{async build(outputs){const graph=await super.build(outputs);record.webnnGraphBuilds++;return graph;}};record.graphBuildInstrumentation=self.MLGraphBuilder!==Native;}catch{}
  }
  phase('Création de session '+data.runtime+' / '+data.backend);let t=performance.now();
  session=await ort.InferenceSession.create(weights,webnnSessionOptions(data.backend,context));record.sessionMilliseconds=performance.now()-t;
  const model=new OnnxCoreModel(session,ort.Tensor);phase('Inférence et DSP');t=performance.now();
  const tracks=await separateTracks(model,{channelData:data.channels,sampleRate:44100},undefined,0),stems=model.sources.flatMap(role=>tracks[role].channelData).map(c=>c.slice());record.audioMilliseconds=performance.now()-t;
  if(stems.length!==8||stems.some(c=>!(c instanceof Float32Array)||c.length!==data.channels[0].length||!c.every(Number.isFinite)))throw Error('PCM invalide.');record.frames=stems[0].length;
  if(data.reference)record.parity=webnnAudioParity(data.reference,stems);
  record.providerEvidence=data.backend==='webnn'?(record.dispatchInstrumentation&&record.webnnDispatches>0?'WebNN graph dispatch observed; WASM fallback coverage not quantified':'WebNN requested; actual execution unverified'):'WASM CPU explicitly requested';
  record.status='ok';record.totalMilliseconds=performance.now()-started;
  payload={type:'result',record,stems};
 }catch(e){record.status='error';record.error={name:e.name,message:e.message};record.totalMilliseconds=performance.now()-started;payload={type:'result',record};}
 finally{console.warn=originalWarn;await session?.release().catch(()=>{});try{context?.destroy();}catch{}if(payload)self.postMessage(payload,payload.stems?.map(c=>c.buffer)||[]);}
};
