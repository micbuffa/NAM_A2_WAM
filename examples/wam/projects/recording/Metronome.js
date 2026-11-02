import {timing} from '../ProjectTiming.js';
// AudioContext time is the only clock used for notes AND the capture boundary.
// The timer only schedules ahead / refreshes the countdown; it never starts the take.
export class Metronome extends EventTarget {
  constructor(context, output = context.destination, {schedule = (fn,ms) => setInterval(fn,ms), cancel = id => clearInterval(id)} = {}) {
    super();Object.assign(this,{context,output,schedule,cancel});this.voices=new Set();this.enabled=false;this.countInBars=1;
  }
  start({when=this.context.currentTime+.15,bpm=120,signature='4/4',countInBars=this.countInBars,offset=0}={}) {
    this.stop();this.grid=timing(bpm,signature);this.startAt=when;this.index=0;
    this.countBeats=this.grid.beats*Math.min(2,Math.max(0,Math.round(countInBars)));
    this.recordAt=when+this.countBeats*this.grid.beatSeconds;
    this.offsetBeats=Math.max(0,Number(offset)||0)/this.grid.beatSeconds;this.firstBeat=Math.ceil(this.offsetBeats-1e-9);
    this.timer=this.schedule(()=>this.pump(),25);this.pump();return this.recordAt;
  }
  get count() {
    if(this.startAt===undefined||this.context.currentTime>=this.recordAt)return null;
    return this.context.currentTime<this.startAt?0:Math.min(this.countBeats,Math.floor((this.context.currentTime-this.startAt)/this.grid.beatSeconds)+1);
  }
  nextTime() {
    return this.index<this.countBeats?this.startAt+this.index*this.grid.beatSeconds:this.recordAt+(this.firstBeat-this.offsetBeats+this.index-this.countBeats)*this.grid.beatSeconds;
  }
  pump() {
    if(this.startAt===undefined)return;
    const now=this.context.currentTime;
    while(this.nextTime()<now+.12) {
      const at=this.nextTime();
      const beat=this.index<this.countBeats?this.index:this.firstBeat+this.index-this.countBeats;
      if(at>=now && (this.index<this.countBeats || this.enabled))this.click(at,beat%this.grid.beats===0);
      this.index++;
    }
    const phase=this.count;
    if(phase!==this.lastCount){this.lastCount=phase;this.dispatchEvent(new Event('tick'));}
  }
  click(at,accent) {
    const oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type='sine';oscillator.frequency.value=accent?1400:950;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(accent ? .16 : .10,at+.002);gain.gain.exponentialRampToValueAtTime(.0001,at+.035);
    oscillator.connect(gain).connect(this.output);const voice={oscillator,gain};this.voices.add(voice);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(voice);};
    oscillator.start(at);oscillator.stop(at+.04);
  }
  stop() {
    if(this.timer!==undefined)this.cancel(this.timer);this.timer=undefined;
    for(const {oscillator,gain} of this.voices){oscillator.onended=null;try{oscillator.stop();}catch{}oscillator.disconnect();gain.disconnect();}
    this.voices.clear();this.startAt=undefined;this.lastCount=undefined;
  }
}
