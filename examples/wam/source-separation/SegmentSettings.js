import {planChunks} from './ChunkTools.js';
export const SEGMENT_SECONDS = [0, 1, 2, 3, 5, 7.8];
export function validateSegmentSeconds(value = 0) {
  if (typeof value !== 'number' || !SEGMENT_SECONDS.includes(value)) throw Error('Durée de segment invalide.');
  return value;
}
export function segmentSettings(value = 0, runtime = 'wasm') {
  validateSegmentSeconds(value);
  const onnx = runtime === 'onnx', seconds = value || (onnx ? 7.8 : 5);
  const frames = Math.round(seconds * 44100);
  return {seconds, frames, overlapFrames: Math.round(frames * (onnx ? .25 : .2))};
}
export function segmentPlans(totalFrames, value = 0, runtime = 'wasm', classic = false) {
  const {frames, overlapFrames} = segmentSettings(value, runtime);
  // Preserve the previous direct WASM inference on short inputs in Auto.
  if (classic && value === 0 && totalFrames <= 10 * 44100) return planChunks(totalFrames, totalFrames, 0);
  return planChunks(totalFrames, frames, overlapFrames);
}
export function segmentHint(value = 0, runtime = 'wasm') {
  const {seconds} = segmentSettings(value, runtime);
  return runtime === 'onnx'
    ? `Segments ${seconds} s · recouvrement 25 %. Le réseau ONNX calcule toujours une fenêtre de 7,8 s : des segments courts peuvent ralentir le traitement et réduire le contexte musical.`
    : `Segments ${seconds} s · recouvrement 20 %. Des segments courts publient moins d’audio par bloc et peuvent modifier la qualité aux raccords.`;
}
