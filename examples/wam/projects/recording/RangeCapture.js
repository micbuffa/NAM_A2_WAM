import {IncrementalTake, MAX_TAKE_BYTES, PEAK_FRAMES, monoHeader} from './TakePCM.js';
import {readDI, punchTake} from './PunchTake.js';

// One continuous capture clock. Split after compensation, never with UI timers.
export function recordingRange(loop, offset, rate) {
  const a=Math.round((loop?.start??0)*rate), b=Math.round((loop?.end??0)*rate), from=Math.round(offset*rate);
  if(b-a<Math.ceil(.05*rate))return null;
  const cycle=Boolean(loop.enabled), start=cycle?a:Math.max(a,from);
  if(start>=b)throw Error('Place the playhead before B to record in the A/B range.');
  return {mode:cycle?'cycle':'punch',startFrame:start,endFrame:b,transportStartFrame:cycle?a:from};
}
export class RangeCapture {
  constructor(metadata){
    this.metadata=metadata;this.range=metadata.rangeRecording;const r=this.range;
    this.period=r.endFrame-r.startFrame;
    if(!['cycle','punch'].includes(r.mode)||![r.startFrame,r.endFrame,r.transportStartFrame].every(Number.isSafeInteger)||r.transportStartFrame<0||r.startFrame<r.transportStartFrame||this.period<1||44+r.endFrame*4>MAX_TAKE_BYTES)throw Error('Invalid A/B range or range exceeds the 100 MiB recording limit.');
    this.limit=r.mode==='punch'?1:Math.min(3,Math.floor((MAX_TAKE_BYTES-44)/(this.period*4))-1);
    if(this.limit<1)throw Error('This A/B range is too long for bounded loop takes. Shorten the range.');
    this.skip=r.startFrame-r.transportStartFrame+metadata.compensationFrames;this.frames=0;this.number=1;this.completed=[];this.begin();
  }
  begin(){this.current=new IncrementalTake({sampleRate:this.metadata.sampleRate,startProjectFrame:0,compensationFrames:0});this.livePeaks=[];this.dirty=Infinity;}
  append(samples){
    let from=Math.min(samples.length,Math.max(0,this.skip-this.frames));this.frames+=samples.length;
    while(from<samples.length&&this.current){
      const count=Math.min(samples.length-from,this.period-this.current.frames),part=samples.subarray(from,from+count),old=this.current.frames;
      this.current.append(part);
      for(let i=0;i<count;i++){const bin=Math.floor((this.range.startFrame+old+i)/PEAK_FRAMES);this.livePeaks[bin]=Math.max(this.livePeaks[bin]??0,Math.abs(part[i]));this.dirty=Math.min(this.dirty,bin);}
      from+=count;
      if(this.current.frames===this.period){
        this.completed.push({...this.current.finish(this.period),number:this.number++,complete:true});
        while(this.completed.length>this.limit)this.completed.shift();
        if(this.range.mode==='punch'){this.current=null;break;}this.begin();
      }
    }
  }
  delta(){
    const start=Number.isFinite(this.dirty)?this.dirty:Math.floor(this.range.startFrame/PEAK_FRAMES);
    const peaks=Float32Array.from({length:Math.max(0,this.livePeaks.length-start)},(_,i)=>this.livePeaks[start+i]??0);this.dirty=Infinity;
    return {frames:this.frames,timelineFrames:this.range.endFrame,sampleRate:this.metadata.sampleRate,peakFrames:PEAK_FRAMES,peakStart:start,peaks,rangePass:this.number,retainedTakes:this.completed.length,takeLimit:this.limit};
  }
  finish(frames){
    if(frames!==this.frames)throw Error('Recording lost audio frames.');
    this.options=[...this.completed];
    if(this.current?.frames)this.options.push({...this.current.finish(this.current.capturedFrames),number:this.number,complete:false});
    this.current=null;
    if(!this.options.length)throw Error('No audio reached the A/B recording range. Previous audio is unchanged.');
    return this.options.filter(t=>t.complete).at(-1)?.number??this.options.at(-1).number;
  }
  async render(number,base){
    const part=this.options.find(t=>t.number===number);if(!part)throw Error('This loop take is no longer retained.');
    const {startFrame,endFrame,mode,transportStartFrame}=this.range,rate=this.metadata.sampleRate,frames=startFrame+part.frames;
    const zeros=new Blob([new Uint8Array(16384*4)]),prefix=[];
    for(let n=startFrame;n>0;n-=16384)prefix.push(n>=16384?zeros:zeros.slice(0,n*4));
    const audio=new Blob([monoHeader(frames,rate),...prefix,part.audio.slice(44)],{type:'audio/wav'});
    let result={audio,frames,peaks:(await readDI(audio,rate)).peaks,recordedPeak:part.peaks.reduce((max,v)=>Math.max(max,v),0)};
    if(base)result=await punchTake(base,result,{startProjectFrame:startFrame,compensationFrames:0,sampleRate:rate});
    return {...result,capturedFrames:this.frames,rangeTake:{mode,startFrame,endFrame,transportStartFrame,takeNumber:part.number,complete:part.complete,contentFrames:part.frames},loopSelection:part.number,
      loopOptions:this.options.map(t=>({number:t.number,complete:t.complete,frames:t.frames})),takeLimit:this.limit};
  }
}
