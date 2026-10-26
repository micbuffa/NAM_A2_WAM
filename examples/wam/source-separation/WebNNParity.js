import {compareAudio} from './AudioComparison.js';
// Fixed before the model experiments. Silent roles are reported, not used as
// unstable relative-error denominators; whole-output parity still must pass.
export const WEBNN_PARITY_LIMITS=Object.freeze({relativeRms:1e-3,maxAbs:.005,roleRmsFloor:1e-5});
export function webnnAudioParity(reference,candidate){
 if(reference.length!==8||candidate.length!==8)throw Error('Huit canaux Demucs4 requis.');
 const all=compareAudio(reference,candidate),roles=['drums','bass','other','vocals'].map((role,i)=>{
  const stats=compareAudio(reference.slice(i*2,i*2+2),candidate.slice(i*2,i*2+2));
  const rms=Math.sqrt(stats.channels.reduce((s,c)=>s+c.referenceRms**2,0)/2),relativeApplicable=rms>=WEBNN_PARITY_LIMITS.roleRmsFloor;
  return {role,relativeRmsError:stats.relativeRmsError,maxAbsError:stats.maxAbsError,referenceRms:rms,relativeApplicable,passed:stats.maxAbsError<=WEBNN_PARITY_LIMITS.maxAbs&&(!relativeApplicable||stats.relativeRmsError<=WEBNN_PARITY_LIMITS.relativeRms)};
 });
 return {limits:WEBNN_PARITY_LIMITS,relativeRmsError:all.relativeRmsError,maxAbsError:all.maxAbsError,roles,passed:all.relativeRmsError<=WEBNN_PARITY_LIMITS.relativeRms&&all.maxAbsError<=WEBNN_PARITY_LIMITS.maxAbs&&roles.every(r=>r.passed)};
}
