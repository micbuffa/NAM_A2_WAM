import {validateGameManifest} from './LocalGameEvaluation.js';
export function gameReviewSource(manifest,id){
 validateGameManifest(manifest);const c=manifest.cases.find(x=>x.id===id);if(!c)throw Error('Extrait GHA inconnu.');
 return {case:c,metadata:{title:`${c.track} · ${c.offsetSeconds}–${c.offsetSeconds+6}s · guitare assignée`,artist:'Export de jeu fourni localement',rights:'Analyse locale des fichiers fournis par l’utilisateur ; aucune redistribution ; droits non audités',alignment:`Origine commune déclarée, décodage depuis zéro puis tranche exacte ${c.offsetSeconds*44100}–${(c.offsetSeconds+6)*44100} ; synchronisation musicale à qualifier`,instrument:'guitar',provenance:'unknown',otherIsGuitar:false},evidence:{protocol:manifest.protocol,caseId:c.id,offsetSeconds:c.offsetSeconds,sourceFiles:c.sourceFiles,files:c.files,preparedCommonGain:c.commonGain,referenceScope:manifest.referenceScope,trainingExposure:'unknown',recommendationEligible:false}};
}
export async function verifiedGameWav(file,{baseURL,digest,fetcher=fetch}){
 const response=await fetcher(new URL(file.path,baseURL));if(!response.ok)throw Error('WAV de référence absent.');const bytes=await response.arrayBuffer();if(await digest(bytes.slice(0))!==file.sha256)throw Error('Empreinte WAV incorrecte.');return bytes;
}
