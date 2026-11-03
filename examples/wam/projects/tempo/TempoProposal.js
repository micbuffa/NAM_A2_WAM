// Preview metadata only. Source audio and raw ML events remain immutable.
export function nearestBeat(beats,time) {
  if(!beats.length||!Number.isFinite(time))return null;
  return beats.reduce((best,t)=>Math.abs(t-time)<Math.abs(best-time)?t:best,beats[0]);
}
function validateTimes(times,duration) {
  if(!Array.isArray(times)||times.length>100000||times.some((t,i)=>!Number.isFinite(t)||t<0||t>=duration||(i&&t<=times[i-1])))throw Error('Invalid beat events.');
}
export function createTempoProposal(analysis,{multiplier=1,anchorTime=null,beatsPerBar=null,rangeStart=0,rangeEnd=analysis.duration}={}) {
  const duration=analysis.duration;
  if(!Number.isFinite(duration)||duration<=0||![.5,1,2].includes(multiplier)||![null,3,4].includes(beatsPerBar)||(anchorTime!==null&&(!Number.isFinite(anchorTime)||anchorTime<0||anchorTime>=duration)))throw Error('Invalid tempo interpretation.');
  if(!Number.isFinite(rangeStart)||!Number.isFinite(rangeEnd)||rangeStart<0||rangeEnd>duration||rangeEnd<=rangeStart)throw Error('Choose a valid preview range A < B.');
  validateTimes(analysis.beats,duration);validateTimes(analysis.downbeats,duration);
  const raw=analysis.beats,reference=anchorTime??analysis.downbeats[0]??raw[0]??null;
  let allBeats=[...raw];
  if(multiplier===.5){const index=raw.indexOf(nearestBeat(raw,reference));allBeats=raw.filter((_,i)=>(i-index)%2===0);}
  if(multiplier===2)allBeats=raw.flatMap((t,i)=>i+1<raw.length?[t,(t+raw[i+1])/2]:[t]);
  const anchor=nearestBeat(allBeats,reference),anchorIndex=allBeats.indexOf(anchor);
  let allDownbeats;
  if(anchorTime!==null||beatsPerBar!==null)allDownbeats=allBeats.filter((_,i)=>(i-anchorIndex)%(beatsPerBar||4)===0);
  else allDownbeats=[...new Set(analysis.downbeats.map(t=>nearestBeat(allBeats,t)).filter(t=>t!==null))].sort((a,b)=>a-b);
  const inside=t=>t>=rangeStart&&t<rangeEnd;
  const beats=allBeats.filter(inside),downbeats=allDownbeats.filter(inside);
  const intervals=beats.slice(1).map((t,i)=>t-beats[i]).sort((a,b)=>a-b),middle=Math.floor(intervals.length/2);
  const median=intervals.length?(intervals.length%2?intervals[middle]:(intervals[middle-1]+intervals[middle])/2):null;
  return {duration,allBeats,allDownbeats,beats,downbeats,anchorTime:anchor,medianBpm:median?60/median:null,
    corrections:{multiplier,anchorTime,beatsPerBar},rangeStart,rangeEnd,kind:'preview-only',appliedToProject:false};
}
export function waveformPeaks(channels,sampleRate,duration,width=1000) {
  if(!Number.isSafeInteger(width)||width<1||width>10000||!Number.isFinite(sampleRate)||sampleRate<=0||!Number.isFinite(duration)||duration<=0||!channels.length||channels.some(c=>!c?.length||c.length!==channels[0].length))throw Error('Invalid waveform source.');
  const length=Math.min(channels[0].length,Math.ceil(duration*sampleRate)),peaks=new Float32Array(width);
  for(let x=0;x<width;x++){
    const start=Math.floor(x*length/width),end=Math.min(length,Math.max(start+1,Math.floor((x+1)*length/width)));
    let peak=0;for(const channel of channels)for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(channel[i]));peaks[x]=peak;
  }
  return peaks;
}
