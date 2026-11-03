import {createTempoProposal,nearestBeat,waveformPeaks} from './TempoProposal.js';
import {TempoPreviewPlayer} from './TempoPreviewPlayer.js';

export class TempoPreviewView {
  constructor(document) {
    this.document=document;this.$=id=>document.getElementById(id);this.canvas=this.$('beats');this.ctx=this.canvas.getContext('2d');
    this.player=new TempoPreviewPlayer({onEnded:()=>this.stopped(true)});
    for(const [id,multiplier]of [['halfTempo',.5],['originalTempo',1],['doubleTempo',2]])this.$(id).onclick=()=>{this.options.multiplier=multiplier;this.change();};
    this.$('anchor').onchange=()=>{this.options.anchorTime=this.$('anchor').value===''?null:Number(this.$('anchor').value);this.change();};
    this.$('barBeats').onchange=()=>{this.options.beatsPerBar=this.$('barBeats').value===''?null:Number(this.$('barBeats').value);this.change();};
    for(const id of ['previewA','previewB'])this.$(id).oninput=()=>{this.options.rangeStart=this.$('previewA').valueAsNumber;this.options.rangeEnd=this.$('previewB').valueAsNumber;this.change({syncFields:false});};
    this.$('resetPreview').onclick=()=>{this.resetOptions();this.change();};
    this.$('stopPreview').onclick=()=>{this.player.stop();this.stopped();};
    this.$('previewClick').onchange=()=>this.player.setClickEnabled(this.$('previewClick').checked);
    this.$('clickVolume').oninput=()=>this.player.setClickVolume(Number(this.$('clickVolume').value)/100);
    this.$('previewPlay').onclick=async()=>{
      if(!this.proposal)return;
      this.$('audio').pause();const analysis=this.analysis;
      try {
        const started=await this.player.play(this.buffer,this.proposal,{click:this.$('previewClick').checked,clickVolume:Number(this.$('clickVolume').value)/100});
        if(!started||analysis!==this.analysis)return;
        this.$('previewStatus').textContent='Préécoute du son original avec les repères proposés.';this.refreshButtons();this.animate();
      }catch(error){if(analysis!==this.analysis)return;this.$('previewStatus').textContent=error.message;this.refreshButtons();}
    };
    this.$('audio').addEventListener('play',()=>{this.player.stop();this.stopped();});
    this.canvas.addEventListener('click',event=>{
      if(!this.proposal||this.busy)return;
      const rect=this.canvas.getBoundingClientRect(),time=(event.clientX-rect.left)/rect.width*this.analysis.duration;
      const anchor=nearestBeat(this.proposal.allBeats,time);if(anchor===null)return;
      this.options.anchorTime=anchor;this.change();
    });
    this.clear();
  }
  setBusy(busy){this.busy=busy;if(busy){this.player.stop();this.stopped();}this.refreshButtons();}
  refreshButtons(){this.$('previewControls').disabled=this.busy||!this.analysis;this.$('previewPlay').disabled=this.busy||!this.proposal;this.$('stopPreview').disabled=!this.player.playing;}
  resetOptions(){this.options={multiplier:1,anchorTime:null,beatsPerBar:null,rangeStart:0,rangeEnd:this.analysis.duration};}
  setSource(buffer,analysis){
    this.player.stop();this.buffer=buffer;this.analysis=analysis;this.resetOptions();
    this.peaks=waveformPeaks(Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c)),buffer.sampleRate,analysis.duration,this.canvas.width);
    this.change();
  }
  clear(){
    this.player.stop();cancelAnimationFrame(this.animation);this.analysis=null;this.proposal=null;this.buffer=null;this.base=null;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.$('previewStats').textContent='Analyser un fichier pour préparer une préécoute.';this.$('previewStatus').textContent='';this.$('previewPosition').textContent='';this.refreshButtons();
  }
  stopped(ended=false){cancelAnimationFrame(this.animation);if(this.base)this.ctx.putImageData(this.base,0,0);if(this.analysis)this.$('previewStatus').textContent=ended?'Préécoute terminée.':'Préécoute arrêtée.';this.$('previewPosition').textContent='';this.refreshButtons();}
  change({syncFields=true}={}){
    this.player.stop();this.stopped();
    try {
      this.proposal=createTempoProposal(this.analysis,this.options);
      const p=this.proposal;
      this.$('previewA').max=String(this.analysis.duration);this.$('previewB').max=String(this.analysis.duration);
      if(syncFields){this.$('previewA').value=String(p.rangeStart);this.$('previewB').value=String(p.rangeEnd);}
      this.$('barBeats').value=this.options.beatsPerBar===null?'':String(this.options.beatsPerBar);
      const select=this.$('anchor');select.replaceChildren(new Option('Repères du modèle',''));
      p.allBeats.forEach(time=>select.add(new Option(`${time.toFixed(3)} s`,String(time))));select.value=this.options.anchorTime===null?'':String(p.anchorTime);
      for(const [id,factor]of [['halfTempo',.5],['originalTempo',1],['doubleTempo',2]])this.$(id).setAttribute('aria-pressed',String(factor===this.options.multiplier));
      this.$('previewStats').textContent=`Proposition : ${p.beats.length} battements dans A/B · ${p.medianBpm?.toFixed(2)||'—'} BPM · ${this.options.anchorTime===null&&this.options.beatsPerBar===null?'débuts de mesures du modèle':`mesures de ${this.options.beatsPerBar||4} battements, premier temps à ${p.anchorTime?.toFixed(3)||'—'} s`}.`;
      this.$('previewStatus').textContent='Prévisualisation uniquement : le son et le projet ne sont pas modifiés.';
      this.draw();
    }catch(error){this.proposal=null;this.base=null;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.$('previewStats').textContent='Proposition indisponible pour cette plage.';this.$('previewStatus').textContent=error.message;}
    this.refreshButtons();
  }
  draw(){
    const {ctx,canvas}=this,w=canvas.width,h=canvas.height,p=this.proposal;ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#152019';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#6a8b91';ctx.beginPath();
    for(let x=0;x<this.peaks.length;x++){const amplitude=Math.min(1,this.peaks[x])*(h-40)/2;ctx.moveTo(x,h/2-amplitude);ctx.lineTo(x,h/2+amplitude);}ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(0,0,p.rangeStart/p.duration*w,h);ctx.fillRect(p.rangeEnd/p.duration*w,0,w,h);
    for(const [times,color]of [[p.allBeats,'#bdea74'],[p.allDownbeats,'#ffaf69']]){ctx.strokeStyle=color;ctx.beginPath();for(const time of times){const x=time/p.duration*w;ctx.moveTo(x,14);ctx.lineTo(x,h-22);}ctx.stroke();}
    ctx.font='12px system-ui';ctx.fillStyle='#e4ede2';for(let i=0;i<=5;i++){const t=p.duration*i/5;ctx.fillText(`${t.toFixed(1)}s`,Math.min(w-42,i*w/5+3),h-5);}
    for(const [time,label]of [[p.rangeStart,'A'],[p.rangeEnd,'B']]){const x=time/p.duration*w;ctx.fillStyle='#fff';ctx.fillText(label,Math.max(1,Math.min(w-12,x)),12);}
    this.base=ctx.getImageData(0,0,w,h);
  }
  animate(){
    if(!this.player.playing)return;this.ctx.putImageData(this.base,0,0);
    this.$('previewPosition').textContent=`Position : ${this.player.position.toFixed(2)} s / ${this.proposal.rangeEnd.toFixed(2)} s`;
    const x=this.player.position/this.analysis.duration*this.canvas.width;this.ctx.strokeStyle='#ff6688';this.ctx.beginPath();this.ctx.moveTo(x,0);this.ctx.lineTo(x,this.canvas.height);this.ctx.stroke();
    this.animation=requestAnimationFrame(()=>this.animate());
  }
  exportProposal(){return this.proposal;}
  dispose(){cancelAnimationFrame(this.animation);return this.player.dispose();}
}
