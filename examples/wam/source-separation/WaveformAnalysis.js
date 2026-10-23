import {producerEnvelope} from './StreamTransport.js';
import {computeWaveformBlock,mergePeaks,copyAudioChannels} from './WaveformWorkerCore.js';
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Annulé','AbortError');};
export class WaveformWorkerClient {
 constructor({workerFactory=typeof Worker==='undefined'?null:()=>new Worker(new URL('./waveform-worker.js',import.meta.url),{type:'module'})}={}){this.factory=workerFactory;this.requests=new Map();this.nextId=0;}
 compute(block){
  if(this.destroyed)return Promise.reject(new DOMException('Annulé','AbortError'));
  // Non-browser tests use the exact same small-block algorithm, yielding first.
  if(!this.factory)return new Promise((resolve,reject)=>setTimeout(()=>{try{resolve(computeWaveformBlock(block));}catch(e){reject(e);}},0));
  if(!this.worker){
   this.worker=this.factory();this.worker.onmessage=({data})=>{const request=this.requests.get(data.id);if(!request)return;this.requests.delete(data.id);data.error?request.reject(Error(data.error)):request.resolve(data);};
   this.worker.onerror=e=>{for(const r of this.requests.values())r.reject(Error(e.message||'Erreur du Worker waveform.'));this.requests.clear();this.worker?.terminate();this.worker=null;};
  }
  const id=++this.nextId,arrays=block.kind==='instrument'?block.channels:block.sources.flatMap(s=>[s.left,...(s.right?[s.right]:[])]);
  return new Promise((resolve,reject)=>{this.requests.set(id,{resolve,reject});try{this.worker.postMessage({id,block},arrays.map(a=>a.buffer));}catch(error){this.requests.delete(id);reject(error);}});
 }
 destroy(){this.destroyed=true;this.worker?.terminate();this.worker=null;for(const r of this.requests.values())r.reject(new DOMException('Annulé','AbortError'));this.requests.clear();}
}
export class InstrumentWaveformJob {
 constructor({computer,onResult=()=>{},onError=()=>{}}){Object.assign(this,{computer,onResult,onError});this.cache=new WeakMap();this.version=0;}
 cancel(){++this.version;this.controller?.abort();this.controller=null;}
 request(input){
  this.cancel();const version=this.version,controller=this.controller=new AbortController();
  const snapshot={...input,tracks:[...input.tracks],chunks:input.chunks?[...input.chunks]:undefined};
  this.pending=this.compute(snapshot,controller.signal).then(peaks=>{if(version===this.version&&!controller.signal.aborted)this.onResult(peaks);}).catch(error=>{if(version===this.version&&error.name!=='AbortError')this.onError(error);});return this.pending;
 }
 async compute({tracks,chunks,totalFrames,bins=2048},signal){
  if(!Number.isSafeInteger(totalFrames)||totalFrames<1)throw Error('Dimensions waveform invalides.');
  const output=[];
  for(let index=0;index<tracks.length;index++){
   const buffers=chunks?chunks.map(chunk=>chunk.tracks[index].buffer):[tracks[index].buffer],peaks=new Float32Array(Math.min(bins,totalFrames));let offset=0;
   for(const buffer of buffers){
    aborted(signal);if(!buffer?.length||offset+buffer.length>totalFrames)throw Error('Waveform désalignée.');
    const signature=`${totalFrames}:${offset}:${bins}`,cached=this.cache.get(buffer),producer=producerEnvelope(buffer);let envelope=producer?.totalFrames===totalFrames&&producer.peaks.length===peaks.length?producer.peaks:cached?.signature===signature?cached.peaks:null;
    if(!envelope){
     envelope=new Float32Array(peaks.length);
     for(let start=0;start<buffer.length;start+=16384){
      aborted(signal);const end=Math.min(buffer.length,start+16384);
      // Only bounded copies cross the worker boundary; AudioBuffer memory stays attached.
      const channels=copyAudioChannels(buffer,start,end);
      const result=await this.computer.compute({kind:'instrument',channels,startFrame:offset+start,totalFrames,bins});aborted(signal);mergePeaks(envelope,result.peaks);
     }
     this.cache.set(buffer,{signature,peaks:envelope});
    }
    mergePeaks(peaks,envelope);offset+=buffer.length;
   }
   output.push(peaks);
  }
  return output;
 }
}
