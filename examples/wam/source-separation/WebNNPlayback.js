// Backend keys include the requested device so changing CPU/GPU/NPU invalidates
// a prepared session and survives the existing model-selection transaction.
export const WEBNN_BACKENDS=Object.freeze(['webnn-cpu','webnn-gpu','webnn-npu']);
export const isWebnnBackend=backend=>WEBNN_BACKENDS.includes(backend);
export const supportsWebnnModel=model=>model?.runtime==='bs-roformer-onnx'||model?.runtime==='demucs-onnx-core'&&model.profile!=='preview';
export function webnnPlaybackConfig(model,backend){
 if(!isWebnnBackend(backend)||!supportsWebnnModel(model))throw Error('WebNN expérimental : choisissez Demucs 4 pistes ONNX ou BS Roformer SW 6 pistes.');
 return {deviceType:backend.slice(6),runtime:model.runtime,frames:model.frames||(model.runtime==='demucs-onnx-core'?343980:176400)};
}
export function backendLabel(backend){return isWebnnBackend(backend)?`WebNN / ${backend.slice(6).toUpperCase()} demandé · expérimental`:backend==='webgpu'?'GPU / WebGPU':'CPU / WASM';}
