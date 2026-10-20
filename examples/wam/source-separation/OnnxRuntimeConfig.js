// Keep the prototype usable on the same static server as the WAM host: no
// cross-origin isolation or SharedArrayBuffer required for this first backend.
export function configureOnnxRuntime(ort,baseURL,{diagnostics=false,adapter,onProfile=()=>{}}={}) {
  ort.env.wasm.numThreads=1;
  ort.env.wasm.proxy=false;
  ort.env.wasm.wasmPaths=new URL('./vendor/onnxruntime-web/',baseURL).href;
  ort.env.logLevel='error';
  const profiling=!!(diagnostics&&adapter?.features.has('timestamp-query'));
  // ORT 1.22 leaves this object undefined until the application initializes it.
  ort.env.webgpu.profiling={mode:profiling?'default':'off',ondata:onProfile};
  return profiling;
}
