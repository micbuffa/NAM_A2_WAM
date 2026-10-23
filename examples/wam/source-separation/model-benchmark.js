import {ModelBenchmark,BENCHMARK_PROTOCOL,benchmarkMatrix} from './ModelBenchmark.js';
import {ModelCache} from './ModelCache.js';
import {ModelDownloadManager} from './ModelDownloadManager.js';
import {detectCapabilities} from './Capabilities.js';
import {createBenchmarkRunner} from './BenchmarkRunnerFactory.js';
import {prepareBenchmarkAudio} from './BenchmarkInputs.js';
const $=id=>document.getElementById(id),cache=new ModelCache(),manager=new ModelDownloadManager({cache});
const createRunner=model=>createBenchmarkRunner(model,manager);
const manifest=await fetch('./models.json').then(r=>r.json());
for(const model of manifest.models){const option=document.createElement('option');option.value=model.id;option.textContent=model.label;document.getElementById('modelFilter').append(option);}
const benchmark=new ModelBenchmark({manager,createRunner});let report,generation=0,visibilityLost=false;
$('run').onclick=async()=>{
 visibilityLost=false;const token=++generation;$('run').disabled=true;$('cancel').disabled=false;$('repetitions').disabled=$('modelFilter').disabled=$('backendFilter').disabled=true;
 try{
  const models=(await fetch('./models.json').then(r=>r.json())).models,capabilities=await detectCapabilities();
  const bytes=await fetch('./fixtures/music/slow-motion-dream.mp3').then(r=>r.arrayBuffer()),digest=await crypto.subtle.digest('SHA-256',bytes.slice(0));
  const audio=await new OfflineAudioContext(2,1,44100).decodeAudioData(bytes),{channels}=prepareBenchmarkAudio(audio,6);
  if(token!==generation)throw new DOMException('Annulé','AbortError');
  const matrix=benchmarkMatrix(models.filter(m=>!$('modelFilter').value||m.id===$('modelFilter').value),capabilities.webgpu).filter(r=>!$('backendFilter').value||r.backend===$('backendFilter').value);
  if(!matrix.length)throw Error('Aucune configuration compatible avec ce filtre.');
  let previous;try{previous=JSON.parse(localStorage.getItem('nam-model-benchmark.v1'));}catch{}
  report={foregroundGuard:true,protocol:BENCHMARK_PROTOCOL,date:new Date().toISOString(),fixtureSha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),userAgent:navigator.userAgent,isolated:crossOriginIsolated,capabilities,runs:[]};
  if(previous?.protocol===report.protocol&&previous.fixtureSha256===report.fixtureSha256&&Array.isArray(previous.runs)){report.previousDate=previous.date;report.runs=previous.runs.filter(r=>r&&!matrix.some(({model,backend})=>r.modelId===model.id&&r.backend===backend));}
  await benchmark.run(matrix,channels,{repetitions:Number($('repetitions').value),onProgress:text=>$('status').textContent=text,onResult:row=>{report.runs.push(row);$('results').textContent=JSON.stringify(report,null,2);}});
  if(token!==generation)throw new DOMException('Annulé','AbortError');
  $('status').textContent='Comparaison terminée. Résultats conservés localement pour les graphiques et la recommandation au prochain chargement.';
  try{localStorage.setItem('nam-model-benchmark.v1',JSON.stringify(report));}catch{$('status').textContent+=' Stockage local indisponible.';}
 }catch(e){$('status').textContent=visibilityLost?'Comparaison annulée : onglet masqué. Gardez cette page visible pendant les mesures.':e.message;}finally{$('run').disabled=false;$('cancel').disabled=true;$('repetitions').disabled=$('modelFilter').disabled=$('backendFilter').disabled=false;}
};
$('cancel').onclick=()=>{++generation;benchmark.cancel();};
window.addEventListener('pagehide',()=>{benchmark.cancel();cache.close();});

$('exportReport').onclick=()=>{
 try{const value=report||JSON.parse(localStorage.getItem('nam-model-benchmark.v1'));if(!value)throw Error('Effectuez une comparaison auparavant.');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=url;a.download='model-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('status').textContent=e.message;}
};

document.addEventListener('visibilitychange',()=>{if(document.hidden&&benchmark.busy){visibilityLost=true;++generation;benchmark.cancel();}});
