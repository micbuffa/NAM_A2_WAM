import {PlayAlongMp3, playAlongImportDialog, saveAudioDownload} from './PlayAlongActions.js';
import {BackingTrackEngine} from './BackingTrackEngine.js';
import {BackingTrackLibrary} from './BackingTrackLibrary.js';
import '../ui/components/tl-slider.js';
import '../ui/components/tl-checkbox.js';
import '../ui/components/tl-button.js';
import '../ui/components/tl-icon-button.js';
import '../ui/components/tl-icon.js';
import '../ui/components/tl-badge.js';
import {toast} from '../ui/components/tl-toast.js';
const time=s=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
// Factory = the bundled catalogue (no origin); My tracks = everything else (YouTube, Studio mixes, temporary mixes, this device's file).
const isFactory=track=>!track.local&&!track.ephemeral&&!track.origin;
const ORIGINS={factory:['Factory','neutral'],local:['This device','neutral'],temporary:['Temporary','warning'],youtube:['YouTube','danger'],studio:['Studio','accent']};
// Date and time a saved track was added (YouTube import, Studio mix); empty for Factory and this device's file.
const added=track=>{const date=track.createdAt&&!track.local?new Date(track.createdAt):null;return date&&!Number.isNaN(date.getTime())?date.toLocaleString(undefined,{dateStyle:'short',timeStyle:'short'}):'';};
const originOf=track=>track.local?'local':track.ephemeral?'temporary':track.origin==='youtube'?'youtube':track.origin==='studio'?'studio':'factory';
export class BackingTrackPlayerElement extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.innerHTML=`
 <link rel="stylesheet" href="${new URL('./backing-track-player.css',import.meta.url)}">
 <section aria-label="Play along" tabindex="-1">
 <header id="transport">
  <div class="heading"><button id="back" class="back" hidden><tl-icon name="chevron" size="14"></tl-icon>Library</button><div class="now-playing"><span class="eyebrow">Play along</span><button id="title" class="track-title">Choose a backing track</button></div></div>
  <div class="transport-buttons"><tl-icon-button id="stop" icon="rewind" size="sm" aria-label="Back to start"></tl-icon-button><tl-icon-button id="play" class="play" icon="play" aria-label="Play backing track"></tl-icon-button></div>
  <output id="clock" class="clock"><span id="position">0:00</span> <span class="separator">/</span> <span id="duration">0:00</span></output>
  <label class="volume"><span>Vol</span><tl-slider><input id="volume" type="range" min="-60" max="6" step=".5" value="-12" aria-label="Backing track volume"></tl-slider></label>
  <tl-button id="mute" size="sm" aria-pressed="false">Mute</tl-button>
 </header>
 <div id="status" role="status" aria-live="polite">Loading library\u2026</div>
 <div id="body"><div id="libraryView" class="library-view"><div class="library-toolbar"><span class="library-head">Library <span id="count">0</span></span><input id="filter" type="search" placeholder="Search tracks\u2026" aria-label="Search backing tracks"><button id="import" class="import"><tl-icon name="plus" size="14"></tl-icon>Import audio</button></div><div id="listScroll" class="list-scroll"><table id="list" aria-label="Backing tracks"><thead><tr><th class="title" scope="col">Title</th><th class="origin" scope="col">Origin</th><th class="added" scope="col">Added</th><th class="num duration" scope="col">Time</th><th class="num bpm" scope="col">BPM</th><th class="num key" scope="col">Key</th></tr></thead></table></div></div>
 <div id="trackView" class="track-view" hidden><div class="wave-container"><div id="wave" tabindex="0" role="slider" aria-label="Position in backing track" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><canvas></canvas><div id="region" class="region"></div><div id="head" class="head"></div><span class="hint">Click to seek \u00b7 Drag to loop \u00b7 Drop audio \u00b7 Space to play</span><strong id="empty" class="empty">Choose or import a backing track</strong></div><div id="loadProgress" hidden><div id="loadRing" role="progressbar" aria-label="Audio download" aria-valuemin="0" aria-valuemax="100"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="load-track" cx="40" cy="40" r="33"/><circle id="loadArc" cx="40" cy="40" r="33" pathLength="100"/></svg><strong id="loadPercent">0%</strong></div><span id="loadPhase">Downloading\u2026</span></div></div>
 <div class="studio-mix-actions"><tl-button id="separateInstruments" size="sm" disabled>Separate instruments</tl-button><tl-button id="downloadMix" size="sm" hidden title="Download the entire source as MP3, without the live guitar or playback settings">Download MP3</tl-button></div><div class="tools">
  <div class="tool"><span class="tool-head">Speed <output id="rateValue">100%</output></span><tl-slider bipolar><input id="rate" type="range" min=".7" max="1.3" step=".01" value="1" disabled aria-label="Playback speed"></tl-slider><tl-button id="rateReset" size="sm" variant="ghost">Reset</tl-button></div>
  <div class="tool"><span class="tool-head">Guitar \u2194 Backing <output id="balanceValue">50 / 50</output></span><tl-slider bipolar><input id="balance" type="range" min="0" max="1" step=".01" value=".5" aria-label="Guitar to backing balance"></tl-slider><tl-button id="balanceReset" size="sm" variant="ghost">Reset</tl-button></div>
  <div class="tool"><span class="tool-head">Guitar pan <output id="panValue">C</output></span><tl-slider bipolar><input id="pan" type="range" min="-1" max="1" step=".01" value="0" aria-label="Guitar global pan"></tl-slider><tl-button id="panReset" size="sm" variant="ghost">Reset</tl-button></div>
  <div class="tool loop"><span class="tool-head">Loop A\u2013B <button id="loop" class="led-toggle" aria-pressed="true" aria-label="Loop"><i></i><span>On</span></button></span><tl-button id="full" size="sm" variant="ghost">Full track</tl-button></div>
  <div class="tool"><span class="tool-head">Level</span><div class="normalize"><tl-button id="normalize" size="sm" aria-pressed="false">Normalize</tl-button><label><tl-checkbox variant="switch"><input id="auto" type="checkbox" checked></tl-checkbox> at load</label></div></div>
 </div></div></div>
 <input id="file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" hidden></section>`;
 this.$=id=>this.shadowRoot.getElementById(id);this.observer=new ResizeObserver(()=>this.draw());
 }
 async initialize({audioContext,library=new BackingTrackLibrary(),importYoutube=null}){
  if(this.engine)throw Error('Player already initialized');this.importYoutube=importYoutube;this.mp3=new PlayAlongMp3();this.library=library;this.engine=new BackingTrackEngine(audioContext,library);this.listeners=new AbortController();
  for(const type of ['track-change','transport-change','load-progress','mix-change','guitar-pan-change','player-error'])this.engine.addEventListener(type,event=>{
   if(type==='track-change'){this.mp3.cancel();this.draw();this.renderList();this.status('');}
   if(type==='load-progress'&&this.engine.loading)this.mp3.cancel();
   if(type==='load-progress'){
    const d=event.detail,complete=d.phase==='decode'||d.phase==='ready';
    const percent=complete?100:d.progress==null?null:Math.round(d.progress*100);
    this.$('loadArc').style.strokeDashoffset=String(100-(percent??0));
    this.$('loadPercent').textContent=percent==null?'…':`${percent}%`;
    if(percent==null)this.$('loadRing').removeAttribute('aria-valuenow');else this.$('loadRing').setAttribute('aria-valuenow',String(percent));
    this.$('loadPhase').textContent=d.phase==='decode'?'Preparing audio…':'Downloading…';
    this.status(d.error?`Load failed: ${d.error}`:d.phase==='ready'?'':d.phase==='decode'?`Preparing audio: ${d.title}…`:`Loading ${d.title}${percent==null?'…':` · ${percent}%`}`,!!d.error);
   }
   if(type==='player-error')this.status(event.detail.message,true);
   this.sync();this.dispatchEvent(new CustomEvent(type,{detail:event.detail,bubbles:true,composed:true}));
  },{signal:this.listeners.signal});
  this.bind();await this.engine.initialize();
  try{await library.list();this.renderList();if(this.engine.stretchReady)this.status('Select a track or import an audio file.');}catch(error){this.status(error.message,true);}
  this.sync();this.startAnimation();return this;
 }
 get view(){return this.$('trackView').hidden?'library':'track';}
 // Library (table) or track (waveform and tools); the track view needs a loaded or loading track.
 // The transport row shows the track name once, with a Library button in the track view.
 setView(view){
  const track=view==='track'&&(!!this.engine?.buffer||!!this.engine?.loading);
  if(track===(this.view==='track'))return;
  this.$('libraryView').hidden=track;this.$('trackView').hidden=!track;this.$('back').hidden=!track;this.setAttribute('view',track?'track':'library');
  this.$('title').title=track?'Show the library':'Show the track';
  if(track)this.draw();else this.revealSelected();
  this.dispatchEvent(new CustomEvent('view-change',{detail:{view:this.view},bubbles:true,composed:true}));
 }
 openTrack(track){return this.act(async()=>{
  const e=this.engine;
  if(track.id===e.track?.id&&e.buffer){this.setView('track');return;}
  const loading=track.local?null:e.loadTrack(track.id);this.setView('track');await loading;
 });}
 openFile(file){return this.act(async()=>{const loading=this.engine.loadFile(file);this.setView('track');await loading;});}
 status(message,error=false){this.$('status').textContent=message;this.$('status').classList.toggle('error',error);}
 act(operation){return Promise.resolve().then(operation).catch(error=>{this.status(error.message,true);this.sync();this.dispatchEvent(new CustomEvent('player-error',{detail:{message:error.message},bubbles:true,composed:true}));});}
 bind(){
  const e=this.engine,on=(id,event,fn)=>this.$(id).addEventListener(event,()=>this.act(fn),{signal:this.listeners.signal});
  on('separateInstruments','click',()=>{if(e.buffer&&!e.loading)this.dispatchEvent(new CustomEvent('separate-instruments',{detail:{track:{...e.track},file:e.sourceFile??null},bubbles:true,composed:true}));});
  on('downloadMix','click',()=>this.downloadMp3());
  on('play','click',()=>e.playing?e.pause():e.play());on('stop','click',()=>e.stop());
  on('title','click',()=>this.setView(this.view==='track'?'library':'track'));on('back','click',()=>this.setView('library'));
  on('volume','input',()=>e.setVolumeDb(this.$('volume').value));on('mute','click',()=>e.setMuted(!e.muted));
  for(const [id,setter,reset] of [['rate','setRate',1],['pan','setGuitarPan',0],['balance','setMix',.5]]){on(id,'input',()=>e[setter](this.$(id).value));on(id+'Reset','click',()=>e[setter](reset));}
  on('loop','click',()=>e.setLoop({enabled:!e.loop.enabled}));
  on('full','click',()=>e.setLoop({startSeconds:0,endSeconds:e.duration}));on('normalize','click',()=>e.setNormalized(!e.normalized));on('auto','change',()=>{e.autoNormalize=this.$('auto').checked;e.changed();});
  on('filter','input',()=>this.renderList());on('import','click',()=>playAlongImportDialog({local:()=>this.$('file').click(),youtube:this.importYoutube,error:error=>this.status(error.message,true)}));this.$('file').addEventListener('change',()=>{const file=this.$('file').files[0];this.$('file').value='';if(file)this.openFile(file);},{signal:this.listeners.signal});
  const wave=this.$('wave'),coordinate=event=>Math.max(0,Math.min(1,(event.clientX-wave.getBoundingClientRect().left)/wave.clientWidth))*e.duration;
  wave.addEventListener('pointerdown',event=>{if(e.loading||event.button!==0||!e.buffer)return;this.drag={x:event.clientX,start:coordinate(event),end:coordinate(event)};wave.setPointerCapture(event.pointerId);});
  wave.addEventListener('pointermove',event=>{if(this.drag){this.drag.end=coordinate(event);this.updateRegion(this.drag.start,this.drag.end);}});
  wave.addEventListener('pointerup',event=>{if(e.loading||!this.drag)return;const drag=this.drag;this.drag=null;this.act(()=>Math.abs(event.clientX-drag.x)<5?e.seek(coordinate(event)):e.setLoop({enabled:true,startSeconds:drag.start,endSeconds:drag.end}));});
  wave.addEventListener('pointercancel',()=>{this.drag=null;this.sync();});
  wave.addEventListener('keydown',event=>{if(e.loading)return;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();this.act(()=>e.seek(event.key==='Home'?0:event.key==='End'?e.duration:e.position+(event.key==='ArrowRight'?1:-1)));}});
  // Dock shortcuts, focus in the dock but not on a control: Space plays/pauses, arrows move 5 s (1 s on the waveform, above).
  this.shadowRoot.addEventListener('keydown',event=>{if(e.loading||!e.buffer||event.altKey||event.ctrlKey||event.metaKey||event.target.closest?.('input,button,tl-button,tl-icon-button,tl-checkbox,tl-slider'))return;
   if(event.key===' '){event.preventDefault();if(!event.repeat)this.act(()=>e.playing?e.pause():e.play());}
   else if(['ArrowLeft','ArrowRight'].includes(event.key)&&event.target!==wave){event.preventDefault();this.act(()=>e.seek(e.position+(event.key==='ArrowRight'?5:-5)));}},{signal:this.listeners.signal});
  for(const target of [wave,this.$('libraryView')])for(const type of ['dragover','drop'])target.addEventListener(type,event=>{event.preventDefault();if(e.loading)return;if(type==='drop'&&event.dataTransfer.files[0])this.openFile(event.dataTransfer.files[0]);},{signal:this.listeners.signal});
 }
 async downloadMp3(){
  const e=this.engine;if(!e.buffer||e.loading||this.downloading)return;
  const generation=e.generation;this.downloading=true;this.sync();
  try{
   const result=await this.mp3.prepare({buffer:e.buffer,sourceFile:e.sourceFile,entry:this.library.tracks.find(track=>track.id===e.track?.id),title:e.track?.title,onProgress:text=>{if(e.generation===generation)this.status(text);}});
   if(e.generation!==generation||e.loading||this.destroyed)return;
   saveAudioDownload(result);this.status('');toast('MP3 download started');
  }catch(error){if(error.name!=='AbortError')throw error;}
  finally{this.downloading=false;this.sync();}
 }
 // Library table: a My tracks section then a Factory section, each a tbody headed by its name and count.
 renderList(){
  const query=this.$('filter').value.toLocaleLowerCase(),current=this.engine.track;
  const tracks=[...(current?.local?[current]:[]),...this.library.tracks],match=track=>track.title.toLocaleLowerCase().includes(query);
  const sections=[['My tracks',tracks.filter(track=>!isFactory(track)),query?'No track matches.':this.importYoutube?'Import an audio file or a YouTube video to add your own tracks.':'Import an audio file to play along with it.'],['Factory',tracks.filter(isFactory),'No track matches.']];
  this.$('count').textContent=String(tracks.length);
  const cell=(tag,className,content)=>{const element=document.createElement(tag);element.className=className;if(content!=null)element.append(content);return element;};
  const bodies=sections.map(([name,all,emptyText])=>{
   const body=document.createElement('tbody'),head=document.createElement('tr'),th=cell('th','section',name),shown=all.filter(match);
   th.colSpan=6;th.scope='colgroup';th.append(cell('span','section-count',String(all.length)));head.append(th);body.append(head);
   for(const track of shown){
    const row=document.createElement('tr'),button=document.createElement('button'),selected=track.id===current?.id,[label,tone]=ORIGINS[originOf(track)],badge=document.createElement('tl-badge');
    button.type='button';button.title=track.title;button.setAttribute('aria-pressed',String(selected));button.append(document.createElement('i'),cell('span','name',track.title));
    badge.setAttribute('tone',tone);badge.textContent=label;if(track.projectName)badge.title=`${label} · ${track.projectName}`;
    const seconds=track.local?(selected?this.engine.duration:null):Number(track.duration);
    row.append(cell('td','title',button),cell('td','origin',badge),cell('td','added',added(track)),cell('td','num duration',seconds>0?time(seconds):'—'),cell('td','num bpm',track.bpm?String(Math.round(track.bpm)):''),cell('td','num key',track.key||''));
    if(selected)row.setAttribute('aria-selected','true');
    row.onclick=()=>this.openTrack(track);body.append(row);
   }
   if(!shown.length){const row=document.createElement('tr'),td=cell('td','empty',emptyText);td.colSpan=6;row.append(td);body.append(row);}
   return body;
  });
  this.$('list').replaceChildren(this.$('list').tHead,...bodies);
  this.revealSelected();
 }
 // Scrolls the table only (scrollIntoView would also scroll the page), below its sticky header.
 revealSelected(){const scroll=this.$('listScroll'),row=this.$('list').querySelector('tr[aria-selected=true]');if(!row||!scroll.clientHeight)return;const head=this.$('list').tHead.offsetHeight,top=row.offsetTop;if(top-head<scroll.scrollTop||top+row.offsetHeight>scroll.scrollTop+scroll.clientHeight)scroll.scrollTop=top-head-(scroll.clientHeight-head-row.offsetHeight)/2;}
 sync(){const e=this.engine;if(!e)return;this.$('downloadMix').hidden=!e.buffer;this.$('downloadMix').disabled=!!e.loading||!!this.downloading;this.$('downloadMix').textContent=this.downloading?'Preparing MP3…':'Download MP3';this.$('title').textContent=e.track?.title||'Choose a backing track';if(!e.buffer&&!e.loading&&this.view==='track')this.setView('library');this.$('play').setAttribute('icon',e.playing?'pause':'play');this.$('play').setAttribute('aria-label',e.playing?'Pause backing track':'Play backing track');this.$('play').disabled=!!e.loading||!e.buffer;this.$('separateInstruments').disabled=!!e.loading||!e.buffer;this.$('loadProgress').hidden=!e.loading;this.$('transport').classList.toggle('loading',!!e.loading);this.$('transport').setAttribute('aria-busy',String(!!e.loading));this.$('wave').inert=!!e.loading;this.$('wave').setAttribute('aria-disabled',String(!!e.loading));if(e.loading)this.drag=null;this.$('stop').disabled=!e.buffer;
  for(const [id,value]of [['volume',e.volumeDb],['rate',e.rate],['pan',e.guitarPan],['balance',e.mix]])if(this.shadowRoot.activeElement!==this.$(id))this.$(id).value=value;
  this.$('rate').disabled=!e.stretchReady;this.$('rateReset').disabled=!e.stretchReady||e.rate===1;this.$('rateValue').textContent=`${Math.round(e.rate*100)}%`;{const db=`${e.volumeDb.toFixed(0)} dB`;this.$('volume').title=db;this.$('volume').setAttribute('aria-valuetext',db);}this.$('panValue').textContent=Math.abs(e.guitarPan)<.01?'C':`${e.guitarPan<0?'L':'R'} ${Math.round(Math.abs(e.guitarPan)*100)}`;this.$('balanceValue').textContent=`${Math.round((1-e.mix)*100)} / ${Math.round(e.mix*100)}`;
  this.$('loop').setAttribute('aria-pressed',String(e.loop.enabled));this.$('loop').querySelector('span').textContent=e.loop.enabled?'On':'Off';this.$('empty').hidden=!!e.buffer||!!e.loading;this.$('auto').checked=e.autoNormalize;this.$('normalize').setAttribute('aria-pressed',String(e.normalized));this.$('mute').setAttribute('aria-pressed',String(e.muted));this.$('wave').setAttribute('aria-valuemax',e.duration);this.updateRegion(e.loop.startSeconds,e.loop.endSeconds);
 }
 updateRegion(a,b){const duration=this.engine.duration||1,whole=!this.drag&&Math.min(a,b)<=0&&Math.max(a,b)>=duration;const region=this.$('region');region.style.left=`${Math.min(a,b)/duration*100}%`;region.style.width=`${Math.abs(b-a)/duration*100}%`;region.style.opacity=whole?'0':this.engine.loop.enabled||this.drag?'1':'.25';}
 draw(){this.drawWave(this.$('wave'));}
 drawWave(wave){const canvas=wave.querySelector('canvas'),width=wave.clientWidth,height=wave.clientHeight;if(!width||!height)return;const dpr=globalThis.devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);const buffer=this.engine?.buffer;if(!buffer)return;const data=buffer.getChannelData(0),step=Math.ceil(data.length/width);ctx.fillStyle=getComputedStyle(this).getPropertyValue('--tl-accent-muted').trim()||'#91a675';ctx.globalAlpha=.55;for(let x=0;x<width;x++){let low=1,high=-1;for(let i=x*step;i<Math.min(data.length,(x+1)*step);i++){low=Math.min(low,data[i]);high=Math.max(high,data[i]);}ctx.fillRect(x,(1-high)*height/2,1,Math.max(1,(high-low)*height/2));}}
 startAnimation(){if(this.frame||!this.isConnected||this.destroyed)return;const animate=()=>{if(!document.hidden&&this.engine){const e=this.engine;this.$('position').textContent=time(e.position);this.$('duration').textContent=time(e.duration);const at=`${e.position/(e.duration||1)*100}%`;this.$('head').style.left=at;this.$('wave').setAttribute('aria-valuenow',e.position.toFixed(2));}this.frame=requestAnimationFrame(animate);};this.frame=requestAnimationFrame(animate);}
 connectedCallback(){this.appearanceChange ??= ()=>this.draw();globalThis.addEventListener('nam-appearance-change',this.appearanceChange);this.observer.observe(this.$('wave'));this.startAnimation();}
 disconnectedCallback(){globalThis.removeEventListener('nam-appearance-change',this.appearanceChange);this.observer.disconnect();cancelAnimationFrame(this.frame);this.frame=null;}
 getState(){return this.engine.getState();}setState(state){return this.engine.setState(state);}
 destroy(){this.destroyed=true;this.mp3?.cancel();this.disconnectedCallback();this.listeners?.abort();this.engine?.destroy();}
}
if(!customElements.get('backing-track-player'))customElements.define('backing-track-player',BackingTrackPlayerElement);
