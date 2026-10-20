/* Classic Worker: the pinned Emscripten module exposes libdemucs globally.
   ABI mirrors upstream worker.js; our own wrapper adds errors and cleanup. */
importScripts('./vendor/demucs-wasm/demucs_onnx_simd.js');
onmessage = async ({data}) => {
  const started = performance.now();
  try {
    const {files, left, right, targets} = data;
    if (![4, 6].includes(targets) || !left?.length || left.length !== right.length || left.length > 441000 || ![1, 4].includes(files?.length)) throw Error('Entrée du Worker invalide.');
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
        const l = allocate(left.byteLength), r = allocate(right.byteLength);
        module.HEAPF32.set(left, l / 4); module.HEAPF32.set(right, r / 4);
        const output = Array.from({length: 12}, (_, i) => i < targets * 2 ? allocate(left.byteLength) : 0);
        postMessage({type: 'progress', phase: 'inference', modelIndex, totalModels: files.length});
        module._modelDemixSegment(l, r, left.length, ...output, false, files.length, modelIndex);
        heapBytes = Math.max(heapBytes, module.HEAPU8.byteLength);
        for (let stem = 0; stem < targets; stem++) {
          if (files.length > 1 && stem !== modelIndex) continue;
          for (let channel = 0; channel < 2; channel++) {
            const pointer = output[stem * 2 + channel];
            const values = module.HEAPF32.slice(pointer / 4, pointer / 4 + left.length);
            if (!values.every(Number.isFinite)) throw Error('Le modèle a produit un signal non fini.');
            stems[stem * 2 + channel] = values;
          }
        }
      } finally { for (const pointer of allocated) module._free(pointer); module = null; }
    }
    postMessage({type: 'result', stems, sampleRate: 44100, elapsedMs: performance.now() - started, heapBytes}, stems.map(channel => channel.buffer));
  } catch (error) { postMessage({type: 'error', message: error.message || String(error)}); }
};
