// Silent two-input recorder for comparing complete WAM and original WAP graphs.
class DifferenceRecorder extends AudioWorkletProcessor {
  constructor(options){super();this.begin=options.processorOptions.begin;this.end=options.processorOptions.end;this.count=0;this.squares=0;this.errors=0;this.peak=0;this.maxError=0;this.finite=true;}
  process(inputs,outputs){
    for(const channel of outputs[0])channel.fill(0);
    const [wap,wam]=inputs;
    for(let i=0;i<128;i++){
      const t=currentTime+i/sampleRate;if(t<this.begin||t>=this.end)continue;
      for(let c=0;c<2;c++){
        const a=wap[c]?.[i]??0,b=wam[c]?.[i]??0,error=a-b;
        this.count++;this.finite&&=Number.isFinite(a)&&Number.isFinite(b);this.squares+=a*a;this.errors+=error*error;this.peak=Math.max(this.peak,Math.abs(a));this.maxError=Math.max(this.maxError,Math.abs(error));
      }
    }
    if(currentTime>=this.end){this.port.postMessage({finite:this.finite,rms:Math.sqrt(this.squares/this.count),peak:this.peak,maxError:this.maxError,relativeError:Math.sqrt(this.errors/Math.max(this.squares,1e-30))});return false;}
    return true;
  }
}
registerProcessor('wap2-difference',DifferenceRecorder);
