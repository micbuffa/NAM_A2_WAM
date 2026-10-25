// Listening declarations qualify supplied game stems, not their training provenance.
export const QUALIFICATION_AXES=['guitarOnly','guitarComplete','rhythmIsBass','backingContainsGuitar','musicalAlignment'];
export const QUALIFICATION_ROLES=['reference','backing','rhythm'];
export function qualifyGameCase({caseId,listener,chain,answers,playedRoles,notes=''},now=()=>new Date().toISOString()){
 if(!/^gha-[123]-(20|90)$/.test(caseId||''))throw Error('Extrait inconnu.');
 if(typeof listener!=='string'||!listener.trim()||typeof chain!=='string'||!chain.trim())throw Error('Pseudonyme et chaîne d’écoute requis.');
 if(QUALIFICATION_AXES.some(k=>!['yes','no','uncertain'].includes(answers?.[k])))throw Error('Chaque observation doit être renseignée, y compris si elle est incertaine.');
 if(QUALIFICATION_ROLES.some(r=>!playedRoles?.includes(r)))throw Error('Écoutez au moins guitare, backing et rhythm avant d’enregistrer.');
 if(typeof notes!=='string'||notes.length>4000)throw Error('Commentaire invalide.');
 const qualified=answers.guitarOnly==='yes'&&answers.guitarComplete==='yes'&&answers.rhythmIsBass==='yes'&&answers.backingContainsGuitar==='no'&&answers.musicalAlignment==='yes';
 return {caseId,date:now(),listener:listener.trim(),chain:chain.trim(),answers:Object.fromEntries(QUALIFICATION_AXES.map(k=>[k,answers[k]])),playedRoles:[...new Set(playedRoles)],notes,qualification:qualified?'listener-qualified':'unresolved',trainingExposure:'unknown',independentCorpus:false,recommendationEligible:false,playbackCaveat:'Playback events do not establish attentive or complete listening; declarations are not independently audited.'};
}
export function qualificationReport(observations,now=()=>new Date().toISOString()){
 if(!Array.isArray(observations)||new Set(observations.map(o=>o.caseId)).size!==observations.length)throw Error('Une observation par extrait requise.');
 const checked=observations.map(o=>qualifyGameCase(o,()=>o.date));
 return {protocol:'game-stem-qualification-v1',date:now(),status:checked.length===6?'completed':'partial',humanResultsAvailable:checked.length>0,recommendationEligible:false,observations:checked};
}
