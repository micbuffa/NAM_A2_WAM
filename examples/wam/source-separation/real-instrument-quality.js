import {REAL_CORPUS as ORIGINAL_CORPUS} from './RealCorpusDefinition.js';
import {GUITAR_DIAGNOSTIC_CORPUS} from './GuitarDiagnosticDefinition.js';
import {REFERENCE_GUITAR_DIAGNOSTIC} from './GuitarDiagnosticData.js';
import {REAL_QUALITY_PROTOCOL,validateRealManifest,loadRealCase,scoreRealCase,realQualitySummary,resumableRealRuns} from './RealInstrumentCorpus.js';
import {REFERENCE_REAL_QUALITY} from './RealQualityData.js';
import {QualityAuditionBank} from './QualityAuditionBank.js';
import {InstrumentComparison,listeningWav} from './InstrumentComparison.js';
import {ModelCache} from './ModelCache.js';
import {ModelDownloadManager} from './ModelDownloadManager.js';
import {detectCapabilities} from './Capabilities.js';
import {createBenchmarkRunner} from './BenchmarkRunnerFactory.js';
const diagnostic=new URL(location.href).searchParams.get('corpus')==='guitar-diagnostic';
const REAL_CORPUS=diagnostic?GUITAR_DIAGNOSTIC_CORPUS:ORIGINAL_CORPUS;
const protocol=diagnostic?'guitar-diagnostic-quality-v1':REAL_QUALITY_PROTOCOL;
const corpusOptions={corpus:REAL_CORPUS,protocol},storageKey=diagnostic?'nam-guitar-diagnostic-quality.v1':'nam-real-instrument-quality.v1',partialKey=storageKey.replace(/\.v1$/,'.partial.v1');
const $=id=>document.getElementById(id),cache=new ModelCache(),manager=new ModelDownloadManager({cache}),baseURL=new URL('../../../test-data/source-separation/'+(diagnostic?'guitar-diagnostic/':''),import.meta.url);
const audition=new QualityAuditionBank();
const comparison=new InstrumentComparison({manager,createRunner:m=>createBenchmarkRunner(m,manager)});let report=diagnostic?REFERENCE_GUITAR_DIAGNOSTIC:REFERENCE_REAL_QUALITY,generation=0,busy=false,audioGeneration=0,urls=[];
if(diagnostic){document.querySelector('a[href="./REAL_INSTRUMENT_CORPUS.md"]').href='./GUITAR_DIAGNOSTIC.md';$('title').textContent='Diagnostic guitare · acoustique et électrique';$('description').textContent='Trois compositions enregistrées, deux artistes : Country1 (acoustique), Grunge (saturée), Take A Step (claire et saturée). Métadonnées sans repisse déclarée, Autres contient seulement les guitares. ATTENTION : morceaux MUSDB train, potentiellement appris par les modèles. Diagnostic de styles et du pipeline uniquement, pas une validation indépendante ni un nouveau classement conseillé. Résultats séparés des références Settings.';}
const models=(await fetch('./models.json').then(r=>r.json())).models;
for(const m of models){const l=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=m.id;input.checked=m.id!=='htdemucs_ft';l.append(input,m.label);$('models').append(l);}
for(const c of REAL_CORPUS.cases){const o=document.createElement('option');o.value=c.id;o.textContent=`${c.track} · ${c.offsetSeconds}s · ${c.target}`;$('listenCase').append(o);}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const load=c=>loadRealCase(c,{baseURL,digest,decode:bytes=>new OfflineAudioContext(2,1,44100).decodeAudioData(bytes)});
function show(){$('results').textContent=report?JSON.stringify(report,null,2):'Aucune campagne terminée.';$('summary').replaceChildren();for(const s of realQualitySummary(report,models,corpusOptions)){const p=document.createElement('p');p.textContent=`${models.find(m=>m.id===s.modelId).label} · ${s.backend} · ${s.instrument} (sortie ${models.find(m=>m.id===s.modelId).roles.includes(s.instrument)?s.instrument:'other'}) · médiane ${s.siSdrDb.toFixed(2)} dB · minimum ${s.minimumDb.toFixed(2)} dB · ${s.count} extraits / ${s.compositions} composition(s)`;$('summary').append(p);}}show();
async function run(reuse=false){
 clearAudio();audition.clear();
 const prior=report,kept=reuse?resumableRealRuns(prior,models,corpusOptions):[],token=++generation;busy=true;$('run').disabled=$('models').disabled=$('resume').disabled=$('resumeFile').disabled=true;$('cancel').disabled=false;report={protocol,status:'running',date:new Date().toISOString(),userAgent:navigator.userAgent,corpus:REAL_CORPUS,resumedRows:kept.length,resumedFromDate:reuse?prior?.date:null,runs:kept};show();
 try{
  const response=await fetch(new URL('manifest.json',baseURL));if(!response.ok)throw Error('Corpus absent : voir la commande de préparation.');report.corpus=validateRealManifest(await response.json(),REAL_CORPUS);
  const caps=await detectCapabilities(),chosen=[...$('models').querySelectorAll('input:checked')].map(e=>models.find(m=>m.id===e.value));if(!chosen.length)throw Error('Choisissez un modèle.');const matrix=chosen.map(model=>({model,backend:caps.webgpu&&model.backends.includes('webgpu')?'webgpu':'wasm'}));
  for(const c of REAL_CORPUS.cases){
   const pending=matrix.filter(({model,backend})=>!report.runs.some(r=>r.caseId===c.id&&r.modelId===model.id&&r.backend===backend&&r.status==='ok'));if(!pending.length)continue;
   $('status').textContent=`${c.id} · vérification des références`;
   const audio=await load(c);if(token!==generation)throw new DOMException('Annulé','AbortError');
   await comparison.run(pending,audio.mix,{onProgress:text=>$('status').textContent=`${c.id} · ${text}`,onResult:r=>{
    if(token!==generation)return;const row={caseId:c.id,modelId:r.model.id,backend:r.backend,frames:c.frames,identity:JSON.stringify([r.model.version,r.model.files.map(f=>f.sha256)]),status:r.status};if(r.status==='error')row.error=r.error;else {row.score=scoreRealCase(c,r.model,r.stems,audio);audition.add(c,r.model,r.backend,r.stems);}report.runs.push(row);show();try{localStorage.setItem(partialKey,JSON.stringify(report));}catch{}
   }});
   if(token!==generation)throw new DOMException('Annulé','AbortError');
  }
  report.status='completed';show();try{localStorage.setItem(storageKey,JSON.stringify(report));}catch{}$('status').textContent=diagnostic?'Diagnostic terminé (MUSDB train). Aucun conseil Settings modifié.':'Campagne terminée. Les tests réels restent distincts du pilote synthétique.';
 }catch(e){report.status=e.name==='AbortError'?'cancelled':'error';show();$('status').textContent=e.message;}finally{busy=false;$('run').disabled=$('models').disabled=$('resumeFile').disabled=false;$('resume').disabled=!report?.runs?.length;$('cancel').disabled=true;try{localStorage.setItem(partialKey,JSON.stringify(report));}catch{}}
}
$('run').onclick=()=>run(false);$('resume').onclick=()=>run(true);
$('resumeFile').onchange=async()=>{try{const file=$('resumeFile').files[0];if(!file)return;const imported=JSON.parse(await file.text());resumableRealRuns(imported,models,corpusOptions);report=imported;show();$('resume').disabled=false;$('status').textContent='Rapport chargé : reprendre les essais manquants.';}catch(e){$('status').textContent=e.message;}};
try{const recovery=JSON.parse(localStorage.getItem(partialKey));if(recovery&&recovery.status!=='completed'&&resumableRealRuns(recovery,models,corpusOptions).length){report=recovery;show();$('resume').disabled=false;$('status').textContent='Une campagne partielle peut être reprise.';}}catch{}
$('cancel').onclick=()=>{++generation;comparison.cancel();};
$('export').onclick=()=>{if(!report)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.href=url;a.download=diagnostic?'guitar-diagnostic-quality.json':'real-instrument-quality.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function clearAudio(){++audioGeneration;$('audio').onloadedmetadata=null;$('play').disabled=true;$('audio').pause();$('audio').removeAttribute('src');$('audio').load();for(const u of urls)URL.revokeObjectURL(u);urls=[];$('audioButtons').replaceChildren();$('audioLabel').textContent='';}
$('audio').volume=.25;
$('play').onclick=async()=>{try{if($('audio').paused)await $('audio').play();else $('audio').pause();}catch(e){$('audioLabel').textContent=e.message;}};
$('listenCase').onchange=clearAudio;
function addAudioChoice(label,channels,c){
 const wav=listeningWav(channels),url=URL.createObjectURL(new Blob([wav.bytes],{type:'audio/wav'}));urls.push(url);
 const button=document.createElement('button');button.textContent=label;
 button.onclick=()=>{const audio=$('audio'),position=Number.isFinite(audio.currentTime)?audio.currentTime:0,playing=!audio.paused;audio.pause();$('play').disabled=true;
  audio.onloadedmetadata=async()=>{audio.currentTime=Math.min(position,Math.max(0,audio.duration-.001));$('play').disabled=false;if(playing){try{await audio.play();}catch(e){$('audioLabel').textContent=e.message;}}};
  audio.src=url;audio.load();$('audioLabel').textContent=`${c.track} · ${c.offsetSeconds}s · ${label}`;
 };$('audioButtons').append(button);
}
$('listen').onclick=async()=>{clearAudio();const token=audioGeneration;$('listen').disabled=true;
 try{const c=REAL_CORPUS.cases.find(c=>c.id===$('listenCase').value),audio=await load(c);if(token!==audioGeneration)return;
  for(const role of ['mix','reference','backing'])addAudioChoice(role==='reference'?`Référence ${c.target}`:role==='mix'?'Mix reconstruit':'Backing de référence',audio[role],c);
  for(const result of audition.forCase(c.id)){addAudioChoice(`${result.label} · ${result.backend} · ${result.role}`,result.isolated,c);addAudioChoice(`${result.label} · ${result.backend} · backing`,result.backing,c);}
  $('audioLabel').textContent=audition.forCase(c.id).length?'Comparez référence et résultats : même volume, position conservée. Résultats uniquement en RAM.':'Références chargées. Relancez une séparation pour écouter ses résultats (les rapports JSON ne contiennent pas d’audio).';
 }catch(e){$('audioLabel').textContent=e.message;}finally{$('listen').disabled=false;}
};
window.addEventListener('pagehide',()=>{++generation;comparison.cancel();clearAudio();audition.clear();cache.close();});
