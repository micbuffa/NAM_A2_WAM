export const QUALIFICATION_PROTOCOL='studio-webnn-admission-v2';
export const CONFIGURATIONS=['wasm','webgpu','webnn-cpu','webnn-gpu','webnn-npu'];
// Full end-to-end wall clock includes the guarded WASM reference for WebNN.
// Candidate inference is also reported separately; neither is a native-NPU claim.
export function summarizeTrial(trial,frames,sampleRate=44100) {
  if(!Number.isSafeInteger(frames)||frames<=0||sampleRate!==44100)throw Error('Invalid qualification duration');
  const audioSeconds=frames/sampleRate;
  return {...trial,audioSeconds,
    endToEndRtf:trial.status==='done'&&Number.isFinite(trial.wallMs)?trial.wallMs/1000/audioSeconds:null,
    candidateRtf:trial.status==='done'&&Number.isFinite(trial.timings?.inferenceMs)?trial.timings.inferenceMs/1000/audioSeconds:null,
    nativeWebNNObserved:trial.backend.startsWith('webnn-')&&trial.evidence?.dispatches>0,
    effectiveHardware:'unknown'};
}
export function summarizeQualification(rows) {
  const expected=CONFIGURATIONS.every(backend=>rows.some(row=>row.backend===backend));
  const webnn=rows.filter(row=>row.backend.startsWith('webnn-'));
  return {completeMatrix:expected,nativeTrials:webnn.length,nativeSuccesses:webnn.filter(row=>row.status==='done'&&row.nativeWebNNObserved&&row.productionParity?.passed===true).length,
    allNativePassed:expected&&webnn.length>0&&webnn.every(row=>row.status==='done'&&row.nativeWebNNObserved&&row.productionParity?.passed===true),
    rankingEligible:false,reason:'Development qualification on one short mixture; no independent source-quality references or confirmed physical device.'};
}
