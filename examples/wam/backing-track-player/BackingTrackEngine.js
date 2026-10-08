const registrations=new WeakMap();
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const number=(n,min,max)=>{if(!Number.isFinite(Number(n)))throw Error('Invalid player value');return clamp(Number(n),min,max);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
export class BackingTrackEngine extends EventTarget {
  constructor(context,library) {
    super();this.context=context;this.library=library;this.outputNode=context.createGain();this.volumeNode=context.createGain();this.normalizer=context.createGain();
    this.normalizer.connect(this.volumeNode).connect(this.outputNode);
    this.rate=1;this.volumeDb=-12;this.muted=false;this.normalized=false;this.autoNormalize=true;this.mix=.5;this.guitarPan=0;
    this.loop={enabled:true,startSeconds:0,endSeconds:0};this.offset=0;this.playing=false;this.loading=false;this.generation=0;this.retiring=new Set();this.setVolumeDb(-12);
  }
  emit(type,detail={}) {this.dispatchEvent(new CustomEvent(type,{detail}));}
  changed(){this.emit('transport-change',this.getState());}
  async initialize() {
    try {
      if(!this.context.audioWorklet)throw Error('AudioWorklet unavailable');
      let registration=registrations.get(this.context);
      if(!registration){registration=this.context.audioWorklet.addModule(new URL('./phaze-processor.js',import.meta.url));registrations.set(this.context,registration);registration.catch(()=>registrations.delete(this.context));}
      await registration;this.stretchReady=true;
    }catch(error){this.stretchReady=false;this.emit('player-error',{message:`Time stretch unavailable: ${error.message}`});}
    this.changed();
  }
  get duration(){return this.buffer?.duration||0;}
  get position(){
    let position=this.offset+(this.playing?(this.context.currentTime-this.startedAt)*this.rate:0);
    const {enabled,startSeconds:a,endSeconds:b}=this.loop;
    if(enabled&&b>a&&position>=b)position=a+(position-a)%(b-a);
    return clamp(position,0,this.duration);
  }
  async loadTrack(id){return this.load(this.library.resolve(id));}
  async loadFile(file){
    const id='local:'+encodeURIComponent(file.name)+':'+file.size+':'+file.lastModified;
    const loaded=await this.load({id,title:file.name,local:true},file);
    if(loaded&&this.pendingLocalState?.track.id===id){const state=this.pendingLocalState;this.pendingLocalState=null;await this.setState(state);}
    return loaded;
  }
  async load(track,file) {
    if(this.destroyed)throw Error('Player destroyed');
    const generation=++this.generation;this.abort?.abort();const abort=this.abort=new AbortController();
    this.loading=true;
    this.emit('load-progress',{title:track.title,progress:0,phase:'transfer'});
    try {
      let bytes;
      if(file)bytes=await file.arrayBuffer();
      else {
        const response=await fetch(track.url,{signal:abort.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);
        const total=Number(response.headers.get('content-length'));const reader=response.body?.getReader();
        if(!reader)bytes=await response.arrayBuffer();
        else {let length=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;if(generation!==this.generation)return;chunks.push(value);length+=value.length;this.emit('load-progress',{title:track.title,progress:total?Math.min(1,length/total):null,phase:'transfer'});}
          const joined=new Uint8Array(length);let at=0;for(const chunk of chunks){joined.set(chunk,at);at+=chunk.length;}bytes=joined.buffer;}
      }
      if(generation!==this.generation)return;
      this.emit('load-progress',{title:track.title,progress:null,phase:'decode'});
      const buffer=await this.context.decodeAudioData(bytes);
      let peak=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){
        const samples=buffer.getChannelData(ch);
        for(let i=0;i<samples.length;i+=262144){if(generation!==this.generation)return;for(let j=i;j<Math.min(i+262144,samples.length);j++){if(!Number.isFinite(samples[j]))throw Error('Non-finite audio');peak=Math.max(peak,Math.abs(samples[j]));}await tick();}
      }
      if(generation!==this.generation||this.destroyed)return;
      const resume=this.playing;this.pause();this.buffer=buffer;this.track={id:track.id,title:track.title,local:!!track.local};this.peak=peak;
      this.offset=0;this.loop={enabled:this.loop.enabled,startSeconds:0,endSeconds:buffer.duration};this.setNormalized(this.autoNormalize);
      this.loading=false;this.emit('track-change',this.track);this.emit('load-progress',{title:track.title,progress:1,phase:'ready'});this.changed();if(resume)await this.play();return true;
    }catch(error){if(generation!==this.generation)return;this.loading=false;this.emit('load-progress',{title:track.title,error:error.message});throw error;}
  }
  retireVoice(immediate=false) {
    const voice=this.voice;if(!voice)return;this.voice=null;voice.source.onended=null;
    const finish=()=>{clearTimeout(voice.timer);clearTimeout(voice.endTimer);voice.source.disconnect();voice.envelope.disconnect();voice.worklet?.port.postMessage({type:'dispose'});voice.worklet?.disconnect();this.retiring.delete(voice);};
    voice.finish=finish;this.retiring.add(voice);
    const t=this.context.currentTime;voice.envelope.gain.cancelScheduledValues(t);voice.envelope.gain.setValueAtTime(voice.envelope.gain.value,t);voice.envelope.gain.linearRampToValueAtTime(0,t+.008);
    try{voice.source.stop(immediate?t:t+.01);}catch{}
    if(immediate)finish();else voice.timer=setTimeout(finish,30);
  }
  startVoice() {
    this.retireVoice();const source=this.context.createBufferSource(),envelope=this.context.createGain();source.buffer=this.buffer;
    source.playbackRate.value=this.rate;source.loop=this.loop.enabled;source.loopStart=this.loop.startSeconds;source.loopEnd=this.loop.endSeconds;
    let worklet;
    if(this.rate!==1){worklet=new AudioWorkletNode(this.context,'nam-backing-phase-vocoder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers'});worklet.parameters.get('pitchFactor').value=1/this.rate;source.connect(worklet).connect(envelope);
      worklet.onprocessorerror=()=>{this.pause();this.stretchReady=false;this.rate=1;this.emit('player-error',{message:'Time stretch processor failed. Playback at 100% remains available.'});this.changed();};
    }else source.connect(envelope);
    const t=this.context.currentTime;envelope.gain.value=0;envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(1,t+.008);envelope.connect(this.normalizer);
    const voice=this.voice={source,envelope,worklet};this.startedAt=t;this.playing=true;
    source.onended=()=>{voice.endTimer=setTimeout(()=>{if(this.voice!==voice)return;this.offset=this.duration;this.playing=false;this.retireVoice();this.changed();},worklet?2048/this.context.sampleRate*1000:0);};
    source.start(t,this.offset);this.changed();
  }
  async play(){if(this.destroyed||this.loading||!this.buffer||this.playing)return;const request=this.playRequest=(this.playRequest||0)+1;await this.context.resume();if(this.destroyed||this.loading||this.playing||request!==this.playRequest)return;
    if(this.offset>=this.duration||(this.loop.enabled&&(this.offset<this.loop.startSeconds||this.offset>=this.loop.endSeconds)))this.offset=this.loop.enabled?this.loop.startSeconds:0;
    this.startVoice();
  }
  pause(){this.playRequest=(this.playRequest||0)+1;this.offset=this.position;this.playing=false;this.retireVoice();this.changed();}
  stop(){this.pause();this.offset=this.loop.enabled?this.loop.startSeconds:0;this.changed();}
  seek(seconds){this.offset=number(seconds,0,this.duration);if(this.playing)this.startVoice();else this.changed();}
  setLoop({enabled=this.loop.enabled,startSeconds=this.loop.startSeconds,endSeconds=this.loop.endSeconds}) {
    let a=number(startSeconds,0,this.duration),b=number(endSeconds,0,this.duration);if(a>b)[a,b]=[b,a];
    if(this.buffer&&b-a<Math.min(.02,this.duration))throw Error('Select a loop at least 20 ms long');
    this.offset=this.position;this.loop={enabled:!!enabled,startSeconds:a,endSeconds:b};
    if(enabled&&(this.offset<a||this.offset>=b))this.offset=a;
    if(this.playing)this.startVoice();else this.changed();
  }
  setRate(rate){rate=number(rate,.7,1.3);if(rate!==1&&!this.stretchReady)throw Error('Time stretch unavailable');this.offset=this.position;this.rate=rate;if(this.playing&&this.voice?.worklet&&rate!==1){const t=this.context.currentTime;this.startedAt=t;this.voice.source.playbackRate.setValueAtTime(rate,t);this.voice.worklet.parameters.get('pitchFactor').setValueAtTime(1/rate,t);this.changed();}else if(this.playing)this.startVoice();else this.changed();}
  setVolumeDb(db){this.volumeDb=number(db,-60,6);this.volumeNode.gain.setTargetAtTime(this.muted?0:10**(this.volumeDb/20),this.context.currentTime,.008);this.changed();}
  setMuted(muted){this.muted=!!muted;this.setVolumeDb(this.volumeDb);}
  setNormalized(enabled){this.normalized=!!enabled;const gain=enabled&&this.peak>=.0001?Math.min(1000,.99/this.peak):1;this.normalizer.gain.setTargetAtTime(gain,this.context.currentTime,.008);this.changed();}
  setMix(value){this.mix=number(value,0,1);this.emit('mix-change',{value:this.mix});this.changed();}
  setGuitarPan(value){this.guitarPan=number(value,-1,1);this.emit('guitar-pan-change',{value:this.guitarPan});this.changed();}
  getState(){return {version:1,track:this.track?{...this.track}:null,position:this.position,loop:{...this.loop},rate:this.rate,volumeDb:this.volumeDb,muted:this.muted,normalized:this.normalized,autoNormalize:this.autoNormalize,mix:this.mix,guitarPan:this.guitarPan};}
  async setState(state){
    if(state?.version!==1||!state.loop)throw Error('Unsupported backing player state');
    for(const value of [state.position,state.rate,state.volumeDb,state.mix,state.guitarPan,state.loop.startSeconds,state.loop.endSeconds])if(!Number.isFinite(value))throw Error('Invalid backing player state');
    this.pause();++this.generation;this.abort?.abort();
    if(state.track?.local&&this.track?.id!==state.track.id){this.pendingLocalState=structuredClone(state);throw Error('Select the same local backing file again to restore its settings');}
    if(state.track&&!state.track.local&&state.track.id!==this.track?.id){if(!await this.loadTrack(state.track.id))return;}
    if(!state.track){this.buffer=null;this.track=null;this.offset=0;this.loop={enabled:true,startSeconds:0,endSeconds:0};this.emit('track-change',null);}
    this.autoNormalize=!!state.autoNormalize;this.setLoop(state.loop);this.setRate(state.rate);this.setVolumeDb(state.volumeDb);this.setMuted(state.muted);this.setNormalized(state.normalized);this.setMix(state.mix);this.setGuitarPan(state.guitarPan);this.seek(state.position);
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.loading=false;++this.generation;this.abort?.abort();this.playing=false;this.retireVoice(true);for(const voice of this.retiring)voice.finish();this.buffer=null;this.normalizer.disconnect();this.volumeNode.disconnect();this.outputNode.disconnect();}
}
