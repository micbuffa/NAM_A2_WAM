import {StreamPublisher} from './StreamTransport.js';
// Production preview: verified weights arrive from the normal download/cache manager.
import * as ort from './vendor/onnxruntime-web/ort.webgpu.min.mjs';
import {configureOnnxRuntime} from './OnnxRuntimeConfig.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {planChunks,OverlapAssembler} from './ChunkTools.js';
let session,model,device,windowFrames=44100;
onmessage=async({data})=>{
 try{
  if(data.type==='prepare'){
   if(session)await session.release();session=null;model=null;device?.destroy();device=null;
   const t=performance.now(),weights=data.weights,fetchMs=0;
   if(!(weights instanceof ArrayBuffer)||!weights.byteLength)throw Error('Poids absents.');
   configureOnnxRuntime(ort,import.meta.url);
   if(data.backend==='webgpu'){const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('WebGPU indisponible.');device=await adapter.requestDevice({requiredFeatures:[]});ort.env.webgpu.device=device;}
   const load=performance.now();
   session=await ort.InferenceSession.create(weights,{executionProviders:[data.backend],graphOptimizationLevel:'all',logSeverityLevel:3});
   const loadMs=performance.now()-load;windowFrames=data.frames??44100;model=new OnnxCoreModel(session,ort.Tensor,{frames:windowFrames});
   const warm=performance.now();
   await separateTracks(model,{channelData:[new Float32Array(windowFrames),new Float32Array(windowFrames)],sampleRate:44100},undefined,0);
   postMessage({type:'prepared',fetchMs,loadMs,warmMs:performance.now()-warm,totalMs:performance.now()-t,backend:data.backend,precision:data.backend==='webgpu'?'FP32 · device sans shader-f16':'FP32 WASM',windowFrames});
  }else if(data.type==='run'){
   if(!model)throw Error('Préparez le modèle.');
   const {left,right}=data;const publisher=new StreamPublisher(data.streamTransport,{totalFrames:left.length});if(!(left instanceof Float32Array)||!left.length||left.length!==right?.length||!left.every(Number.isFinite)||!right.every(Number.isFinite))throw Error('Audio invalide.');
   const t=performance.now(),plans=planChunks(left.length,windowFrames,windowFrames===88200?44100:11025),assembler=new OverlapAssembler(8),blocks=[];
   for(let i=0;i<plans.length;i++){
    const p=plans[i],start=performance.now();
    const tracks=await separateTracks(model,{channelData:[left.slice(p.start,p.end),right.slice(p.start,p.end)],sampleRate:44100},undefined,0);
    const stems=assembler.push(p,model.sources.flatMap(role=>tracks[role].channelData));
    blocks.push({index:i,inputFrames:p.end-p.start,publishedFrames:p.commitFrames,computeMs:performance.now()-start,elapsedMs:performance.now()-t});
    await publisher.publish({type:'chunk',startFrame:p.start,stems,sampleRate:44100,roles:model.sources,chunkIndex:i,totalChunks:plans.length,elapsedMs:performance.now()-t});
   }
   postMessage({type:'done',elapsedMs:performance.now()-t,blocks});
  }
 }catch(error){postMessage({type:'error',message:error.message||String(error)});}
};
