import {WEBNN_BACKENDS,isWebnnBackend,backendLabel} from './WebNNPlayback.js';
import {separationStopState,requestSeparationStop} from './SeparationStopControl.js';
import {createYouTubeImportPanel} from './YouTubeImportClient.js';
import {createModelComparisonPanel,readBenchmarkReport} from './ModelComparisonPanel.js';
import {transportTimeline,seekAvailable,WaveformRefreshGate,ProgressSlider} from './TransportTimeline.js';
import {UiFrameMetrics} from './UiFrameMetrics.js';
import {ModelSelectionTransaction} from './ModelSelectionTransaction.js';
import {PreparedDemucsRunner} from './PreparedDemucsRunner.js';
import {separationFrames,selectedModelLabel} from './SeparationRange.js';
import {exportSnapshot} from './Mp3ExportCore.js';
import {SessionAudioStore} from './SessionAudioStore.js';
import {saveSession,restoreSession,validateSession,applyDeckState,sameSource} from './MultitrackState.js';
import {ModelCatalog} from './ModelCatalog.js';
import {MultitrackSession} from './MultitrackSession.js';
import {MultitrackEngine} from './MultitrackEngine.js';
import {SeparationWorkflow} from './SeparationWorkflow.js';
import {PeakNormalization} from './PeakNormalization.js';
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

export function mountSeparationPlayer(root=document,{audioContext:providedContext,rackOutput=null,initialVolumeDb=0,emptyHint='Importez un morceau ou choisissez un exemple ci-dessus.',onConfigure=null,onSourceChange=()=>{},onSeparated=()=>{},onProjectChange=()=>{},onError=()=>{},onUpdate=()=>{},mixerFactory=null,storageKey='nam-multitrack-prototype.v2',audioStore=new SessionAudioStore()}={}) {
const $ = id => root.getElementById(id);
const activeElement=()=>root.activeElement||document.activeElement;
let destroyed=false,frame,source=null,pendingRestore=null,pendingLegacy=null,restoring=false;
const ensureIdle=()=>{if(busy||decoding||restoring)throw Error('Attendez la fin de l’opération en cours.');};
const labels = {drums:'Batterie', bass:'Basse', other:'Autres', vocals:'Voix', guitar:'Guitare', piano:'Piano'};
let previewRunner,comparisonPanel;
let catalog, session, engine, runner, progressiveRunner, onnxRunner, downloads, tracks = [], selectedAudio = null, busy = false;
let selectionGeneration = 0, audioGeneration = 0, audioContext, globalMixer, guitarPreview;
let installing = false, modelInstalled = false, cancelRequested=false;
let selectedModelState = {state:'checking'}, decoding = false;
const modelSettings=new ModelSelectionTransaction();
let separationProgress = new SeparationProgress();
const modelLoadIndicator = new ModelLoadIndicator();
const time = seconds => `${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
const report = error => { $('progress').textContent = error.name === 'AbortError' ? 'Séparation annulée.' : error.message;onError(error); };
const compactPlayer = new CompactMultitrackView($('tracks'), {
  createRenderer: options => new Renderer(options), labels,
  onChange: () => {}, onError: report,
  onLoopChange: bounds=>applyLoopRegion(bounds.start,bounds.end),
  onSeek: seconds => {const result=engine?.seek(seconds);result?.catch(report);},
});
const waveformRefresh=new WaveformRefreshGate(),progressSlider=new ProgressSlider($('seek'));
function updateWaveforms(){if(uiMetrics)return uiMetrics.measure('waveformPublication',updateWaveformsNow);return updateWaveformsNow();}
function updateWaveformsNow() {
  waveformRefresh.rendered(performance.now());
  if(!engine||!session)return;
  compactPlayer.setAudio({tracks:engine.tracks,chunks:engine.progressive?engine.chunks:undefined,
    totalFrames:engine.progressive?engine.totalFrames:tracks[0]?.buffer.length,
    duration:engine.duration,outputGain:effectiveBackingGain(),availableDuration:engine.progressive?engine.availableDuration:engine.duration});
}
function getContext(){
  if(!audioContext){
    audioContext=providedContext||new AudioContext({sampleRate:44100});globalMixer=mixerFactory?mixerFactory(audioContext):new SeparationMixer(audioContext,rackOutput?{guitarSource:rackOutput}:{});
    workflow.destination=globalMixer.backingInput;globalMixer.update({volumeDb:initialVolumeDb});
    globalMixer.addEventListener('change',()=>{projectChanged();syncGlobalMix();compactPlayer.setOutputGain(effectiveBackingGain());});
    syncGlobalMix();
  }
  return audioContext;
}
function effectiveBackingGain(){return (engine?.outputNode.gain.value??.7)*(engine?.normalizationGain??1)*(globalMixer?.backingWaveformGain()??1);}
function syncGlobalMix(){
  const state=globalMixer?.getState()||{volumeDb:0,muted:false,mix:.5,guitarPan:0};
  for(const [id,key] of [['backingVolume','volumeDb'],['guitarBalance','mix'],['globalGuitarPan','guitarPan']])if(activeElement()!==$(id))$(id).value=state[key];
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
const workflow=new SeparationWorkflow({canAutoSwitch:()=>!activeElement()?.closest('.compact-track-controls'),onActivate:deck=>{
  engine=deck.engine;globalMixer?.setActiveEngine(engine);session=deck.session;tracks=engine.tracks;
  $('sessionTitle').textContent=deck.title;renderTracks();updateWaveforms();syncTransport();
},onChange:()=>syncWorkflow()});
function projectChanged(){if(!restoring&&workflow.original){$('sessionStatus').textContent='Projet non enregistré · audio en RAM.';onProjectChange();}}
function createDeck(nextTracks,title,{progressive=false,totalFrames,roles}={}) {
  const e=progressive?new ProgressiveMultitrackEngine(getContext(),{lookAheadSeconds:new URLSearchParams(globalThis.location?.search).get('uiMetrics')==='1'&&new URLSearchParams(globalThis.location?.search).get('audioSchedule')==='all'?Infinity:8}):new MultitrackEngine(getContext());
  e.outputNode.gain.value=.7;
  if(progressive)e.startStream({roles,totalFrames});else e.load(nextTracks);
  const mix=new MultitrackSession(e.tracks),deck={engine:e,session:mix,title};
  deck.normalization=new PeakNormalization(e,mix);
  const normalized=()=>{projectChanged();if(workflow.active===deck){syncNormalization();compactPlayer.setOutputGain(effectiveBackingGain());}};
  deck.normalization.addEventListener('change',normalized);
  const changed=()=>{projectChanged();if(workflow.active===deck){e.sync(mix.tracks);renderTracks();}};
  mix.addEventListener('change',changed);e.addEventListener('statechange',syncTransport);
  const error=event=>report(event.detail);e.addEventListener('player-error',error);
  deck.cleanup=()=>{deck.normalization.removeEventListener('change',normalized);deck.normalization.destroy();mix.removeEventListener('change',changed);e.removeEventListener('statechange',syncTransport);e.removeEventListener('player-error',error);};
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
  const stopState=separationStopState(busy,cancelRequested);
  $('playerCancelButton').hidden=false;$('playerCancelButton').disabled=stopState.disabled;if($('playerCancelButton').textContent!==stopState.label)$('playerCancelButton').textContent=stopState.label;
  $('cancelSeparation').disabled=stopState.disabled;$('playerSeparationState').hidden=!busy;
  const resultRange=workflow.result&&Math.abs(workflow.result.engine.duration-workflow.original.engine.duration)<1/44100?'morceau entier':`extrait de 0 à ${workflow.result?.engine.duration.toFixed(1)} s sur ${workflow.original?.engine.duration.toFixed(1)} s`;
  const status=!workflow.original?emptyHint:original?
    `Original complet · ${workflow.original.engine.duration.toFixed(1)} s${busy?' · séparation en cours ; vous pouvez continuer à écouter.':workflow.available()?' · pistes séparées disponibles.':''}`:
    `${session?.viewMode==='mix'?'Mix courant':'Instruments'} · ${resultRange} · original conservé.${engine?.progressive&&!engine.complete?(busy?' Le calcul continue.':!engine.availableFrames?' En attente d’une nouvelle séparation.':''):''}`;
  const workflowStatus=!busy&&cancelRequested?'Séparation arrêtée. Original conservé'+(workflow.available()?' ; les pistes déjà calculées restent accessibles avec Écouter les instruments.':'.'):status;
  if($('playerWorkflowStatus').textContent!==workflowStatus)$('playerWorkflowStatus').textContent=workflowStatus;
}
async function loadOriginal(audio,label,nextSource={kind:'example',name:label}) {
  cancelRequested=false;
  $('excerptSeconds').value='0';
  source=nextSource;onSourceChange(source);$('fileStatus').textContent=`Audio prêt · ${label} · ${audio.duration.toFixed(1)} s`;
  const deck=createDeck([{id:'original',role:'original',label:'Original',buffer:audio}],`${label} · original complet · ${audio.duration.toFixed(1)} s`);
  selectedAudio=audio;workflow.setOriginal(deck);projectChanged();deck.engine.prepare().catch(report);
  $('separationProgress').hidden=true;$('completedTracks').replaceChildren();$('playerSeparationState').textContent='';
  $('progress').textContent='Original prêt à écouter. La séparation traitera le début du fichier.';
  if(pendingLegacy&&source.kind==='file'&&pendingLegacy.track.id==='local:'+encodeURIComponent(source.name)+':'+source.size+':'+source.lastModified){const legacy=pendingLegacy;pendingLegacy=null;await restoreLegacy(legacy);}
  if(pendingRestore&&sameSource(pendingRestore.source,source)){
    const state=pendingRestore;await applyDeckState(deck,state.original);globalMixer.update(state.global);pendingRestore=null;
    $('sessionStatus').textContent='Réglages de l’original restaurés en pause. Relancez la séparation pour recréer les instruments manquants.';
  }
}
const needsPreparation=model=>model?.profile==='preview'||model?.runtime==='bs-roformer-onnx'||isWebnnBackend($('backendSelect').value);
const isOnnx=model=>['demucs-onnx-core','bs-roformer-onnx'].includes(model?.runtime);
function progressiveEnabled() { return isOnnx(selectedModel()) || selectedModel()?.id === 'htdemucs_6s' && $('progressiveMode').checked; }
function syncBackendOptions() {
  const policy=backendPolicy(selectedModel(),downloads?.capabilities,$('backendSelect').value);
  $('backendSelect').querySelector('[value=webgpu]').disabled=!policy.gpu;
  for(const backend of WEBNN_BACKENDS)$('backendSelect').querySelector(`[value=${backend}]`).disabled=!policy.webnn;
  $('backendSelect').value=policy.backend;
  $('fallbackLabel').hidden=!policy.onnx;
  $('backendStatus').textContent=policy.description+(policy.onnx&&!downloads?.capabilities?.webnn?' WebNN absent dans ce navigateur ; utilisez un navigateur avec WebNN activé pour ces options expérimentales.':'');
  if($('activeModelSummary'))$('activeModelSummary').textContent=selectedModelLabel(selectedModel(),policy.backend)+(needsPreparation(selectedModel())?` · ${previewRunner?.isPrepared(selectedModel(),policy.backend)?'prêt en mémoire':previewRunner?.isPreparing(selectedModel(),policy.backend)?'préparation en mémoire…':describeModelStatus(selectedModelState,selectedModel()).label}`:'');
}
function chooseModel(options) {
  $('backendSelect').value=backendPolicy(selectedModel(),downloads?.capabilities,'webgpu').backend;
  return refreshModel(options);
}
function syncProgressiveOptions() {
  $('progressiveMode').disabled = busy || selectedModel()?.id !== 'htdemucs_6s';
  if(isOnnx(selectedModel()))$('progressiveMode').checked=true;

}
function syncNormalization(){
  const n=workflow.active?.normalization;
  $('normalizeButton').disabled=!n?.available||restoring;
  $('normalizeButton').textContent=n?.busy?'Annuler l’analyse':'Normaliser le mix';
  $('normalizationEnabled').disabled=!n?.result||n.result.silent;
  $('normalizationEnabled').checked=!!n?.enabled;
  $('normalizationReset').disabled=!n?.busy&&!n?.result;
  $('normalizationTarget').disabled=!!n?.busy;
  if(activeElement()!==$('normalizationTarget'))$('normalizationTarget').value=String(n?.targetDb??-1);
  $('normalizationControls').setAttribute('aria-busy',String(!!n?.busy));
  let text=!n?'Chargez un morceau.':!n.available?'Disponible après la fin de la séparation.':'Pic du mix complet · avant volume global et balance guitare.';
  if(n?.busy)text='Analyse du mix stéréo…';
  else if(n?.status==='stale')text='Mix modifié · relancez Normaliser le mix.';
  else if(n?.status==='error')text='Analyse impossible · vous pouvez réessayer.';
  else if(n?.result){const r=n.result;text=r.silent?'Mix silencieux · aucun gain ajouté.':`${n.enabled?'Actif':'Désactivé'} · ${r.gainDb>=0?'+':''}${r.gainDb.toFixed(1)} dB · pic mesuré ${(20*Math.log10(r.peak)).toFixed(1)} dBFS · cible ${r.targetDb} dBFS${r.limited?' · amplification limitée à +24 dB':''}`;}
  if($('normalizationStatus').textContent!==text)$('normalizationStatus').textContent=text;
}
function syncTransport() {
  syncNormalization();
  const state = transportState(engine, {busy:false, installing});
  $('saveSession').disabled=!workflow.original||busy||restoring;
  $('playButton').disabled = state.disabled||restoring;
  if ($('playButton').textContent !== state.label) $('playButton').textContent = state.label;
  $('activateAudio').hidden = !state.canActivate || (engine?.progressive && !engine.availableFrames);
  $('stopButton').disabled = installing || !engine?.tracks.length;
  $('seek').disabled = state.disabled;
  $('loopToggle').checked=engine?.loop??true;
  const available=engine?(engine.progressive?engine.availableDuration:engine.duration):0;
  for(const id of ['loopA','loopB','loopSetA','loopSetB','loopReset'])$(id).disabled=!available;
  if(engine){
    const bounds=engine.loopBounds;
    for(const [id,key] of [['loopA','start'],['loopB','end']]){if(activeElement()!==$(id))$(id).value=bounds[key].toFixed(2);$(id).max=available;}
    compactPlayer.setLoopRegion(bounds,engine.loop);
    if(engine.progressive&&!engine.complete&&bounds.end>available)$('loopStatus').textContent=busy?'B pas encore disponible · attente des prochains blocs':'En attente d’une nouvelle séparation';
    else if($('loopStatus').textContent.startsWith('B pas encore'))$('loopStatus').textContent='Boucle A/B disponible';
  }
  $('transport').setAttribute('aria-busy', String(installing || !!engine?.preparing || !!engine?.starting));
}
function showProgress(data) {
  if(data.phase==='fallback') {
    $('backendSelect').value='wasm';
    if($('activeModelSummary'))$('activeModelSummary').textContent=selectedModelLabel(selectedModel(),'wasm')+' · repli CPU';
    $('backendStatus').textContent=`Le moteur accéléré a échoué : ${data.message}. Repli sur CPU/WASM avec le même modèle ONNX.`;
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
function selectedModel() { return catalog?.get(modelSettings.draft?.modelId||$('modelSelect').value); }
function syncSeparationButton() {
  const availability = separationEligibility({modelState:selectedModelState.state,audioReady:!!selectedAudio,decoding,busy:busy||restoring});
  $('separateButton').disabled=!availability.enabled;
  $('playerSeparateButton').disabled=onConfigure?(!selectedAudio||decoding||busy||restoring):!availability.enabled;
  $('playerSeparateButton').title=availability.reason;
  $('separationHint').textContent = availability.reason;
}
function renderSelectedModel(status) {
  const model = selectedModel();
  if(needsPreparation(model)&&status.state==='installed'&&previewRunner?.isPrepared(model,$('backendSelect').value))status={...status,message:`${model.roles.length} sources prêtes en mémoire · publication par blocs. Le délai réel dépend de la machine.`};
  selectedModelState = status;
  const view = describeModelStatus(status, model);
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
  if($('activeModelSummary'))$('activeModelSummary').textContent=selectedModelLabel(model,$('backendSelect').value)+(needsPreparation(model)?` · ${status.state==='installed'?(previewRunner?.isPrepared(model,$('backendSelect').value)?'prêt en mémoire':'en cache · préparation au prochain lancement'):view.label}`:'');
}
async function refreshModel({backgroundPreparation=false}={}) {
  const model = selectedModel(); if (!model) return;
  syncBackendOptions();syncProgressiveOptions();
  if(needsPreparation(model)&&previewRunner.isPreparing(model,$('backendSelect').value)){syncSeparationButton();return;}
  const changed = modelLoadIndicator.select(`${model.id}:${model.version}:${$('backendSelect').value}`);
  if(changed)previewRunner?.cancel();
  if (!changed && selectedModelState.state === 'installed' && (!needsPreparation(model)||previewRunner.isPrepared(model,$('backendSelect').value))) { syncSeparationButton(); return; }
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
    if(needsPreparation(model)&&state.state==='installed'){
      const preparation=prepareSelectedModel(model,generation);
      if(backgroundPreparation)preparation.catch(error=>{if(generation!==selectionGeneration||destroyed)return;renderSelectedModel({state:'error',message:error.message});report(error);});
      else await preparation;
    }
  } catch (error) { if(generation!==selectionGeneration||destroyed)return;renderSelectedModel({state:'error',message:error.message}); report(error); }
}
async function prepareSelectedModel(model,generation=selectionGeneration) {
  const backend=$('backendSelect').value;
  if(previewRunner.isPrepared(model,backend))return;
  renderSelectedModel({state:'loading',message:'Préparation du modèle · compilation puis préchauffage sur silence…'});
  try {
    await previewRunner.prepare(model,backend,{onProgress:({completed,total})=>{
      if(generation!==selectionGeneration||destroyed)return;
      renderSelectedModel({state:'loading',message:completed===total?'Étapes GPU compilées · préchauffage sur silence…':`Compilation GPU · étape ${completed}/${total}…`});
    }});
    if(generation!==selectionGeneration||destroyed)return;
    renderSelectedModel({state:'installed',message:`${model.roles.length} sources prêtes en mémoire · publication par blocs. Le délai réel dépend de la machine.`});
  }catch(error){
    if(generation!==selectionGeneration||destroyed)return;
    if((backend==='webgpu'||isWebnnBackend(backend))&&$('allowCpuFallback').checked&&error.name!=='AbortError'){
      $('backendSelect').value='wasm';syncBackendOptions();
      await previewRunner.prepare(model,'wasm');
      if(generation===selectionGeneration&&!destroyed)renderSelectedModel({state:'installed',message:'Modèle prêt sur CPU/WASM · repli après échec du moteur accéléré. Lecture rapide non garantie.'});
    }else throw error;
  }
}
async function loadDemo() {
  ensureIdle();
  ++audioGeneration;cancelRequested=false;decoding=false;$('progressiveTest').disabled=$('realMixTest').disabled=false;
  const context = getContext(), rate = 44100, length = rate * 4;
  const roles = ['drums','bass','vocals','guitar'];
  const stems = roles.flatMap((_, index) => {
    const data = Float32Array.from({length}, (_, i) => .07 * Math.sin(2*Math.PI*(110+index*55)*i/rate) * (.3+.7*Math.sin(Math.PI*i/(rate/2))**2));
    return [data, data.slice()];
  });
  const demo=createDeck(makeTracks(context,{roles,stems,sampleRate:rate}),'Démo synthétique · 4 pistes · 4 s');
  source={kind:'demo',name:'Démo synthétique'};onSourceChange(source);selectedAudio=null;workflow.setOriginal(demo);await demo.engine.prepare();syncSeparationButton();
}
function renderTracks() {
  if(!session)return;
  $('zoomValue').textContent=`${Math.round(session.zoom*100)}%`;
  compactPlayer.setSession(session);
}
function renderProgressiveTracks() {waveformRefresh.request();}
async function separate() {
  const runToken=modelSettings.token();
  if (busy || restoring || !selectedAudio || !selectedModel()) return;
  const model = selectedModel(), progressive = progressiveEnabled(), segmentSeconds=0;
  let candidate,e,completed=false;const startedAt=performance.now();let firstReadyMs=null;
  busy = true;projectChanged();cancelRequested=false;syncSeparationButton(); $('cancelSeparation').disabled = false;
  const cachedBeforeSeparation = modelInstalled;syncBackendOptions();
  for(const id of ['fileInput','modelSelect','useCase','excerptSeconds','loadDemo','testSignal','progressiveTest','realMixTest','progressiveMode','backendSelect','allowCpuFallback']) $(id).disabled=true;
  $('separateButton').disabled = true;
  $('separationHint').textContent = 'Séparation en cours…';
  separationProgress = new SeparationProgress(); showProgress({phase:'cache'}); syncTransport();
  $('completedTracks').replaceChildren();$('backendMetrics').textContent='';syncWorkflow();
  let streamStarted=false;
  try {
    if(needsPreparation(model)&&!previewRunner.isPrepared(model,$('backendSelect').value))await prepareSelectedModel(model);
    if(cancelRequested)throw new DOMException('Annulé','AbortError');
    const length = separationFrames(selectedAudio.length,$('excerptSeconds').value);
    const channels=[selectedAudio.getChannelData(0).slice(0,length),selectedAudio.getChannelData(Math.min(1,selectedAudio.numberOfChannels-1)).slice(0,length)];
    $('progress').textContent='Préparation du modèle…';
    const onProgress=data=>{if(cancelRequested||!modelSettings.current(runToken))return;showProgress(data);$('progress').textContent=separationMessage(data);};
    let result;
    const title=`${model.id} · ${model.roles.length} pistes · extrait 0–${(length/44100).toFixed(1)} s`;
    if(progressive) {
      candidate=createDeck([],title,{progressive:true,totalFrames:length,roles:model.roles});e=candidate.engine;
      candidate.renderInfo={modelId:model.id,profile:model.profile||'quality',neuralFrames:model.frames||(isOnnx(model)?343980:null),backend:$('backendSelect').value};
      await workflow.begin(candidate);streamStarted=true;
      if(cancelRequested||!modelSettings.current(runToken))throw new DOMException('Annulé','AbortError');
      const callbacks={segmentSeconds,onProgress,diagnostics:!!uiMetrics,onDiagnostic:data=>{if(modelSettings.current(runToken))uiMetrics?.worker(data);},onChunk:data=>{
        if(cancelRequested||!modelSettings.current(runToken))return;
        transportMode=data.transportMode||'legacy-transfer';
        $('tracks').dataset.transport=transportMode;
        const publish=()=>e.append(data.startFrame,makeTracks(e.context,data));
        if(uiMetrics)uiMetrics.measure('audioPublication',publish);else publish();
        if(firstReadyMs===null)firstReadyMs=performance.now()-startedAt;
        if(workflow.active===candidate)renderProgressiveTracks();
        workflow.tryActivate().catch(report);syncWorkflow();
      }};
      result=isOnnx(model)
        ? await (needsPreparation(model)?previewRunner:onnxRunner).separate(model,channels,{...callbacks,backend:$('backendSelect').value,fallback:$('allowCpuFallback').checked})
        : await progressiveRunner.separate(model,channels,callbacks);
      if(!modelSettings.current(runToken))return;
      if(cancelRequested)throw new DOMException('Annulé','AbortError');
      candidate.renderInfo.backend=result.backend||'wasm';e.finish();
      if(workflow.active===candidate){updateWaveforms();syncTransport();}
    } else {
      result=await runner.separate(model,channels,onProgress,{segmentSeconds});
      if(!modelSettings.current(runToken))return;
      if(cancelRequested)throw new DOMException('Annulé','AbortError');
      showProgress({phase:'audio'});
      candidate=createDeck(makeTracks(getContext(),result),title);e=candidate.engine;
      candidate.renderInfo={modelId:model.id,profile:model.profile||'quality',neuralFrames:null,backend:result.backend||'wasm'};
      await workflow.begin(candidate);
    }
    if(!modelSettings.current(runToken))return;
    await workflow.tryActivate();
    if(!modelSettings.current(runToken))return;
    syncWorkflow();
    completed=true;showProgress({phase:'ready'});
    const memory=result.heapBytes?` · mémoire WASM maximale ${(result.heapBytes/1024**3).toFixed(2)} Gio`:'';
    $('progress').textContent=`Terminé en ${(result.elapsedMs/1000).toFixed(1)} s${memory} · ${backendLabel(result.backend)}${result.fallbackReason?' — repli CPU/WASM après échec du moteur accéléré':''}`;
    if(result.blocks)$('backendMetrics').textContent=JSON.stringify({profile:model.profile||'quality',firstReadyMs,backend:result.backend,runtimeVersion:result.runtimeVersion,loadMs:result.loadMs,blocks:result.blocks,adapter:result.adapterInfo,...(isWebnnBackend(result.backend)?{requestedDevice:result.requestedDevice,effectiveHardware:result.effectiveHardware,webnnDispatches:result.webnnDispatches,wasmFallbackCoverage:result.wasmFallbackCoverage}:{})},null,2);
  } catch(error){
    if(!modelSettings.current(runToken))return;
    if(streamStarted)e.finish(true);
    await workflow.fail().catch(report);syncWorkflow();
    if(error.name==='AbortError'){
      $('separationPhase').textContent='Séparation arrêtée';$('progress').textContent='Séparation arrêtée. Le morceau original est conservé.';
      $('playerWorkflowStatus').setAttribute('aria-live','polite');
    }else{$('separationPhase').textContent='Erreur';report(error);}
    if(streamStarted && e.availableFrames) $('progress').textContent+=` Les ${(e.availableDuration).toFixed(1)} s déjà calculées restent écoutables.`;
  } finally {
    if(modelSettings.current(runToken)){
    busy=false; $('cancelSeparation').disabled=true;syncWorkflow();
    if(completed)Promise.resolve(onSeparated()).catch(report);
    for(const id of ['fileInput','modelSelect','useCase','excerptSeconds','loadDemo','testSignal','progressiveTest','realMixTest','backendSelect','allowCpuFallback']) $(id).disabled=false;
    syncProgressiveOptions();
    const latest = downloads.manager.states.get(model.id);
    renderSelectedModel(latest?.state === 'missing' ? latest : {state:cachedBeforeSeparation ? 'installed' : 'missing'});
    syncTransport();
    if(!cancelRequested&&!modelSettings.draft&&needsPreparation(model)&&!previewRunner.isPrepared(model,$('backendSelect').value))await refreshModel();
    }
  }
}
async function loadFile(file,provenance=null,signal=null){
  if(restoring||busy){report(Error('Attendez la fin de l’opération en cours.'));return;}
  if(!file)return;
  if(!provenance)youtubeImport.cancel();
  const generation=++audioGeneration;getContext().resume().catch(report);
  decoding = true; $('fileStatus').textContent = `Audio : décodage de ${file.name}…`;
  syncSeparationButton();
  $('separationHint').textContent = 'Décodage du fichier audio en cours…';
  try{
    if(file.size>512*1024*1024)throw Error('Fichier limité à 512 Mio.');
    $('progress').textContent='Décodage à 44,1 kHz…';
    const context=new OfflineAudioContext(2,1,44100);
    const decoded=await context.decodeAudioData(await file.arrayBuffer());if(generation!==audioGeneration||signal?.aborted)return false;
    await loadOriginal(decoded,file.name,{kind:'file',name:file.name,size:file.size,lastModified:file.lastModified,...(provenance?{provenance}: {})});decoding = false; $('fileStatus').textContent = `Audio prêt · ${file.name} · ${selectedAudio.duration.toFixed(1)} s`;
    $('progress').textContent=`${file.name} · ${selectedAudio.duration.toFixed(1)} s. La durée à traiter se choisit dans le menu Durée à séparer.`;
    if(provenance){refreshModel().catch(report);return true;}
    await refreshModel();return true;
  }catch(error){if(generation!==audioGeneration)return false;decoding=false;$('fileStatus').textContent = `Audio : ${error.message}`;syncSeparationButton();report(error);if(provenance)throw error;}
  finally{if(generation===audioGeneration){decoding=false;$('progressiveTest').disabled=$('realMixTest').disabled=false;syncSeparationButton();}}
}
let youtubeImportGeneration;
const youtubeImport=createYouTubeImportPanel({onBegin:()=>{youtubeImportGeneration=audioGeneration;},isBusy:()=>busy||restoring||decoding,onImport:async({blob,metadata},signal)=>{
  if(youtubeImportGeneration!==audioGeneration||busy||restoring||decoding)throw Error('Une autre opération a commencé ; importez à nouveau après sa fin.');
  const file=new File([blob],`${metadata.name}.${metadata.extension}`,{type:blob.type,lastModified:Date.now()});
  const loaded=await loadFile(file,metadata,signal);if(!loaded)throw new DOMException('Import remplacé ou annulé','AbortError');
}});
($('youtubeImportSlot')||$('fileInput').closest('label').parentElement).append(youtubeImport.element);
$('fileInput').onchange=()=>{const file=$('fileInput').files[0];$('fileInput').value='';return loadFile(file);};
$('modelSelect').onchange=()=>{if(!modelSettings.draft)return chooseModel();const policy=backendPolicy(selectedModel(),downloads?.capabilities,$('backendSelect').value);$('backendSelect').querySelector('[value=webgpu]').disabled=!policy.gpu;for(const backend of WEBNN_BACKENDS)$('backendSelect').querySelector(`[value=${backend}]`).disabled=!policy.webnn;};
$('backendSelect').onchange=()=>{if(!modelSettings.draft)return refreshModel();};
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
$('useCase').onchange=()=>{const local=readBenchmarkReport();const model=preferredModel(catalog?.list()||[],downloads?.capabilities,$('useCase').value,local?{report:local}:{});if(model){$('modelSelect').value=model.id;if(!modelSettings.draft)chooseModel();}};
$('loadDemo').onclick=()=>loadDemo().catch(report);
$('progressiveMode').onchange=syncProgressiveOptions;
$('progressiveTest').onclick=()=>loadExample().catch(report);
$('realMixTest').onclick=()=>loadExample('./fixtures/music/slow-motion-dream.mp3','Slow Motion Dream · mix stéréo CC BY 3.0',10).catch(report);
async function loadExample(path='../assets/audio/CleanChords.mp3',label='CleanChords.mp3',seconds=30){
  ensureIdle();
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
$('separateButton').onclick=separate;
$('playerSeparateButton').onclick=()=>{onConfigure?.();if(modelInstalled)separate();};
$('cancelSeparation').onclick=$('playerCancelButton').onclick=()=>requestSeparationStop({busy,requested:cancelRequested,runners:[runner,progressiveRunner,onnxRunner,previewRunner],onRequest:()=>{cancelRequested=true;syncWorkflow();$('playerSeparationState').textContent='Arrêt du calcul en cours…';}});
$('toggleMixView').onclick=()=>{if(session?.tracks.length>1){session.setViewMode(session.viewMode==='mix'?'instruments':'mix');syncWorkflow();}};
$('showOriginal').onclick=()=>workflow.showOriginal().then(projectChanged).catch(report);
$('showSeparated').onclick=()=>workflow.showResult().then(projectChanged).catch(report);
$('playButton').onclick=()=>{if(engine?.playing||engine?.waiting)engine.pause();else engine?.play().catch(report);};
$('activateAudio').onclick=()=>engine?.prepare().catch(report);
$('stopButton').onclick=()=>engine?.stop();
function applyLoopRegion(start,end){
  if(!engine)return;
  try{const result=engine.setLoopRegion(Number(start),Number(end));result?.catch(report);$('loopStatus').textContent='Boucle A/B · secondes';projectChanged();}catch(error){$('loopStatus').textContent=error.message;}
}
$('normalizeButton').onclick=()=>{const n=workflow.active?.normalization;if(n?.busy)n.reset();else n?.analyze({targetDb:Number($('normalizationTarget').value)}).catch(report);};
$('normalizationEnabled').onchange=()=>workflow.active?.normalization.setEnabled($('normalizationEnabled').checked);
$('normalizationReset').onclick=()=>workflow.active?.normalization.reset();
$('normalizationTarget').onchange=()=>workflow.active?.normalization.setTargetDb(Number($('normalizationTarget').value));
$('loopToggle').onchange=()=>{const result=engine?.setLoop($('loopToggle').checked);result?.catch(report);projectChanged();};
for(const id of ['loopA','loopB'])$(id).oninput=()=>{if($('loopA').value!==''&&$('loopB').value!=='')applyLoopRegion($('loopA').value,$('loopB').value);};
$('loopSetA').onclick=()=>applyLoopRegion(engine?.position||0,engine?.loopBounds.end||0);
$('loopSetB').onclick=()=>applyLoopRegion(engine?.loopBounds.start||0,engine?.position||0);
$('loopReset').onclick=()=>{engine?.resetLoopRegion()?.catch(report);$('loopStatus').textContent='Boucle sur toute la piste';projectChanged();};
$('seek').oninput=()=>{if(!engine)return;const seconds=seekAvailable(engine,$('seek').value);const result=engine.seek(seconds);$('seek').value=String(seconds);result?.catch(report);};
$('zoomIn').onclick=()=>session?.setZoom(session.zoom*2);$('zoomOut').onclick=()=>session?.setZoom(session.zoom/2);$('zoomReset').onclick=()=>session?.resetZoom();
for(const [id,key] of [['backingVolume','volumeDb'],['guitarBalance','mix'],['globalGuitarPan','guitarPan']])$(id).oninput=()=>{getContext();globalMixer.update({[key]:Number($(id).value)});};
$('backingMute').onclick=()=>{getContext();globalMixer.update({muted:!globalMixer.muted});};
$('guitarPreviewLoad').onclick=()=>loadGuitarPreview().catch(report);
$('guitarPreviewPlay').onclick=()=>{if(guitarPreview?.playing)guitarPreview.pause();else guitarPreview?.play().catch(report);};
$('guitarPreviewStop').onclick=()=>guitarPreview?.stop();
for(const id of ['fileInput','loadDemo','testSignal','progressiveTest','realMixTest'])$(id).disabled=false;
let clipUntil=0,lastUiSync=-Infinity,transportMode='idle',metricsAt=0;
const uiMetrics=new URLSearchParams(globalThis.location?.search).get('uiMetrics')==='1'?new UiFrameMetrics():null;
let metricsOutput,metricsObserver,metricsTimer,animationObserver;const metricsVisibility=()=>{if(uiMetrics){uiMetrics.last=null;uiMetrics.lastTask=null;}};
if(uiMetrics){
  document.addEventListener('visibilitychange',metricsVisibility);
  metricsTimer=setInterval(()=>uiMetrics.heartbeat(performance.now(),!document.hidden),50);
  const details=document.createElement('details'),caption=document.createElement('summary'),reset=document.createElement('button');
  caption.textContent='UI performance';details.append(caption);reset.textContent='Reset UI metrics';reset.type='button';reset.onclick=()=>uiMetrics.reset();
  metricsOutput=document.createElement('pre');metricsOutput.id='uiFrameMetrics';details.append(reset,metricsOutput);$('backendMetrics').parentElement.append(details);
  if(globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')){metricsObserver=new PerformanceObserver(list=>{for(const task of list.getEntries())uiMetrics.longTask(task.duration);});metricsObserver.observe({type:'longtask',buffered:false});}
  if(globalThis.PerformanceObserver?.supportedEntryTypes?.includes('long-animation-frame')){animationObserver=new PerformanceObserver(list=>{for(const entry of list.getEntries())uiMetrics.animationFrame(entry);});animationObserver.observe({type:'long-animation-frame',buffered:false});}
}

function tick(){
  if(destroyed)return;
  const now=performance.now();uiMetrics?.frame(now,!document.hidden);
  if(uiMetrics&&now-metricsAt>=1000){metricsAt=now;metricsOutput.textContent=JSON.stringify({...uiMetrics.summary(),transportMode,isolated:globalThis.crossOriginIsolated===true,availableSeconds:engine?.availableDuration||0,position:engine?.position||0,timeOrigin:performance.timeOrigin,workerPhaseTracing:selectedModel()?.runtime==='bs-roformer-onnx',longAnimationFrameSupported:globalThis.PerformanceObserver?.supportedEntryTypes?.includes('long-animation-frame')||false,scheduledVoices:engine?.voices.length||0,audioLookAheadSeconds:engine?.progressive?(Number.isFinite(engine.lookAheadSeconds)?engine.lookAheadSeconds:'all'):null,busy},null,2);}
  if(engine){
    const {position,duration}=transportTimeline(engine);compactPlayer.setPosition(position);
    const clock=`${time(position)} / ${time(engine.duration)}`;if($('clock').textContent!==clock)$('clock').textContent=clock;
    progressSlider.update({duration,position});
  }
  if(globalMixer){const level=globalMixer.readMixLevel?.();if(level){$('globalMixMeter').value=Math.max(-60,Math.min(0,level.db));if(now-lastUiSync>=100)$('globalMixLevel').textContent=`${level.db.toFixed(1)} dBFS`;if(level.peak>=1)clipUntil=now+1000;$('globalMixClip').hidden=now>clipUntil;}}
  // Buttons, labels and loop handles do not need 60 DOM refreshes per second.
  if(now-lastUiSync>=100){
    lastUiSync=now;
    if(waveformRefresh.due(now))updateWaveforms();
    $('bufferStatus').hidden=!engine?.progressive;
    if(engine?.progressive){const text=`Audio prêt : ${engine.availableDuration.toFixed(1)} / ${engine.duration.toFixed(1)} s${engine.waiting?' — mise en tampon, reprise automatique dès le prochain bloc.':engine.complete?(engine.partial?' — calcul interrompu, extrait conservé.':' — calcul terminé.'):busy?' — vous pouvez écouter dès le premier bloc ; le calcul continue.':' — en attente d’une nouvelle séparation.'}`;if($('bufferStatus').textContent!==text)$('bufferStatus').textContent=text;}
    const guitarLabel=guitarPreview?.playing?'Pause guitare':'Jouer la guitare';if($('guitarPreviewPlay').textContent!==guitarLabel)$('guitarPreviewPlay').textContent=guitarLabel;
    const controls=()=>{syncTransport();syncWorkflow();onUpdate();};if(uiMetrics)uiMetrics.measure('controls',controls);else controls();
  }
  frame=requestAnimationFrame(tick);
}
tick();
const ready=(async()=>{
  try{
    downloads=await initializeDownloads(root);
    if(destroyed){downloads.cache.close();return;}
    const response=await fetch(new URL('./models.json',import.meta.url));if(!response.ok)throw Error('Catalogue musical indisponible.');
    const manifest=await response.json();catalog=new ModelCatalog(manifest.models);
    $('modelSelect').replaceChildren(...catalog.list().map(m=>new Option(m.label,m.id)));
    runner=new DemucsRunner({manager:downloads.manager});
    progressiveRunner=new ProgressiveDemucsRunner({manager:downloads.manager});
    onnxRunner=new OnnxDemucsRunner({manager:downloads.manager});
    previewRunner=new PreparedDemucsRunner({manager:downloads.manager,workerFactory:(model,backend)=>new Worker(new URL(isWebnnBackend(backend)?'./webnn-playback-worker.js':model.runtime==='bs-roformer-onnx'?'./roformer-worker.js':'./preview-worker.js',import.meta.url),{type:'module'})});
    downloads.manager.addEventListener('progress',event=>{
      if(event.detail.id !== selectedModel()?.id)return;
      ++selectionGeneration; // A live event supersedes an older cache lookup.
      if(!busy){
        if(event.detail.state==='installed'&&needsPreparation(selectedModel()))refreshModel().catch(report);
        else {if(event.detail.state==='missing')previewRunner.cancel();renderSelectedModel(event.detail);}
      }
    });
    const localBenchmark=readBenchmarkReport();
    refreshModelComparison();
    const preferred=preferredModel(catalog.list(),downloads.capabilities,$('useCase').value,localBenchmark?{report:localBenchmark}:{});
    if(preferred)$('modelSelect').value=preferred.id;
    await chooseModel({backgroundPreparation:true});
  }catch(error){$('separationHint').textContent = `Initialisation impossible : ${error.message}`;report(error);}
})();
async function getState(){
  ensureIdle();if(!workflow.original)return {version:2,empty:true,global:getContext()&&globalMixer.getState()};const state=await saveSession({workflow,mixer:globalMixer,store:audioStore,source,measure:(name,callback)=>uiMetrics?uiMetrics.measure(name,callback):callback(),separation:{modelId:$('modelSelect').value,backend:$('backendSelect').value,useCase:$('useCase').value,seconds:Number($('excerptSeconds').value),segmentSeconds:0,profile:selectedModel()?.profile||'quality',neuralFrames:selectedModel()?.frames||null,resultRender:workflow.result?.renderInfo||null,progressive:$('progressiveMode').checked,fallback:$('allowCpuFallback').checked}});
  try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{throw Error('Audio sauvegardé, mais les réglages ne peuvent pas être mémorisés dans ce navigateur.');}
  $('sessionStatus').textContent='Session sauvegardée localement : réglages + audio. Restauration sans lecture automatique.';return state;
}
async function setState(state){
  ensureIdle();$('sessionStatus').textContent='Préparation de la restauration…';await ready;ensureIdle();youtubeImport.cancel();++audioGeneration;cancelRequested=false;
  if(state===null||state?.empty===true){if(state!==null)validateSession(state);pendingRestore=null;pendingLegacy=null;workflow.destroy();globalMixer?.setActiveEngine(null);engine=null;session=null;selectedAudio=null;source=null;onSourceChange(null);tracks=[];compactPlayer.reset();$('sessionTitle').textContent='Choisir une piste';if(state?.global)globalMixer.update(state.global);syncTransport();syncSeparationButton();return;}
  validateSession(state);restoring=true;
  try{
    getContext();const restored=await restoreSession(state,{context:audioContext,store:audioStore,createDeck,workflow,mixer:globalMixer});
    if(restored.missing){pendingRestore=restored.state;$('sessionStatus').textContent='Audio absent du cache : choisissez à nouveau la piste de bibliothèque ou réimportez le même fichier pour retrouver ses réglages.';return restored;}
    source=state.source;onSourceChange(source);$('fileStatus').textContent=`Audio restauré · ${source?.name||state.original.title}`;selectedAudio=source?.kind==='demo'?null:workflow.original.engine.tracks[0].buffer;pendingRestore=null;
    const choice=state.separation||{};
    if(workflow.result)workflow.result.renderInfo=choice.resultRender||{modelId:choice.modelId,profile:choice.profile||'quality',backend:choice.backend};
    if(catalog.get(choice.modelId))$('modelSelect').value=choice.modelId;
    if(['guitar','vocals','remix'].includes(choice.useCase))$('useCase').value=choice.useCase;
    $('backendSelect').value=['webgpu',...WEBNN_BACKENDS].includes(choice.backend)?choice.backend:'wasm';$('progressiveMode').checked=choice.progressive!==false;$('allowCpuFallback').checked=choice.fallback!==false;
    if([0,1,5,10,30,60].includes(choice.seconds))$('excerptSeconds').value=String(choice.seconds);
    // Cached stems can play while the neural session prepares for a later re-separation.
    await refreshModel({backgroundPreparation:true});renderTracks();updateWaveforms();syncTransport();syncWorkflow();
    $('sessionStatus').textContent=restored.missingResult?'Original restauré en pause ; instruments absents du cache, relancez la séparation.':'Session restaurée en pause : aucun son ne démarre automatiquement.';return restored;
  }finally{restoring=false;syncSeparationButton();syncTransport();}
}
$('saveSession').onclick=()=>getState().catch(error=>{$('sessionStatus').textContent=error.message;});
$('restoreSession').onclick=()=>{try{const saved=localStorage.getItem(storageKey);if(!saved)throw Error('Aucune session locale sauvegardée.');setState(JSON.parse(saved)).catch(error=>{$('sessionStatus').textContent=error.message;});}catch(error){$('sessionStatus').textContent=error.message;}};
try{if(localStorage.getItem(storageKey))$('sessionStatus').textContent='Une session locale est disponible : cliquez Restaurer la session.';}catch{}
async function restoreLegacy(state){
    const e=workflow.original?.engine;if(!e)return;
    e.pause();if(state.loop?.endSeconds>state.loop.startSeconds)e.setLoopRegion(Number(state.loop.startSeconds),Math.min(e.duration,Number(state.loop.endSeconds)));e.setLoop(!!state.loop?.enabled);e.seek(Number(state.position)||0);
    globalMixer.update({volumeDb:Number(state.volumeDb)||0,muted:!!state.muted,mix:state.mix??.5,guitarPan:state.guitarPan??0});
    if(state.normalized)await workflow.original.normalization.analyze();
    $('sessionStatus').textContent=state.rate&&state.rate!==1?'Ancienne session restaurée en pause · lecture à vitesse 1 (time-stretch multipiste à venir).':'Ancienne session restaurée en pause.';
  }
function destroy(){
  if(destroyed)return;destroyed=true;youtubeImport.destroy();modelSettings.invalidate();progressSlider.destroy();metricsObserver?.disconnect();animationObserver?.disconnect();clearInterval(metricsTimer);document.removeEventListener('visibilitychange',metricsVisibility);++audioGeneration;++selectionGeneration;cancelAnimationFrame(frame);
  runner?.cancel();progressiveRunner?.cancel();onnxRunner?.cancel();previewRunner?.cancel();for(const id of downloads?.manager.tasks.keys()||[])downloads.manager.cancel(id);
  workflow.destroy();guitarPreview?.destroy();globalMixer?.destroy();compactPlayer.destroy();downloads?.cache.close();audioStore.close();window.removeEventListener('pagehide',destroy);
}
if(providedContext)getContext();
window.addEventListener('pagehide',destroy,{once:true});
function refreshModelComparison(){
  if(!catalog||!downloads)return;
  const next=createModelComparisonPanel({models:catalog.list(),capabilities:downloads.capabilities,onRefresh:refreshModelComparison,onRecommend:model=>{if(model){$('modelSelect').value=model.id;$('backendSelect').value=backendPolicy(model,downloads.capabilities,'webgpu').backend;if(!modelSettings.draft)chooseModel();}}});
  if(comparisonPanel)comparisonPanel.replaceWith(next);else $('modelSelect').closest('.setup-card').append(next);
  comparisonPanel=next;
}
async function beginModelSettings(){
  await modelSettings.beginWhenReady(ready,()=>{
    if(destroyed)throw new DOMException('Lecteur fermé.','AbortError');
    return {modelId:selectedModel()?.id,backend:$('backendSelect').value,useCase:$('useCase').value};
  });
  refreshModelComparison();
  for(const id of ['modelSelect','backendSelect','useCase'])$(id).disabled=false;
}
function cancelModelSettings(){
  const previous=modelSettings.cancel();if(!previous)return;
  $('modelSelect').value=previous.modelId;$('backendSelect').value=previous.backend;$('useCase').value=previous.useCase;
  for(const id of ['modelSelect','backendSelect','useCase'])$(id).disabled=busy;
}
async function commitModelSettings(){
  const next={modelId:$('modelSelect').value,backend:$('backendSelect').value};
  if(!catalog.get(next.modelId))throw Error('Modèle inconnu.');
  return modelSettings.commit(next,{
    stop(){
      ++selectionGeneration;cancelRequested=true;
      runner?.cancel();progressiveRunner?.cancel();onnxRunner?.cancel();previewRunner?.cancel();
      busy=false;$('cancelSeparation').disabled=true;
      for(const id of ['fileInput','modelSelect','useCase','excerptSeconds','loadDemo','testSignal','progressiveTest','realMixTest','backendSelect','allowCpuFallback'])$(id).disabled=false;
    },
    reset(){
      separationProgress=new SeparationProgress();$('separationProgress').hidden=true;$('completedTracks').replaceChildren();
      $('progress').textContent='Modèle changé · relancez Separate instruments.';$('backendMetrics').textContent='';
      if(selectedAudio&&workflow.original){
        const model=catalog.get(next.modelId),length=separationFrames(selectedAudio.length,$('excerptSeconds').value);
        const empty=createDeck([],`${model.label} · en attente`,{progressive:true,totalFrames:length,roles:model.roles});
        workflow.resetResult(empty);projectChanged();$('sessionStatus').textContent='Nouveau modèle · pistes réinitialisées · cliquez Separate instruments.';
      }
      syncWorkflow();syncTransport();
    },
    prepare:()=>busy?undefined:refreshModel({backgroundPreparation:true}),
  });
}
return {ready,getState,setState,destroy,loadFile,separate,beginModelSettings,cancelModelSettings,commitModelSettings,exportSnapshot(){ensureIdle();if(!engine)throw Error('Chargez un projet.');return {...exportSnapshot(engine,session.tracks),renderInfo:workflow.active?.renderInfo||{profile:'original'}};},pause(){engine?.pause();},get hasSeparated(){return !!workflow.result&&!!(workflow.result.engine.progressive?workflow.result.engine.availableFrames:workflow.result.engine.tracks.length);},get busy(){return busy||restoring;},get engine(){return engine;},get mixer(){return globalMixer;},
  beginLoad(){if(busy||restoring)throw Error('Attendez la fin de l’opération en cours.');youtubeImport.cancel();const token=++audioGeneration;decoding=true;syncSeparationButton();return token;},
  endLoad(token){if(token===audioGeneration){decoding=false;syncSeparationButton();}},
  async loadBuffer(audio,label,reference,token){
    if(token!==undefined&&token!==audioGeneration)return false;
    if(token===undefined){ensureIdle();++audioGeneration;}else if(busy||restoring)throw Error('Attendez la fin de l’opération en cours.');
    await loadOriginal(audio,label,reference);decoding=false;syncSeparationButton();return true;
  },
  restoreLegacy,
  deferLegacy(state){pendingLegacy=structuredClone(state);workflow.active?.engine.pause();$('sessionStatus').textContent='Ancienne session : réimportez le même fichier pour restaurer ses réglages en pause.';},get source(){return source;}};
}
// bootstrap.js retains the file:// diagnostic; embedded imports do not mount
// anything in the host document.
if(document.getElementById('selectedModelPanel'))mountSeparationPlayer(document);
