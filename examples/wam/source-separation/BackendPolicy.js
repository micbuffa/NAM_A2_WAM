export function backendPolicy(model,capabilities,requested='wasm') {
  const onnx=model?.runtime==='demucs-onnx-core';
  const gpu=!!(onnx&&capabilities?.webgpu&&model.backends.includes('webgpu'));
  return {onnx,gpu,backend:requested==='webgpu'&&gpu?'webgpu':'wasm',
    description:onnx?(requested==='webgpu'&&gpu?'WebGPU expérimental : réseau neuronal accéléré, FFT JavaScript et certains opérateurs CPU.':gpu?'CPU/WASM sélectionné pour ce modèle ONNX ; WebGPU est aussi disponible.':'GPU indisponible : même modèle ONNX exécuté sur CPU/WASM.'):'Ce modèle ORT utilise uniquement CPU/WASM. Pour tester le GPU, choisissez « 4 pistes ONNX ». '};
}

// Recommendations never download weights or override a subsequent manual choice.
export function preferredModel(models, capabilities, useCase='guitar') {
  const candidates=capabilities?.webgpu ? models.filter(m=>backendPolicy(m,capabilities,'webgpu').gpu) : [];
  const pool=candidates.length?candidates:models.filter(m=>m.backends.includes('wasm'));
  return pool.find(m=>m.roles.includes(useCase)) || pool[0] || null;
}
