export const GUITAR_TARGET_DB = -24;
export const GUITAR_MAX_CORRECTION_DB = 36;
export function guitarCorrection(rmsDb, peakDb) {
  if(!Number.isFinite(rmsDb)||!Number.isFinite(peakDb)||rmsDb < -90)throw Error('Reference output is silent or too quiet to calibrate');
  const requestedDb=GUITAR_TARGET_DB-rmsDb,peakLimit=-1-peakDb;
  const compensationDb=Math.max(-GUITAR_MAX_CORRECTION_DB,Math.min(GUITAR_MAX_CORRECTION_DB,requestedDb,peakLimit));
  if(peakDb+compensationDb> -1+1e-6)throw Error('Reference output exceeds the available correction range');
  return {version:2,mode:'measured',reference:'Funky-Guitar.mp3 (8–20 s, left channel)',targetRmsDb:GUITAR_TARGET_DB,
    referenceInputTrimDb:-18,outputRmsDb:rmsDb,outputPeakDb:peakDb,compensationDb,requestedDb,
    peakLimited:peakLimit<requestedDb&&peakLimit<=GUITAR_MAX_CORRECTION_DB,
    clamped:Math.abs(compensationDb-requestedDb)>1e-6};
}

// A separate WASM instance: never touches the live model, its history or its graph.
export function measureGuitar({module,model,samples,sampleRate,variant,inputGainDb=0}) {
  const noop=()=>0;
  const wasm=new WebAssembly.Instance(module,{env:{emscripten_notify_memory_growth:noop},wasi_snapshot_preview1:{fd_seek:noop,fd_write:noop,fd_read:noop,fd_close:noop,environ_sizes_get:noop,environ_get:noop}}).exports;
  wasm._initialize();const handle=wasm.nam_create(sampleRate);if(!handle)throw Error('Calibration instance unavailable');
  let ptr=0;
  try {
    const bytes=new TextEncoder().encode(model);ptr=wasm.malloc(bytes.length);if(!ptr)throw Error('Calibration memory unavailable');
    new Uint8Array(wasm.memory.buffer,ptr,bytes.length).set(bytes);
    if(!wasm.nam_load_model(handle,ptr,bytes.length))throw Error('Could not load model for calibration');
    wasm.free(ptr);ptr=0;wasm.nam_set_slimmable_size(handle,variant==='lite'?0:1);
    const inputPtr=wasm.nam_input_buffer(handle),outputPtr=wasm.nam_output_buffer(handle);
    const gain=10**((-18+inputGainDb)/20);let squares=0,peak=0,count=0;
    // Warm up with the first second, then measure the complete reference excerpt.
    for(const audio of [samples.subarray(0,Math.min(samples.length,sampleRate)),samples]) {
      const measuring=audio===samples;
      for(let offset=0;offset<audio.length;offset+=128){
        const frames=Math.min(128,audio.length-offset),input=new Float32Array(wasm.memory.buffer,inputPtr,128);
        for(let i=0;i<frames;i++)input[i]=audio[offset+i]*gain;
        if(!wasm.nam_process(handle,inputPtr,outputPtr,frames))throw Error('Calibration processing failed');
        const output=new Float32Array(wasm.memory.buffer,outputPtr,frames);
        for(const value of output){if(!Number.isFinite(value))throw Error('Invalid calibration output');if(measuring){squares+=value*value;peak=Math.max(peak,Math.abs(value));count++;}}
      }
    }
    return {...guitarCorrection(20*Math.log10(Math.sqrt(squares/count)),20*Math.log10(peak)),sampleRate,inputGainDb,durationSeconds:samples.length/sampleRate};
  } finally {if(ptr)wasm.free(ptr);wasm.nam_destroy(handle);}
}
