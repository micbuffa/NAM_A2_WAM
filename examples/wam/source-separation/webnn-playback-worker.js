import {createWebnnPlaybackSession} from './WebNNRuntime.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {RoformerCoreModel} from './RoformerCoreModel.js';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {planChunks,OverlapAssembler} from './ChunkTools.js';
import {StreamPublisher} from './StreamTransport.js';
let runtime,model,config,backend;
const separate=channels=>runtime.guard(config.runtime==='bs-roformer-onnx'?model.separate(channels):separateTracks(model,{channelData:channels,sampleRate:44100},undefined,0).then(tracks=>model.sources.flatMap(role=>tracks[role].channelData)));
self.onmessage=async({data})=>{
 try{
  if(data.type==='prepare'){
   await runtime?.release();runtime=null;model=null;config=data.webnn;backend=data.backend;
   if(!config||!['cpu','gpu','npu'].includes(config.deviceType)||!['demucs-onnx-core','bs-roformer-onnx'].includes(config.runtime)||!(data.weights instanceof ArrayBuffer)||!data.weights.byteLength)throw Error('Préparation WebNN invalide.');
   const start=performance.now();runtime=await createWebnnPlaybackSession(data.weights,config.deviceType);
   model=config.runtime==='bs-roformer-onnx'?new RoformerCoreModel(runtime.session,runtime.ort.Tensor):new OnnxCoreModel(runtime.session,runtime.ort.Tensor,{frames:config.frames});
   await separate([new Float32Array(config.frames),new Float32Array(config.frames)]);
   const evidence=runtime.evidence();if(evidence.dispatchInstrumentation&&!evidence.webnnDispatches)throw Error('Aucun appel WebNN observé : modèle entièrement replié sur WASM. Choisissez explicitement WASM ou un autre moteur.');
   postMessage({type:'prepared',backend,loadMs:performance.now()-start,...evidence});
  }else if(data.type==='run'){
   if(!model)throw Error('Préparez le modèle WebNN.');const {left,right}=data;
   if(!(left instanceof Float32Array)||!(right instanceof Float32Array)||!left.length||left.length!==right.length||!left.every(Number.isFinite)||!right.every(Number.isFinite))throw Error('Audio WebNN invalide.');
   const publisher=new StreamPublisher(data.streamTransport,{totalFrames:left.length}),plans=planChunks(left.length,config.frames,config.runtime==='bs-roformer-onnx'?44100:11025),assembler=new OverlapAssembler((model.sources||model.roles).length*2),blocks=[],start=performance.now();
   for(let i=0;i<plans.length;i++){
    const plan=plans[i],t=performance.now(),output=await separate([left.slice(plan.start,plan.end),right.slice(plan.start,plan.end)]),stems=assembler.push(plan,output);
    blocks.push({index:i,computeMs:performance.now()-t,publishedFrames:plan.commitFrames});
    await publisher.publish({type:'chunk',backend,sampleRate:44100,startFrame:plan.start,chunkIndex:i,totalChunks:plans.length,stems});
   }
   postMessage({type:'done',backend,elapsedMs:performance.now()-start,blocks,runtimeVersion:runtime.ort.env.versions.web,...runtime.evidence()});
  }else throw Error('Commande WebNN inconnue.');
 }catch(error){await runtime?.release();runtime=null;model=null;postMessage({type:'error',message:error.message||String(error)});}
};
