importScripts('./vendor/demucs-wasm/demucs_onnx_simd.js');
onmessage = async ({data}) => {
  const started = performance.now(); let module;
  try {
    const {OverlapAssembler} = await import('./ChunkTools.js');
    const {StreamPublisher}=await import('./StreamTransport.js');
    const publisher=new StreamPublisher(data.streamTransport,{totalFrames:data.left.length});
    const {segmentPlans}=await import('./SegmentSettings.js');
    const {weights,left,right,segmentSeconds=0} = data;
    if (!(left instanceof Float32Array) || left.length !== right?.length || !left.length || left.length > 86400 * 44100) throw Error('Extrait progressif invalide (24 h maximum).');
    postMessage({type:'progress',phase:'load',totalTracks:6});
    module = await libdemucs({locateFile:name=>new URL('./vendor/demucs-wasm/'+name,location.href).href});
    let pointer = module._malloc(weights.byteLength); if(!pointer)throw Error('Mémoire insuffisante.');
    module.HEAPU8.set(new Uint8Array(weights),pointer); module._modelInit(pointer,weights.byteLength); module._free(pointer);
    const plans = segmentPlans(left.length,segmentSeconds), assembler = new OverlapAssembler(12);
    for(let index=0;index<plans.length;index++) {
      const plan=plans[index], length=plan.end-plan.start, allocated=[];
      const allocate=()=>{const p=module._malloc(length*4);if(!p)throw Error('Mémoire insuffisante.');allocated.push(p);return p;};
      postMessage({type:'progress',phase:'inference',chunkIndex:index,totalChunks:plans.length,totalTracks:6,progress:0});
      try {
        const l=allocate(),r=allocate(),out=Array.from({length:12},allocate);
        module.HEAPF32.set(left.subarray(plan.start,plan.end),l/4);module.HEAPF32.set(right.subarray(plan.start,plan.end),r/4);
        module._modelDemixSegment(l,r,length,...out,false,1,0);
        const raw=out.map(p=>module.HEAPF32.slice(p/4,p/4+length));
        const stems=assembler.push(plan,raw);
        await publisher.publish({type:'chunk',startFrame:plan.start,stems,sampleRate:44100,totalFrames:left.length,completedFrames:assembler.committedFrames,chunkIndex:index,totalChunks:plans.length,heapBytes:module.HEAPU8.byteLength});
      } finally { for(const p of allocated)module._free(p); }
    }
    postMessage({type:'done',elapsedMs:performance.now()-started,heapBytes:module.HEAPU8.byteLength});
  } catch(error) { postMessage({type:'error',message:error.message||String(error)}); }
  finally { module=null; }
};
