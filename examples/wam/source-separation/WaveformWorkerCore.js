// Display analysis only. Never normalizes, mutates or schedules audible PCM.
export function computeWaveformBlock({kind,channels,sources,startFrame,totalFrames,bins=2048}) {
  const length=kind==='instrument'?channels?.[0]?.length:sources?.[0]?.left?.length;
  if(!['instrument','mix'].includes(kind)||!Number.isSafeInteger(length)||length<1||length>16384||!Number.isSafeInteger(startFrame)||startFrame<0||!Number.isSafeInteger(totalFrames)||startFrame+length>totalFrames||!Number.isSafeInteger(bins)||bins<1)throw Error('Bloc de waveform invalide.');
  const peaks=new Float32Array(Math.min(bins,totalFrames));let peak=0;
  if(kind==='instrument'){
    if(!channels.length||channels.some(c=>!(c instanceof Float32Array)||c.length!==length))throw Error('Canaux invalides.');
    for(let i=0;i<length;i++){
      let value=0;for(const channel of channels){if(!Number.isFinite(channel[i]))throw Error('PCM non fini.');value=Math.max(value,Math.abs(channel[i]));}
      const bin=Math.min(peaks.length-1,Math.floor((startFrame+i)/totalFrames*peaks.length));peaks[bin]=Math.max(peaks[bin],value);peak=Math.max(peak,value);
    }
  }else{
    if(!sources.length||sources.some(s=>!(s.left instanceof Float32Array)||s.left.length!==length||s.right&&(!(s.right instanceof Float32Array)||s.right.length!==length)||!Number.isFinite(s.gain)||s.matrix?.length!==4||!s.matrix.every(Number.isFinite)))throw Error('Sources de mix invalides.');
    for(let i=0;i<length;i++){
      let left=0,right=0;
      for(const source of sources){const l=source.left[i],r=source.right?source.right[i]:0;if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('PCM non fini.');const [ll,lr,rl,rr]=source.matrix;left+=(l*ll+r*lr)*source.gain;right+=(l*rl+r*rr)*source.gain;}
      const value=Math.max(Math.abs(left),Math.abs(right)),bin=Math.min(peaks.length-1,Math.floor((startFrame+i)/totalFrames*peaks.length));peaks[bin]=Math.max(peaks[bin],value);peak=Math.max(peak,value);
    }
  }
  return {peaks,peak};
}
export function mergePeaks(target,source){if(target.length!==source.length)throw Error('Enveloppes désalignées.');for(let i=0;i<target.length;i++)target[i]=Math.max(target[i],source[i]);}
// Main-thread bridge: copy at most 16K frames, without materializing a whole
// AudioBuffer channel. The copies may be transferred; audible storage never is.
export function copyAudioChannels(buffer,start,end){
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>buffer.length||end-start>16384||!Number.isSafeInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1||buffer.numberOfChannels>32)throw Error('Copie audio invalide.');
 return Array.from({length:buffer.numberOfChannels},(_,c)=>{const out=new Float32Array(end-start);if(buffer.copyFromChannel)buffer.copyFromChannel(out,c,start);else out.set(buffer.getChannelData(c).subarray(start,end));return out;});
}
