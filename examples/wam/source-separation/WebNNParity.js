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
export function syntheticWebnnInput(){return [0,1].map(c=>Float32Array.from({length:44100},(_,i)=>.08*Math.sin(2*Math.PI*(c?330:220)*i/44100)+.03*Math.sin(2*Math.PI*880*i/44100)));}
export function webnnSessionOptions(backend,context){
 if(!['wasm','webnn'].includes(backend))throw Error('Backend laboratoire invalide.');
 if(backend==='webnn'&&!context)throw Error('Contexte WebNN réel requis.');
 return {executionProviders:backend==='webnn'?[{name:'webnn',context},'wasm']:['wasm'],graphOptimizationLevel:'all',logSeverityLevel:2};
}

export function webnnMusicCase(mode){
 if(mode==='initial')return {id:'gha-dream-on-20-6s',path:'local-game-stems/gha-1-20/mix.wav',sha256:'b0f38ab52f1df6aff819c2c7127ed7c4d2b33e0ab61de3af2f50ba39214573fa',referenceScope:'G1 constructed game mix; training exposure unknown; numerical parity only'};
 if(mode==='falcon')return {id:'musdb-falcon-6s-control',path:'musdb-falcon/mix.wav',sha256:'229f72ea5cce679cf0e388641fa576318a0d4435325b65a88fcfd421f62f164a',referenceScope:'Existing Q2 Falcon six-second mixture, chosen before viewing these model outputs as an additional musical parity control; not a new independent quality corpus'};
 throw Error('Jeu de contrôle inconnu.');
}
