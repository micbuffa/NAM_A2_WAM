export async function detectCapabilities(navigatorImpl = globalThis.navigator) {
  if (!navigatorImpl?.gpu) return {webgpu: false, message: 'WebGPU absent · CPU/WASM à évaluer avec le premier modèle.'};
  try {
    const adapter = await navigatorImpl.gpu.requestAdapter();
    if (!adapter) throw Error('aucun adaptateur');
    const device = await adapter.requestDevice(); device.destroy();
    return {webgpu: true, message: 'WebGPU disponible · compatibilité de chaque modèle à valider.'};
  } catch { return {webgpu: false, message: 'Initialisation WebGPU impossible · CPU/WASM à évaluer.'}; }
}
