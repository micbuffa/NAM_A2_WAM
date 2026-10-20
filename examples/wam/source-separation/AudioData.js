export function waveformPath(data, bins = 400) {
  const step = Math.max(1, Math.ceil(data.length / bins)); let path = '';
  for (let i = 0; i < bins; i++) {
    let peak = 0;
    for (let j = i * step; j < Math.min((i + 1) * step, data.length); j++) peak = Math.max(peak, Math.abs(data[j]));
    peak = Math.min(1, peak);
    path += `M${i / bins * 960},${40 - peak * 20}v${Math.max(.5, peak * 40)} `;
  }
  return path;
}
export function makeTracks(context, result) {
  if (!result.roles?.length || result.stems?.length !== result.roles.length * 2 || result.stems.some(c => !(c instanceof Float32Array) || !c.length || c.length !== result.stems[0].length || !c.every(Number.isFinite))) throw Error('Stems invalides.');
  return result.roles.map((role, index) => {
    const buffer = context.createBuffer(2, result.stems[index * 2].length, result.sampleRate);
    buffer.copyToChannel(result.stems[index * 2], 0); buffer.copyToChannel(result.stems[index * 2 + 1], 1);
    return {id: `${role}-${index}`, role, label: role, buffer};
  });
}

export function progressiveWaveformPath(buffers,totalFrames,bins=400) {
  const peaks=new Float32Array(bins);let offset=0;
  for(const buffer of buffers){
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++){
      const bin=Math.min(bins-1,Math.floor((offset+i)/totalFrames*bins));
      peaks[bin]=Math.max(peaks[bin],Math.abs(samples[i]));
    }
    offset+=samples.length;
  }
  return Array.from(peaks,(peak,i)=>i/bins*totalFrames<offset?`M${i/bins*960},${40-Math.min(1,peak)*20}v${Math.max(.5,Math.min(1,peak)*40)}`:'').join(' ');
}
