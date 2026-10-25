import {ModelCache} from './ModelCache.js';
import {ModelDownloadManager} from './ModelDownloadManager.js';
import {InstrumentComparison} from './InstrumentComparison.js';
import {createBenchmarkRunner} from './BenchmarkRunnerFactory.js';
import {loadRealCase} from './RealInstrumentCorpus.js';
import {GAME_PROTOCOL,validateGameManifest,scoreGameStems} from './LocalGameEvaluation.js';
const $=id=>document.getElementById(id),cache=new ModelCache(),manager=new ModelDownloadManager({cache});
const comparison=new InstrumentComparison({manager,createRunner:m=>createBenchmarkRunner(m,manager)});
const models=(await fetch('./models.json').then(r=>r.json())).models;
const matrix=[{model:models.find(m=>m.id==='bs_roformer_sw_6s'),backend:'webgpu'},{model:models.find(m=>m.id==='htdemucs_6s'),backend:'wasm'}];
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const baseURL=new URL('../../../test-data/source-separation/local-game-stems/',import.meta.url);
let report={protocol:GAME_PROTOCOL,status:'ready',runs:[],recommendationEligible:false};
const show=()=>$('results').textContent=JSON.stringify(report,null,2);
try{for(const {model,backend} of matrix){const s=await manager.getStatus(model);report[model.id]={state:s.state,backend};if(s.state!=='installed')throw Error(`${model.label} absent du cache de cette origine.`);}report.corpus=validateGameManifest(await fetch(new URL('manifest.json',baseURL)).then(r=>r.json()));$('run').disabled=false;$('status').textContent='Deux modèles en cache · prêt.';}catch(e){report.status='error';report.error=e.message;$('status').textContent=e.message;}show();
$('cancel').onclick=()=>comparison.cancel();
$('run').onclick=async()=>{
 $('run').disabled=true;$('cancel').disabled=false;report.status='running';report.date=new Date().toISOString();report.userAgent=navigator.userAgent;report.logicalProcessors=navigator.hardwareConcurrency;report.isolated=crossOriginIsolated;report.runs=[];
 try{
  const adapter=await navigator.gpu?.requestAdapter();report.gpu=adapter?.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,description:adapter.info.description}:null;
  for(const c of report.corpus.cases){
   const audio=await loadRealCase(c,{baseURL,digest,decode:b=>new OfflineAudioContext(2,1,44100).decodeAudioData(b)});
   const file=c.files.rhythm,response=await fetch(new URL(file.path,baseURL)),bytes=await response.arrayBuffer();if(await digest(bytes.slice(0))!==file.sha256)throw Error('Empreinte rhythm incorrecte.');
   const rhythm=await new OfflineAudioContext(2,1,44100).decodeAudioData(bytes);if(rhythm.length!==c.frames||rhythm.numberOfChannels!==2||rhythm.sampleRate!==44100)throw Error('Format rhythm incorrect.');audio.rhythm=[rhythm.getChannelData(0).slice(),rhythm.getChannelData(1).slice()];
   for(const item of matrix){
    const start=performance.now();
    await comparison.run([item],audio.mix,{onProgress:text=>{$('status').textContent=`${c.id} · ${report.runs.length}/12 · ${text}`;},onResult:r=>{
     const row={caseId:c.id,modelId:r.model.id,backend:r.backend,identity:JSON.stringify([r.model.version,r.model.files.map(f=>f.sha256)]),frames:c.frames,status:r.status,jobSeconds:(performance.now()-start)/1000};
     if(r.status==='ok')row.scores=scoreGameStems(r.model,r.stems,audio);else row.error=r.error;
     report.runs.push(row);show();localStorage.setItem('nam-local-game-evaluation.v1',JSON.stringify(report));
    }});
   }
  }
  report.status=report.runs.length===12&&report.runs.every(r=>r.status==='ok')?'completed':'completed-with-errors';$('status').textContent=`${report.status} · ${report.runs.length}/12 exécutions`;
 }catch(e){report.status=e.name==='AbortError'?'cancelled':'error';report.error=e.message;$('status').textContent=e.message;}
 finally{$('run').disabled=false;$('cancel').disabled=true;show();localStorage.setItem('nam-local-game-evaluation.v1',JSON.stringify(report));}
};
window.addEventListener('pagehide',()=>{comparison.cancel();cache.close();});
