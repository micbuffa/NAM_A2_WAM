// Zero is a serializable whole-song choice, preserved in saved projects.
export const MAX_AUDIO_FRAMES = 86400 * 44100;
export function separationFrames(totalFrames, seconds = 0) {
  if (!Number.isSafeInteger(totalFrames) || totalFrames < 1 || totalFrames > MAX_AUDIO_FRAMES || ![0,1,5,10,30,60].includes(Number(seconds))) throw Error('Durée de séparation invalide.');
  return Number(seconds) === 0 ? totalFrames : Math.min(totalFrames, Math.round(Number(seconds) * 44100));
}
export function selectedModelLabel(model, backend) {
  return `${model?.label || model?.name || model?.id || 'Chargement du modèle…'} · ${backend === 'webgpu' ? 'GPU / WebGPU' : 'CPU / WASM'}`;
}
