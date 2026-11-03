// Reference: CPJKU/beat_this (MIT), LogMelSpect and minimal postprocessor.
// All expensive feature computation is called from a Worker, never the Studio UI.
import {fftRadix2InPlace} from '../../source-separation/vendor/bs-roformer-web/fft-radix2.js';
export const SAMPLE_RATE=22050, HOP=441, FFT=1024, MELS=128, CHUNK=1500, BORDER=6;
export function downmix(channels) {
  if (!channels.length || !channels[0]?.length || channels.some(c=>c.length!==channels[0].length)) throw Error('Invalid PCM channels.');
  const mono=new Float32Array(channels[0].length);
  for(let i=0;i<mono.length;i++) {
    let sum=0; for(const channel of channels) {if(!Number.isFinite(channel[i])) throw Error('Non-finite PCM.'); sum+=channel[i];}
    mono[i]=sum/channels.length;
  }
  return mono;
}
function reflect(i,length) {
  const period=2*(length-1); const j=((i%period)+period)%period;
  return j<length?j:period-j;
}
export function logMel(pcm,filterbank,onProgress=()=>{}) {
  if(pcm.length<=FFT/2) throw Error('At least 513 audio samples are required.');
  if(filterbank.length!==513*MELS) throw Error('Invalid mel filterbank.');
  const frames=1+Math.floor(pcm.length/HOP), data=new Float32Array(frames*MELS);
  const window=Float32Array.from({length:FFT},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/FFT));
  const fft=new Float64Array(FFT*2), magnitude=new Float64Array(513);
  // Slaney filters are sparse. Precompute nonzero coefficients once per analysis.
  const filters=Array.from({length:MELS},(_,m)=>{
    const f=[];for(let k=0;k<513;k++)if(filterbank[k*MELS+m])f.push([k,filterbank[k*MELS+m]]);return f;
  });
  for(let t=0;t<frames;t++) {
    fft.fill(0);
    for(let i=0;i<FFT;i++)fft[2*i]=Math.fround(pcm[reflect(t*HOP+i-FFT/2,pcm.length)]*window[i]);
    fftRadix2InPlace(fft,FFT);
    for(let k=0;k<513;k++)magnitude[k]=Math.hypot(fft[2*k],fft[2*k+1])/Math.sqrt(FFT);
    for(let m=0;m<MELS;m++){let sum=0;for(const [k,w]of filters[m])sum+=magnitude[k]*w;data[t*MELS+m]=Math.log1p(1000*sum);}
    if(t%100===0)onProgress(t/frames);
  }
  onProgress(1);return {data,frames};
}
export function windowStarts(frames) {
  if(!Number.isSafeInteger(frames)||frames<1)throw Error('Invalid frame count.');
  const starts=[];for(let s=-BORDER;s<frames-BORDER;s+=CHUNK-2*BORDER)starts.push(s);
  if(frames>CHUNK-2*BORDER)starts[starts.length-1]=frames-(CHUNK-BORDER);
  return starts;
}
export function windowFrameCount(frames) {
  if(!Number.isSafeInteger(frames)||frames<1)throw Error('Invalid frame count.');
  return Math.min(CHUNK,frames+2*BORDER);
}
export function featureWindow(data,frames,start,length=CHUNK) {
  if(!Number.isSafeInteger(length)||length<2*BORDER+1||length>CHUNK)throw Error('Invalid feature window length.');
  const out=new Float32Array(length*MELS);
  const from=Math.max(start,0),to=Math.min(start+length,frames);
  out.set(data.subarray(from*MELS,to*MELS),(from-start)*MELS);return out;
}
export function aggregate(predictions,starts,frames) {
  const beat=new Float32Array(frames).fill(-1000),downbeat=new Float32Array(frames).fill(-1000);
  if(predictions.length!==starts.length)throw Error('Window count mismatch.');
  for(let w=starts.length-1;w>=0;w--) {
    for(const name of ['beat','downbeat']) {
      const input=predictions[w][name],output=name==='beat'?beat:downbeat;
      if(input.length!==windowFrameCount(frames))throw Error('Invalid output shape.');
      for(let j=BORDER;j<input.length-BORDER;j++){const i=starts[w]+j;if(i>=0&&i<frames)output[i]=input[j];}
    }
  }
  return {beat,downbeat};
}
export function deduplicatePeaks(peaks) {
  const result=[];if(!peaks.length)return result;let p=peaks[0],count=1;
  for(const next of peaks.slice(1))if(next-p<=1){count++;p+=(next-p)/count;}else{result.push(p);p=next;count=1;}
  result.push(p);return result;
}
export function peakTimes(logits) {
  const peaks=[];
  for(let i=0;i<logits.length;i++) {
    if(!Number.isFinite(logits[i]))throw Error('Non-finite model output.');
    if(logits[i]<=0)continue;
    let max=true;for(let j=Math.max(0,i-3);j<=Math.min(logits.length-1,i+3);j++)if(logits[j]>logits[i]){max=false;break;}
    if(max)peaks.push(i);
  }
  return deduplicatePeaks(peaks).map(p=>p/50);
}
export function postprocess({beat,downbeat},{duration=Infinity,offsetSeconds=0}={}) {
  if(!(duration>0)||!Number.isFinite(offsetSeconds))throw Error('Invalid audio range.');
  const beats=peakTimes(beat).filter(t=>t<duration);
  let downbeats=peakTimes(downbeat).filter(t=>t<duration);
  if(beats.length)downbeats=downbeats.map(t=>beats.reduce((best,b)=>Math.abs(b-t)<Math.abs(best-t)?b:best,beats[0]));
  downbeats=[...new Set(downbeats)].sort((a,b)=>a-b);
  const intervals=beats.slice(1).map((t,i)=>t-beats[i]).sort((a,b)=>a-b);
  const middle=Math.floor(intervals.length/2);
  const interval=intervals.length?(intervals.length%2?intervals[middle]:(intervals[middle-1]+intervals[middle])/2):null;
  return {beats:beats.map(t=>t+offsetSeconds),downbeats:downbeats.map(t=>t+offsetSeconds),
    medianBpm:interval?60/interval:null,postprocessor:'minimal',fps:50};
}
