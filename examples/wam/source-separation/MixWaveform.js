import {mergePeaks,copyAudioChannels} from './WaveformWorkerCore.js';
// Steady-state StereoPannerNode matrices, W3C Web Audio panning algorithm.
// Compute the PCM SUM before extracting peaks: peak envelopes cannot be summed.
export function panMatrix(channels,pan) {
  if(![1,2].includes(channels)||!Number.isFinite(pan))throw Error('Panoramique invalide.');
  pan=Math.max(-1,Math.min(1,pan));
  if(channels===1){const angle=(pan+1)*Math.PI/4;return [Math.cos(angle),0,Math.sin(angle),0];}
  if(pan<=0){const angle=(pan+1)*Math.PI/2;return [1,Math.cos(angle),0,Math.sin(angle)];}
  const angle=pan*Math.PI/2;return [Math.cos(angle),0,Math.sin(angle),1];
}
const check=signal=>{if(signal?.aborted)throw new DOMException('Calcul annulé','AbortError');};
export async function buildMixPeaks({tracks,chunks,totalFrames,settings,outputGain=1,bins=2048},{signal,yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0)),framesPerTurn=16384,computeBlock,cache}={}) {
  if(!Number.isSafeInteger(totalFrames)||totalFrames<=0||!Number.isSafeInteger(bins)||bins<=0||!Number.isFinite(outputGain)||outputGain<0||!Number.isSafeInteger(framesPerTurn)||framesPerTurn<1||!tracks?.length||!Array.isArray(settings))throw Error('Mix invalide.');
  // Snapshot metadata; PCM buffers are shared read-only, never copied or edited.
  const mix=settings.map(track=>({...track})),hasSolo=mix.some(track=>track.solo);
  const segments=chunks?[...chunks]:[{startFrame:0,tracks}],peaks=new Float32Array(Math.min(bins,totalFrames));
  let offset=0,peak=0,activeTracks=0;
  const configs=tracks.map(track=>{
    const setting=mix.find(item=>item.id===track.id);
    if(!setting)return {volume:0,pan:0};
    if(!Number.isFinite(setting.volume)||!Number.isFinite(setting.pan))throw Error('Réglages de mix invalides.');
    const audible=!setting.muted&&(!hasSolo||setting.solo),volume=audible?Math.max(0,Math.min(1.5,setting.volume)):0;
    if(volume>0)activeTracks++;
    return {volume,pan:Math.max(-1,Math.min(1,setting.pan))};
  });
  const signature=JSON.stringify([totalFrames,bins,outputGain,configs]);
  check(signal);await yieldControl();check(signal);
  for(const segment of segments) {
    const length=segment.tracks?.[0]?.buffer?.length;
    if(segment.startFrame!==offset||!length||offset+length>totalFrames||segment.tracks.length!==tracks.length)throw Error('Blocs du mix désalignés.');
    if(segment.tracks.some((t,i)=>t.id!==tracks[i].id||t.buffer?.length!==length||![1,2].includes(t.buffer?.numberOfChannels)))throw Error('Pistes du mix désalignées.');
    check(signal);const buffers=segment.tracks.map(t=>t.buffer),previous=cache?.get(buffers[0]);
    if(previous?.signature===signature&&previous.offset===offset&&previous.buffers.length===buffers.length&&previous.buffers.every((b,i)=>b===buffers[i])){
      mergePeaks(peaks,previous.peaks);peak=Math.max(peak,previous.peak);offset+=length;continue;
    }
    const segmentPeaks=new Float32Array(peaks.length);let segmentPeak=0;
    const sources=segment.tracks.map((track,index)=>{
      const buffer=track.buffer;
      if(track.id!==tracks[index].id||buffer.length!==length||![1,2].includes(buffer.numberOfChannels))throw Error('Pistes du mix désalignées.');
      if(computeBlock)return {buffer,matrix:panMatrix(buffer.numberOfChannels,configs[index].pan),gain:configs[index].volume*outputGain};
      const left=buffer.getChannelData(0),right=buffer.numberOfChannels===2?buffer.getChannelData(1):null;
      if(left.length!==length||(right&&right.length!==length))throw Error('Canaux du mix désalignés.');
      return {left,right,matrix:panMatrix(buffer.numberOfChannels,configs[index].pan),gain:configs[index].volume*outputGain};
    });
    for(let start=0;start<length;start+=computeBlock?Math.min(framesPerTurn,16384):framesPerTurn) {
      check(signal);
      if(computeBlock){
        const end=Math.min(length,start+Math.min(framesPerTurn,16384));
        const blockSources=sources.map(s=>{const channels=copyAudioChannels(s.buffer,start,end);return {matrix:s.matrix,gain:s.gain,left:channels[0],right:channels[1]||null};});
        const result=await computeBlock({kind:'mix',sources:blockSources,startFrame:offset+start,totalFrames,bins});check(signal);mergePeaks(segmentPeaks,result.peaks);segmentPeak=Math.max(segmentPeak,result.peak);
      }else for(let i=start;i<Math.min(length,start+framesPerTurn);i++) {
        let left=0,right=0;
        for(const source of sources) {
          const l=source.left[i],r=source.right?source.right[i]:0;
          if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('PCM du mix non fini.');
          const [ll,lr,rl,rr]=source.matrix;
          left+=(l*ll+r*lr)*source.gain;right+=(l*rl+r*rr)*source.gain;
        }
        const value=Math.max(Math.abs(left),Math.abs(right)),bin=Math.min(peaks.length-1,Math.floor((offset+i)/totalFrames*peaks.length));
        segmentPeaks[bin]=Math.max(segmentPeaks[bin],value);segmentPeak=Math.max(segmentPeak,value);
      }
      await yieldControl();check(signal);
    }
    mergePeaks(peaks,segmentPeaks);peak=Math.max(peak,segmentPeak);
    cache?.set(buffers[0],{signature,offset,buffers,peaks:segmentPeaks,peak:segmentPeak});
    offset+=length;
  }
  return {peaks,peak,availableFrames:offset,activeTracks};
}

// Latest request wins, even when a superseded calculation finishes late.
export class MixWaveformJob {
  constructor({compute=buildMixPeaks,onStart=()=>{},onResult=()=>{},onError=()=>{}}={}){Object.assign(this,{compute,onStart,onResult,onError});this.version=0;}
  cancel(){++this.version;this.controller?.abort();this.controller=null;this.key=null;}
  request(input,key) {
    if(key===this.key)return;
    this.cancel();this.key=key;const version=this.version,controller=new AbortController();this.controller=controller;this.onStart();
    this.pending=Promise.resolve().then(()=>this.compute(input,{signal:controller.signal})).then(result=>{if(version===this.version&&!controller.signal.aborted)this.onResult(result);}).catch(error=>{if(version===this.version&&error.name!=='AbortError'){this.key=null;this.onError(error);}});
    return this.pending;
  }
}
