import * as ort from './vendor/onnxruntime-web/ort.webgpu.min.mjs';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {configureOnnxRuntime} from './OnnxRuntimeConfig.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {planChunks,OverlapAssembler} from './ChunkTools.js';

onmessage=async({data:{weights,left,right,backend,diagnostics=false}})=>{
  const started=performance.now();let session;
  try {
    if(!['webgpu','wasm'].includes(backend)||!(left instanceof Float32Array)||!left.length||left.length!==right?.length||left.length>60*44100)throw Error('Entrée ONNX invalide.');
    let adapterInfo=null,gpuKernels=0,adapter=null;
    if(backend==='webgpu') {
      adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('Adaptateur WebGPU indisponible.');
      adapterInfo={vendor:adapter.info?.vendor||'',architecture:adapter.info?.architecture||''};
    }
    const profilingEnabled=configureOnnxRuntime(ort,import.meta.url,{adapter,diagnostics,onProfile:()=>{gpuKernels++;}});
    postMessage({type:'progress',phase:'load',backend,totalTracks:4});
    const loadStarted=performance.now();
    session=await ort.InferenceSession.create(weights,{executionProviders:[backend],graphOptimizationLevel:'all',logSeverityLevel:3});
    const loadMs=performance.now()-loadStarted,model=new OnnxCoreModel(session,ort.Tensor);
    const plans=planChunks(left.length,343980,85995),assembler=new OverlapAssembler(8),blocks=[];
    for(let index=0;index<plans.length;index++) {
      const plan=plans[index];
      postMessage({type:'progress',phase:'inference',backend,chunkIndex:index,totalChunks:plans.length,totalTracks:4,progress:0});
      const t=performance.now();
      const tracks=await separateTracks(model,{channelData:[left.slice(plan.start,plan.end),right.slice(plan.start,plan.end)],sampleRate:44100},undefined,0);
      const raw=model.sources.flatMap(role=>tracks[role].channelData);
      let stems;
      try {stems=assembler.push(plan,raw);}
      catch {throw Object.assign(Error('Sorties audio ONNX désalignées ou non finies.'),{code:'INVALID_AUDIO'});}

      blocks.push({inputSeconds:(plan.end-plan.start)/44100,publishedSeconds:plan.commitFrames/44100,elapsedMs:performance.now()-t});
      postMessage({type:'chunk',backend,startFrame:plan.start,stems,sampleRate:44100,chunkIndex:index,totalChunks:plans.length},stems.map(c=>c.buffer));
    }
    postMessage({type:'done',backend,elapsedMs:performance.now()-started,loadMs,blocks,adapterInfo,gpuKernels,profilingEnabled,runtimeVersion:ort.env.versions.web});
  } catch(error) {postMessage({type:'error',code:error.code,message:error.message||String(error)});}
  finally {if(session)await session.release().catch(()=>{});}
};
