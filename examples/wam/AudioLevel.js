// Analysis taps never connect to the destination. Separate channels avoid
// cancelling out-of-phase stereo when measuring the signal.
export class AudioLevel {
  constructor(context, source) {
    this.context=context;this.source=source;
    this.splitter=context.createChannelSplitter(2);
    this.analysers=[context.createAnalyser(),context.createAnalyser()];
    this.samples=new Float32Array(512);this.level=0;this.levels=[0,0];
    source.connect(this.splitter);
    this.analysers.forEach((analyser,index)=>{analyser.fftSize=512;this.splitter.connect(analyser,index);});
  }
  // Overall reading (loudest channel) plus `channels`: the same reading per L/R channel.
  read() {
    const running=this.context.state==='running';
    const channels=this.analysers.map((analyser,index)=>{
      let peak=0,energy=0;
      if(running){
        analyser.getFloatTimeDomainData(this.samples);
        for(const value of this.samples){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
        energy/=this.samples.length;
      }
      return this.reading(energy,peak,index);
    });
    const loudest=channels.reduce((a,b)=>b.energy>a.energy?b:a);
    const db=20*Math.log10(Math.max(1e-6,Math.sqrt(loudest.energy)));
    this.level=Math.max((db+60)/60,0,this.level*.86);
    return {level:Math.min(1,this.level),db,peak:Math.max(...channels.map(c=>c.peak)),channels};
  }
  reading(energy,peak,index) {
    const db=20*Math.log10(Math.max(1e-6,Math.sqrt(energy)));
    this.levels[index]=Math.max((db+60)/60,0,this.levels[index]*.86);
    return {level:Math.min(1,this.levels[index]),db,peak,energy};
  }
  destroy(){try{this.source.disconnect(this.splitter);}catch{}this.splitter.disconnect();this.analysers.forEach(a=>a.disconnect());}
}
