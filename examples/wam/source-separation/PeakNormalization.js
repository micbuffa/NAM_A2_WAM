import {buildMixPeaks} from './MixWaveform.js';

// Sample-peak normalization, not loudness normalization or a true-peak limiter.
// Measure the stereo SUM after stem controls and the fixed player gain, before
// user master volume / guitar balance. Never normalize stems independently.
export function peakCorrection(peak,{targetDb=-1,maxBoostDb=24}={}) {
  if(!Number.isFinite(peak)||peak<0||!Number.isFinite(targetDb)||targetDb< -24||targetDb>0||!Number.isFinite(maxBoostDb)||maxBoostDb<0||maxBoostDb>24)throw Error('Mesure de normalisation invalide.');
  if(peak<=1e-8)return {gain:1,gainDb:0,peak,targetDb,silent:true,limited:false};
  const wanted=10**(targetDb/20)/peak,gain=Math.min(wanted,10**(maxBoostDb/20));
  return {gain,gainDb:20*Math.log10(gain),peak,targetDb,silent:false,limited:gain<wanted};
}

export class PeakNormalization extends EventTarget {
  constructor(engine,session,{compute=buildMixPeaks}={}) {
    super();Object.assign(this,{engine,session,compute});this.generation=0;this.enabled=false;this.status='idle';this.targetDb=-1;
    this.signature=this.inputSignature();this.observe=()=>{
      const signature=this.inputSignature();if(signature!==this.signature){this.signature=signature;const stale=!!this.result||this.busy;this.reset();if(stale){this.status='stale';this.changed();}}
    };
    engine.addEventListener('statechange',this.observe);session.addEventListener('change',this.observe);
  }
  get available(){return !!this.engine.tracks.length&&(!this.engine.progressive||this.engine.complete)&&this.engine.duration>0;}
  inputSignature(){return JSON.stringify([this.engine.audioVersion,this.engine.duration,this.engine.availableFrames,this.engine.complete,this.engine.outputNode.gain.value,this.session.tracks.map(({id,volume,pan,muted,solo})=>[id,volume,pan,muted,solo])]);}
  changed(){this.dispatchEvent(new Event('change'));}
  reset(){++this.generation;this.controller?.abort();this.controller=null;this.busy=false;this.result=null;this.enabled=false;this.status='idle';this.engine.setNormalizationGain(1);this.changed();}
  setEnabled(enabled){
    this.enabled=!!enabled&&!!this.result&&!this.result.silent;
    this.engine.setNormalizationGain(this.enabled?this.result.gain:1);this.changed();
  }
  setTargetDb(value){peakCorrection(1,{targetDb:value});this.targetDb=value;this.reset();}
  async analyze({targetDb=this.targetDb}={}) {
    if(this.destroyed)throw Error('Analyseur fermé.');
    if(!this.available)throw Error('Attendez la fin du calcul avant de normaliser le mix.');
    peakCorrection(1,{targetDb}); // Validate before changing a working correction.
    this.targetDb=targetDb;this.reset();const generation=this.generation,controller=new AbortController();this.controller=controller;this.busy=true;this.status='analyzing';this.changed();
    const engine=this.engine,totalFrames=engine.progressive?engine.totalFrames:engine.tracks[0].buffer.length;
    try {
      const result=await this.compute({tracks:engine.tracks,chunks:engine.progressive?engine.chunks:undefined,totalFrames,
        settings:this.session.tracks.map(track=>({...track})),outputGain:engine.outputNode.gain.value,bins:1},{signal:controller.signal});
      if(generation!==this.generation||controller.signal.aborted)return null;
      if(result.availableFrames!==totalFrames)throw Error('Le mix à analyser est incomplet.');
      this.result=peakCorrection(result.peak,{targetDb});this.busy=false;this.controller=null;
      this.status=this.result.silent?'silent':this.result.limited?'limited':'ready';this.setEnabled(!this.result.silent);return this.result;
    } catch(error) {
      if(generation!==this.generation||controller.signal.aborted)return null;
      this.busy=false;this.controller=null;this.status='error';this.changed();throw error;
    }
  }
  getState(){return {targetDb:this.targetDb,enabled:this.enabled,result:this.result?{...this.result}:null};}
  destroy(){this.destroyed=true;this.engine.removeEventListener('statechange',this.observe);this.session.removeEventListener('change',this.observe);this.reset();}
}
