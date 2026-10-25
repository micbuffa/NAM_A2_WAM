import {listeningWav} from './InstrumentComparison.js';
// One active URL, one generation. Late metadata callbacks cannot resume old audio.
export class ReviewAudioPlayer {
 constructor(audio,{create=channels=>URL.createObjectURL(new Blob([listeningWav(channels).bytes],{type:'audio/wav'})),revoke=url=>URL.revokeObjectURL(url),ready=()=>{},error=()=>{}}={}){Object.assign(this,{audio,create,revoke,ready,error});this.generation=0;this.url=null;}
 select(channels){
  const next=this.create(channels),audio=this.audio,position=this.loading?this.position:Number.isFinite(audio.currentTime)?audio.currentTime:0,playing=this.loading?this.resumeRequested:!audio.paused,token=++this.generation,previous=this.url;
  audio.pause();this.loading=true;this.position=position;this.resumeRequested=playing;this.ready(false);this.url=next;
  audio.onloadedmetadata=async()=>{if(token!==this.generation)return;this.loading=false;audio.currentTime=Math.min(position,Math.max(0,audio.duration-.001));this.ready(true);if(playing)try{await audio.play();}catch(e){if(token===this.generation)this.error(e);}};
  audio.onerror=()=>{if(token===this.generation){this.loading=false;this.ready(false);this.error(Error('Lecture audio impossible.'));}};
  audio.src=next;audio.load();if(previous)this.revoke(previous);
 }
 clear(){++this.generation;this.loading=false;this.resumeRequested=false;this.audio.pause();this.audio.onloadedmetadata=this.audio.onerror=null;this.audio.removeAttribute('src');this.audio.load();this.ready(false);if(this.url)this.revoke(this.url);this.url=null;}
 async toggle(){try{if(this.audio.paused)await this.audio.play();else this.audio.pause();}catch(e){this.error(e);}}
}
