// Standalone audition transport. No project tempo, recording graph or DI mutation.
export class TempoPreviewPlayer {
  constructor({contextFactory=()=>new AudioContext(),setIntervalImpl=(fn,ms)=>globalThis.setInterval(fn,ms),clearIntervalImpl=id=>globalThis.clearInterval(id),onEnded=()=>{}}={}) {
    Object.assign(this,{contextFactory,setIntervalImpl,clearIntervalImpl,onEnded});this.generation=0;this.voices=new Set();this.click=true;this.clickVolume=.15;
  }
  get position(){return this.playing?Math.min(this.proposal.rangeEnd,this.proposal.rangeStart+Math.max(0,this.context.currentTime-this.startAt)):null;}
  async play(buffer,proposal,{click=true,clickVolume=.15}={}) {
    this.stop();const generation=++this.generation;
    if(!buffer||!proposal||!Number.isFinite(proposal.rangeStart)||!Number.isFinite(proposal.rangeEnd)||proposal.rangeStart<0||proposal.rangeEnd>buffer.duration||proposal.rangeEnd<=proposal.rangeStart||!Array.isArray(proposal.beats)||proposal.beats.some((t,i)=>!Number.isFinite(t)||t<proposal.rangeStart||t>=proposal.rangeEnd||(i&&t<=proposal.beats[i-1])))throw Error('Invalid preview audio range.');
    this.context ||=this.contextFactory();await this.context.resume();
    if(generation!==this.generation)return false;
    this.proposal=proposal;this.click=click;this.clickVolume=Math.max(0,Math.min(1,clickVolume));this.next=0;this.accents=new Set(proposal.downbeats);this.startAt=this.context.currentTime+.05;this.playing=true;
    this.source=this.context.createBufferSource();this.source.buffer=buffer;this.source.connect(this.context.destination);
    this.source.onended=()=>{if(generation===this.generation){this.stop();this.onEnded();}};
    try {this.source.start(this.startAt,proposal.rangeStart,proposal.rangeEnd-proposal.rangeStart);this.schedule();this.timer=this.setIntervalImpl(()=>this.schedule(),25);}
    catch(error){this.stop();throw error;}
    return true;
  }
  schedule(){
    if(!this.playing)return;
    const now=this.context.currentTime,end=now+.12;
    while(this.next<this.proposal.beats.length){
      const beat=this.proposal.beats[this.next],when=this.startAt+beat-this.proposal.rangeStart;
      if(when>end)break;this.next++;
      if(this.click&&when>=now)this.tick(when,this.accents.has(beat));
    }
  }
  tick(when,accent){
    const oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(accent?1400:900,when);
    gain.gain.setValueAtTime(Math.max(.0001,this.clickVolume*(accent ? .7 : .45)),when);gain.gain.exponentialRampToValueAtTime(.0001,when+.045);
    oscillator.connect(gain);gain.connect(this.context.destination);
    const voice={oscillator,gain};this.voices.add(voice);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(voice);};
    oscillator.start(when);oscillator.stop(when+.05);
  }
  setClickEnabled(enabled){this.click=!!enabled;if(!this.click)this.stopVoices();}
  setClickVolume(value){if(Number.isFinite(value))this.clickVolume=Math.max(0,Math.min(1,value));}
  stopVoices(){for(const {oscillator,gain}of this.voices){oscillator.onended=null;try{oscillator.stop();}catch{}oscillator.disconnect();gain.disconnect();}this.voices.clear();}
  stop(){
    this.generation++;this.playing=false;
    if(this.timer!==undefined){this.clearIntervalImpl(this.timer);this.timer=undefined;}
    if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
    this.stopVoices();
  }
  async dispose(){this.stop();const context=this.context;this.context=null;await context?.close();}
}
