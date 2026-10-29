export const WEBNN_BACKENDS = ['webnn-cpu','webnn-gpu','webnn-npu'];
export const isWebNN = backend => WEBNN_BACKENDS.includes(backend);
export const backendLabel = backend => isWebNN(backend) ? `WebNN / ${backend.slice(6).toUpperCase()} (experimental, validated against WASM)` : backend === 'webgpu' ? 'WebGPU' : 'CPU / WASM';
export function validateWebNNSelection(modelId, backend) {
  if(isWebNN(backend) && modelId !== 'htdemucs_4s_onnx')throw Error('WebNN is experimental for Demucs 4 only. SW 6 did not pass admission; choose WebGPU or WASM.');
}
export function validateWebNNEvidence(evidence) {
  return evidence?.runtimeVersion==='1.30.0' && Number.isSafeInteger(evidence?.validatedBlocks) && evidence.validatedBlocks>0 && Number.isSafeInteger(evidence?.dispatches) && evidence.dispatches>0 && evidence?.strictParity===true && evidence?.effectiveHardware==='unknown';
}

// Availability is API-based: Firefox builds and Canary use the same menu.
export function studioBackendOptions({webgpu=false,webnn=false,modelId='htdemucs_4s_onnx'}={}) {
 return [
  {value:'webgpu',label:'WebGPU',disabled:!webgpu},
  {value:'wasm',label:'CPU / WASM',disabled:false},
  ...WEBNN_BACKENDS.map(value=>({value,label:`WebNN / ${value.slice(6).toUpperCase()} · experimental`,disabled:!webnn||modelId!=='htdemucs_4s_onnx'})),
 ];
}
