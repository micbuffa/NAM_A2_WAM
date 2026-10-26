// Separate runtime/Worker: enabling WebNN never changes the production ORT
// version. Each block must pass strict per-role AND global WASM parity before
// publication. Device type is a preference, never a hardware attestation.
import * as ort from './vendor/onnxruntime-webnn/ort.all.min.mjs';
import {admitWebNNBlock,contextGuard} from './WebNNAdmission.js';
import {isWebNN} from './StudioWebNN.js';
import {StreamPublisher} from './StreamTransport.js';
import {segmentPlans} from './SegmentSettings.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {OverlapAssembler} from './ChunkTools.js';
self.onmessage=async({data:{weights,left,right,backend,segmentSeconds=0,streamTransport,diagnostics=false}})=>{
 let session,reference,context;
 const started=performance.now(),timings={contextMs:0,sessionMs:0,referenceSessionMs:0,inferenceMs:0,referenceMs:0,validationMs:0,publishedFrames:0,blocks:[]},evidence={runtimeVersion:ort.env.versions.web,validatedBlocks:0,dispatches:0,strictParity:false,effectiveHardware:'unknown',mixedProvider:true};
 try{
  if(!isWebNN(backend)||!(left instanceof Float32Array)||!left.length||left.length!==right?.length||!left.every(Number.isFinite)||!right.every(Number.isFinite))throw Error('Invalid WebNN audio input');
  if(!navigator.ml?.createContext||!self.MLGraphBuilder)throw Error('WebNN unavailable in this browser Worker');
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
  ort.env.wasm.wasmPaths=new URL('./vendor/onnxruntime-webnn/',import.meta.url).href;
  const deviceType=backend.slice(6);
  postMessage({type:'progress',phase:'load',backend,totalTracks:4});
  let t=performance.now();
  context=await navigator.ml.createContext({deviceType});
  timings.contextMs=performance.now()-t;
  const dispatch=context.dispatch;
  context.dispatch=function(...args){evidence.dispatches++;return dispatch.apply(this,args);};
  const guarded=contextGuard(context);
  t=performance.now();
  session=await guarded(ort.InferenceSession.create(weights,{executionProviders:[{name:'webnn',context,deviceType},'wasm'],graphOptimizationLevel:'all',logSeverityLevel:3}));
  timings.sessionMs=performance.now()-t;t=performance.now();
  reference=await guarded(ort.InferenceSession.create(weights,{executionProviders:['wasm'],graphOptimizationLevel:'all',logSeverityLevel:3}));
  timings.referenceSessionMs=performance.now()-t;
  const core=new OnnxCoreModel(session,ort.Tensor),control=new OnnxCoreModel(reference,ort.Tensor);
  const plans=segmentPlans(left.length,segmentSeconds,'onnx'),assembler=new OverlapAssembler(8),publisher=new StreamPublisher(streamTransport,{totalFrames:left.length});
  for(let index=0;index<plans.length;index++){
   const plan=plans[index],audio={channelData:[left.slice(plan.start,plan.end),right.slice(plan.start,plan.end)],sampleRate:44100};
   postMessage({type:'progress',phase:'inference',backend,chunkIndex:index,totalChunks:plans.length,totalTracks:4});
   const block={index,dispatchesBefore:evidence.dispatches};t=performance.now();
   const tracks=await guarded(separateTracks(core,audio,undefined,0));
   block.inferenceMs=performance.now()-t;timings.inferenceMs+=block.inferenceMs;
   postMessage({type:'progress',phase:'validation',backend,chunkIndex:index,totalChunks:plans.length});
   t=performance.now();
   const expected=await guarded(separateTracks(control,audio,undefined,0));
   block.referenceMs=performance.now()-t;timings.referenceMs+=block.referenceMs;t=performance.now();
   const raw=core.sources.flatMap(role=>tracks[role].channelData),baseline=control.sources.flatMap(role=>expected[role].channelData);
   let parity;
   try {parity=admitWebNNBlock(baseline,raw,block.dispatchesBefore,evidence.dispatches);}
   finally {block.validationMs=performance.now()-t;timings.validationMs+=block.validationMs;}
   if(diagnostics)timings.blocks.push({...block,dispatches:evidence.dispatches-block.dispatchesBefore,parity});
   evidence.validatedBlocks++;evidence.strictParity=true;
   timings.firstValidatedAudioMs ??= performance.now()-started;
   const stems=assembler.push(plan,raw);
   await publisher.publish({type:'chunk',backend,startFrame:plan.start,stems,sampleRate:44100,chunkIndex:index,totalChunks:plans.length,evidence:{...evidence}});
   timings.publishedFrames+=stems[0].length;
  }
  postMessage({type:'done',backend,elapsedMs:performance.now()-started,evidence,timings});
 }catch(error){postMessage({type:'error',code:'BACKEND_ERROR',message:error.message||String(error),elapsedMs:performance.now()-started,timings,evidence,parity:error.parity});}
 finally{await session?.release().catch(()=>{});await reference?.release().catch(()=>{});try{context?.destroy();}catch{}}
};
