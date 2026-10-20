import {BackingTrackMix} from '../backing-track-player/BackingTrackMix.js';
const clamp=(value,min,max)=>{value=Number(value);if(!Number.isFinite(value))throw Error('Réglage de mix invalide.');return Math.max(min,Math.min(max,value));};
// Adapter to the host's existing post-rack mixer. The host can inject its rack
// output as guitarSource and its shared AudioContext; no new context is created.
export class SeparationMixer extends EventTarget {
  constructor(context,{guitarSource=context.createGain(),mixFactory=(...args)=>new BackingTrackMix(...args)}={}) {
    super();this.context=context;this.guitarInput=guitarSource;this.backingInput=context.createGain();this.globalGain=context.createGain();this.backingInput.connect(this.globalGain);
    this.volumeDb=0;this.muted=false;this.mix=.5;this.guitarPan=0;
    const owner=this;this.engine={outputNode:this.globalGain,get playing(){return !!owner.activeEngine?.playing;},get mix(){return owner.mix;},get guitarPan(){return owner.guitarPan;}};
    this.routing=mixFactory(context,guitarSource,this);this.syncGain();
    this.transportChanged=()=>this.dispatchEvent(new Event('transport-change'));
  }
  setActiveEngine(engine){this.activeEngine?.removeEventListener('statechange',this.transportChanged);this.activeEngine=engine;engine?.addEventListener('statechange',this.transportChanged);this.transportChanged();}
  syncGain(){this.globalGain.gain.setTargetAtTime(this.muted?0:10**(this.volumeDb/20),this.context.currentTime,.01);}
  update(changes={}) {
    const next={...this.getState()};
    if('volumeDb'in changes)next.volumeDb=clamp(changes.volumeDb,-60,6);
    if('mix'in changes)next.mix=clamp(changes.mix,0,1);
    if('guitarPan'in changes)next.guitarPan=clamp(changes.guitarPan,-1,1);
    if('muted'in changes)next.muted=!!changes.muted;
    Object.assign(this,next);this.syncGain();this.dispatchEvent(new Event('mix-change'));this.dispatchEvent(new Event('change'));
  }
  backingWaveformGain(){return (this.muted?0:10**(this.volumeDb/20))*Math.min(1,2*this.mix);}
  getState(){return {volumeDb:this.volumeDb,muted:this.muted,mix:this.mix,guitarPan:this.guitarPan};}
  destroy(){this.setActiveEngine(null);this.routing.destroy();this.backingInput.disconnect();this.globalGain.disconnect();}
}
