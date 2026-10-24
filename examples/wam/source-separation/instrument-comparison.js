import {QUALITY_CASES,QUALITY_PROTOCOL,controlledMixture} from './InstrumentQuality.js';
import {InstrumentComparison,listeningPair,listeningWav} from './InstrumentComparison.js';
import {ModelCache} from './ModelCache.js';
import {ModelDownloadManager} from './ModelDownloadManager.js';
import {detectCapabilities} from './Capabilities.js';
import {createBenchmarkRunner} from './BenchmarkRunnerFactory.js';
import {prepareBenchmarkAudio} from './BenchmarkInputs.js';
const $=id=>document.getElementById(id),cache=new ModelCache(),manager=new ModelDownloadManager({cache});
const comparison=new InstrumentComparison({manager,createRunner:model=>createBenchmarkRunner(model,manager)});
$('audio').volume=.25;
$('play').onclick=async()=>{try{const audio=$('audio');if(audio.paused)await audio.play();else audio.pause();}catch(e){$('status').textContent=e.message;}};
$('audio').onerror=()=>{$('play').disabled=true;$('status').textContent='Lecture WAV impossible dans ce navigateur.';};
let urls=[],generation=0,report=null,switchToken=0;
const models=(await fetch('./models.json').then(r=>r.json())).models;
for(const model of models){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=model.id;input.checked=['htdemucs_4s_onnx','bs_roformer_sw_6s'].includes(model.id);label.append(input,model.label);$('models').append(label);}
const clear=()=>{++switchToken;$('play').disabled=true;$('audio').pause();$('audio').removeAttribute('src');$('audio').load();for(const url of urls)URL.revokeObjectURL(url);urls=[];$('results').replaceChildren();$('playing').textContent='Choisissez une piste après séparation';};
const download=(url,name)=>{const a=document.createElement('a');a.href=url;a.download=name;a.click();};
function addAudio(parent,label,channels,name,row){
 const wav=listeningWav(channels),url=URL.createObjectURL(new Blob([wav.bytes],{type:'audio/wav'}));urls.push(url);
 const button=document.createElement('button');button.textContent=label;button.onclick=()=>{
  const audio=$('audio'),position=audio.currentTime||0,playing=!audio.paused,token=++switchToken;
  audio.pause();$('play').disabled=true;audio.onloadedmetadata=()=>{if(token!==switchToken)return;$('play').disabled=false;audio.currentTime=Math.min(position,Math.max(0,audio.duration-.01));if(playing)audio.play().catch(e=>$('status').textContent=e.message);};audio.src=url;audio.load();$('playing').textContent=`${row.label} · ${row.backend} · ${label}`;
 };
 const save=document.createElement('button');save.textContent='WAV';save.setAttribute('aria-label',`Télécharger ${row.label} ${label}`);save.onclick=()=>download(url,name+'.wav');
 const note=document.createElement('small');note.textContent=`Pic ${wav.peak.toFixed(3)} · ${wav.overRangeSamples} échantillon(s) au-delà de ±1 (préservés). `;
 parent.append(button,save,note,document.createElement('br'));return {label,peak:wav.peak,overRangeSamples:wav.overRangeSamples};
}
const updateSource=()=>{const recipe=QUALITY_CASES.find(c=>c.id===$('fixture').value);$('file').disabled=$('seconds').disabled=!!recipe;if(recipe)$('seconds').value='6';$('source').textContent=recipe?`Banc contrôlé : ${recipe.label}`:$('file').files[0]?.name||'Démo : Slow Motion Dream';};
$('fixture').onchange=$('file').onchange=()=>{clear();report=null;updateSource();$('status').textContent='Source modifiée : préparez la comparaison.';};
const requestedFixture=new URL(location.href).searchParams.get('fixture');if(QUALITY_CASES.some(c=>c.id===requestedFixture))$('fixture').value=requestedFixture;updateSource();
$('run').onclick=async()=>{
 const token=++generation;clear();report=null;$('run').disabled=true;$('cancel').disabled=false;for(const id of ['fixture','file','seconds','backend','models'])$(id).disabled=true;
 try{
  const selected=[...$('models').querySelectorAll('input:checked')].map(e=>models.find(m=>m.id===e.value));if(!selected.length)throw Error('Choisissez au moins un modèle.');
  $('status').textContent='Décodage de l’extrait…';const recipe=QUALITY_CASES.find(c=>c.id===$('fixture').value),caps=await detectCapabilities(),file=recipe?null:$('file').files[0],bytes=recipe?await fetch(new URL(`../assets/audio/${recipe.file}`,import.meta.url)).then(r=>r.arrayBuffer()):file?await file.arrayBuffer():await fetch('./fixtures/music/slow-motion-dream.mp3').then(r=>r.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice(0))),x=>x.toString(16).padStart(2,'0')).join('');
  if(recipe&&hash!==recipe.sourceSha256)throw Error('Source du banc modifiée.');
  const audio=await new OfflineAudioContext(2,1,44100).decodeAudioData(bytes),prepared=prepareBenchmarkAudio(audio,recipe?6:Number($('seconds').value)),controlled=recipe?controlledMixture(prepared.channels,recipe):null,channels=controlled?.mix||prepared.channels,frames=prepared.frames;
  if(token!==generation)throw new DOMException('Annulé','AbortError');
  const requested=$('backend').value,matrix=selected.map(model=>({model,backend:requested==='auto'?(caps.webgpu&&model.backends.includes('webgpu')?'webgpu':'wasm'):requested}));
  report={protocol:'instrument-listening-v1',status:'running',date:new Date().toISOString(),source:recipe?`Banc contrôlé : ${recipe.label}`:file?.name||'Slow Motion Dream',recipeId:recipe?.id||null,controlledProtocol:recipe?QUALITY_PROTOCOL:null,sourceSha256:hash,sampleRate:44100,frames,normalization:false,referenceStems:!!controlled,runs:[]};
  const original=document.createElement('article');addAudio(original,'Original',channels,'original',{label:'Original',backend:'source'});if(controlled)for(const [role,label] of [['guitar','Référence guitare'],['bass','Référence basse']])addAudio(original,label,controlled.refs[role],`reference-${role}`,{label:'Référence connue',backend:'source'});$('results').append(original);
  await comparison.run(matrix,channels,{onProgress:message=>$('status').textContent=message,onResult:async result=>{
   if(token!==generation)return;
   const row={modelId:result.model.id,label:result.model.label,identity:JSON.stringify([result.model.version,result.model.files.map(f=>f.sha256)]),backend:result.backend,status:result.status};
   const article=document.createElement('article'),title=document.createElement('h2');title.textContent=`${row.label} · ${row.backend}`;article.append(title);$('results').append(article);report.runs.push(row);
   if(result.status!=='ok'){row.error=result.error;const error=document.createElement('p');error.textContent=result.error;article.append(error);return;}
   row.outputs=[];
   for(const instrument of ['bass','guitar']){
    const pair=listeningPair(result.model,result.stems,instrument),label=pair.role==='other'?'Autres (guitare non isolée)':instrument==='bass'?'Basse':'Guitare';
    row.outputs.push(addAudio(article,label,pair.isolated,`${row.modelId}-${pair.role}`,row));
    row.outputs.push(addAudio(article,`Backing sans ${label}`,pair.backing,`${row.modelId}-sans-${pair.role}`,row));
    // Yield between WAV conversions; only short bounded excerpts are retained.
    await new Promise(resolve=>setTimeout(resolve,0));if(token!==generation)return;
   }
   const note=document.createElement('label');note.textContent='Notes d’écoute : repisse, attaques, graves, artefacts, utilité du backing';const input=document.createElement('textarea');input.setAttribute('aria-label',`Notes ${row.label}`);input.oninput=()=>row.listeningNotes=input.value;note.append(input);article.append(note);
  }});
  if(token===generation){report.status=report.runs.some(r=>r.status==='error')?'completed-with-errors':'completed';$('status').textContent='Comparaison terminée. Choisissez une piste, puis Play. Les notes et mesures techniques peuvent être exportées ; aucun classement automatique de qualité.';}
 }catch(e){if(report)report.status=e.name==='AbortError'?'cancelled':'error';$('status').textContent=e.message;}finally{$('run').disabled=false;$('cancel').disabled=true;for(const id of ['fixture','file','seconds','backend','models'])$(id).disabled=false;updateSource();}
};
$('cancel').onclick=()=>{++generation;comparison.cancel();$('status').textContent='Annulation…';};
$('export').onclick=()=>{if(!report){$('status').textContent='Préparez une comparaison auparavant.';return;}const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));download(url,'instrument-comparison.json');setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('pagehide',()=>{++generation;comparison.cancel();clear();cache.close();});
