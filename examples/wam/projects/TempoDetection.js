// At most 60 seconds of one already-decoded channel is transferred once. Analysis
// happens in a worker; no full-song decode/copy, no server upload or audio playback.
export class TempoDetection {
  constructor({onResult,workerFactory=()=>new Worker(new URL('./tempo-worker.js',import.meta.url),{type:'module'})}){Object.assign(this,{onResult,workerFactory});}
  analyse(buffer) {
    this.cancel();const token=this.token;this.worker=this.workerFactory();
    const finish=value=>{if(token!==this.token)return;this.worker?.terminate();this.worker=null;clearTimeout(this.timeout);this.onResult(value);};
    this.worker.onmessage=({data})=>finish(data.error?null:data.result);this.worker.onerror=()=>finish(null);
    this.timeout=setTimeout(()=>finish(null),15000);
    const pcm=buffer.getChannelData(0).slice(0,Math.min(buffer.length,Math.floor(buffer.sampleRate*60)));
    this.worker.postMessage({pcm,sampleRate:buffer.sampleRate},[pcm.buffer]);
  }
  cancel(){this.token=(this.token??0)+1;clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;}
}
