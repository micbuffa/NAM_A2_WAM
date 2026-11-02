import {loadDirectWebNNModel,createDirectWebNNSession,DirectAudioTensor} from './DirectWebNN.js';
import {isDirectWebNN} from './StudioWebNN.js';
import {contextGuard} from './WebNNAdmission.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {RoformerCoreModel} from './RoformerCoreModel.js';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {segmentPlans} from './SegmentSettings.js';
import {planChunks,OverlapAssembler} from './ChunkTools.js';
import {StreamPublisher} from './StreamTransport.js';
let session,context,core,backend,roles,guard,evidence;
async function dispose(){try{await session?.release();}catch{}try{context?.destroy();}catch{}session=context=core=null;}
self.onmessage=async({data})=>{
 try{
  if(data.type==='prepare'){
   await dispose();
   if(!isDirectWebNN(data.backend)||!navigator.ml?.createContext||!self.MLGraphBuilder)throw Error('Direct WebNN unavailable in this Worker.');
   const key={htdemucs_4s_onnx:'demucs4',bs_roformer_sw_6s:'roformer6'}[data.modelId];if(!key)throw Error('Unsupported direct WebNN model.');
   backend=data.backend;const start=performance.now();
   postMessage({type:'preparation-progress',completed:1,total:3,phase:'download'});
   const model=await loadDirectWebNNModel(key);
   context=await navigator.ml.createContext({deviceType:backend.slice(13)});guard=contextGuard(context);
   evidence={implementation:'direct-webnn',verifiedModel:true,graphSha256:model.indexEntry.graph.sha256,weightsSha256:model.indexEntry.weights.sha256,dispatches:0,effectiveHardware:'unknown',audioParity:'benchmark-qualified; not revalidated per block'};
   postMessage({type:'preparation-progress',completed:2,total:3,phase:'compile'});
   session=await guard(createDirectWebNNSession(context,model.recipe,model.weights,{onStep:step=>{if(step.name==='dispatch')evidence.dispatches++;}}));
   core=key==='demucs4'?new OnnxCoreModel(session,DirectAudioTensor):new RoformerCoreModel(session,DirectAudioTensor);
   roles=key==='demucs4'?core.sources:core.roles;
   postMessage({type:'prepared',backend,loadMs:performance.now()-start,evidence});
  }else if(data.type==='run'){
   if(!core)throw Error('Prepare direct WebNN first.');const {left,right}=data;
   if(!(left instanceof Float32Array)||!(right instanceof Float32Array)||!left.length||left.length!==right.length||!left.every(Number.isFinite)||!right.every(Number.isFinite))throw Error('Invalid input audio.');
   const started=performance.now(),demucs=roles.length===4,plans=demucs?segmentPlans(left.length,0,'onnx'):planChunks(left.length,176400,44100),assembler=new OverlapAssembler(roles.length*2),publisher=new StreamPublisher(data.streamTransport,{totalFrames:left.length});
   for(let i=0;i<plans.length;i++){
    const plan=plans[i],channels=[left.slice(plan.start,plan.end),right.slice(plan.start,plan.end)],before=evidence.dispatches;
    postMessage({type:'progress',phase:'inference',backend,chunkIndex:i,totalChunks:plans.length});
    const audio=demucs?await guard(separateTracks(core,{channelData:channels,sampleRate:44100},undefined,0)):await guard(core.separate(channels));
    const raw=demucs?roles.flatMap(role=>audio[role].channelData):audio;
    if(evidence.dispatches<=before)throw Error('No direct WebNN dispatch for this block.');
    await publisher.publish({backend,sampleRate:44100,startFrame:plan.start,chunkIndex:i,totalChunks:plans.length,stems:assembler.push(plan,raw),evidence:{...evidence}});
   }
   postMessage({type:'done',backend,elapsedMs:performance.now()-started,evidence:{...evidence}});
  }else throw Error('Unknown native separation command.');
 }catch(error){await dispose();postMessage({type:'error',code:'BACKEND_ERROR',message:error.message?.includes('Direct WebNN export missing')?'Direct WebNN model assets are unavailable on this server. Choose WebGPU or CPU/WASM.':error.message});}
};
