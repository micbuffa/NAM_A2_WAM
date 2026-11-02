// Bounded onset-envelope autocorrelation. A suggestion, never a musical ground truth.
// Quarter-note BPM; half/double tempo ambiguities are deliberately reported in the UI.
export function estimateTempo(pcm, sampleRate) {
  if(!(pcm instanceof Float32Array)||!(sampleRate>0)||pcm.length<sampleRate*8)return null;
  const hop=Math.max(1,Math.round(sampleRate/100)),energy=[];
  for(let start=0;start<pcm.length;start+=hop){let power=0;for(let i=start;i<Math.min(pcm.length,start+hop);i++)power+=pcm[i]*pcm[i];energy.push(Math.sqrt(power/hop));}
  if(Math.max(...energy)-Math.min(...energy)<Math.max(...energy)*.12)return null;
  const onset=energy.map((v,i)=>Math.max(0,v-(energy[i-1]??v)));
  const power=onset.reduce((sum,v)=>sum+v*v,0);if(power<1e-7)return null;
  const rate=sampleRate/hop,candidates=[];
  for(let lag=Math.floor(rate*60/180);lag<=Math.ceil(rate*60/60);lag++){
    let cross=0,a=0,b=0;for(let i=lag;i<onset.length;i++){cross+=onset[i]*onset[i-lag];a+=onset[i]**2;b+=onset[i-lag]**2;}
    const correlation=cross/Math.sqrt(a*b||1),bpm=60*rate/lag;
    candidates.push({bpm:Math.round(bpm),score:correlation*(1-.035*Math.abs(Math.log2(bpm/120))),correlation});
  }
  candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];
  return best.correlation>=.18?{bpm:best.bpm,confidence:Math.min(1,best.correlation),seconds:pcm.length/sampleRate}:null;
}
