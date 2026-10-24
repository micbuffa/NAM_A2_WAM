import {QUALITY_PROTOCOL,QUALITY_CASES,controlledMixture,scoreInstrument,qualitySummary} from './InstrumentQuality.js';
import {instrumentRole,InstrumentComparison,listeningPair} from './InstrumentComparison.js';
import {ModelCache} from './ModelCache.js';
import {ModelDownloadManager} from './ModelDownloadManager.js';
import {detectCapabilities} from './Capabilities.js';
import {createBenchmarkRunner} from './BenchmarkRunnerFactory.js';
import {prepareBenchmarkAudio} from './BenchmarkInputs.js';
const $=id=>document.getElementById(id),cache=new ModelCache(),manager=new ModelDownloadManager({cache});
const comparison=new InstrumentComparison({manager,createRunner:m=>createBenchmarkRunner(m,manager)});let report,generation=0,busy=false;
const models=(await fetch('./models.json').then(r=>r.json())).models;
for(const m of models){const l=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=m.id;input.checked=true;l.append(input,m.label);$('models').append(l);}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
function show(){ $('results').textContent=JSON.stringify(report,null,2);$('summary').replaceChildren();for(const s of qualitySummary(report,models)){const p=document.createElement('p');p.textContent=`${models.find(m=>m.id===s.modelId).label} · ${s.backend} · ${s.instrument} · médiane SI-SDR ${s.siSdrDb.toFixed(2)} dB · amélioration ${s.improvementDb.toFixed(2)} dB · minimum ${s.minimumDb.toFixed(2)} dB · n=${s.count}`;$('summary').append(p);}}
$('run').onclick=async()=>{
 const token=++generation;busy=true;$('run').disabled=$('models').disabled=true;$('cancel').disabled=false;
 report={protocol:QUALITY_PROTOCOL,status:'running',date:new Date().toISOString(),userAgent:navigator.userAgent,cases:[],runs:[]};show();
 try{
  if(document.hidden)throw new DOMException('Gardez cet onglet visible.','AbortError');
  const caps=await detectCapabilities(),chosen=[...$('models').querySelectorAll('input:checked')].map(e=>models.find(m=>m.id===e.value));if(!chosen.length)throw Error('Choisissez un modèle.');
  const matrix=chosen.map(model=>({model,backend:caps.webgpu&&model.backends.includes('webgpu')?'webgpu':'wasm'}));
  for(const recipe of QUALITY_CASES){
   $('status').textContent=`${recipe.label} · préparation du mix de référence`;
   const response=await fetch(new URL(`../assets/audio/${recipe.file}`,import.meta.url));if(!response.ok)throw Error('Source audio absente.');const bytes=await response.arrayBuffer(),sourceSha256=await digest(bytes.slice(0));
   if(sourceSha256!==recipe.sourceSha256)throw Error('Source de référence modifiée : mettez à jour le protocole.');
   const audio=await new OfflineAudioContext(2,1,44100).decodeAudioData(bytes),{channels}=prepareBenchmarkAudio(audio,6),{mix,refs}=controlledMixture(channels,recipe);
   if(token!==generation)throw new DOMException('Annulé','AbortError');
   report.cases.push({id:recipe.id,file:recipe.file,sourceSha256});
   await comparison.run(matrix,mix,{onProgress:text=>$('status').textContent=`${recipe.label} · ${text}`,onResult:r=>{
    if(token!==generation)return;
    const row={caseId:recipe.id,modelId:r.model.id,backend:r.backend,status:r.status,frames:mix[0].length,identity:JSON.stringify([r.model.version,r.model.files.map(f=>f.sha256)])};
    if(r.status==='error')row.error=r.error;else{row.scores={};for(const instrument of ['guitar','bass']){const pair=listeningPair(r.model,r.stems,instrument),target=refs[instrument],backing=[0,1].map(c=>Float32Array.from(mix[c],(x,i)=>x-target[c][i]));row.scores[instrument]={...scoreInstrument(target,pair.isolated,mix),role:instrumentRole(r.model,instrument),backing:scoreInstrument(backing,pair.backing,mix)};}}
    report.runs.push(row);show();
   }});
   if(token!==generation)throw new DOMException('Annulé','AbortError');
  }
  report.status='completed';show();try{localStorage.setItem('nam-instrument-quality.v1',JSON.stringify(report));}catch{}
  $('status').textContent='Évaluation terminée. Résultats pilotes conservés pour Settings. Aucun classement universel ni appréciation d’écoute humaine.';
 }catch(e){report.status=e.name==='AbortError'?'cancelled':'error';show();$('status').textContent=e.message;}finally{busy=false;$('run').disabled=$('models').disabled=false;$('cancel').disabled=true;}
};
$('cancel').onclick=()=>{++generation;comparison.cancel();};
$('export').onclick=()=>{if(!report)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.href=url;a.download='instrument-quality.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&busy){++generation;comparison.cancel();}});
window.addEventListener('pagehide',()=>{++generation;comparison.cancel();cache.close();});
