export const MODEL_LOUDNESS_TARGET_DB = -18;
export const MODEL_LEVEL_MAX_CORRECTION_DB = 12;
export const MODEL_LEVEL_PEAK_CEILING_DB = -1;

export function modelLoudnessFromNam(model, variant = 'full') {
  const submodels = Array.isArray(model?.config?.submodels) ? model.config.submodels : [];
  const selected = submodels.length ? submodels[variant === 'lite' ? 0 : submodels.length - 1]?.model : null;
  const selectedLoudness = Number(selected?.metadata?.loudness);
  const containerLoudness = Number(model?.metadata?.loudness);
  if (Number.isFinite(selectedLoudness)) return selectedLoudness;
  return Number.isFinite(containerLoudness) ? containerLoudness : null;
}

export function modelLevelCompensationDb(loudness, enabled = true) {
  const value = typeof loudness === 'number' ? loudness : Number.NaN;
  if (!enabled || !Number.isFinite(value)) return 0;
  return Math.max(-MODEL_LEVEL_MAX_CORRECTION_DB,
    Math.min(MODEL_LEVEL_MAX_CORRECTION_DB, MODEL_LOUDNESS_TARGET_DB - value));
}

export function measuredModelLevelCompensationDb(outputRmsDb, outputPeakDb) {
  if (!Number.isFinite(outputRmsDb) || !Number.isFinite(outputPeakDb) || outputRmsDb < -100) return null;
  const requestedDb = MODEL_LOUDNESS_TARGET_DB - outputRmsDb;
  const peakLimitedDb = MODEL_LEVEL_PEAK_CEILING_DB - outputPeakDb;
  const compensationDb = Math.max(-MODEL_LEVEL_MAX_CORRECTION_DB,
    Math.min(MODEL_LEVEL_MAX_CORRECTION_DB, requestedDb, peakLimitedDb));
  return {compensationDb, requestedDb, peakLimited: compensationDb < requestedDb - 1e-9,
    clamped: Math.abs(compensationDb - requestedDb) > 1e-9};
}
