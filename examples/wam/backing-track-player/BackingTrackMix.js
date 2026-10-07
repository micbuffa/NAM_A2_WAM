import {AudioLevel} from '../AudioLevel.js';
export class BackingTrackMix {
 constructor(context,rackOutput,player){
  this.context=context;this.rackOutput=rackOutput;this.player=player;
  this.guitarPan=context.createStereoPanner();this.guitarGain=context.createGain();this.backingGain=context.createGain();this.output=context.createGain();
  rackOutput.connect(this.guitarPan).connect(this.guitarGain).connect(this.output);
  player.engine.outputNode.connect(this.backingGain).connect(this.output);this.output.connect(context.destination);
  this.meter=new AudioLevel(context,this.output);player.readMixLevel=()=>this.meter.read();
  this.abort=new AbortController();for(const type of ['transport-change','mix-change','guitar-pan-change'])player.addEventListener(type,()=>this.sync(),{signal:this.abort.signal});this.sync();
 }
 sync(){const e=this.player.engine,t=this.context.currentTime;this.guitarGain.gain.setTargetAtTime(e.playing?Math.min(1,2*(1-e.mix)):1,t,.015);this.backingGain.gain.setTargetAtTime(Math.min(1,2*e.mix),t,.015);this.guitarPan.pan.setTargetAtTime(e.guitarPan,t,.015);}
 destroy(){this.abort.abort();this.rackOutput.disconnect(this.guitarPan);this.player.engine.outputNode.disconnect(this.backingGain);this.player.readMixLevel=null;this.meter.destroy();for(const node of [this.guitarPan,this.guitarGain,this.backingGain,this.output])node.disconnect();}
}
