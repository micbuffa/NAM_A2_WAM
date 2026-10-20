import {ModelCatalog} from './ModelCatalog.js';
import {MultitrackSession} from './MultitrackSession.js';
import {MultitrackEngine} from './MultitrackEngine.js';
import {SeparationWorkflow} from './SeparationWorkflow.js';
import {SeparationMixer} from './SeparationMixer.js';
import {initializeDownloads} from './DownloadsView.js';
import {DemucsRunner} from './DemucsRunner.js';
import {OnnxDemucsRunner} from './OnnxDemucsRunner.js';
import {backendPolicy,preferredModel} from './BackendPolicy.js';
import {ProgressiveDemucsRunner} from './ProgressiveDemucsRunner.js';
import {ProgressiveMultitrackEngine} from './ProgressiveMultitrackEngine.js';
import {makeTracks} from './AudioData.js';
import Renderer from './vendor/wavesurfer/renderer.js';
import {CompactMultitrackView} from './CompactMultitrackView.js';
import {SeparationProgress, transportState, separationMessage} from './SeparationProgress.js';
import {describeModelStatus, separationEligibility, modelSize, ModelLoadIndicator} from './ModelStatus.js';

const $ = id => document.getElementById(id);
const labels = {drums:'Batterie', bass:'Basse', other:'Autres', vocals:'Voix', guitar:'Guitare', piano:'Piano'};
let catalog, session, engine, runner, progressiveRunner, onnxRunner, downloads, tracks = [], selectedAudio = null, busy = false;
let selectionGeneration = 0, audioGeneration = 0, audioContext, globalMixer, guitarPreview;
let installing = false, modelInstalled = false, cancelRequested=false;
let selectedModelState = {state:'checking'}, decoding = false;
let separationProgress = new SeparationProgress();
const modelLoadIndicator = new ModelLoadIndicator();
const time = seconds => `${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
const report = error => { $('progress').textContent = error.name === 'AbortError' ? 'Séparation annulée.' : error.message; };
const compactPlayer = new CompactMultitrackView($('tracks'), {
  createRenderer: options => new Renderer(options), labels,
  onChange: () => {}, onError: report,
  onLoopChange: bounds=>applyLoopRegion(bounds.start,bounds.end),
  onSeek: seconds => {const result=engine?.seek(seconds);result?.catch(report);},
});
function updateWaveforms() {
  if(!engine||!session)return;
  compactPlayer.setAudio({tracks:engine.tracks,chunks:engine.progressive?engine.chunks:undefined,
    totalFrames:engine.progressive?engine.totalFrames:tracks[0]?.buffer.length,
    duration:engine.duration,outputGain:effectiveBackingGain(),availableDuration:engine.progressive?engine.availableDuration:engine.duration});
}
function getContext(){
  if(!audioContext){
    audioContext=new AudioContext({sampleRate:44100});globalMixer=new SeparationMixer(audioContext);
    workflow.destination=globalMixer.backingInput;
    globalMixer.addEventListener('change',()=>{syncGlobalMix();compactPlayer.setOutputGain(effectiveBackingGain());});
    syncGlobalMix();
  }
  return audioContext;
}
function effectiveBackingGain(){return (engine?.outputNode.gain.value??.7)*(globalMixer?.backingWaveformGain()??1);}
function syncGlobalMix(){
  const state=globalMixer?.getState()||{volumeDb:0,muted:false,mix:.5,guitarPan:0};
  for(const [id,key] of [['backingVolume','volumeDb'],['guitarBalance','mix'],['globalGuitarPan','guitarPan']])if(document.activeElement!==$(id))$(id).value=state[key];
  $('backingVolumeValue').textContent=`${state.volumeDb.toFixed(1)} dB`;$('backingMute').setAttribute('aria-pressed',String(state.muted));
  $('guitarBalanceValue').textContent=`${Math.round((1-state.mix)*100)} / ${Math.round(state.mix*100)}`;
  $('globalGuitarPanValue').textContent=state.guitarPan===0?'C':`${Math.round(Math.abs(state.guitarPan)*100)}${state.guitarPan<0?'L':'R'}`;
}
async function loadGuitarPreview(){
  getContext();await audioContext.resume();$('guitarPreviewLoad').disabled=true;
  try{
    const response=await fetch('../assets/audio/CleanChords.mp3');if(!response.ok)throw Error('Guitare de test indisponible.');
    const buffer=await new OfflineAudioContext(2,1,44100).decodeAudioData(await response.arrayBuffer());
    guitarPreview?.destroy();guitarPreview=new MultitrackEngine(audioContext);guitarPreview.load([{id:'preview',buffer}]);guitarPreview.sync([{id:'preview',volume:.5,pan:0}]);guitarPreview.outputNode.connect(globalMixer.guitarInput);
    $('guitarPreviewPlay').disabled=false;$('guitarPreviewStop').disabled=false;$('guitarPreviewStatus').textContent='Guitare de test prête · CleanChords';
  }finally{$('guitarPreviewLoad').disabled=false;}
}
const workflow=new SeparationWorkflow({canAutoSwitch:()=>!document.activeElement?.closest('.compact-track-controls'),onActivate:deck=>{
  engine=deck.engine;globalMixer?.setActiveEngine(engine);session=deck.session;tracks=engine.tracks;
  $('sessionTitle').textContent=deck.title;renderTracks();updateWaveforms();syncTransport();
},onChange:()=>syncWorkflow()});
function createDeck(nextTracks,title,{progressive=false,totalFrames,roles}={}) {
  const e=progressive?new ProgressiveMultitrackEngine(getContext()):new MultitrackEngine(getContext());
  e.outputNode.gain.value=.7;
  if(progressive)e.startStream({roles,totalFrames});else e.load(nextTracks);
  const mix=new MultitrackSession(e.tracks),deck={engine:e,session:mix,title};
  const changed=()=>{if(workflow.active===deck){e.sync(mix.tracks);renderTracks();}};
  mix.addEventListener('change',changed);e.addEventListener('statechange',syncTransport);
  const error=event=>report(event.detail);e.addEventListener('player-error',error);
  deck.cleanup=()=>{mix.removeEventListener('change',changed);e.removeEventListener('statechange',syncTransport);e.removeEventListener('player-error',error);};
  e.sync(mix.tracks);return deck;
}
function syncWorkflow() {
  const original=workflow.active===workflow.original;
  $('showOriginal').hidden=!workflow.original||original;
  const canReduce=(session?.tracks.length||0)>1;
  $('toggleMixView').hidden=!canReduce;
  $('toggleMixView').setAttribute('aria-pressed',String(session?.viewMode==='mix'));
  const toggleLabel=session?.viewMode==='mix'?'Afficher les instruments':'Réduire au mix';
  if($('toggleMixView').textContent!==toggleLabel)$('toggleMixView').textContent=toggleLabel;
  $('showSeparated').hidden=!workflow.result||!original||!workflow.available();
  $('showSeparated').textContent=engine?.position>=workflow.available()?'Écouter l’extrait séparé depuis le début':'Écouter les instruments';
  $('playerCancelButton').hidden=!busy;$('playerSeparationState').hidden=!busy;
  const status=!workflow.original?'Importez un morceau ou choisissez un exemple ci-dessus.':original?
    `Original complet · ${workflow.original.engine.duration.toFixed(1)} s${busy?' · séparation en cours ; vous pouvez continuer à écouter.':workflow.available()?' · pistes séparées disponibles.':''}`:
    `${session?.viewMode==='mix'?'Mix courant':'Instruments'} · extrait de 0 à ${workflow.result.engine.duration.toFixed(1)} s sur ${workflow.original.engine.duration.toFixed(1)} s · original conservé.${engine?.progressive&&!engine.complete?' Le calcul continue.':''}`;
  if($('playerWorkflowStatus').textContent!==status)$('playerWorkflowStatus').textContent=status;
}
async function loadOriginal(audio,label) {
  const deck=createDeck([{id:'original',role:'original',label:'Original',buffer:audio}],`${label} · original complet · ${audio.duration.toFixed(1)} s`);
  selectedAudio=audio;workflow.setOriginal(deck);deck.engine.prepare().catch(report);
  $('separationProgress').hidden=true;$('completedTracks').replaceChildren();$('playerSeparationState').textContent='';
  $('progress').textContent='Original prêt à écouter. La séparation traitera le début du fichier.';
}
function progressiveEnabled() { return selectedModel()?.runtime === 'demucs-onnx-core' || selectedModel()?.id === 'htdemucs_6s' && $('progressiveMode').checked; }
function syncBackendOptions() {
  const policy=backendPolicy(selectedModel(),downloads?.capabilities,$('backendSelect').value);
  $('backendSelect').querySelector('[value=webgpu]').disabled=!policy.gpu;
  $('backendSelect').value=policy.backend;
  $('fallbackLabel').hidden=!policy.onnx;
  $('backendStatus').textContent=policy.description;
}
function chooseModel() {
  $('backendSelect').value=backendPolicy(selectedModel(),downloads?.capabilities,'webgpu').backend;
  return refreshModel();
}
function syncProgressiveOptions() {
  $('progressiveMode').disabled = busy || selectedModel()?.id !== 'htdemucs_6s';
  if(selectedModel()?.runtime==='demucs-onnx-core')$('progressiveMode').checked=true;
  for(const option of $('excerptSeconds').options) option.disabled = Number(option.value)>10 && !progressiveEnabled();
  if(!progressiveEnabled() && Number($('excerptSeconds').value)>10) $('excerptSeconds').value='10';
}
function syncTransport() {
  const state = transportState(engine, {busy:false, installing});
  $('playButton').disabled = state.disabled;
  if ($('playButton').textContent !== state.label) $('playButton').textContent = state.label;
  $('activateAudio').hidden = !state.canActivate || (engine?.progressive && !engine.availableFrames);
  $('stopButton').disabled = installing || !engine?.tracks.length;
  $('seek').disabled = state.disabled;
  $('loopToggle').checked=engine?.loop??true;
  const available=engine?(engine.progressive?engine.availableDuration:engine.duration):0;
  for(const id of ['loopA','loopB','loopSetA','loopSetB','loopReset'])$(id).disabled=!available;
  if(engine){
    const bounds=engine.loopBounds;
    for(const [id,key] of [['loopA','start'],['loopB','end']]){if(document.activeElement!==$(id))$(id).value=bounds[key].toFixed(2);$(id).max=available;}
    compactPlayer.setLoopRegion(bounds,engine.loop);
    if(engine.progressive&&!engine.complete&&bounds.end>available)$('loopStatus').textContent='B pas encore disponible · attente des prochains blocs';
    else if($('loopStatus').textContent.startsWith('B pas encore'))$('loopStatus').textContent='Boucle A/B disponible';
  }
  $('transport').setAttribute('aria-busy', String(installing || !!engine?.preparing || !!engine?.starting));
}
function showProgress(data) {
  if(data.phase==='fallback') {
    $('backendStatus').textContent=`WebGPU a échoué : ${data.message}. Repli sur CPU/WASM avec le même modèle ONNX.`;
    separationProgress=new SeparationProgress();
  }
  const value = separationProgress.update(data);
  $('separationProgress').hidden = false;
  $('separationBar').value = value; $('separationPercent').textContent = `${value}%`;
  $('separationPhase').textContent = separationMessage(data);
  $('playerSeparationState').textContent=`${separationMessage(data)} · ${value}%`;
  if (['load','inference','track-complete'].includes(data.phase)) {
    const state = modelLoadIndicator.update(data.phase);
    if (selectedModelState.state !== state) renderSelectedModel({state});
  }
  if (data.phase === 'track-complete') {
    const item = document.createElement('li'); item.textContent = separationMessage(data);
    $('completedTracks').append(item);
  }
}
function selectedModel() { return catalog?.get($('modelSelect').value); }
function syncSeparationButton() {
  const availability = separationEligibility({modelState:selectedModelState.state,audioReady:!!selectedAudio,decoding,busy});
  $('separateButton').disabled = $('playerSeparateButton').disabled = !availability.enabled;
  $('playerSeparateButton').title=availability.reason;
  $('separationHint').textContent = availability.reason;
}
function renderSelectedModel(status) {
  selectedModelState = status;
  const model = selectedModel(), view = describeModelStatus(status, model);
  modelInstalled = view.ready;
  $('selectedModelPanel').dataset.state = status.state;
  $('modelStatus').textContent = view.label;
  $('selectedModelDetail').textContent = view.detail;
  const bar = $('selectedModelBar');
  bar.hidden = !view.pending && !['loading','installed','inference'].includes(status.state);
  if (view.indeterminate) bar.removeAttribute('value'); else bar.value = view.percent;
  $('downloadSelectedModel').disabled = !view.canDownload || busy || !model;
  $('downloadSelectedModel').hidden = view.ready || ['loading','inference'].includes(status.state);
  if (model) $('downloadSelectedModel').textContent = `Télécharger le modèle (${modelSize(model.files.reduce((sum,file)=>sum+file.size,0))})`;
  $('cancelSelectedDownload').hidden = !view.pending || !downloads?.manager.tasks.has(model?.id);
  $('selectedModelLicense').hidden = !model;
  if (model) $('selectedModelLicense').href = new URL(model.license.url, import.meta.url);
  syncSeparationButton();
}
async function refreshModel() {
  const model = selectedModel(); if (!model) return;
  syncBackendOptions();syncProgressiveOptions();
  const changed = modelLoadIndicator.select(`${model.id}:${model.version}`);
  if (!changed && selectedModelState.state === 'installed') { syncSeparationButton(); return; }
  if (changed) {
    separationProgress = new SeparationProgress(); $('separationProgress').hidden = true;
    $('completedTracks').replaceChildren();
  }
  const generation = ++selectionGeneration;
  $('modelDescription').textContent = `${model.description} · ${(model.roles || []).map(role=>labels[role]||role).join(', ')}`;
  $('modelRecommendation').textContent = model.recommendation;
  renderSelectedModel({state:'checking'});
  try {
    const state = await downloads.manager.getStatus(model);
    if (generation !== selectionGeneration) return;
    renderSelectedModel(state);
  } catch (error) { renderSelectedModel({state:'error',message:error.message}); report(error); }
}
async function loadDemo() {
  ++audioGeneration;decoding=false;$('progressiveTest').disabled=$('realMixTest').disabled=false;
  const context = getContext(), rate = 44100, length = rate * 4;
  const roles = ['drums','bass','vocals','guitar'];
  const stems = roles.flatMap((_, index) => {
    const data = Float32Array.from({length}, (_, i) => .07 * Math.sin(2*Math.PI*(110+index*55)*i/rate) * (.3+.7*Math.sin(Math.PI*i/(rate/2))**2));
    return [data, data.slice()];
  });
  const demo=createDeck(makeTracks(context,{roles,stems,sampleRate:rate}),'Démo synthétique · 4 pistes · 4 s');
  selectedAudio=null;workflow.setOriginal(demo);await demo.engine.prepare();syncSeparationButton();
}
function renderTracks() {
  if(!session)return;
  $('zoomValue').textContent=`${Math.round(session.zoom*100)}%`;
  compactPlayer.setSession(session);
}
function renderProgressiveTracks() {updateWaveforms();syncTransport();}
async function separate() {
  if (busy || !selectedAudio || !selectedModel()) return;
  const model = selectedModel(), progressive = progressiveEnabled();
  let candidate,e;
  busy = true;cancelRequested=false;syncSeparationButton(); $('cancelSeparation').disabled = false;
  const cachedBeforeSeparation = modelInstalled;syncBackendOptions();
  for(const id of ['fileInput','modelSelect','useCase','excerptSeconds','loadDemo','testSignal','progressiveTest','realMixTest','progressiveMode','backendSelect','allowCpuFallback']) $(id).disabled=true;
  $('separateButton').disabled = true;
  $('separationHint').textContent = 'Séparation en cours…';
  separationProgress = new SeparationProgress(); showProgress({phase:'cache'}); syncTransport();
  $('completedTracks').replaceChildren();$('backendMetrics').textContent='';syncWorkflow();
  let streamStarted=false;
  try {
    const limit=progressive?60:10;
    const length = Math.min(selectedAudio.length,Math.round(Math.min(limit,Number($('excerptSeconds').value))*44100));
    const channels=[selectedAudio.getChannelData(0).slice(0,length),selectedAudio.getChannelData(Math.min(1,selectedAudio.numberOfChannels-1)).slice(0,length)];
    $('progress').textContent='Préparation du modèle…';
    const onProgress=data=>{showProgress(data);$('progress').textContent=separationMessage(data);};
    let result;
    const title=`${model.id} · ${model.roles.length} pistes · extrait 0–${(length/44100).toFixed(1)} s`;
    if(progressive) {
      candidate=createDeck([],title,{progressive:true,totalFrames:length,roles:model.roles});e=candidate.engine;
      await workflow.begin(candidate);streamStarted=true;
      if(cancelRequested)throw new DOMException('Annulé','AbortError');
      const callbacks={onProgress,onChunk:data=>{
        e.append(data.startFrame,makeTracks(e.context,data));
        if(workflow.active===candidate)renderProgressiveTracks();
        workflow.tryActivate().catch(report);syncWorkflow();
      }};
      result=model.runtime==='demucs-onnx-core'
        ? await onnxRunner.separate(model,channels,{...callbacks,backend:$('backendSelect').value,fallback:$('allowCpuFallback').checked})
        : await progressiveRunner.separate(model,channels,callbacks);
      e.finish();
      if(workflow.active===candidate)renderProgressiveTracks();
    } else {
      result=await runner.separate(model,channels,onProgress);
      showProgress({phase:'audio'});
      candidate=createDeck(makeTracks(getContext(),result),title);e=candidate.engine;
      await workflow.begin(candidate);
    }
    await workflow.tryActivate();syncWorkflow();
    showProgress({phase:'ready'});
    const memory=result.heapBytes?` · mémoire WASM maximale ${(result.heapBytes/1024**3).toFixed(2)} Gio`:'';
    $('progress').textContent=`Terminé en ${(result.elapsedMs/1000).toFixed(1)} s${memory} · ${result.backend==='webgpu'?'WebGPU (pipeline hybride)':'CPU/WASM'}${result.fallbackReason?' — repli CPU après échec GPU':''}`;
    if(result.blocks)$('backendMetrics').textContent=JSON.stringify({backend:result.backend,runtimeVersion:result.runtimeVersion,loadMs:result.loadMs,blocks:result.blocks,adapter:result.adapterInfo},null,2);
  } catch(error){
    if(streamStarted)e.finish(true);
    await workflow.fail().catch(report);syncWorkflow();
    $('separationPhase').textContent = error.name === 'AbortError' ? 'Annulé' : 'Erreur'; report(error);
    if(streamStarted && e.availableFrames) $('progress').textContent+=` Les ${(e.availableDuration).toFixed(1)} s déjà calculées restent écoutables.`;
  } finally {
    busy=false; $('cancelSeparation').disabled=true;syncWorkflow();
    for(const id of ['fileInput','modelSelect','useCase','excerptSeconds','loadDemo','testSignal','progressiveTest','realMixTest','backendSelect','allowCpuFallback']) $(id).disabled=false;
    syncProgressiveOptions();
    const latest = downloads.manager.states.get(model.id);
    renderSelectedModel(latest?.state === 'missing' ? latest : {state:cachedBeforeSeparation ? 'installed' : 'missing'});
    syncTransport();
  }
}
$('fileInput').onchange=async()=>{
  const file=$('fileInput').files[0]; if(!file)return;
  const generation=++audioGeneration;getContext().resume().catch(report);
  decoding = true; $('fileStatus').textContent = `Audio : décodage de ${file.name}…`;
  syncSeparationButton();
  $('separationHint').textContent = 'Décodage du fichier audio en cours…';
  try{
    if(file.size>32*1024*1024)throw Error('Prototype : fichier limité à 32 Mio. Choisissez un extrait court.');
    $('progress').textContent='Décodage à 44,1 kHz…';
    const context=new OfflineAudioContext(2,1,44100);
    const decoded=await context.decodeAudioData(await file.arrayBuffer());if(generation!==audioGeneration)return;
    await loadOriginal(decoded,file.name);decoding = false; $('fileStatus').textContent = `Audio prêt · ${file.name} · ${selectedAudio.duration.toFixed(1)} s`;
    $('progress').textContent=`${file.name} · ${selectedAudio.duration.toFixed(1)} s. Seul le début de l’extrait sera traité.`;
    const preferred=preferredModel(catalog.list(),downloads.capabilities,$('useCase').value);
    if(preferred)$('modelSelect').value=preferred.id;
    await chooseModel();
  }catch(error){if(generation!==audioGeneration)return;decoding=false;$('fileStatus').textContent = `Audio : ${error.message}`;syncSeparationButton();report(error);}
  finally{if(generation===audioGeneration){decoding=false;$('progressiveTest').disabled=$('realMixTest').disabled=false;syncSeparationButton();}}
};
$('modelSelect').onchange=chooseModel;
$('backendSelect').onchange=()=>{syncBackendOptions();syncProgressiveOptions();};
$('downloadSelectedModel').onclick=async()=>{
  const model=selectedModel(); if(!model||busy)return;
  try { await downloads.manager.download(model); } catch(error) { report(error); }
};
$('cancelSelectedDownload').onclick=()=>downloads?.manager.cancel(selectedModel()?.id);
$('testSignal').onclick=async()=>{
  ++audioGeneration;const audio=getContext().createBuffer(2,44100,44100);
  const signal=Float32Array.from({length:44100},(_,i)=>.1*Math.sin(2*Math.PI*220*i/44100));
  audio.copyToChannel(signal,0);audio.copyToChannel(signal,1);await loadOriginal(audio,'Signal 220 Hz');
  decoding=false;$('progressiveTest').disabled=$('realMixTest').disabled=false;$('fileStatus').textContent='Audio prêt · signal de test · 1 s';
  $('progress').textContent='Signal synthétique de validation · 1 s · 220 Hz'; await refreshModel();
};
$('useCase').onchange=()=>{const model=preferredModel(catalog?.list()||[],downloads?.capabilities,$('useCase').value);if(model){$('modelSelect').value=model.id;chooseModel();}};
$('loadDemo').onclick=()=>loadDemo().catch(report);
$('progressiveMode').onchange=syncProgressiveOptions;
$('progressiveTest').onclick=()=>loadExample().catch(report);
$('realMixTest').onclick=()=>loadExample('./fixtures/music/slow-motion-dream.mp3','Slow Motion Dream · mix stéréo CC BY 3.0',10).catch(report);
async function loadExample(path='../assets/audio/CleanChords.mp3',label='CleanChords.mp3',seconds=30){
  const generation=++audioGeneration;getContext().resume().catch(report);
  decoding=true;syncSeparationButton();
  $('progressiveTest').disabled=$('realMixTest').disabled=true;
  try {
  const response=await fetch(new URL(path,import.meta.url));
  if(!response.ok)throw Error('Exemple audio indisponible.');
  const audio=await new OfflineAudioContext(2,1,44100).decodeAudioData(await response.arrayBuffer());
  if(generation!==audioGeneration)return;await loadOriginal(audio,label);decoding=false;$('excerptSeconds').value=String(progressiveEnabled()?seconds:Math.min(10,seconds));
  $('fileStatus').textContent=`Audio prêt · ${label} · ${audio.duration.toFixed(1)} s`;await refreshModel();
  } finally {if(generation===audioGeneration){decoding=false;$('progressiveTest').disabled=$('realMixTest').disabled=false;syncSeparationButton();}}
}
$('separateButton').onclick=$('playerSeparateButton').onclick=separate;
$('cancelSeparation').onclick=$('playerCancelButton').onclick=()=>{cancelRequested=true;runner?.cancel();progressiveRunner?.cancel();onnxRunner?.cancel();};
$('toggleMixView').onclick=()=>{if(session?.tracks.length>1){session.setViewMode(session.viewMode==='mix'?'instruments':'mix');syncWorkflow();}};
$('showOriginal').onclick=()=>workflow.showOriginal().catch(report);
$('showSeparated').onclick=()=>workflow.showResult().catch(report);
$('playButton').onclick=()=>{if(engine?.playing||engine?.waiting)engine.pause();else engine?.play().catch(report);};
$('activateAudio').onclick=()=>engine?.prepare().catch(report);
$('stopButton').onclick=()=>engine?.stop();
function applyLoopRegion(start,end){
  if(!engine)return;
  try{const result=engine.setLoopRegion(Number(start),Number(end));result?.catch(report);$('loopStatus').textContent='Boucle A/B · secondes';}catch(error){$('loopStatus').textContent=error.message;}
}
$('loopToggle').onchange=()=>{const result=engine?.setLoop($('loopToggle').checked);result?.catch(report);};
for(const id of ['loopA','loopB'])$(id).oninput=()=>{if($('loopA').value!==''&&$('loopB').value!=='')applyLoopRegion($('loopA').value,$('loopB').value);};
$('loopSetA').onclick=()=>applyLoopRegion(engine?.position||0,engine?.loopBounds.end||0);
$('loopSetB').onclick=()=>applyLoopRegion(engine?.loopBounds.start||0,engine?.position||0);
$('loopReset').onclick=()=>{engine?.resetLoopRegion()?.catch(report);$('loopStatus').textContent='Boucle sur toute la piste';};
$('seek').oninput=()=>{const result=engine?.seek(Number($('seek').value));result?.catch(report);};
$('zoomIn').onclick=()=>session?.setZoom(session.zoom*2);$('zoomOut').onclick=()=>session?.setZoom(session.zoom/2);$('zoomReset').onclick=()=>session?.resetZoom();
for(const [id,key] of [['backingVolume','volumeDb'],['guitarBalance','mix'],['globalGuitarPan','guitarPan']])$(id).oninput=()=>{getContext();globalMixer.update({[key]:Number($(id).value)});};
$('backingMute').onclick=()=>{getContext();globalMixer.update({muted:!globalMixer.muted});};
$('guitarPreviewLoad').onclick=()=>loadGuitarPreview().catch(report);
$('guitarPreviewPlay').onclick=()=>{if(guitarPreview?.playing)guitarPreview.pause();else guitarPreview?.play().catch(report);};
$('guitarPreviewStop').onclick=()=>guitarPreview?.stop();
for(const id of ['fileInput','loadDemo','testSignal','progressiveTest','realMixTest'])$(id).disabled=false;
let clipUntil=0;
function tick(){
  if(engine){compactPlayer.setPosition(engine.position);$('clock').textContent=`${time(engine.position)} / ${time(engine.duration)}`;$('seek').max=engine.progressive?engine.availableDuration:engine.duration;if(document.activeElement!==$('seek'))$('seek').value=engine.position;}
  $('bufferStatus').hidden=!engine?.progressive;
  if(engine?.progressive) $('bufferStatus').textContent=`Audio prêt : ${engine.availableDuration.toFixed(1)} / ${engine.duration.toFixed(1)} s${engine.waiting?' — mise en tampon, reprise automatique dès le prochain bloc.':engine.complete?(engine.partial?' — calcul interrompu, extrait conservé.':' — calcul terminé.'):' — vous pouvez écouter dès le premier bloc ; le calcul continue.'}`;
  if(globalMixer){const level=globalMixer.readMixLevel?.();if(level){$('globalMixMeter').value=Math.max(-60,Math.min(0,level.db));$('globalMixLevel').textContent=`${level.db.toFixed(1)} dBFS`;if(level.peak>=1)clipUntil=performance.now()+1000;$('globalMixClip').hidden=performance.now()>clipUntil;}}
  if($('guitarPreviewPlay').textContent!==(guitarPreview?.playing?'Pause guitare':'Jouer la guitare'))$('guitarPreviewPlay').textContent=guitarPreview?.playing?'Pause guitare':'Jouer la guitare';
  syncTransport();syncWorkflow();
  requestAnimationFrame(tick);
}
tick();
(async()=>{
  try{
    downloads=await initializeDownloads();
    const response=await fetch(new URL('./models.json',import.meta.url));if(!response.ok)throw Error('Catalogue musical indisponible.');
    const manifest=await response.json();catalog=new ModelCatalog(manifest.models);
    $('modelSelect').replaceChildren(...catalog.list().map(m=>new Option(m.label,m.id)));
    runner=new DemucsRunner({manager:downloads.manager});
    progressiveRunner=new ProgressiveDemucsRunner({manager:downloads.manager});
    onnxRunner=new OnnxDemucsRunner({manager:downloads.manager});
    downloads.manager.addEventListener('progress',event=>{
      if(event.detail.id !== selectedModel()?.id)return;
      ++selectionGeneration; // A live event supersedes an older cache lookup.
      if(!busy)renderSelectedModel(event.detail);
    });
    const preferred=preferredModel(catalog.list(),downloads.capabilities,$('useCase').value);
    if(preferred)$('modelSelect').value=preferred.id;
    await chooseModel();
  }catch(error){$('separationHint').textContent = `Initialisation impossible : ${error.message}`;report(error);}
})();
window.addEventListener('pagehide',()=>{runner?.cancel();progressiveRunner?.cancel();onnxRunner?.cancel();workflow.destroy();guitarPreview?.destroy();globalMixer?.destroy();compactPlayer.destroy();});
