import {prepareBeatThisGraph,beatThisSessionOptions} from './BeatThisGraph.js';
import {ModelCache} from '../../source-separation/ModelCache.js';
import {ModelDownloadManager,modelKey,sha256} from '../../source-separation/ModelDownloadManager.js';
import {beatThisManifest} from './BeatThisManifest.js';
import {SAMPLE_RATE,CHUNK,MELS,downmix,logMel,windowStarts,featureWindow,windowFrameCount,aggregate,postprocess} from './BeatThisDSP.js';

import {beatThisResponse} from './BeatThisClient.js';
import {compareLogits,sameEvents} from './BeatThisParity.js';
const cache=new ModelCache();
let session,ort,sessionBackend,referenceSession,sessionGraph,sessionMode,referenceBytes;
const clock=()=>performance.now();
self.onmessage=async({data:request})=>{
  const {id,action,assetBase,backend='wasm'}=request;
  const send=(type,value)=>self.postMessage(beatThisResponse(id,type,value));
  const manifest=beatThisManifest(assetBase);
  // HF's pinned downloads redirect to its signed Xet CDN. Hash and size remain mandatory.
  const manager=new ModelDownloadManager({cache,baseURL:import.meta.url,
    allowedOrigins:['https://huggingface.co','https://us.aws.cdn.hf.co','https://cdn-lfs.huggingface.co','https://cas-bridge.xethub.hf.co']});
  let lastProgress=0;
  manager.addEventListener('progress',event=>{
    const now=clock(),p=event.detail;
    if(now-lastProgress>100||p.state!=='downloading'){send('progress',p);lastProgress=now;}
  });
  try {
    if(action==='status'){send('result',{result:await manager.getStatus(manifest)});return;}
    if(action==='remove'){await session?.release();await referenceSession?.release();session=null;referenceSession=null;referenceBytes=null;await manager.remove(manifest);send('result',{result:{state:'missing'}});return;}
    if(action==='install'){await manager.download(manifest);send('result',{result:{state:'installed'}});return;}
    if(action!=='analyse')throw Error('Unknown operation.');
    if(!['wasm','webgpu'].includes(backend))throw Error('Unsupported backend.');
    if(request.sampleRate!==SAMPLE_RATE)throw Error('Expected audio resampled to 22050 Hz.');
    if(!request.channels?.length||request.channels.length>8||request.channels[0].length>120*SAMPLE_RATE)throw Error('Bench limit: 120 seconds, 8 channels.');
    const timing={},started=clock();
    send('progress',{state:'checking'});
    const record=await cache.get(modelKey(manifest));
    if(!await manager.verifyRecord(manifest,record))throw Error('Download and verify the model first.');
    timing.cacheVerifyMs=clock()-started;
    const featureStart=clock(),mono=downmix(request.channels);
    const pcmSha256=await sha256(mono.buffer);
    const {data,frames}=logMel(mono,new Float32Array(record.files[1]),fraction=>send('progress',{state:'features',fraction}));
    timing.featuresMs=clock()-featureStart;
    const windowFrames=windowFrameCount(frames),mode=windowFrames<CHUNK?'dynamic':'fixed';
    const setup=clock();timing.graphPreparationMs=0;
    if(!session||sessionBackend!==backend||sessionMode!==mode){
      await session?.release();session=null;
      await referenceSession?.release();referenceSession=null;referenceBytes=null;
      send('progress',{state:'initializing',backend});
      ort ||= await import('../../source-separation/vendor/onnxruntime-webnn/ort.all.min.mjs');
      ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
      ort.env.wasm.wasmPaths=new URL('../../source-separation/vendor/onnxruntime-webnn/',import.meta.url).href;
      ort.env.logLevel='warning';
      // Patch only the GPU graph, preserving the original source and all learned weights.
      send('progress',{state:'preparingGraph',backend});const graphStart=clock();
      const graph=await prepareBeatThisGraph(record.files[0],backend,{frames:windowFrames});
      timing.graphPreparationMs=clock()-graphStart;
      send('progress',{state:'initializing',backend});
      const options=beatThisSessionOptions(backend,{dynamic:mode==='dynamic'});
      session=await ort.InferenceSession.create(graph.bytes,options);
      sessionGraph={sha256:graph.sha256,workaround:graph.workaround,mode,preferredLayout:backend==='webgpu'&&mode==='dynamic'?'NCHW':null};
      sessionMode=mode;
      if(backend==='webgpu')referenceBytes=mode==='dynamic'?graph.bytes:record.files[0];
      sessionBackend=backend;
    }
    timing.sessionSetupMs=clock()-setup-timing.graphPreparationMs;
    const starts=windowStarts(frames),predictions=[],references=[];timing.windowsMs=[];
    const parity=[];timing.parityMs=0;
    for(let i=0;i<starts.length;i++){
      send('progress',{state:'processing',window:i+1,windows:starts.length});
      const window=featureWindow(data,frames,starts[i],windowFrames),t=clock();
      const tensor=new ort.Tensor('float32',window,[1,windowFrames,MELS]);
      let outputs;
      try {
        outputs=await session.run({spect:tensor});
        if(outputs.beat?.data?.length!==windowFrames||outputs.downbeat?.data?.length!==windowFrames)throw Error('Unexpected Beat This output.');
        predictions.push({beat:Float32Array.from(outputs.beat.data),downbeat:Float32Array.from(outputs.downbeat.data)});
      } finally {tensor.dispose();for(const output of Object.values(outputs||{}))output.dispose();}
      timing.windowsMs.push(clock()-t);
      if(backend==='webgpu'){
        const parityStart=clock();
        send('progress',{state:'parity',window:i+1,windows:starts.length});
        referenceSession ||= await ort.InferenceSession.create(referenceBytes||record.files[0],{executionProviders:['wasm']});referenceBytes=null;
        const referenceInput=new ort.Tensor('float32',window,[1,windowFrames,MELS]);let reference;
        try {
          reference=await referenceSession.run({spect:referenceInput});
          const referenceCopy={beat:Float32Array.from(reference.beat.data),downbeat:Float32Array.from(reference.downbeat.data)};references.push(referenceCopy);
          const check=compareLogits(referenceCopy,predictions[i]);parity.push(check);
          if(!check.passed){const error=Error(`WebGPU rejected: logits differ from WASM (max absolute error ${check.maxAbs?.toFixed(6)}, tolerance ${check.tolerance||'.002'}). Select CPU / WASM.`);error.diagnostics={backend,window:i+1,parity:check,executionGraph:sessionGraph};throw error;}
        }finally{referenceInput.dispose();for(const output of Object.values(reference||{}))output.dispose();}
        timing.parityMs+=clock()-parityStart;
      }
    }
    const postStart=clock(),duration=mono.length/SAMPLE_RATE;
    const logits=aggregate(predictions,starts,frames);
    const result=postprocess(logits,{duration});
    if(backend==='webgpu'&&!sameEvents(postprocess(aggregate(references,starts,frames),{duration}),result))throw Error('WebGPU rejected: beat/downbeat events differ from WASM. Select CPU / WASM.');
    timing.postprocessMs=clock()-postStart;timing.processingMs=timing.windowsMs.reduce((a,b)=>a+b,0);timing.totalMs=clock()-started;
    send('result',{result:{...result,timing,duration,pcmSha256,frames,starts,backend,parity,executionGraph:sessionGraph,runtime:'onnxruntime-web 1.30.0',
      model:{id:manifest.id,version:manifest.version,sha256:manifest.files[0].sha256},
      windowFrames,windowMode:mode,shortWindowPadded:false,qualification:'Experimental; no Studio tempo applied.',
      ...(request.includeLogits?{logits:{beat:Array.from(logits.beat),downbeat:Array.from(logits.downbeat)}}:{})}});
  } catch(error){send('error',{message:error.message,stack:error.stack,diagnostics:error.diagnostics});}
};
