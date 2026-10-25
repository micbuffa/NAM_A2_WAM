import {referenceMetrics,scoreInstrument} from './InstrumentQuality.js';
import {listeningPair} from './InstrumentComparison.js';
export const REFERENCE_PROTOCOL='local-reference-evaluation-v1';
export const RATING_AXES=['leakage','artifacts','attacks','timbre','backingUtility'];
export function validateMetadata(meta){
 if(!meta||!['guitar','bass'].includes(meta.instrument)||!['original-recording','unknown','known-training','development-fixture'].includes(meta.provenance))throw Error('Instrument ou provenance invalide.');
 for(const key of ['title','rights','alignment'])if(typeof meta[key]!=='string'||!meta[key].trim()||meta[key].length>1000)throw Error('Titre, droits et origine temporelle communs requis.');
 if(meta.provenance==='original-recording'&&(!/^\d{4}-\d{2}-\d{2}$/.test(meta.recordingDate||'')||!Number.isFinite(Date.parse(meta.recordingDate))||new Date(meta.recordingDate).toISOString().slice(0,10)!==meta.recordingDate))throw Error('Date de prise originale requise.');
 return {...meta,title:meta.title.trim(),rights:meta.rights.trim(),alignment:meta.alignment.trim(),trainingExposure:'user-declaration-not-independently-audited'};
}
function stereo(buffer){
 if(buffer.sampleRate!==44100||![1,2].includes(buffer.numberOfChannels)||!Number.isInteger(buffer.length)||buffer.length<1)throw Error('Audio mono ou stéréo à 44100 Hz requis après décodage.');
 const data=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c));
 if(data.some(c=>!(c instanceof Float32Array)||c.length!==buffer.length||!c.every(Number.isFinite)))throw Error('Échantillons non finis ou invalides.');
 return {channels:[data[0],data[1]||data[0]],monoDuplicated:data.length===1};
}
export function prepareReferencePair(target,backing,{offsetSeconds=0,seconds=6,metadata}={}){
 const meta=validateMetadata(metadata),t=stereo(target),b=stereo(backing);
 if(target.length!==backing.length)throw Error('Les deux fichiers doivent avoir exactement la même durée et la même origine temporelle. Aucun recalage automatique.');
 if(!Number.isFinite(offsetSeconds)||offsetSeconds<0||![1,6,15,30].includes(seconds))throw Error('Fenêtre invalide.');
 const start=Math.round(offsetSeconds*44100),frames=seconds*44100;
 if(start+frames>target.length)throw Error('Fenêtre hors des fichiers ; aucun padding automatique.');
 const isolated=t.channels.map(c=>c.slice(start,start+frames)),accompaniment=b.channels.map(c=>c.slice(start,start+frames));
 let peak=0;for(let c=0;c<2;c++)for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(isolated[c][i]+accompaniment[c][i]));
 const gain=peak>.9?.9/peak:1;
 for(const part of [isolated,accompaniment])for(const channel of part)for(let i=0;i<frames;i++)channel[i]*=gain;
 const mix=isolated.map((channel,c)=>Float32Array.from(channel,(x,i)=>x+accompaniment[c][i]));
 for(const audio of [isolated,accompaniment,mix])if(!referenceMetrics(audio,audio).valid)throw Error('Cible, backing ou mix silencieux dans cette fenêtre.');
 return {mix,reference:isolated,backing:accompaniment,metadata:meta,recipe:{sampleRate:44100,frames,offsetFrame:start,seconds,commonGain:gain,targetMonoDuplicated:t.monoDuplicated,backingMonoDuplicated:b.monoDuplicated,mix:'target-plus-backing',normalization:'one-common-peak-gain',alignment:'user-declared-no-delay-search'}};
}
export function applicable(model,metadata){return model.roles.includes(metadata.instrument)||metadata.instrument==='guitar'&&metadata.otherIsGuitar===true&&model.roles.includes('other');}
export function evaluateReference(model,stems,input){
 if(!applicable(model,input.metadata))throw Error('Other ne peut être noté comme guitare sans déclaration explicite de son contenu.');
 const pair=listeningPair(model,stems,input.metadata.instrument);
 return {pair,score:{...scoreInstrument(input.reference,pair.isolated,input.mix),role:pair.role,backing:scoreInstrument(input.backing,pair.backing,input.mix)}};
}
export function pcmBytes(channels){
 const frames=channels[0].length,bytes=new ArrayBuffer(frames*channels.length*4),view=new DataView(bytes);
 for(let c=0;c<channels.length;c++)for(let f=0;f<frames;f++)view.setFloat32((c*frames+f)*4,channels[c][f],true);
 return bytes;
}
// An exploratory blind review, not a standardized MUSHRA/ABX or population study.
export class BlindReview {
 constructor(items,{randomInt=n=>{const x=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(x);}while(x[0]>=limit);return x[0]%n;},now=()=>new Date().toISOString()}={}){
  if(items.length<2||new Set(items.map(i=>i.id)).size!==items.length)throw Error('Deux candidats uniques au minimum, référence cachée comprise.');
  this.now=now;this.items=[...items];for(let i=this.items.length-1;i>0;i--){const j=randomInt(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('Randomisation invalide.');[this.items[i],this.items[j]]=[this.items[j],this.items[i]];}
  this.startedAt=now();this.ratings=new Map();this.events=[];this.status='in-progress';
 }
 labels(){return this.items.map((_,i)=>`Échantillon ${String.fromCharCode(65+i)}`);}
 item(index){if(!Number.isInteger(index)||index<0||index>=this.items.length)throw Error('Échantillon inconnu.');return this.items[index];}
 rate(index,ratings){
  this.item(index);if(this.status!=='in-progress')throw Error('Évaluation verrouillée.');
  if(RATING_AXES.some(key=>!Object.hasOwn(ratings,key)||!Number.isFinite(ratings[key])||ratings[key]<0||ratings[key]>100))throw Error('Chaque note doit être renseignée entre 0 et 100.');
  this.ratings.set(index,Object.fromEntries(RATING_AXES.map(k=>[k,ratings[k]])));
 }
 recordPlayback(index,variant,position){this.item(index);if(!['instrument','backing'].includes(variant)||!Number.isFinite(position)||position<0)throw Error('Événement invalide.');if(this.status==='in-progress')this.events.push({sample:index,variant,position,date:this.now()});}
 finish({listener,chain}){
  if(this.status!=='in-progress')throw Error('Évaluation déjà terminée.');
  if(typeof listener!=='string'||!listener.trim()||typeof chain!=='string'||!chain.trim())throw Error('Pseudonyme et chaîne d’écoute requis.');
  if(this.items.some((_,i)=>!this.ratings.has(i)))throw Error('Toutes les notes doivent être saisies avant révélation.');
  this.status='completed';this.result={protocol:'exploratory-blind-review-v1',status:this.status,startedAt:this.startedAt,completedAt:this.now(),listener,chain,scale:'0=très dégradé/inutilisable;100=aucun défaut/pleinement utilisable',normalization:'common-player-volume-no-per-candidate-normalization',observations:this.items.map((item,i)=>({sample:this.labels()[i],candidateId:item.id,hiddenReference:item.hiddenReference===true,ratings:this.ratings.get(i)})),playbackEvents:[...this.events],playbackCaveat:'Events do not prove attentive or complete listening.'};return this.result;
 }
 report(){return this.status==='completed'?structuredClone(this.result):{protocol:'exploratory-blind-review-v1',status:this.status,ratedCount:this.ratings.size,candidateCount:this.items.length,humanResultsAvailable:false};}
}
