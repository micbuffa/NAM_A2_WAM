import {PERF_TRIALS,summarizePerformance,withWebnnContext} from './WebNNBenchmark.js';
import {webnnContextOptions} from './WebNNDevice.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {RoformerCoreModel} from './RoformerCoreModel.js';
import {planChunks,OverlapAssembler} from './ChunkTools.js';
import {createCooperativeRoformerSession} from './CooperativeOnnxSession.js';
import {compareAudio} from './AudioComparison.js';
const sha=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
self.onmessage=async({data})=>{
 let session,context,payload;const record={...data.config,status:'running',effectiveHardware:'unknown',trials:[],webnnDispatches:0,webnnGraphBuilds:0,warnings:[]},phase=text=>postMessage({type:'progress',text}),start=performance.now();
 const warn=console.warn;console.warn=(...args)=>{if(record.warnings.length<20)record.warnings.push(args.map(String).join(' ').slice(0,800));warn(...args);};
 try{
  const {model,runtime,backend,deviceType}=data.config;
  if(!['demucs4','roformer6'].includes(model)||!['production','lab'].includes(runtime)||!['wasm','webgpu','webnn'].includes(backend))throw Error('Configuration invalide.');
  if(data.channels?.length!==2||data.channels.some(c=>!(c instanceof Float32Array)||c.length!==264600||!c.every(Number.isFinite)))throw Error('Entrée Falcon 6s requise.');
  phase('Intégrité des poids et du runtime');
  const demucs=model==='demucs4',url=demucs?'../../../third_party/nam-webgpu-probe/htdemucs-core.onnx':'./model-assets/bs_roformer_sw_6stem_fp16.onnx';
  record.modelSha256=demucs?'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748':'d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444';
  const response=await fetch(new URL(url,import.meta.url));if(!response.ok)throw Error('Poids locaux absents.');const weights=await response.arrayBuffer();if(await sha(weights)!==record.modelSha256)throw Error('SHA poids invalide.');
  let ort;
  if(runtime==='lab'){
   const manifest=await fetch('./research/webnn-runtime.json').then(r=>r.json()),base=new URL('../../../third_party/nam-webnn-probe/runtime/',import.meta.url);
   for(const [file,info] of Object.entries(manifest.files)){const r=await fetch(new URL(file,base));if(!r.ok)throw Error('Runtime absent.');const b=await r.arrayBuffer();if(b.byteLength!==info.bytes||await sha(b)!==info.sha256)throw Error('SHA runtime invalide.');}
   record.runtimeManifest=manifest;ort=await import('../../../third_party/nam-webnn-probe/runtime/ort.all.min.mjs');ort.env.wasm.wasmPaths=base.href;
  }else{ort=await import('./vendor/onnxruntime-web/ort.webgpu.min.mjs');ort.env.wasm.wasmPaths=new URL('./vendor/onnxruntime-web/',import.meta.url).href;}
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';record.runtimeVersion=ort.env.versions.web;record.integrityAndImportMs=performance.now()-start;
  if(backend==='webgpu'){
   const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('GPU absent.');record.adapterInfo=adapter.info?.toJSON?.()||{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture};
   // Same production policy: no shader-f16 device feature, FP16 weights cast by graph.
   ort.env.webgpu.device=await adapter.requestDevice();
  }
  const prep=performance.now();
  if(backend==='webnn'){
   if(!navigator.ml||!self.MLGraphBuilder)throw Error('WebNN absent.');record.contextRequestedOptions=webnnContextOptions(deviceType);context=await navigator.ml.createContext(record.contextRequestedOptions);
   record.reportedAccelerated=typeof context.accelerated==='boolean'?context.accelerated:null;
   const dispatch=context.dispatch;context.dispatch=function(...args){record.webnnDispatches++;return dispatch.apply(this,args);};record.dispatchInstrumentation=context.dispatch!==dispatch;
   const Native=self.MLGraphBuilder;self.MLGraphBuilder=class extends Native{async build(outputs){const graph=await super.build(outputs);record.webnnGraphBuilds++;return graph;}};
  }
  phase('Création de session');
  record.graphStrategy=!demucs&&backend==='webgpu'?'cooperative-9-stages':'monolithic';
  session=await withWebnnContext((!demucs&&backend==='webgpu'?createCooperativeRoformerSession(ort,weights,{onStage:(n,total)=>phase(`Création étape ${n}/${total}`)}):ort.InferenceSession.create(weights,{executionProviders:backend==='webnn'?[{name:'webnn',context},'wasm']:[backend],graphOptimizationLevel:'all',logSeverityLevel:3})),context);
  record.sessionMs=performance.now()-prep;
  const core=demucs?new OnnxCoreModel(session,ort.Tensor):new RoformerCoreModel(session,ort.Tensor);
  let first;
  for(let trial=0;trial<PERF_TRIALS;trial++){
   phase(`Exécution ${trial+1}/${PERF_TRIALS} (${trial?'session conservée':'première'})`);
   const t=performance.now(),dispatchBefore=record.webnnDispatches;let output,firstReadyMs;
   if(demucs){const tracks=await separateTracks(core,{channelData:data.channels,sampleRate:44100},undefined,0);output=core.sources.flatMap(role=>tracks[role].channelData);firstReadyMs=performance.now()-t;}
   else{
    const plans=planChunks(264600,176400,44100),assembler=new OverlapAssembler(12);output=Array.from({length:12},()=>new Float32Array(264600));
    for(const plan of plans){const block=await core.separate(data.channels.map(c=>c.slice(plan.start,plan.end))),pcm=assembler.push(plan,block);if(firstReadyMs===undefined)firstReadyMs=performance.now()-t;pcm.forEach((c,i)=>output[i].set(c,plan.start));}
   }
   const elapsedMs=performance.now()-t;
   if(output.length!==(demucs?8:12)||output.some(c=>c.length!==264600||!c.every(Number.isFinite)))throw Error('Sortie PCM invalide.');
   // Validation and copies deliberately outside timed inference; fresh assembler each repeat.
   const repeatParity=first?compareAudio(first,output):null;
   if(!first)first=output.map(c=>c.slice());
   record.trials.push({trial,elapsedMs,firstReadyMs,webnnDispatches:record.webnnDispatches-dispatchBefore,repeatParity});postMessage({type:'checkpoint',record});
  }
  if(data.reference)record.baselineParity=compareAudio(data.reference,first);
  record.status='ok';record.summary=summarizePerformance({...record,frames:264600});record.frames=264600;
  record.providerEvidence=backend==='webnn'?record.webnnDispatches>0?'WebNN dispatch observed; WASM fallback coverage unknown':'WebNN requested, dispatch unverified':backend+' explicitly requested';
  payload={type:'result',record,stems:first};
 }catch(e){record.failedAfterMs=performance.now()-start;record.status='error';record.error={name:e.name,message:e.message};payload={type:'result',record};}
 finally{record.wallMs=performance.now()-start;await session?.release().catch(()=>{});try{context?.destroy();}catch{}console.warn=warn;if(payload)postMessage(payload,payload.stems?.map(c=>c.buffer)||[]);}
};
