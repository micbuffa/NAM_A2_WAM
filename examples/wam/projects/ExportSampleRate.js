// Offline rendering does not use an audio device. Prefer the actual host clock
// for unconstrained chains; a NAM model's declared rate takes precedence.
export const MP3_SAMPLE_RATES = Object.freeze([32000, 44100, 48000]);
export function mp3SampleRate(rate = 44100) {
  if (!Number.isFinite(rate) || rate < 8000 || rate > 192000) throw Error('Invalid audio sample rate.');
  return MP3_SAMPLE_RATES.includes(rate) ? rate : 48000;
}
export function modelSampleRate(entry) {
  if (entry.kind !== 'nam') return null;
  const data = entry.state?.model?.data;
  if (!data) throw Error('The NAM model must be saved in the track preset before exporting.');
  let model;
  try { model = typeof data === 'string' ? JSON.parse(data) : data; }
  catch { throw Error('Invalid NAM model in track preset.'); }
  const rate = model.sample_rate;
  // Older NAM files omit sample_rate; the native engine makes no rate demand.
  if (rate === undefined || rate === null || rate === -1) return null;
  if (!Number.isFinite(rate) || rate < 8000 || rate > 192000 || !Number.isInteger(rate)) throw Error('Invalid NAM model sample rate.');
  return rate;
}
export function trackRenderRate(state, hostRate = 44100) {
  mp3SampleRate(hostRate); // validate even when a model overrides it
  const entries = [...(state.a?.entries ?? state.entries ?? []), ...(state.visible && state.enabledB ? state.b?.entries ?? [] : [])];
  const rates = [...new Set(entries.filter(e => !e.bypass).map(modelSampleRate).filter(Boolean))];
  if (rates.length > 1) throw Error(`This preset contains NAM models with incompatible sample rates (${rates.join(', ')} Hz).`);
  return rates[0] ?? hostRate;
}
