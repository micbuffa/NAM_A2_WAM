import {chooseAudioFile} from './AudioImportChoice.js';
import {ProjectSaveState} from './ProjectSaveState.js';
import '../ui/index.js';
import {mountSeparationPlayer} from './main.js';
import {MediaRepository} from './MediaRepository.js';
import {createModelResearchPanel} from './ModelResearchCatalog.js';
import {Mp3Exporter} from './Mp3Exporter.js';

export class MultitrackPlayerElement extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this.generation=0;this.projectVersion=0;this.projectSave=new ProjectSaveState();}
 async initialize({audioContext,mixerFactory,audioStore,repository=new MediaRepository()}={}){
  if(this.application)throw Error('Lecteur déjà initialisé.');if(!audioContext||!mixerFactory)throw Error('Contexte et mixeur partagés requis.');this.repository=repository;this.context=audioContext;this.exporter=new Mp3Exporter();
  const generation=++this.generation,url=new URL('./index.html',import.meta.url),response=await fetch(url);if(!response.ok)throw Error('Interface multipiste indisponible.');
  const html=new DOMParser().parseFromString(await response.text(),'text/html'),main=html.querySelector('.source-main');if(generation!==this.generation)return;
  for(const link of main.querySelectorAll('[href]'))link.setAttribute('href',new URL(link.getAttribute('href'),url));
  for(const file of ['../ui/base.css','../ui/components.css','./source-separation.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(file,import.meta.url);this.shadowRoot.append(link);}
  const style=document.createElement('style');style.textContent=`:host{display:block;min-width:0;color:var(--tl-text,#edf2f7);font:13px system-ui}.layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px}.projects{min-width:0;background:#171d22;border:1px solid #35404c;border-radius:10px;padding:12px}.projects h3{margin:0 0 12px;font-size:14px}.projects input{width:100%;box-sizing:border-box;margin:12px 0}.project-list{display:grid;gap:7px}.project-list button{min-width:0;width:100%;box-sizing:border-box;overflow-wrap:anywhere;display:grid;gap:5px;text-align:left;padding:10px;border:1px solid #394851;border-radius:6px;background:#222a30;color:inherit}.project-list button[aria-current=true]{border-color:#c7f65b}.project-list small{color:#abb9c1}.source-main{min-width:0}.host-card{padding:14px;border:1px solid #35404c;border-radius:10px;background:#191d23}.section-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.section-heading h2{font-size:16px;margin:0}.rack-kicker{font-size:10px;color:#b4bfc7;margin:0 0 4px}.player-workflow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.guitar-preview{display:none}.settings{color:#edf2f7;background:#1b2229;border:1px solid #52616b;border-radius:12px;max-width:1000px;width:min(900px,90vw);max-height:85vh;padding:20px}.settings::backdrop{background:#000a}.settings header{display:flex;justify-content:space-between;align-items:center;position:sticky;top:-20px;background:#1b2229;padding:10px 0;z-index:5}.settings .host-card{margin:12px 0}.model-research article{border-top:1px solid #394851;padding:12px 0}.model-research p{margin:6px 0}.model-research a{color:#c7f65b;margin-right:12px}.model-research small{color:#bdc9d0}.settings h3{font-size:16px}.setup-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.notice{font-size:12px;color:#bdc9d0;padding:8px 0;min-height:18px}button{cursor:pointer}button,input,select{font:inherit}button:disabled{cursor:default;opacity:.45}[hidden]{display:none!important}@media(max-width:850px){.layout{grid-template-columns:1fr}.project-list{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.setup-grid{grid-template-columns:1fr}}`;
  const layout=document.createElement('div');layout.className='layout';const sidebar=document.createElement('aside');sidebar.className='projects';sidebar.innerHTML='<h3>Morceaux séparés</h3><details class="audio-import-choice" id="audioImportChoice"><summary>Importer audio</summary><div class="audio-import-options"><tl-button id="importAudio">Depuis un fichier audio</tl-button><div id="youtubeImportSlot"></div></div></details><input id="projectFilter" type="search" placeholder="Rechercher…" aria-label="Rechercher les projets séparés"><nav class="project-list" aria-label="Projets séparés"></nav><small>Audio chargé uniquement à la sélection.</small>';
  layout.append(sidebar,main);this.shadowRoot.append(style,layout);
  const dialog=document.createElement('dialog');dialog.className='settings';dialog.setAttribute('aria-label','Multitracks Settings');dialog.innerHTML='<header><h3>Settings · Multitracks</h3><span><tl-button id="cancelModelSettings">Annuler</tl-button> <tl-button id="closeSettings">Valider</tl-button></span></header>';
  const player=main.querySelector('.player-card'),setup=main.querySelector('.setup-card'),downloads=main.querySelector('[aria-labelledby=modelsHeading]');
  dialog.append(setup,createModelResearchPanel(),downloads);
  for(const selector of ['.global-mix-controls','.normalization-controls','.session-actions','.guitar-preview','#backendMetrics']){
   const node=player.querySelector(selector);if(node)dialog.append(node.closest('details')||node);
  }
  const diagnosticLink=player.querySelector('a[href*="webgpu-benchmark"]');if(diagnosticLink)dialog.append(diagnosticLink.closest('p'));
  // The full test panel stays available only in Settings. Keep actual progress
  // and cancellation next to the transport in the main view.
  const progress=setup.querySelector('#separationProgress');player.querySelector('#transport').before(progress);
  main.replaceChildren(player);this.shadowRoot.append(dialog);this.dialog=dialog;
  const actions=player.querySelector('.player-workflow'),exportButton=document.createElement('tl-button'),settingsButton=document.createElement('tl-button');
  exportButton.textContent='Export mix to Tracks';exportButton.id='exportToTracks';settingsButton.textContent='Change model / settings';settingsButton.id='multitrackSettings';actions.append(exportButton,settingsButton);
  const saveButton=this.shadowRoot.getElementById('saveSession'),saveStatus=document.createElement('small');
  saveButton.textContent='Enregistrer le projet';saveButton.disabled=true;saveStatus.id='projectSaveStatus';saveStatus.setAttribute('role','status');saveStatus.hidden=true;
  actions.insertBefore(saveButton,exportButton);actions.append(saveStatus);
  const range=setup.querySelector('#excerptSeconds').closest('label'),summary=document.createElement('p'),options=document.createElement('div');
  options.className='player-workflow';summary.id='activeModelSummary';summary.setAttribute('role','status');summary.textContent='Chargement du modèle…';options.append(range,summary);actions.before(options);
  const notice=document.createElement('div');notice.className='notice';notice.setAttribute('role','status');notice.id='projectNotice';player.append(notice);this.notice=notice;this.exportButton=exportButton;
  const openSettings=async()=>{settingsButton.disabled=true;try{await this.application.beginModelSettings();if(this.isConnected&&!dialog.open)dialog.showModal();}catch(error){notice.textContent=error.message;}finally{settingsButton.disabled=false;}};
  this.application=mountSeparationPlayer(this.shadowRoot,{audioContext,mixerFactory,audioStore,initialVolumeDb:-12,emptyHint:'Depuis Tracks : clic droit sur la waveform → Separate Stems, ou importez un fichier.',onConfigure:()=>{if(!this.modelReady())openSettings();},onSourceChange:()=>this.sourceChanged(),onProjectChange:()=>{this.projectSave.changed();this.renderSaveStatus();},onSeparated:()=>this.separationComplete(),onError:error=>{notice.textContent=error.message;},onUpdate:()=>{this.renderSaveStatus();const e=this.application?.engine;exportButton.disabled=!this.exporter.worker&&(!e||e.progressive&&!e.complete);const title=this.application?.source?.name?this.application.source.name+(e?.tracks.length>1?' · '+e.tracks.length+' pistes':''):'Choisissez un projet ou importez un morceau';const heading=this.shadowRoot.getElementById('sessionTitle');if(heading.textContent!==title)heading.textContent=title;},storageKey:'nam-multitracks-workspace.v3'});
  this.shadowRoot.getElementById('separateButton').onclick=async()=>{dialog.close();try{await this.application.commitModelSettings();if(this.modelReady())await this.application.separate();}catch(error){notice.textContent=error.message;}};
  settingsButton.onclick=openSettings;
  this.shadowRoot.getElementById('closeSettings').onclick=async()=>{dialog.close();try{await this.application.commitModelSettings();}catch(error){notice.textContent=error.message;}};
  this.shadowRoot.getElementById('cancelModelSettings').onclick=()=>{this.application.cancelModelSettings();dialog.close();};
  dialog.addEventListener('cancel',()=>this.application.cancelModelSettings());
  sidebar.querySelector('#importAudio').onclick=()=>{if(!chooseAudioFile(sidebar.querySelector('#audioImportChoice'),this.shadowRoot.getElementById('fileInput')))notice.textContent='Attendez la fin du traitement en cours avant d’importer un fichier.';};
  saveButton.onclick=()=>this.saveProject();
  sidebar.querySelector('#projectFilter').oninput=()=>this.renderProjects();exportButton.onclick=()=>this.exportMix();
  main.addEventListener('dragover',event=>event.preventDefault());main.addEventListener('drop',event=>{event.preventDefault();const file=event.dataTransfer?.files[0];if(file)this.application.loadFile(file);});
  await this.refreshProjects();return this;
 }
 modelReady(){return this.shadowRoot.getElementById('selectedModelPanel').dataset.state==='installed';}
 async refreshProjects(){try{this.projects=await this.repository.list('project');this.renderProjects();}catch(error){this.notice.textContent=error.message;}}
 renderProjects(){
  const root=this.shadowRoot,list=root.querySelector('.project-list'),query=root.getElementById('projectFilter').value.toLocaleLowerCase();list.replaceChildren();
  for(const p of (this.projects||[]).filter(x=>x.title.toLocaleLowerCase().includes(query))){const b=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('small');title.textContent=p.title;meta.textContent=`${p.stems} pistes · ${p.duration.toFixed(1)} s`;b.append(title,meta);b.setAttribute('aria-current',String(p.id===this.activeProject));b.onclick=()=>this.loadProject(p.id);list.append(b);}
  if(!list.children.length){const empty=document.createElement('p');empty.textContent='Enregistrez un projet pour le retrouver ici.';list.append(empty);}
 }
 sourceChanged(){this.activeProject=null;++this.projectVersion;this.projectSave.reset();if(this.projects)this.renderProjects();this.renderSaveStatus();}
 separationComplete(){
  this.shadowRoot.getElementById('separationProgress').hidden=true;
  this.notice.textContent='Résultat en RAM · cliquez sur Enregistrer le projet pour le conserver.';this.renderSaveStatus();
 }
 renderSaveStatus(){
  const root=this.shadowRoot,status=root.getElementById('projectSaveStatus'),button=root.getElementById('saveSession');if(!status||!button)return;
  status.hidden=!this.application?.source;
  const text=this.projectSave.saving?'Enregistrement…':this.projectSave.dirty?'En RAM · projet non enregistré':'Projet enregistré';
  if(status.textContent!==text)status.textContent=text;
  button.disabled=!!(!this.application?.hasSeparated||this.application.busy||this.projectSave.saving||this.loadingProject);
 }
 async saveProject(){
  if(!this.application.hasSeparated){this.notice.textContent='Séparez le morceau avant d’enregistrer un projet multipiste.';return;}
  const token=this.projectSave.begin();if(!token)return;
  const version=this.projectVersion,id=this.activeProject||crypto.randomUUID(),title=this.application.source?.name||'Morceau séparé';this.notice.textContent='Enregistrement du projet…';this.renderSaveStatus();
  try{
   const state=await this.application.getState();if(!state?.result)throw Error('Le résultat séparé n’est plus disponible.');
   await this.repository.putProject({id,title,state});
   const current=this.projectSave.finish(token,true)&&version===this.projectVersion;
   if(current)this.activeProject=id;await this.refreshProjects();
   if(current)this.notice.textContent=this.projectSave.dirty?'Projet enregistré · modifications récentes non enregistrées.':'Projet conservé localement · chargé à la demande.';
  }catch(error){if(this.projectSave.finish(token)&&version===this.projectVersion)this.notice.textContent=`Projet utilisable, mais sauvegarde impossible : ${error.message}`;}
  finally{this.renderSaveStatus();}
 }
 async loadProject(id){
  if(this.loadingProject)return;this.loadingProject=true;this.notice.textContent='Chargement du projet sélectionné…';
  try{const p=await this.repository.get(id);if(p?.kind!=='project')throw Error('Projet introuvable.');const result=await this.application.setState(p.state);if(result?.missing)throw Error('Audio absent du cache : réimportez le morceau et relancez Separate.');this.activeProject=id;this.projectSave.reset(true);this.renderProjects();this.notice.textContent='Projet chargé en pause.';}
  catch(error){this.notice.textContent=error.message;}finally{this.loadingProject=false;this.renderSaveStatus();}
 }
 async importFromTracks(buffer,track){
  this.exporter.cancel();const length=Math.round(buffer.length*44100/buffer.sampleRate),offline=new OfflineAudioContext(Math.min(2,buffer.numberOfChannels),length,44100),source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();
  const audio=await offline.startRendering();await this.application.loadBuffer(audio,track.title,{kind:track.local?'example':'library',id:track.id,name:track.title});this.notice.textContent='Piste reçue de Tracks · cliquez Separate instruments.';
 }
 async exportMix(){
  if(this.exporter.worker){this.exporter.cancel();return;}
  try{const input=this.application.exportSnapshot(),title=(this.application.source?.name||'Multitrack')+(input.renderInfo?.profile==='preview'?' — aperçu rapide':'')+' — mix.mp3';this.exportButton.textContent='Annuler l’export';
   const result=await this.exporter.export(input,p=>{this.notice.textContent=`${p.phase} · ${p.percent}%`;});
   const entry=await this.repository.putTrack({title,blob:result.blob,duration:result.duration,renderInfo:input.renderInfo});this.notice.textContent=`MP3 exporté vers Tracks${result.attenuation<1?' · gain réduit pour éviter l’écrêtage':''}.`;
   this.dispatchEvent(new CustomEvent('export-to-tracks',{detail:entry,bubbles:true,composed:true}));
  }catch(error){this.notice.textContent=error.name==='AbortError'?'Export annulé.':error.message;}finally{this.exportButton.textContent='Export mix to Tracks';}
 }
 pause(){this.application?.pause();}
 get engine(){return this.application?.engine;}
 getState(){return this.application.getState();}
 async setState(state){const result=await this.application.setState(state);if(!result?.missing){this.projectSave.reset(true);this.renderSaveStatus();}return result;}
 disconnectedCallback(){queueMicrotask(()=>{if(!this.isConnected)this.destroy();});}
 destroy(){++this.generation;this.exporter?.cancel();this.application?.destroy();}
}
if(!customElements.get('multitrack-player'))customElements.define('multitrack-player',MultitrackPlayerElement);
