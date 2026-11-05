export const DIRECT_WEBNN_BACKENDS=['webnn-direct-cpu','webnn-direct-gpu','webnn-direct-npu'];
export const isDirectWebNN=backend=>DIRECT_WEBNN_BACKENDS.includes(backend);
export const WEBNN_BACKENDS = ['webnn-cpu','webnn-gpu','webnn-npu',...DIRECT_WEBNN_BACKENDS];
export const isWebNN = backend => WEBNN_BACKENDS.includes(backend);
export const backendLabel = backend => isDirectWebNN(backend)?`Direct WebNN / ${backend.slice(13).toUpperCase()} · experimental`:isWebNN(backend) ? `WebNN / ${backend.slice(6).toUpperCase()} (experimental, validated against WASM)` : backend === 'webgpu' ? 'WebGPU' : 'CPU / WASM';
export function validateWebNNSelection(modelId, backend) {
  if(isWebNN(backend) && !isDirectWebNN(backend) && modelId !== 'htdemucs_4s_onnx')throw Error('WebNN is experimental for Demucs 4 only. SW 6 did not pass admission; choose WebGPU or WASM.');
}
export function validateWebNNEvidence(evidence) {
  return evidence?.runtimeVersion==='1.30.0' && Number.isSafeInteger(evidence?.validatedBlocks) && evidence.validatedBlocks>0 && Number.isSafeInteger(evidence?.dispatches) && evidence.dispatches>0 && evidence?.strictParity===true && evidence?.effectiveHardware==='unknown';
}

// Availability is API-based: Firefox builds and Canary use the same menu.
export function studioBackendOptions({webgpu=false,webnn=false,modelId='htdemucs_4s_onnx',directAvailable=true}={}) {
 return [
  {value:'webgpu',label:'WebGPU',disabled:!webgpu},
  {value:'wasm',label:'CPU / WASM',disabled:false},
  ...WEBNN_BACKENDS.map(value=>({value,label:isDirectWebNN(value)?`Direct WebNN / ${value.slice(13).toUpperCase()} · experimental`:`ONNX → WebNN / ${value.slice(6).toUpperCase()} · experimental`,disabled:!webnn||isDirectWebNN(value)&&!directAvailable||!isDirectWebNN(value)&&modelId!=='htdemucs_4s_onnx'})),
 ];
}

export function validateDirectEvidence(evidence){return evidence?.implementation==='direct-webnn'&&evidence.verifiedModel===true&&Number.isSafeInteger(evidence.dispatches)&&evidence.dispatches>0&&/^[a-f0-9]{64}$/.test(evidence.graphSha256??'')&&/^[a-f0-9]{64}$/.test(evidence.weightsSha256??'')&&evidence.effectiveHardware==='unknown';}
export function studioRecommendation(modelId){return modelId==='bs_roformer_sw_6s'?'6 tracks: dedicated guitar/piano. WebGPU recommended for fast startup. Direct WebNN can be faster once initialized, but the reference six-stem build took about 110 s to compile; device-specific.':'4 tracks: fastest startup with WebGPU. WebNN showed a modest processing gain in the reference benchmark; keep WebGPU as the quick-start default.';}
