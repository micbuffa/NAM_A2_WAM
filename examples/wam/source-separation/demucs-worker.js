/* Classic Worker: the pinned Emscripten module exposes libdemucs globally.
   ABI mirrors upstream worker.js; our own wrapper adds errors and cleanup. */
importScripts('./vendor/demucs-wasm/demucs_onnx_simd.js');
onmessage = async ({data}) => {
  const started = performance.now();
  try {
    const {files, left, right, targets, segmentSeconds=0} = data;
    const {segmentPlans}=await import('./SegmentSettings.js');
    if (![4, 6].includes(targets) || !left?.length || left.length !== right.length || left.length > 86400 * 44100 || ![1, 4].includes(files?.length)) throw Error('Entrée du Worker invalide.');
    const {OverlapAssembler}=await import('./ChunkTools.js');
    const stems = new Array(targets * 2); let heapBytes = 0;
    for (let modelIndex = 0; modelIndex < files.length; modelIndex++) {
      postMessage({type: 'progress', phase: 'load', modelIndex, totalModels: files.length});
      let module = await libdemucs({locateFile: name => new URL('./vendor/demucs-wasm/' + name, location.href).href});
      const allocated = [];
      const allocate = size => { const pointer = module._malloc(size); if (!pointer) throw Error('Mémoire WASM insuffisante.'); allocated.push(pointer); return pointer; };
      try {
        const weights = allocate(files[modelIndex].byteLength);
        module.HEAPU8.set(new Uint8Array(files[modelIndex]), weights);
        module._modelInit(weights, files[modelIndex].byteLength);
        // Bound WASM scratch memory independently of song duration. FT keeps
        // one specialist loaded while all overlapping windows are processed.
        const plans=segmentPlans(left.length,segmentSeconds,'wasm',true),assembler=new OverlapAssembler(targets*2);
        for(let channel=0;channel<targets*2;channel++)stems[channel]=new Float32Array(left.length);
        for(let chunkIndex=0;chunkIndex<plans.length;chunkIndex++){
          const plan=plans[chunkIndex],length=plan.end-plan.start,chunkPointers=[];
          const allocChunk=()=>{const p=module._malloc(length*4);if(!p)throw Error('Mémoire WASM insuffisante.');chunkPointers.push(p);return p;};
          try {
            const l=allocChunk(),r=allocChunk(),output=Array.from({length:12},(_,i)=>i<targets*2?allocChunk():0);
            module.HEAPF32.set(left.subarray(plan.start,plan.end),l/4);module.HEAPF32.set(right.subarray(plan.start,plan.end),r/4);
            postMessage({type:'progress',phase:'inference',modelIndex,totalModels:files.length,chunkIndex,totalChunks:plans.length,progress:0});
            module._modelDemixSegment(l,r,length,...output,false,files.length,modelIndex);
            const raw=output.slice(0,targets*2).map(p=>module.HEAPF32.slice(p/4,p/4+length));
            if(raw.some(c=>!c.every(Number.isFinite)))throw Error('Le modèle a produit un signal non fini.');
            const ready=assembler.push(plan,raw);
            ready.forEach((values,i)=>stems[i].set(values,plan.start));
            heapBytes=Math.max(heapBytes,module.HEAPU8.byteLength);
          } finally {for(const p of chunkPointers)module._free(p);}
        }
      } finally { for (const pointer of allocated) module._free(pointer); module = null; }
    }
    postMessage({type: 'result', stems, sampleRate: 44100, elapsedMs: performance.now() - started, heapBytes}, stems.map(channel => channel.buffer));
  } catch (error) { postMessage({type: 'error', message: error.message || String(error)}); }
};
