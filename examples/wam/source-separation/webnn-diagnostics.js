import {measuredCandidates,recommendMeasuredBackend,recommendationLabel} from './BenchmarkRecommendations.js';
import {EXPERIMENT_PROTOCOL,EXPERIMENT_MODELS,EXPERIMENT_BACKENDS,experimentPlan,experimentCsv,restoreExperiment,saveExperiment,sha256,formatExperimentSeconds,experimentAudioDescription} from './WebNNExperiment.js';
import {prepareBenchmarkAudio} from './BenchmarkInputs.js';
const $=id=>document.getElementById(id),number=id=>Number($(id).value);
let storage;try{storage=localStorage;}catch{}
let report=restoreExperiment(storage)??{protocol:EXPERIMENT_PROTOCOL,runs:[]},stopped=false,cancelJob,worker,generation=0,running=false;
const sources=['BenchmarkRecommendations.js','DirectWebNN.js','WebNNExperiment.js','webnn-diagnostics.js','webnn-diagnostics-worker.js','WebNNDevice.js','WebNNBenchmark.js','OnnxCoreModel.js','RoformerCoreModel.js','RoformerDSP.js','CooperativeOnnxSession.js','ChunkTools.js','AudioComparison.js','BenchmarkInputs.js','vendor/demucs-js/apply.js','vendor/bs-roformer-web/fft-radix2.js','research/roformer-stage-plan.json'];
$('capabilities').textContent=`${navigator.userAgent} · Window: WebNN ${navigator.ml?'present':'absent'}, WebGPU ${navigator.gpu?'present':'absent'} · crossOriginIsolated ${crossOriginIsolated}. Worker support is checked independently.`;
function selectedAudio(){
 $('fileField').hidden=$('input').value!=='file';
 const name=$('input').value==='file'?($('file').files[0]?.name??'choose a local file'):$('input').value==='guitar'?'CleanChords.mp3 · guitar DI':'Slow Motion Dream · CC BY 3.0';
 $('selectedAudio').textContent=`Next run: ${name} · first ${number('seconds')} s requested (limited to source length). This selection does not change the report above.`;
}
$('input').onchange=$('file').onchange=$('seconds').oninput=selectedAudio;
$('settings').onsubmit=event=>event.preventDefault();
const format=formatExperimentSeconds;
let recommendationReference=null;
function showRecommendations(){
 if(!$('recommendations'))return;
 const reference=$('recommendationSource').value==='reference',evidence=reference?recommendationReference:report;
 $('recommendationEvidence').textContent=reference?(evidence?.source??'Loading reference measurements…')+' · '+(evidence?.limitations??''):('Current campaign: '+(report.date??'no measurements yet')+' · '+experimentAudioDescription(report.input));
 const candidates=measuredCandidates(evidence);$('recommendations').replaceChildren();
 const seconds=Number($('songSeconds').value);if(!Number.isFinite(seconds)||seconds<=0){$('recommendationEvidence').textContent='Enter a positive song duration.';return;}
 for(const model of ['demucs4','roformer6'])for(const webnn of [false,true]){
  const card=document.createElement('article');card.className='recommendation-card';
  const title=document.createElement('h3');title.textContent=EXPERIMENT_MODELS[model].label+' · '+(webnn?'WebNN available':'Without WebNN');card.append(title);
  const {recommended,fastest}=recommendMeasuredBackend(candidates,{model,webnn,durationSeconds:seconds,initialized:$('modelInitialized').checked});
  for(const text of recommended?[`Suggested for ${seconds} s: ${recommendationLabel(recommended)}`,`Estimated total ${(recommended.estimatedMs/1000).toFixed(1)} s · graph setup ${(recommended.setupMs/1000).toFixed(1)} s${$('modelInitialized').checked?' (excluded: session retained)':''}`,`Fastest retained processing: ${recommendationLabel(fastest)} · ${(fastest.processingMs/1000).toFixed(3)} s per ${fastest.seconds.toFixed(1)} s · RTF ${fastest.rtf.toFixed(3)}`,`${recommended.samples} independent session(s) for the suggested candidate${recommended.implementation==='direct-webnn'?' · '+(recommended.directParity?'PCM reference check passed for measured excerpt':'PCM reference check not qualified'):''}`]:['No successful measured candidate for this profile. Run the matching configurations.']){const p=document.createElement('p');p.textContent=text;card.append(p);}
  $('recommendations').append(card);
 }
}
if($('recommendations')){
 $('recommendationSource').onchange=$('songSeconds').oninput=$('modelInitialized').onchange=showRecommendations;
 fetch(new URL('./research/recommendation-reference.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Reference unavailable');return r.json();}).then(value=>{recommendationReference=value;if(!running&&!measuredCandidates(report).length)$('recommendationSource').value='reference';showRecommendations();}).catch(()=>{recommendationReference={source:'Reference unavailable',runs:[]};showRecommendations();});
}
function show(){
 showRecommendations();
 saveExperiment(storage,report);$('measuredAudio').textContent=experimentAudioDescription(report.input);$('rows').replaceChildren();
 for(const r of [...report.runs,...(report.current?[report.current]:[])]){
  const tr=document.createElement('tr');tr.dataset.status=r.status;const p=r.phases??{};
  for(const v of [`${EXPERIMENT_MODELS[r.config.model]?.label} / ${r.config.session}`,r.config.backend+(r.config.backend.startsWith('webnn-')?` · ${r.implementation==='direct-webnn'||r.config.webnnImplementation==='direct'?'direct':'ORT'}`:''),`${format(p.weightsFetchMs)} + ${format(p.weightsHashMs)}`,`${format(p.runtimeVerifyMs)} + ${format(p.runtimeImportMs)}`,format(p.contextMs??p.adapterMs),format(p.sessionCreateMs),format(r.summary?.firstMs??r.trials?.[0]?.processingMs),format(r.summary?.retained?.medianMs),r.summary?.retainedRtf?.toFixed(3)??'—']){const td=document.createElement('td');td.textContent=v;tr.append(td);}
  const openLog=()=>{$('details').textContent=JSON.stringify({input:report.input,run:r},null,2);$('logPanel').open=true;$('logPanel').scrollIntoView({block:'nearest',behavior:'smooth'});};
  const td=document.createElement('td'),button=document.createElement('button');button.textContent=r.status;button.title=r.error?.message??'Show per-pass measurements';button.onclick=openLog;td.append(button);tr.append(td);const log=document.createElement('td');if(!['ok','starting','running'].includes(r.status)){const see=document.createElement('button');see.textContent='See log';see.onclick=openLog;log.append(see);}tr.append(log);$('rows').append(tr);
 }
 const completed=report.runs.filter(r=>r.status==='ok').length;
 $('summary').textContent=`${completed} successful / ${report.runs.length} finished configurations. Errors/unsupported/cancellations are retained, without speed scores.`;
 $('export').disabled=$('csv').disabled=!report.runs.length&&!report.current;
}
function setRunning(value){running=value;for(const e of $('settings').elements)e.disabled=value;$('run').disabled=value;$('cancel').disabled=!value;}
function one(config,channels,reference){return new Promise(resolve=>{
 const created=performance.now(),w=new Worker(new URL('./webnn-diagnostics-worker.js',import.meta.url),{type:'module'});worker=w;
 let startup,sendEpoch,last={config,status:'starting',trials:[],phases:{}},settled=false;
 const done=result=>{if(settled)return;settled=true;clearTimeout(timer);w.terminate();worker=null;cancelJob=null;result.record.workerStartupMs=startup??null;result.record.mainJobWallMs=performance.now()-created;if(result.record.receivedEpochMs&&sendEpoch)result.record.inputDeliveryMs=result.record.receivedEpochMs-sendEpoch;resolve(result);};
 const timer=setTimeout(()=>done({record:{...last,status:'timeout',error:{message:`Timeout after ${config.timeoutSeconds}s`,phase:last.phase}}}),config.timeoutSeconds*1000);
 cancelJob=()=>done({record:{...last,status:'cancelled',error:{message:'Explicit stop',phase:last.phase}}});
 w.onerror=e=>done({record:{...last,status:'error',error:{message:e.message,filename:e.filename,lineno:e.lineno}}});
 w.onmessage=({data})=>{
  if(data.type==='ready'){
   startup=performance.now()-created;const copy=channels.map(c=>c.slice()),ref=reference?.map(c=>c.slice());sendEpoch=performance.timeOrigin+performance.now();
   w.postMessage({config,channels:copy,reference:ref},[...copy,...(ref??[])].map(c=>c.buffer));
  }
  if(data.type==='checkpoint'){last={...data.record,workerStartupMs:startup};report.current=last;show();}
  if(data.type==='progress'){last={...last,phase:data.text};report.current=last;show();$('status').textContent=`${config.id} · ${data.text}`;}
  if(data.type==='result')done(data);
 };
});}
async function input(){
 const start=performance.now(),file=$('input').value==='file'?$('file').files[0]:null;
 if($('input').value==='file'&&!file)throw Error('Choose an audio file.');
 if(file&&file.size>100*1024**2)throw Error('Choose a file under 100 MiB; only its first 1–30 seconds are benchmarked.');
 const guitar=$('input').value==='guitar';
 const bytes=file?await file.arrayBuffer():await fetch(new URL(guitar?'../assets/audio/CleanChords.mp3':'./fixtures/music/slow-motion-dream.mp3',import.meta.url)).then(r=>{if(!r.ok)throw Error('Included test audio missing.');return r.arrayBuffer();});
 const sourceSha256=await sha256(bytes),decodeStart=performance.now();const decoder=new OfflineAudioContext(2,1,44100);
 const audio=await decoder.decodeAudioData(bytes),decodeMs=performance.now()-decodeStart,prepared=prepareBenchmarkAudio(audio,number('seconds'));
 if(prepared.frames<44100)throw Error('Input must contain at least one second.');
 const joined=new Float32Array(prepared.frames*2);joined.set(prepared.channels[0]);joined.set(prepared.channels[1],prepared.frames);
 report.input={name:file?.name??(guitar?'CleanChords.mp3 · guitar DI':'Slow Motion Dream · CC BY 3.0'),kind:file?'local-file':guitar?'included-guitar':'included-music',sourceDurationSeconds:audio.duration,requestedSeconds:number('seconds'),sourceSha256,frames:prepared.frames,sampleRate:44100,sourceChannels:prepared.sourceChannels,pcmSha256:await sha256(joined.buffer),pcmFormat:'Float32 planar L then R, native little endian on tested browsers',decodeMs,preparationMs:performance.now()-start};
 show();return prepared.channels;
}
$('run').onclick=async()=>{
 const selected=name=>[...document.querySelectorAll(`input[name="${name}"]:checked`)].map(e=>e.value);
 let plan;try{plan=experimentPlan({models:selected('models'),backends:selected('backends'),sessions:number('sessions'),trials:number('trials'),warmups:number('warmups'),threads:number('threads'),gpuStrategy:$('strategy').value,timeoutSeconds:number('timeout'),order:$('order').value,webnnImplementation:$('webnnImplementation').value});if(!Number.isSafeInteger(number('seconds'))||number('seconds')<1||number('seconds')>30)throw Error('Excerpt must be 1–30 seconds.');}catch(error){$('status').textContent=error.message;return;}
 const run=++generation;stopped=false;setRunning(true);if($('recommendationSource'))$('recommendationSource').value='current';
 report={protocol:EXPERIMENT_PROTOCOL,date:new Date().toISOString(),status:'running',userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency??null,deviceMemoryGiB:navigator.deviceMemory??null,buildLabel:$('build').value,machineLabel:$('machine').value,notes:$('notes').value,crossOriginIsolated,secureContext:isSecureContext,initialVisibility:document.visibilityState,visibilityEvents:[],plan,runs:[],sources:{},measurementPolicy:{runtime:'ORT 1.30.0 for WASM/WebGPU and optional ORT-WebNN; direct WebNN has no browser model runtime',webnnImplementation:$('webnnImplementation').value,implicitBackendRetry:false,operatorWasmFallback:'none for direct WebNN; possible for ORT-WebNN, coverage unknown',effectiveHardware:'unknown',cacheState:'new worker/session; OS/driver/HTTP caches not purged',firstPcm:'available in worker, not audible playback',profiling:'public API wall spans + performance marks; instrumentation always enabled'}};
 $('progress').max=plan.length;$('progress').value=0;$('status').textContent='Preparing input and source fingerprints…';show();
 try{
  try{report.buildInfo=await fetch(new URL('./build-info.json',import.meta.url)).then(r=>r.ok?r.json():null);}catch{}
  const channels=await input();
  for(const path of sources){if(stopped)break;const r=await fetch(new URL(path,import.meta.url));if(!r.ok)throw Error(`Source fingerprint unavailable: ${path}`);const b=await r.arrayBuffer();report.sources[path]={bytes:b.byteLength,sha256:await sha256(b)};}
  const references={};
  for(const config of plan){
   if(stopped||generation!==run)break;
   const result=await one(config,channels,references[config.model]);report.runs.push(result.record);
   if(result.stems&&result.record.status==='ok')references[config.model]=result.stems;
   delete report.current;$('progress').value=report.runs.length;show();
   // Allow browser/device teardown between independent sessions; not a thermal reset.
   if(!stopped)await new Promise(resolve=>setTimeout(resolve,500));
  }
  report.status=stopped?'cancelled':report.runs.some(r=>r.status!=='ok')?'completed-with-failures':'completed';
 }catch(error){report.status='error';report.error={message:error.message,stack:error.stack};}
 finally{delete report.current;worker?.terminate();worker=null;setRunning(false);$('status').textContent=report.status+' · Export JSON for detailed diagnostics and CSV for timings.';show();}
};
$('cancel').onclick=()=>{stopped=true;cancelJob?.();$('status').textContent='Stopping… completed measurements are preserved.';};
document.addEventListener('visibilitychange',()=>{if(running)report.visibilityEvents.push({at:new Date().toISOString(),state:document.visibilityState});});
function download(type){const content=type==='json'?JSON.stringify(report,null,2):experimentCsv(report),url=URL.createObjectURL(new Blob([content],{type:type==='json'?'application/json':'text/csv'})),a=document.createElement('a');a.href=url;a.download=`webnn-diagnostics-${new Date().toISOString().replaceAll(':','-')}.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download('json');$('csv').onclick=()=>download('csv');
selectedAudio();show();if(report.date)$('status').textContent=`Restored report from ${report.date} · ${report.status}. Nothing restarts automatically.`;
