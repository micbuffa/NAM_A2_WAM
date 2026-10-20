// Display peaks only. This module never creates an AudioContext or media player.
export const instrumentColors = {drums:'#edb16c',bass:'#bba2ef',vocals:'#79c8ee',other:'#82d2bd',guitar:'#c4dc78',piano:'#ec9eb8'};

export function buildWaveformPeaks(buffers,totalFrames,bins=2048) {
  if(!Number.isSafeInteger(totalFrames)||totalFrames<=0||!Number.isSafeInteger(bins)||bins<=0)throw Error('Dimensions de waveform invalides.');
  const peaks=new Float32Array(Math.min(bins,totalFrames));let offset=0;
  for(const buffer of buffers) {
    if(!buffer?.length||!buffer.numberOfChannels||offset+buffer.length>totalFrames)throw Error('Waveform désalignée.');
    for(let c=0;c<buffer.numberOfChannels;c++) {
      const data=buffer.getChannelData(c);
      for(let i=0;i<buffer.length;i++) {
        const bin=Math.min(peaks.length-1,Math.floor((offset+i)/totalFrames*peaks.length));
        if(!Number.isFinite(data[i]))throw Error('Waveform non finie.');
        peaks[bin]=Math.max(peaks[bin],Math.abs(data[i]));
      }
    }
    offset+=buffer.length;
  }
  return peaks;
}

export function timelineTicks(duration,width,zoom=1) {
  if(!(duration>0)||!(width>0))return [];
  const rough=duration*75/(width*zoom),power=10**Math.floor(Math.log10(rough));
  const step=[1,2,5,10].map(x=>x*power).find(x=>x>=rough);
  return Array.from({length:Math.floor(duration/step)+1},(_,i)=>({fraction:i*step/duration,label:`${Number((i*step).toFixed(2))}s`}));
}
