import {BackingTrackEngine} from './BackingTrackEngine.js';
import {BackingTrackLibrary} from './BackingTrackLibrary.js';
import '../ui/components/tl-slider.js';
import '../ui/components/tl-checkbox.js';
import '../ui/components/tl-button.js';
import '../ui/components/tl-icon-button.js';
import '../ui/components/tl-icon.js';
const time=s=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
export class BackingTrackPlayerElement extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.innerHTML=`
 <link rel="stylesheet" href="${new URL('./backing-track-player.css',import.meta.url)}">
 <section aria-label="Play along" tabindex="-1">
 <header id="transport">
  <button id="expand" class="dock-toggle" aria-expanded="false" aria-controls="body"><tl-icon name="chevron" size="14"></tl-icon><span>Play along</span></button>
  <button id="title" class="track-title" aria-controls="body">Choose a backing track</button>
  <div class="transport-buttons"><tl-icon-button id="stop" icon="stop" size="sm" aria-label="Stop backing track"></tl-icon-button><tl-icon-button id="play" class="play" icon="play" aria-label="Play backing track"></tl-icon-button></div>
  <div id="miniWave" class="mini-wave" aria-hidden="true"><canvas></canvas><div id="miniRegion" class="region"></div><div id="miniHead" class="head"></div></div>
  <output id="clock" class="clock">0:00 / 0:00</output>
  <label class="header-control speed">Speed <tl-slider bipolar><input id="rate" type="range" min=".7" max="1.3" step=".01" value="1" disabled aria-label="Playback speed"></tl-slider><output id="rateValue">100%</output></label>
  <label class="header-control volume"><span class="label-text">Volume</span> <tl-slider><input id="volume" type="range" min="-60" max="6" step=".5" value="-12" aria-label="Backing track volume"></tl-slider><output id="volumeValue">\u221212 dB</output></label>
  <tl-button id="mute" size="sm" aria-pressed="false">Mute</tl-button>
  <span id="mixMeter" class="meter" role="meter" aria-label="Combined output level" aria-valuemin="-60" aria-valuemax="0" aria-valuenow="-60"><i></i></span>
 </header>
 <div id="status" role="status" aria-live="polite">Loading library\u2026</div>
 <div id="body" hidden><aside><div class="library-head"><span id="count">Library</span><tl-button id="import" size="sm" variant="ghost" icon="plus">Import audio\u2026</tl-button></div><input id="filter" type="search" placeholder="Filter tracks" aria-label="Filter backing tracks"><div id="list" role="group" aria-label="Backing tracks"></div></aside>
 <main><div class="wave-container"><div id="wave" tabindex="0" role="slider" aria-label="Position in backing track" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><canvas></canvas><div id="region" class="region"></div><div id="head" class="head"></div><span class="hint">Click to seek \u00b7 Drag to loop \u00b7 Drop audio \u00b7 Space to play</span></div><div id="loadProgress" hidden><div id="loadRing" role="progressbar" aria-label="Audio download" aria-valuemin="0" aria-valuemax="100"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="load-track" cx="40" cy="40" r="33"/><circle id="loadArc" cx="40" cy="40" r="33" pathLength="100"/></svg><strong id="loadPercent">0%</strong></div><span id="loadPhase">Downloading\u2026</span></div></div>
 <div class="tools">
  <div class="tool"><span class="tool-head">Guitar \u2194 Backing <output id="balanceValue">50 / 50</output></span><tl-slider bipolar><input id="balance" type="range" min="0" max="1" step=".01" value=".5" aria-label="Guitar to backing balance"></tl-slider><tl-button id="balanceReset" size="sm" variant="ghost">Reset</tl-button></div>
  <div class="tool"><span class="tool-head">Guitar pan <output id="panValue">C</output></span><tl-slider bipolar><input id="pan" type="range" min="-1" max="1" step=".01" value="0" aria-label="Guitar global pan"></tl-slider><tl-button id="panReset" size="sm" variant="ghost">Reset</tl-button></div>
  <div class="tool loop"><span class="tool-head"><label><tl-checkbox variant="switch"><input id="loop" type="checkbox" checked></tl-checkbox> Loop A\u2013B</label></span><div class="loop-points"><label>A <input id="a" type="number" min="0" step=".01" value="0" aria-label="Loop start seconds"></label><label>B <input id="b" type="number" min="0" step=".01" value="0" aria-label="Loop end seconds"></label><tl-button id="full" size="sm" variant="ghost">Full track</tl-button></div></div>
  <div class="tool"><span class="tool-head">Level</span><div class="normalize"><tl-button id="normalize" size="sm" aria-pressed="false">Normalize</tl-button><label><tl-checkbox variant="switch"><input id="auto" type="checkbox" checked></tl-checkbox> at load</label><tl-button id="rateReset" size="sm" variant="ghost">Reset speed</tl-button></div></div>
 </div></main></div>
 <input id="file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" hidden></section>`;
 this.$=id=>this.shadowRoot.getElementById(id);this.observer=new ResizeObserver(()=>this.draw());
 }
 async initialize({audioContext,library=new BackingTrackLibrary()}){
  if(this.engine)throw Error('Player already initialized');this.library=library;this.engine=new BackingTrackEngine(audioContext,library);this.listeners=new AbortController();
  for(const type of ['track-change','transport-change','load-progress','mix-change','guitar-pan-change','player-error'])this.engine.addEventListener(type,event=>{
   if(type==='track-change'){this.draw();this.renderList();this.status('');}
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
 get expanded(){return !this.$('body').hidden;}
 setExpanded(expanded){this.$('body').hidden=!expanded;this.toggleAttribute('expanded',!!expanded);this.$('expand').setAttribute('aria-expanded',String(!!expanded));this.$('title').setAttribute('aria-expanded',String(!!expanded));this.sync();if(expanded)this.draw();this.dispatchEvent(new CustomEvent('expand-change',{detail:{expanded:!!expanded},bubbles:true,composed:true}));}
 status(message,error=false){this.$('status').textContent=message;this.$('status').classList.toggle('error',error);}
 act(operation){return Promise.resolve().then(operation).catch(error=>{this.status(error.message,true);this.sync();this.dispatchEvent(new CustomEvent('player-error',{detail:{message:error.message},bubbles:true,composed:true}));});}
 bind(){
  const e=this.engine,on=(id,event,fn)=>this.$(id).addEventListener(event,()=>this.act(fn),{signal:this.listeners.signal});
  on('play','click',()=>e.playing?e.pause():e.play());on('stop','click',()=>e.stop());
  const toggle=()=>this.setExpanded(this.$('body').hidden);on('expand','click',toggle);on('title','click',toggle);
  on('volume','input',()=>e.setVolumeDb(this.$('volume').value));on('mute','click',()=>e.setMuted(!e.muted));
  for(const [id,setter,reset] of [['rate','setRate',1],['pan','setGuitarPan',0],['balance','setMix',.5]]){on(id,'input',()=>e[setter](this.$(id).value));on(id+'Reset','click',()=>e[setter](reset));}
  for(const id of ['loop','a','b'])on(id,'change',()=>e.setLoop({enabled:this.$('loop').checked,startSeconds:this.$('a').value,endSeconds:this.$('b').value}));
  on('full','click',()=>e.setLoop({startSeconds:0,endSeconds:e.duration}));on('normalize','click',()=>e.setNormalized(!e.normalized));on('auto','change',()=>{e.autoNormalize=this.$('auto').checked;e.changed();});
  on('filter','input',()=>this.renderList());on('import','click',()=>this.$('file').click());on('file','change',()=>{const file=this.$('file').files[0];this.$('file').value='';return file&&e.loadFile(file);});
  const wave=this.$('wave'),coordinate=event=>Math.max(0,Math.min(1,(event.clientX-wave.getBoundingClientRect().left)/wave.clientWidth))*e.duration;
  wave.addEventListener('pointerdown',event=>{if(e.loading||event.button!==0||!e.buffer)return;this.drag={x:event.clientX,start:coordinate(event),end:coordinate(event)};wave.setPointerCapture(event.pointerId);});
  wave.addEventListener('pointermove',event=>{if(this.drag){this.drag.end=coordinate(event);this.updateRegion(this.drag.start,this.drag.end);}});
  wave.addEventListener('pointerup',event=>{if(e.loading||!this.drag)return;const drag=this.drag;this.drag=null;this.act(()=>Math.abs(event.clientX-drag.x)<5?e.seek(coordinate(event)):e.setLoop({enabled:true,startSeconds:drag.start,endSeconds:drag.end}));});
  const mini=this.$('miniWave');mini.addEventListener('click',event=>{if(e.loading||!e.buffer)return;this.act(()=>e.seek(Math.max(0,Math.min(1,(event.clientX-mini.getBoundingClientRect().left)/mini.clientWidth))*e.duration));},{signal:this.listeners.signal});
  wave.addEventListener('pointercancel',()=>{this.drag=null;this.sync();});
  wave.addEventListener('keydown',event=>{if(e.loading)return;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();this.act(()=>e.seek(event.key==='Home'?0:event.key==='End'?e.duration:e.position+(event.key==='ArrowRight'?1:-1)));}});
  // Dock shortcuts, focus in the dock but not on a control: Space plays/pauses, arrows move 5 s (1 s on the waveform, above).
  this.shadowRoot.addEventListener('keydown',event=>{if(e.loading||!e.buffer||event.altKey||event.ctrlKey||event.metaKey||event.target.closest?.('input,button,tl-button,tl-icon-button,tl-checkbox,tl-slider'))return;
   if(event.key===' '){event.preventDefault();if(!event.repeat)this.act(()=>e.playing?e.pause():e.play());}
   else if(['ArrowLeft','ArrowRight'].includes(event.key)&&event.target!==wave){event.preventDefault();this.act(()=>e.seek(e.position+(event.key==='ArrowRight'?5:-5)));}},{signal:this.listeners.signal});
  for(const type of ['dragover','drop'])wave.addEventListener(type,event=>{event.preventDefault();if(e.loading)return;if(type==='drop'&&event.dataTransfer.files[0])this.act(()=>e.loadFile(event.dataTransfer.files[0]));});
 }
 renderList(){const query=this.$('filter').value.toLocaleLowerCase();const tracks=[...(this.engine.track?.local?[this.engine.track]:[]),...this.library.tracks];this.$('count').textContent=`${tracks.length} tracks`;this.$('list').replaceChildren();
  for(const track of tracks.filter(t=>t.title.toLocaleLowerCase().includes(query))){const button=document.createElement('button');button.textContent=track.title;button.title=track.title;button.setAttribute('aria-pressed',String(track.id===this.engine.track?.id));button.onclick=()=>this.act(()=>track.local?this.engine.seek(0):this.engine.loadTrack(track.id));this.$('list').append(button);}
 }
 sync(){const e=this.engine;if(!e)return;this.$('title').textContent=e.track?.title||'Choose a backing track';this.$('play').setAttribute('icon',e.playing?'pause':'play');this.$('play').setAttribute('aria-label',e.playing?'Pause backing track':'Play backing track');this.$('play').disabled=!!e.loading||!e.buffer;this.$('loadProgress').hidden=!e.loading||this.$('body').hidden;this.$('transport').classList.toggle('loading',!!e.loading);this.$('transport').setAttribute('aria-busy',String(!!e.loading));this.$('wave').inert=!!e.loading;this.$('wave').setAttribute('aria-disabled',String(!!e.loading));if(e.loading)this.drag=null;this.$('stop').disabled=!e.buffer;
  for(const [id,value]of [['volume',e.volumeDb],['rate',e.rate],['pan',e.guitarPan],['balance',e.mix],['a',e.loop.startSeconds],['b',e.loop.endSeconds]])if(this.shadowRoot.activeElement!==this.$(id))this.$(id).value=value;
  this.$('rate').disabled=!e.stretchReady;this.$('rateReset').disabled=!e.stretchReady||e.rate===1;this.$('rateValue').textContent=`${Math.round(e.rate*100)}%`;this.$('volumeValue').textContent=`${e.volumeDb.toFixed(0)} dB`;this.$('panValue').textContent=Math.abs(e.guitarPan)<.01?'C':`${e.guitarPan<0?'L':'R'} ${Math.round(Math.abs(e.guitarPan)*100)}`;this.$('balanceValue').textContent=`${Math.round((1-e.mix)*100)} / ${Math.round(e.mix*100)}`;
  this.$('loop').checked=e.loop.enabled;this.$('auto').checked=e.autoNormalize;this.$('normalize').setAttribute('aria-pressed',String(e.normalized));this.$('mute').setAttribute('aria-pressed',String(e.muted));this.$('wave').setAttribute('aria-valuemax',e.duration);this.updateRegion(e.loop.startSeconds,e.loop.endSeconds);
 }
 updateRegion(a,b){const duration=this.engine.duration||1,whole=!this.drag&&Math.min(a,b)<=0&&Math.max(a,b)>=duration;for(const id of ['region','miniRegion']){const region=this.$(id);region.style.left=`${Math.min(a,b)/duration*100}%`;region.style.width=`${Math.abs(b-a)/duration*100}%`;region.style.opacity=whole?'0':this.engine.loop.enabled||this.drag?'1':'.25';}}
 draw(){for(const wave of [this.$('wave'),this.$('miniWave')])this.drawWave(wave);}
 drawWave(wave){const canvas=wave.querySelector('canvas'),width=wave.clientWidth,height=wave.clientHeight;if(!width||!height)return;const dpr=globalThis.devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);const buffer=this.engine?.buffer;if(!buffer)return;const data=buffer.getChannelData(0),step=Math.ceil(data.length/width);ctx.fillStyle=getComputedStyle(this).getPropertyValue('--tl-accent-muted').trim()||'#91a675';for(let x=0;x<width;x++){let low=1,high=-1;for(let i=x*step;i<Math.min(data.length,(x+1)*step);i++){low=Math.min(low,data[i]);high=Math.max(high,data[i]);}ctx.fillRect(x,(1-high)*height/2,1,Math.max(1,(high-low)*height/2));}}
 startAnimation(){if(this.frame||!this.isConnected||this.destroyed)return;const animate=()=>{if(!document.hidden&&this.engine){const e=this.engine;this.$('clock').textContent=`${time(e.position)} / ${time(e.duration)}`;const at=`${e.position/(e.duration||1)*100}%`;this.$('head').style.left=at;this.$('miniHead').style.left=at;this.$('wave').setAttribute('aria-valuenow',e.position.toFixed(2));if(this.readMixLevel){const value=this.readMixLevel();this.$('mixMeter').style.setProperty('--level',value.level);this.$('mixMeter').setAttribute('aria-valuenow',Math.max(-60,Math.min(0,value.db)).toFixed(1));if(value.peak>=1)this.clipUntil=performance.now()+1000;this.$('mixMeter').classList.toggle('clip',performance.now()<this.clipUntil);}}this.frame=requestAnimationFrame(animate);};this.frame=requestAnimationFrame(animate);}
 connectedCallback(){this.observer.observe(this.$('wave'));this.observer.observe(this.$('miniWave'));this.startAnimation();}
 disconnectedCallback(){this.observer.disconnect();cancelAnimationFrame(this.frame);this.frame=null;}
 getState(){return this.engine.getState();}setState(state){return this.engine.setState(state);}
 destroy(){this.destroyed=true;this.disconnectedCallback();this.listeners?.abort();this.engine?.destroy();}
}
if(!customElements.get('backing-track-player'))customElements.define('backing-track-player',BackingTrackPlayerElement);
