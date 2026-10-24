import {REAL_CORPUS} from './RealCorpusDefinition.js';
import {referenceMetrics,scoreInstrument} from './InstrumentQuality.js';
import {listeningPair} from './InstrumentComparison.js';
import {median} from './ModelBenchmark.js';
export const REAL_QUALITY_PROTOCOL='real-instrument-quality-v1';
const canonical=value=>JSON.stringify(value&&typeof value==='object'?(Array.isArray(value)?value.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))]))):value);
export function validateRealManifest(manifest,definition=REAL_CORPUS){
 if(manifest?.protocol!==definition.protocol||manifest.sampleRate!==44100||manifest.frames!==264600||manifest.redistributeAudio!==false||!Array.isArray(manifest.cases)||manifest.cases.length!==definition.cases.length)throw Error('Manifeste de corpus incompatible.');
 if(definition.purpose&&(manifest.purpose!==definition.purpose||manifest.trainingOverlap!==definition.trainingOverlap))throw Error('Statut du corpus modifié.');
 for(const [key,source] of Object.entries(definition.sources))if(manifest.sources?.[key]?.sha256!==source.sha256||manifest.sources[key].url!==source.url)throw Error('Archive source modifiée.');
 for(const expected of definition.cases){
  const matches=manifest.cases.filter(c=>c?.id===expected.id);if(matches.length!==1)throw Error('Cas absent ou dupliqué.');const c=matches[0];
  if(canonical(Object.fromEntries(Object.keys(expected).map(k=>[k,c[k]??null])))!==canonical(expected))throw Error('Provenance du cas modifiée.');
  if(c.target!==expected.target||c.frames!==264600||c.sampleRate!==44100||c.group!==expected.group||c.offsetSeconds!==expected.offsetSeconds||c.otherIsGuitar!==expected.otherIsGuitar)throw Error('Contrat du cas modifié.');
  for(const role of ['mix','reference','backing'])if(c.files?.[role]?.path!==expected.files[role].path||c.files[role].sha256!==expected.files[role].sha256)throw Error('Référence audio modifiée.');
 }
 return manifest;
}
export function validateRealAudio(audio,frames){
 for(const role of ['mix','reference','backing']){const channels=audio[role];if(channels?.length!==2||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames||!c.every(Number.isFinite)))throw Error('Audio de référence invalide.');}
 let error=0;for(let c=0;c<2;c++)for(let i=0;i<frames;i++)error=Math.max(error,Math.abs(audio.mix[c][i]-audio.reference[c][i]-audio.backing[c][i]));
 if(error>1e-6||!referenceMetrics(audio.reference,audio.reference).valid||!referenceMetrics(audio.mix,audio.mix).valid||!referenceMetrics(audio.backing,audio.backing).valid)throw Error('Référence inactive ou mix non reconstructible.');return audio;
}
export async function loadRealCase(c,{baseURL,fetcher=fetch,decode,digest}={}){
 const audio={};for(const role of ['mix','reference','backing']){
  const response=await fetcher(new URL(c.files[role].path,baseURL));if(!response.ok)throw Error('Corpus local absent : exécutez la préparation décrite dans REAL_INSTRUMENT_CORPUS.md.');
  const bytes=await response.arrayBuffer();if(await digest(bytes.slice(0))!==c.files[role].sha256)throw Error('SHA-256 du fichier audio incorrect.');
  const buffer=await decode(bytes);if(buffer.sampleRate!==44100||buffer.numberOfChannels!==2||buffer.length!==c.frames)throw Error('Format audio du corpus incorrect.');audio[role]=[buffer.getChannelData(0).slice(),buffer.getChannelData(1).slice()];
 }return validateRealAudio(audio,c.frames);
}
export function scoreRealCase(c,model,stems,audio){
 if(c.target==='guitar'&&!model.roles.includes('guitar')&&!c.otherIsGuitar)throw Error('Autres ne constitue pas une référence guitare pour ce cas.');
 const pair=listeningPair(model,stems,c.target);return {...scoreInstrument(audio.reference,pair.isolated,audio.mix),role:pair.role,backing:scoreInstrument(audio.backing,pair.backing,audio.mix)};
}
export function realQualitySummary(report,models,{corpus=REAL_CORPUS,protocol=REAL_QUALITY_PROTOCOL}={}){
 if(report?.protocol!==protocol||report.status!=='completed'||!Array.isArray(report.runs))return [];
 try{validateRealManifest(report.corpus,corpus);}catch{return [];}
 return models.flatMap(model=>model.backends.flatMap(backend=>['guitar','bass'].flatMap(instrument=>{
  const cases=corpus.cases.filter(c=>c.target===instrument),runs=cases.map(c=>report.runs.filter(r=>r?.caseId===c.id&&r.modelId===model.id&&r.backend===backend&&r.frames===c.frames&&r.identity===JSON.stringify([model.version,model.files.map(f=>f.sha256)])&&r.status==='ok'));
  if(!cases.length||runs.some(a=>a.length!==1))return [];const scores=runs.map(a=>a[0].score),role=instrument==='guitar'&&!model.roles.includes('guitar')?'other':instrument;
  if(!model.roles.includes(role)||role==='other'&&cases.some(c=>!c.otherIsGuitar))return [];
  if(scores.some(s=>s?.role!==role||s?.valid!==true||![s.siSdrDb,s.snrDb,s.gainDb,s.improvementDb].every(Number.isFinite)))return [];
  return [{modelId:model.id,backend,instrument,count:scores.length,compositions:new Set(cases.map(c=>c.group)).size,siSdrDb:median(scores.map(s=>s.siSdrDb)),improvementDb:median(scores.map(s=>s.improvementDb)),snrDb:median(scores.map(s=>s.snrDb)),gainDb:median(scores.map(s=>s.gainDb)),minimumDb:Math.min(...scores.map(s=>s.siSdrDb)),minimumImprovementDb:Math.min(...scores.map(s=>s.improvementDb))}];
 })));
}
// Preserve only verifiable successful observations when resuming a local campaign.
export function resumableRealRuns(report,models,{corpus=REAL_CORPUS,protocol=REAL_QUALITY_PROTOCOL}={}){
 if(report?.protocol!==protocol||!Array.isArray(report.runs))throw Error('Rapport de reprise incompatible.');validateRealManifest(report.corpus,corpus);
 const seen=new Set(),kept=[];
 for(const row of report.runs){
  const c=corpus.cases.find(c=>c.id===row?.caseId),m=models.find(m=>m.id===row?.modelId),s=row?.score;
  if(!c||!m||row.status!=='ok'||row.frames!==c.frames||!m.backends.includes(row.backend)||row.identity!==JSON.stringify([m.version,m.files.map(f=>f.sha256)])||s?.valid!==true||![s.siSdrDb,s.snrDb,s.gainDb,s.improvementDb].every(Number.isFinite))continue;
  const role=c.target==='guitar'&&!m.roles.includes('guitar')?'other':c.target;
  if(!m.roles.includes(role)||s.role!==role||role==='other'&&!c.otherIsGuitar)continue;
  const key=JSON.stringify([c.id,m.id,row.backend]);if(seen.has(key))throw Error('Résultat de reprise dupliqué.');seen.add(key);kept.push(row);
 }return kept;
}
