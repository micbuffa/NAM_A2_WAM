import {scoreInstrument} from './InstrumentQuality.js';
import {listeningPair} from './InstrumentComparison.js';
export const GAME_PROTOCOL='local-game-assigned-stems-v1';
export function validateGameManifest(m){
 if(m?.protocol!==GAME_PROTOCOL||m.frames!==264600||m.sampleRate!==44100||m.redistributeAudio!==false||m.recommendationEligible!==false||m.trainingExposure!=='unknown'||m.cases?.length!==6)throw Error('Corpus de jeu incompatible.');
 const seen=new Set();
 for(const c of m.cases){
  if(!/^gha-[123]-(20|90)$/.test(c.id)||seen.has(c.id)||c.target!=='guitar'||c.otherIsGuitar!==false||c.frames!==264600||c.sampleRate!==44100||c.offsetSeconds!==Number(c.id.split('-')[2]))throw Error('Fenêtre du corpus modifiée.');seen.add(c.id);
  for(const role of ['mix','reference','backing','rhythm'])if(c.files?.[role]?.path!==`${c.id}/${role}.wav`||!/^[a-f0-9]{64}$/.test(c.files[role].sha256))throw Error('Référence absente.');
 }return m;
}
export function scoreGameStems(model,stems,audio){
 if(!model.roles.includes('guitar'))throw Error('Autres ne peut pas être assimilé à la guitare de ce corpus.');
 const guitar=listeningPair(model,stems,'guitar'),rhythm=listeningPair(model,stems,'bass');
 return {assignedGuitar:scoreInstrument(audio.reference,guitar.isolated,audio.mix),assignedGuitarBacking:scoreInstrument(audio.backing,guitar.backing,audio.mix),provisionalRhythm:scoreInstrument(audio.rhythm,rhythm.isolated,audio.mix),recommendationEligible:false};
}
