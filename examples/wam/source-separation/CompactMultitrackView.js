import {buildWaveformPeaks,instrumentColors,timelineTicks} from './CompactWaveform.js';
import {MixWaveformJob} from './MixWaveform.js';

// One shared viewport, stable controls, and inert WaveSurfer renderers.
// Audio scheduling remains exclusively in MultitrackEngine.
export class CompactMultitrackView {
  constructor(root,{createRenderer,onSeek,onLoopChange=()=>{},onChange=()=>{},onError=console.error,labels={},document=root.ownerDocument,observeResize=callback=>new ResizeObserver(callback)}={}) {
    Object.assign(this,{root,createRenderer,onSeek,onLoopChange,onChange,onError,labels,document});
    this.audioVersion=0;this.rows=new Map();this.duration=0;this.zoom=1;this.destroyed=false;
    const make=(tag,cls,parent)=>{const node=document.createElement(tag);node.className=cls;parent?.append(node);return node;};this.make=make;
    this.shell=make('div','compact-player');this.controls=make('div','compact-controls',this.shell);
    make('div','mixer-caption',this.controls).textContent='Instruments · mix';
    this.viewport=make('div','wave-viewport',this.shell);this.viewport.tabIndex=0;this.viewport.setAttribute('aria-label','Défilement horizontal des pistes');
    this.viewport.onkeydown=event=>{
      if(event.target!==this.viewport)return;
      const maximum=Math.max(0,this.viewport.scrollWidth-this.viewport.clientWidth);
      const positions={Home:0,End:maximum,ArrowLeft:Math.max(0,this.viewport.scrollLeft-80),ArrowRight:Math.min(maximum,this.viewport.scrollLeft+80)};
      if(event.key in positions){event.preventDefault();this.viewport.scrollLeft=positions[event.key];}
    };
    this.content=make('div','wave-content',this.viewport);this.ruler=make('div','shared-ruler',this.content);this.ruler.setAttribute('aria-hidden','true');
    this.region=make('div','loop-region',this.content);this.region.hidden=true;
    this.handles={};
    for(const key of ['start','end']){
      const handle=make('button','loop-handle',this.region);handle.type='button';handle.textContent=key==='start'?'A':'B';handle.setAttribute('aria-label',`Boucle ${handle.textContent} — déplacer horizontalement`);this.handles[key]=handle;
      handle.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();handle.setPointerCapture(event.pointerId);this.dragging={key,id:event.pointerId};};
      handle.onpointermove=event=>{
        if(this.dragging?.key!==key||this.dragging.id!==event.pointerId)return;
        const rect=this.content.getBoundingClientRect(),value=(event.clientX-rect.left)/rect.width*this.duration;
        const bounds={...this.loopRegion},gap=Math.min(.05,this.available/2);
        bounds[key]=key==='start'?Math.max(0,Math.min(bounds.end-gap,value)):Math.max(bounds.start+gap,Math.min(this.available,value));
        this.loopRegion=bounds;this.setLoopRegion(bounds,this.loopEnabled);
      };
      handle.onpointerup=event=>{if(this.dragging?.id!==event.pointerId)return;this.dragging=null;handle.releasePointerCapture(event.pointerId);this.onLoopChange(this.loopRegion);};
      handle.onpointercancel=()=>{this.dragging=null;this.onLoopChange(this.loopRegion);};
      handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const bounds={...this.loopRegion};bounds[key]+=(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?1:.1);bounds[key]=key==='start'?Math.max(0,Math.min(bounds.end-.01,bounds[key])):Math.max(bounds.start+.01,Math.min(this.available,bounds[key]));this.onLoopChange(bounds);};
    }
    this.mixJob=new MixWaveformJob({
      onStart:()=>{if(this.mixRow){this.mixRow.note.textContent='Calcul du mix…';this.mixRow.wave.setAttribute('aria-busy','true');}},
      onResult:result=>{if(!this.mixRow||this.destroyed)return;this.mixRow.note.textContent=result.peak?`${result.activeTracks} instrument(s) · pic ${(20*Math.log10(result.peak)).toFixed(1)} dBFS`:'Mix silencieux';this.mixRow.wave.setAttribute('aria-busy','false');this.setPeaks(this.mixRow,result.peaks);},
      onError:error=>{if(this.mixRow){this.mixRow.note.textContent='Calcul du mix impossible';this.mixRow.wave.setAttribute('aria-busy','false');}this.onError(error);},
    });
    root.replaceChildren(this.shell);
    this.resize=observeResize(()=>this.renderRuler());this.resize.observe(this.viewport);
  }
  setSession(session) {
    if(this.session!==session){this.clear();this.audio=null;this.session=session;this.viewport.scrollLeft=0;}
    this.updateControls();
  }
  updateControls() {
    if(this.destroyed||!this.session)return;
    for(const track of this.session.tracks) {
      let row=this.rows.get(track.id);
      if(!row){row=this.createRow(track);this.rows.set(track.id,row);}
      const audible=this.session.isAudible(track);row.controls.dataset.audible=String(audible);row.wave.style.opacity=audible?'1':'.35';
      row.mute.setAttribute('aria-pressed',String(track.muted));row.solo.setAttribute('aria-pressed',String(track.solo));
      for(const key of ['volume','pan']) {
        if(this.document.activeElement!==row[key])row[key].value=track[key];
        row[`${key}Value`].textContent=key==='volume'?`${Math.round(track[key]*100)}%`:track[key]===0?'C':`${Math.round(Math.abs(track[key])*100)}${track[key]<0?'L':'R'}`;
      }
    }
    const collapsed=this.session.viewMode==='mix';
    if(collapsed&&!this.mixRow)this.createMixRow();
    for(const row of this.rows.values()){row.controls.hidden=collapsed;row.wave.hidden=collapsed;}
    if(this.mixRow){this.mixRow.controls.hidden=!collapsed;this.mixRow.wave.hidden=!collapsed;}
    this.shell.dataset.view=collapsed?'mix':'instruments';
    if(collapsed)this.requestMix();else this.mixJob.cancel();
    this.zoom=this.session.zoom;this.content.style.width=`${this.zoom*100}%`;this.renderRuler();
  }
  createRow(track) {
    const {make}=this,label=this.labels[track.role]||track.label||track.id,color=instrumentColors[track.role]||instrumentColors.other;
    const controls=make('div','compact-track-controls',this.controls);controls.style.setProperty('--stem-color',color);
    const name=make('strong','compact-track-name',controls);name.textContent=label;name.title=label;
    const change=patch=>{this.session.updateTrack(track.id,patch);this.onChange(this.session.tracks);this.updateControls();};
    const button=(key,text)=>{const node=make('button',`stem-${key}`,controls);node.type='button';node.textContent=text;node.setAttribute('aria-label',`${key==='mute'?'Mute':'Solo'} ${label}`);node.onclick=()=>change({[key==='mute'?'muted':key]:!track[key==='mute'?'muted':key]});return node;};
    const mute=button('mute','M'),solo=button('solo','S'),row={controls,mute,solo};
    for(const [key,min,max,caption] of [['volume',0,1.5,'Vol'],['pan',-1,1,'Pan']]) {
      const group=make('label','stem-fader',controls),text=make('span','',group);text.textContent=caption;
      const input=make('input','',group);input.type='range';input.min=min;input.max=max;input.step=.01;input.value=track[key];input.setAttribute('aria-label',`${key==='volume'?'Volume':'Pan'} ${label}`);
      const value=make('output','',group);input.oninput=()=>change({[key]:Number(input.value)});row[key]=input;row[`${key}Value`]=value;
    }
    return Object.assign(row,this.createWaveRow(label,color));
  }
  createWaveRow(label,color) {
    const wave=this.make('div','compact-wave',this.content);wave.tabIndex=0;wave.setAttribute('role','slider');wave.setAttribute('aria-label',`Position — ${label}`);wave.setAttribute('aria-valuemin','0');wave.setAttribute('aria-valuemax',String(this.duration));
    const renderer=this.createRenderer({container:wave,height:44,waveColor:color,progressColor:color,cursorColor:'#fff',cursorWidth:1,fillParent:true,minPxPerSec:0,normalize:false,autoScroll:false,autoCenter:false,hideScrollbar:true,interact:false,dragToSeek:false,barWidth:2,barGap:1});
    const row={wave,renderer,position:this.position||0};
    row.unsubscribe=renderer.on('click',fraction=>this.seek(fraction*this.duration));
    wave.onkeydown=event=>{const keys={ArrowRight:1,ArrowLeft:-1,Home:-Infinity,End:Infinity};if(!(event.key in keys))return;event.preventDefault();this.seek(event.key==='Home'?0:event.key==='End'?this.available:row.position+keys[event.key]);};
    return row;
  }
  createMixRow() {
    const controls=this.make('div','compact-track-controls mix-summary-controls',this.controls);
    const name=this.make('strong','',controls);name.textContent='Mix courant';
    const note=this.make('small','',controls);note.setAttribute('role','status');note.textContent='Calcul du mix…';
    this.mixRow={controls,note,...this.createWaveRow('Mix courant','#c7f65b')};
  }
  requestMix() {
    if(!this.audio||this.destroyed||this.session?.viewMode!=='mix')return;
    const settings=this.session.tracks.map(track=>({...track}));
    const key=JSON.stringify([this.audioVersion,this.audio.outputGain??1,settings]);
    this.mixJob.request({...this.audio,settings},key);
  }
  setOutputGain(value) {if(this.audio&&this.audio.outputGain!==value){this.audio={...this.audio,outputGain:value};this.requestMix();}}
  setPeaks(row,peaks) {
    row.wave.setAttribute('aria-valuemax',String(this.available));
    row.pending={duration:this.duration,length:peaks.length,numberOfChannels:1,sampleRate:peaks.length/this.duration,getChannelData:()=>peaks};this.draw(row);
  }
  seek(seconds){this.onSeek(Math.max(0,Math.min(this.available||0,seconds)));}
  setAudio({tracks,chunks,totalFrames,duration,availableDuration=duration,outputGain=1}) {
    if(this.destroyed||!this.session||!totalFrames)return;
    this.duration=duration;this.available=availableDuration;
    this.audio={tracks,chunks,totalFrames,duration,outputGain};++this.audioVersion;
    for(const [index,track] of tracks.entries()) {
      const row=this.rows.get(track.id);if(!row)continue;
      const buffers=chunks?chunks.map(chunk=>chunk.tracks[index].buffer):[track.buffer];
      const peaks=buildWaveformPeaks(buffers,totalFrames);
      this.setPeaks(row,peaks);
    }
    this.content.style.setProperty('--available',`${Math.min(100,availableDuration/duration*100)}%`);this.renderRuler();this.requestMix();
  }
  async draw(row) {
    if(row.drawing)return;row.drawing=true;
    try {while(row.pending&&!this.destroyed&&!row.disposed){const data=row.pending;row.pending=null;await row.renderer.render(data);if(!this.destroyed&&!row.disposed)row.renderer.renderProgress(this.duration?row.position/this.duration:0,false);}}
    catch(error){if(!this.destroyed&&!row.disposed)this.onError(error);}
    finally{row.drawing=false;}
  }
  renderRuler() {
    const ticks=timelineTicks(this.duration,this.viewport.clientWidth||600,this.zoom);
    this.ruler.replaceChildren(...ticks.map(tick=>{const node=this.make('span','');node.style.left=`${tick.fraction*100}%`;node.textContent=tick.label;return node;}));
  }
  setLoopRegion(bounds,enabled=true) {
    if(this.dragging&&bounds!==this.loopRegion)return;
    this.loopRegion={...bounds};this.loopEnabled=enabled;this.region.hidden=!this.duration;
    this.region.style.left=`${bounds.start/this.duration*100}%`;this.region.style.width=`${(bounds.end-bounds.start)/this.duration*100}%`;this.region.style.opacity=enabled?'1':'.45';
    for(const key of ['start','end'])this.handles[key].title=`${key==='start'?'A':'B'} : ${bounds[key].toFixed(2)} s`;
  }
  setPosition(seconds) {
    if(this.destroyed)return;
    this.position=seconds;
    for(const row of [...this.rows.values(),...(this.mixRow?[this.mixRow]:[])]) {row.position=seconds;row.wave.setAttribute('aria-valuenow',seconds.toFixed(2));row.renderer.renderProgress(this.duration?Math.max(0,Math.min(1,seconds/this.duration)):0,false);}
  }
  clear(){this.mixJob?.cancel();for(const row of [...this.rows.values(),...(this.mixRow?[this.mixRow]:[])]){row.disposed=true;row.pending=null;row.unsubscribe?.();row.renderer.destroy();row.wave.remove();row.controls.remove();}this.rows.clear();this.mixRow=null;}
  destroy(){this.destroyed=true;this.resize.disconnect();this.clear();this.shell.remove();}
}
