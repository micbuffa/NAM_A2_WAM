// Analysis taps never connect to the destination. Separate channels avoid
// cancelling out-of-phase stereo when measuring the signal.
export class AudioLevel {
  constructor(context, source) {
    this.context=context;this.source=source;
    this.splitter=context.createChannelSplitter(2);
    this.analysers=[context.createAnalyser(),context.createAnalyser()];
    this.samples=new Float32Array(512);this.level=0;
    source.connect(this.splitter);
    this.analysers.forEach((analyser,index)=>{analyser.fftSize=512;this.splitter.connect(analyser,index);});
  }
  read() {
    let peak=0,sum=0;
    if(this.context.state==='running')for(const analyser of this.analysers){
      analyser.getFloatTimeDomainData(this.samples);
      let energy=0;
      for(const value of this.samples){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
      sum=Math.max(sum,energy/this.samples.length);
    }
    const db=20*Math.log10(Math.max(1e-6,Math.sqrt(sum)));
    this.level=Math.max((db+60)/60,0,this.level*.86);
    return {level:Math.min(1,this.level),db,peak};
  }
  destroy(){try{this.source.disconnect(this.splitter);}catch{}this.splitter.disconnect();this.analysers.forEach(a=>a.disconnect());}
}
