import {PERF_PROTOCOL,performanceMatrix,restorePerformanceCheckpoint,savePerformanceCheckpoint,performanceCompletion} from './WebNNBenchmark.js';
import {webnnMusicCase} from './WebNNParity.js';
const $=id=>document.getElementById(id);let worker,cancelRun,report={protocol:PERF_PROTOCOL,runs:[]},cancelled=false;
let storage;try{storage=localStorage;}catch{}
report=restorePerformanceCheckpoint(storage)||report;
const sha=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
const show=()=>{savePerformanceCheckpoint(storage,report);$('rows').replaceChildren();for(const r of report.runs){const tr=document.createElement('tr');for(const v of [r.model,`${r.runtimeVersion||r.runtime} / ${r.backend} ${r.deviceType||''}`,r.sessionMs?.toFixed(0),r.summary?.firstMs.toFixed(0),r.summary?.warmMedianMs.toFixed(0),r.status==='error'?r.error?.message:r.status+' '+(r.trials?.length||0)+'/3']){const td=document.createElement('td');td.textContent=v??'—';tr.append(td);}$('rows').append(tr);}$('report').textContent=JSON.stringify(report,null,2);};
function one(config,channels,reference){return new Promise(resolve=>{
 const w=new Worker(new URL('./webnn-performance-worker.js',import.meta.url),{type:'module'});worker=w;let last={...config,status:'running',trials:[]};
 const done=result=>{clearTimeout(timer);w.terminate();worker=null;cancelRun=null;resolve(result);};
 const timer=setTimeout(()=>done({record:{...last,status:'error',error:{message:'Délai maximal de 15 minutes atteint.'}}}),900000);
 cancelRun=()=>done({record:{...last,status:'cancelled'}});
 w.onerror=e=>done({record:{...last,status:'error',error:{message:e.message}}});
 w.onmessage=({data})=>{if(data.type==='progress'){report.current={...last,phase:data.text};show();$('status').textContent=`${config.model} · ${config.backend} ${config.deviceType||''} · ${data.text}`;}if(data.type==='checkpoint'){last=data.record;report.current=last;show();}if(data.type==='result')done(data);};
 const copy=channels.map(c=>c.slice()),ref=reference?.map(c=>c.slice());w.postMessage({config,channels:copy,reference:ref},[...copy,...(ref||[])].map(c=>c.buffer));
 });}
$('cancel').onclick=()=>{cancelled=true;cancelRun?.();};
document.addEventListener('visibilitychange',()=>{if(report.status==='running')report.visibilityEvents.push({at:new Date().toISOString(),state:document.visibilityState});});
async function runCampaign(swOnly=false){
 cancelled=false;report={protocol:PERF_PROTOCOL,date:new Date().toISOString(),userAgent:navigator.userAgent,crossOriginIsolated,initialVisibility:document.visibilityState,visibilityEvents:[],selection:swOnly?'roformer-webnn-'+$('scope').value:'full-matrix',status:'running',runs:[],note:'Same six-second PCM. Sequential sessions. No disk/OS cache flush. First pass + two retained-session passes. Timed intervals include model+DSP+assembly, exclude validation and transfer. No claim of audible playback or effective NPU.'};$('run').disabled=$('resume').disabled=true;$('cancel').disabled=false;$('export').disabled=false;
 try{
  const fixture=webnnMusicCase('falcon'),response=await fetch(new URL('../../../test-data/source-separation/'+fixture.path,import.meta.url)),bytes=await response.arrayBuffer();if(await sha(bytes.slice(0))!==fixture.sha256)throw Error('SHA extrait invalide.');const buffer=await new OfflineAudioContext(2,1,44100).decodeAudioData(bytes),channels=[buffer.getChannelData(0).slice(),buffer.getChannelData(1).slice()],pcm=new Float32Array(529200);pcm.set(channels[0]);pcm.set(channels[1],264600);report.input={...fixture,frames:buffer.length,sampleRate:buffer.sampleRate,pcmSha256:await sha(pcm.buffer)};
  const references={};
  for(const config of performanceMatrix().filter(c=>!swOnly||c.model==='roformer6'&&c.backend==='webnn'&&($('scope').value==='all'||c.deviceType===$('scope').value))){
   if(cancelled)break;
   const result=await one(config,channels,references[config.model]);report.runs.push(result.record);if(config.backend==='wasm'&&result.record.status==='ok')references[config.model]=result.stems;delete report.current;show();
  }
  report.status=performanceCompletion(report.runs,cancelled);
 }catch(e){report.status='error';report.error=e.message;}
 finally{$('status').textContent=report.status;$('run').disabled=$('resume').disabled=false;$('cancel').disabled=true;show();}
};
$('run').onclick=()=>runCampaign();
$('resume').onclick=()=>runCampaign(true);
$('export').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.href=u;a.download='webnn-performance-falcon-2026-10-25.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};

show();if(report.runs.length||report.current){$('export').disabled=false;$('status').textContent='Rapport précédent restauré · '+report.status+(report.current?' · essai interrompu pendant '+report.current.phase:'');}
