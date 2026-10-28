export async function detectCapabilities(navigatorImpl = globalThis.navigator) {
  const webnn=!!navigatorImpl?.ml;
  if (!navigatorImpl?.gpu) return {webnn,webgpu: false, message: 'WebGPU absent · CPU/WASM à évaluer avec le premier modèle.'};
  try {
    const adapter = await navigatorImpl.gpu.requestAdapter();
    if (!adapter) throw Error('aucun adaptateur');
    const device = await adapter.requestDevice(); device.destroy();
    return {webnn,webgpu: true, message: 'WebGPU disponible · compatibilité de chaque modèle à valider.'};
  } catch { return {webnn,webgpu: false, message: 'Initialisation WebGPU impossible · CPU/WASM à évaluer.'}; }
}
