import {MultitrackEngine} from './MultitrackEngine.js';

export class ProgressiveMultitrackEngine extends MultitrackEngine {
  constructor(context,{lookAheadSeconds=8,scheduleTask=(fn,delay)=>setTimeout(fn,delay),cancelTask=id=>clearTimeout(id)}={}) {
    if(!(lookAheadSeconds>0))throw Error('Avance audio invalide.');
    super(context);this.lookAheadSeconds=lookAheadSeconds;this.scheduleTask=scheduleTask;this.cancelTask=cancelTask;this.scheduledFrames=new Set();this.progressive=true;this.chunks=[];this.availableFrames=0;this.totalFrames=0;this.sampleRate=44100; }
  get duration(){return this.totalFrames/this.sampleRate;}
  get availableDuration(){return this.availableFrames/this.sampleRate;}
  get position(){return this.regionPlaying?super.position:Math.min(this.availableDuration,this.offset+(this.playing?Math.max(0,this.context.currentTime-this.startedAt):0));}
  get ready(){return super.ready&&this.availableFrames>0;}
  startStream({roles,totalFrames,sampleRate=44100}) {
    if(!Number.isSafeInteger(totalFrames)||totalFrames<=0||sampleRate!==44100||!roles.length)throw Error('Session progressive invalide.');
    this.stop();this.loopRegion=null;this.regionCache=null;this.audioVersion++;this.chunks=[];this.availableFrames=0;this.totalFrames=totalFrames;this.sampleRate=sampleRate;this.complete=false;this.partial=false;
    this.tracks=roles.map((role,index)=>({id:`${role}-${index}`,role,label:role}));this.changed();
  }
  append(startFrame,tracks) {
    const length=tracks[0]?.buffer?.length;
    if(this.complete||startFrame!==this.availableFrames||tracks.length!==this.tracks.length||!length||tracks.some((t,i)=>t.id!==this.tracks[i].id||t.buffer.length!==length||t.buffer.sampleRate!==this.sampleRate)||startFrame+length>this.totalFrames)throw Error('Pistes progressives désalignées.');
    // A late append can race the native onended event. Enter buffering first
    // so the new block gets a fresh clock rather than a start in the past.
    if(this.playing && this.position>=this.availableDuration)this.boundary(this.availableDuration);
    const chunk={startFrame,length,tracks};this.chunks.push(chunk);this.availableFrames+=length;
    if(this.playing&&!this.regionPlaying)this.scheduleAhead();
    else if(this.waiting&&this.playRequested)this.play().catch(error=>{this.waiting=false;this.playRequested=false;this.dispatchEvent(new CustomEvent('player-error',{detail:error}));this.changed();});
    this.changed();
  }
  finish(partial=false) {
    if(!partial&&this.availableFrames!==this.totalFrames)throw Error('Il manque des blocs.');
    if(partial){this.totalFrames=this.availableFrames;
      if(this.loopRegion){const {start,end}=this.loopRegion;this.loopRegion=start<this.duration?{start,end:Math.min(end,this.duration)}:null;}
    }
    this.complete=true;this.partial=partial;
    if(this.waiting && this.playRequested){this.waiting=false;if(this.loop)this.play().catch(()=>this.pause());else this.playRequested=false;}
    this.changed();
  }
  async play() {
    if(this.destroyed||!this.availableFrames||this.playing||this.starting)return;
    this.playRequested=true;
    const region=this.loop&&this.loopRegion;
    if(region&&(this.offset<region.start||this.offset>=region.end))this.offset=region.start;
    if(this.offset>=this.availableDuration) {
      if(this.complete)this.offset=0;
      else {this.waiting=true;this.changed();return;}
    }
    const generation=++this.generation;this.starting=true;this.changed();
    try {
      await this.prepare();if(generation!==this.generation||this.destroyed)return;
      this.startedAt=this.context.currentTime+.03;this.playing=true;this.waiting=false;
      this.regionPlaying=!!(region&&region.end<=this.availableDuration);
      if(this.regionPlaying)this.scheduleRegion(region);else this.scheduleAhead();
    } finally {this.starting=false;this.changed();}
  }
  // Compile only an explicitly selected, fully published interval. Native loops
  // then keep every stem sample-aligned without onended/JS timing gaps.
  scheduleRegion({start,end}) {
    const first=Math.round(start*this.sampleRate),last=Math.round(end*this.sampleRate),key=`${first}:${last}`;
    if(this.regionCache?.key!==key){
      const buffers=this.tracks.map((_,index)=>{
        const buffer=this.context.createBuffer(this.chunks[0].tracks[index].buffer.numberOfChannels,last-first,this.sampleRate);
        for(const chunk of this.chunks){
          const a=Math.max(first,chunk.startFrame),b=Math.min(last,chunk.startFrame+chunk.length);if(b<=a)continue;
          for(let c=0;c<buffer.numberOfChannels;c++)buffer.getChannelData(c).set(chunk.tracks[index].buffer.getChannelData(c).subarray(a-chunk.startFrame,b-chunk.startFrame),a-first);
        }
        return buffer;
      });this.regionCache={key,buffers};
    }
    this.tracks.forEach((track,i)=>{
      const source=this.context.createBufferSource(),gain=this.context.createGain(),pan=this.context.createStereoPanner();
      source.buffer=this.regionCache.buffers[i];source.loop=true;source.loopStart=0;source.loopEnd=source.buffer.duration;
      source.connect(gain).connect(pan).connect(this.normalizationNode);source.start(this.startedAt,this.offset-start);
      this.voices.push({id:track.id,source,gain,pan});
    });this.sync(this.mixTracks||[]);
  }
  clearSchedule(){if(this.scheduleTimer!==undefined)this.cancelTask(this.scheduleTimer);this.scheduleTimer=undefined;}
  releaseVoices(){this.clearSchedule();this.scheduledFrames?.clear();super.releaseVoices();}
  scheduleAhead(){
    this.clearSchedule();if(!this.playing||this.regionPlaying||this.destroyed)return;
    const position=this.offset+Math.max(0,this.context.currentTime-this.startedAt),horizon=position+this.lookAheadSeconds;
    for(const chunk of this.chunks){
      const start=chunk.startFrame/this.sampleRate,end=start+chunk.length/this.sampleRate;
      if(start>=horizon)break;
      if(end>position&&!this.scheduledFrames.has(chunk.startFrame)){
        this.scheduledFrames.add(chunk.startFrame);this.schedule(chunk);
      }
    }
    if(position<this.availableDuration){
      this.scheduleTimer=this.scheduleTask(()=>{this.scheduleTimer=undefined;try{this.scheduleAhead();}catch(error){this.pause();this.dispatchEvent(new CustomEvent('player-error',{detail:error}));}},250);
      this.scheduleTimer?.unref?.();
    }
  }
  schedule(chunk) {
    const start=chunk.startFrame/this.sampleRate,end=(chunk.startFrame+chunk.length)/this.sampleRate;
    const position=this.offset+Math.max(0,this.context.currentTime-this.startedAt);
    if(end<=position||(this.loop&&this.loopRegion&&start>=this.loopRegion.end))return;
    // If a UI stall delayed the scheduler, skip elapsed PCM rather than replaying
    // the start of a late block. All stems still share exactly the same clock.
    const from=Math.max(start,position),when=Math.max(this.startedAt,this.context.currentTime,this.startedAt+start-this.offset),offset=from-start;
    // This path is called only for already-ready blocks or newly appended
    // blocks whose start is still ahead of the current playback boundary.
    for(let i=0;i<chunk.tracks.length;i++) {
      const track=chunk.tracks[i],source=this.context.createBufferSource(),gain=this.context.createGain(),pan=this.context.createStereoPanner();
      source.buffer=track.buffer;source.connect(gain).connect(pan).connect(this.normalizationNode);
      const voice={id:track.id,source,gain,pan};this.voices.push(voice);
      source.onended=()=>{
        source.disconnect();gain.disconnect();pan.disconnect();this.voices=this.voices.filter(v=>v!==voice);
        if(i===0)this.boundary(this.loop&&this.loopRegion?Math.min(end,this.loopRegion.end):end);
      };
      const limit=this.loop&&this.loopRegion?Math.min(end,this.loopRegion.end):end;
      if(limit<end)source.start(when,offset,Math.max(0,limit-from));else source.start(when,offset);
    }
    this.sync(this.mixTracks||[]);
  }
  boundary(end) {
    if(!this.playing)return;
    if(this.loop&&this.loopRegion&&end+1/this.sampleRate>=this.loopRegion.end){
      this.offset=this.loopRegion.start;this.playing=false;this.releaseVoices();this.play().catch(()=>this.pause());return;
    }
    if(end+1/this.sampleRate<this.availableDuration)return;
    this.offset=this.availableDuration;this.playing=false;this.releaseVoices();
    if(this.complete) {
      if(this.loop&&this.playRequested){this.offset=0;this.play().catch(()=>this.pause());}
      else this.playRequested=false;
    } else this.waiting=this.playRequested;
    this.changed();
  }
  pause(){++this.generation;this.offset=this.position;this.playing=false;this.regionPlaying=false;this.waiting=false;this.playRequested=false;this.releaseVoices();this.changed();}
  seek(seconds) {
    if(!Number.isFinite(Number(seconds)))throw Error('Position invalide.');
    const resume=this.playing||this.waiting;this.pause();this.offset=Math.max(0,Math.min(this.availableDuration,Number(seconds)));
    if(resume)return this.play();this.changed();
  }
  setLoop(enabled){
    const resume=this.playing||this.waiting;this.pause();this.loop=!!enabled;this.changed();if(resume)return this.play();
  }
  resetLoopRegion(){this.regionCache=null;return super.resetLoopRegion();}
  setLoopRegion(start,end){this.regionCache=null;return super.setLoopRegion(start,end);}
  destroy(){super.destroy();this.chunks=[];this.regionCache=null;}
}
