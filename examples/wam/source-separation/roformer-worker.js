import {StreamPublisher} from './StreamTransport.js';
import * as ort from './vendor/onnxruntime-web/ort.webgpu.min.mjs';
import {configureOnnxRuntime} from './OnnxRuntimeConfig.js';
import {createCooperativeRoformerSession} from './CooperativeOnnxSession.js';
import {RoformerCoreModel} from './RoformerCoreModel.js';
import {ROFORMER_FRAMES,ROFORMER_ROLES} from './RoformerDSP.js';
import {planChunks,OverlapAssembler} from './ChunkTools.js';
let session,model,backend;
onmessage=async({data})=>{
 try{
  if(data.type==='prepare'){
   if(session)await session.release();session=null;model=null;
   if(!['webgpu','wasm'].includes(data.backend)||!(data.weights instanceof ArrayBuffer)||!data.weights.byteLength)throw Error('Préparation Roformer invalide.');
   backend=data.backend;configureOnnxRuntime(ort,import.meta.url);
   const start=performance.now();
   session=backend==='webgpu'?await createCooperativeRoformerSession(ort,data.weights,{onStage:(completed,total)=>postMessage({type:'preparation-progress',completed,total})}):await ort.InferenceSession.create(data.weights,{executionProviders:[backend],graphOptimizationLevel:'all',logSeverityLevel:3});
   const loadMs=performance.now()-start;model=new RoformerCoreModel(session,ort.Tensor);const warm=performance.now();
   await model.separate([new Float32Array(ROFORMER_FRAMES),new Float32Array(ROFORMER_FRAMES)]);
   postMessage({type:'prepared',backend,loadMs,warmMs:performance.now()-warm});
  }else if(data.type==='run'){
   if(!model)throw Error('Préparez le modèle Roformer.');
   const {left,right}=data;const publisher=new StreamPublisher(data.streamTransport,{totalFrames:left.length});if(!(left instanceof Float32Array)||!left.length||left.length!==right?.length||!left.every(Number.isFinite)||!right.every(Number.isFinite))throw Object.assign(Error('Audio invalide.'),{code:'INVALID_AUDIO'});
   model.onPhase=data.diagnostics?(phase,edge)=>postMessage({type:'diagnostic',phase,edge,at:Date.now(),backend}):null;
   const start=performance.now(),plans=planChunks(left.length,ROFORMER_FRAMES,44100),assembler=new OverlapAssembler(12),blocks=[];
   for(let i=0;i<plans.length;i++){
    const plan=plans[i],t=performance.now(),output=await model.separate([left.slice(plan.start,plan.end),right.slice(plan.start,plan.end)]);
    const stems=assembler.push(plan,output);
    blocks.push({index:i,computeMs:performance.now()-t,inputFrames:plan.end-plan.start,...(data.diagnostics&&session.lastTimings?{stageMs:session.lastTimings}:{}),publishedFrames:plan.commitFrames,elapsedMs:performance.now()-start});
    await publisher.publish({type:'chunk',backend,sampleRate:44100,roles:ROFORMER_ROLES,startFrame:plan.start,chunkIndex:i,totalChunks:plans.length,stems});
   }
   postMessage({type:'done',backend,elapsedMs:performance.now()-start,blocks,runtimeVersion:ort.env.versions?.web});
  }else throw Error('Commande Roformer inconnue.');
 }catch(error){postMessage({type:'error',code:error.code,message:error.message||String(error)});}
};
