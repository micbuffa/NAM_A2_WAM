import {AudioLevel} from './AudioLevel.js';

const disconnect=(from,to)=>{try{from.disconnect(to);}catch{}};
export class FxRack extends EventTarget {
  constructor({context,a,source,createLane}) {
    super();Object.assign(this,{context,a,source,createLane});
    this.pending=Promise.resolve();this.b=null;this.visible=false;this.enabledB=false;this.mutedA=false;
    this.channelB=1;this.inputDbB=0;this.tap=null;this.route=null;
    this.physicalB=context.createGain();this.gateA=context.createGain();this.gateB=context.createGain();this.gateB.gain.value=0;
    this.mix=context.createGain();this.output=context.createGain();this.mix.connect(this.output);
    a.output.connect(this.gateA).connect(this.mix);this.gateB.connect(this.mix);
    this.meter=new AudioLevel(context,this.output);this.attach(a);
    this.sourceChanged=()=>{this.syncSource();this.changed();};
    source.addEventListener('change',this.sourceChanged);this.syncMix();
  }
  enqueue(operation){const result=this.pending.then(operation);this.pending=result.catch(()=>{});return result;}
  changed(){this.dispatchEvent(new Event('change'));}
  attach(lane){
    lane.enqueue=operation=>this.enqueue(operation);
    lane.transition=operation=>this.inTransaction?operation():this.transition(operation);
    lane.addEventListener('change',()=>this.changed());
    lane.addEventListener('error',event=>this.dispatchEvent(new CustomEvent('error',{detail:event.detail})));
    lane.addEventListener('graphchange',()=>{this.syncTap();this.refreshRouting();});
    if(lane===this.a){
      const apply=lane.applyRouting.bind(lane);
      lane.applyRouting=async()=>{await apply();if(this.b)await this.b.applyRouting();};
    }
  }
  refreshRouting(){
    if(this.routingScheduled)return;this.routingScheduled=true;
    queueMicrotask(()=>{this.enqueue(()=>this.a.applyRouting()).catch(error=>this.dispatchEvent(new CustomEvent('error',{detail:error}))).finally(()=>{this.routingScheduled=false;});});
  }
  async transition(operation){
    const gain=this.output.gain,t=this.context.currentTime;
    gain.cancelScheduledValues(t);gain.setValueAtTime(gain.value,t);gain.linearRampToValueAtTime(0,t+.008);
    await new Promise(resolve=>setTimeout(resolve,12));
    try{return await operation();}finally{gain.cancelScheduledValues(this.context.currentTime);gain.setTargetAtTime(1,this.context.currentTime,.008);}
  }
  async ensureB(){
    if(this.b)return this.b;
    const b=await this.createLane();this.b=b;
    b.upstreamEntries=()=>this.route?this.a.entries.slice(0,this.route.index):[];
    this.attach(b);return b;
  }
  setVisible(visible){return this.enqueue(async()=>{
    if(visible)await this.ensureB();
    await this.transition(()=>{this.visible=visible;this.enabledB=visible;this.syncTap();this.syncSource();this.syncMix();});
    await this.a.applyRouting();this.changed();
  });}
  connectRoute(index){return this.enqueue(async()=>{
    if(!this.visible||!this.b)throw Error('Show chain B first');
    if(!Number.isInteger(index)||index<0||index>this.a.entries.length)throw Error('Invalid junction');
    await this.transition(()=>{
      this.route={id:this.route?.id||crypto.randomUUID(),index};this.a.junction=this.route;
      this.enabledB=true;
      this.syncTap();this.syncSource();this.syncMix();
    });await this.a.applyRouting();this.changed();
  });}
  removeRoute(){return this.enqueue(async()=>{
    await this.transition(()=>{this.route=null;this.a.junction=null;this.enabledB=false;this.syncTap();this.syncSource();this.syncMix();});
    await this.a.applyRouting();this.changed();
  });}
  syncTap(){
    if(this.tap&&this.b)disconnect(this.tap,this.b.input);this.tap=null;
    if(this.route&&this.visible&&this.b){
      this.route.index=Math.max(0,Math.min(this.route.index,this.a.entries.length));
      this.tap=this.route.index?this.a.entries[this.route.index-1].output:this.a.input;
      this.tap.connect(this.b.input);
    }
  }
  syncSource(){
    // Isolate both ends of the hidden lane, rather than merely muting its sum.
    if(this.b){disconnect(this.b.output,this.gateB);if(this.visible)this.b.output.connect(this.gateB);}
    if(this.b)disconnect(this.physicalB,this.b.input);
    if(this.b&&this.visible&&!this.route)this.physicalB.connect(this.b.input);
    const live=this.source.mode==='live',available=live&&this.channelB>=0&&this.channelB<this.source.liveInput?.channelCount;
    this.source.setSecondary(this.visible&&!this.route&&available?this.physicalB:null,this.channelB);
    // Device loss and source switches must not silently re-enable an independent input.
    if(!this.route&&!available)this.enabledB=false;
    this.physicalB.gain.setTargetAtTime(10**(this.inputDbB/20),this.context.currentTime,.008);
    this.syncMix();
  }
  setChannelB(channel){return this.enqueue(()=>{
    if(!Number.isInteger(channel)||channel<0||channel>=32)throw Error('Invalid B input channel');
    this.channelB=channel;this.syncSource();this.changed();
  });}
  setInputDbB(db){if(!Number.isFinite(Number(db)))throw Error('Invalid gain');this.inputDbB=Math.max(-48,Math.min(12,Number(db)));this.physicalB.gain.setTargetAtTime(10**(this.inputDbB/20),this.context.currentTime,.008);this.changed();}
  setEnabledB(enabled){return this.enqueue(()=>{
    if(enabled&&!this.visible)throw Error('Show chain B first');
    if(enabled&&!this.route&&!(this.source.mode==='live'&&this.channelB>=0&&this.channelB<this.source.liveInput?.channelCount))throw Error('Enable live input and select an available channel for B, or route A to B');
    this.enabledB=enabled;this.syncMix();this.changed();
  });}
  setMutedA(muted){return this.enqueue(()=>{this.mutedA=muted;this.syncMix();this.changed();});}
  syncMix(){
    const b=this.visible&&this.enabledB,t=this.context.currentTime;
    this.gateA.gain.setTargetAtTime(this.mutedA?0:1,t,.008);this.gateB.gain.setTargetAtTime(b?1:0,t,.008);
    this.mixDb=!this.mutedA&&b?-6:0;this.mix.gain.setTargetAtTime(10**(this.mixDb/20),t,.008);
  }
  destroy(){
    this.source.removeEventListener('change',this.sourceChanged);this.source.setSecondary(null,this.channelB);
    if(this.tap&&this.b)disconnect(this.tap,this.b.input);
    this.meter.destroy();this.a.destroy();this.b?.destroy();
    for(const node of [this.physicalB,this.gateA,this.gateB,this.mix,this.output])node.disconnect();
  }
  async snapshot(){return {version:2,a:await this.a.captureState(),b:this.b?await this.b.captureState():null,visible:this.visible,route:this.route?{...this.route}:null,inputDbB:this.inputDbB,outputDbA:this.a.outputDb,outputDbB:this.b?.outputDb||0,mutedA:this.mutedA,enabledB:this.enabledB,sourceTrim:{...this.source.trimDb}};}
  getState(){return this.enqueue(()=>this.snapshot());}
  setState(state){return this.enqueue(async()=>{
    const saved=structuredClone(state.version===1?{version:2,a:state,b:null,visible:false,route:null,inputDbB:0,outputDbA:0,outputDbB:0,mutedA:false,enabledB:false}:state);
    if(saved.version!==2||!saved.a?.entries||saved.visible&&!saved.b)throw Error('Invalid rack state');
    if(saved.sourceTrim)for(const mode of ['live','file'])if(!Number.isFinite(saved.sourceTrim[mode])||saved.sourceTrim[mode]<-48||saved.sourceTrim[mode]>12)throw Error('Invalid source trim');
    const ids=new Set();for(const e of [...saved.a.entries,...saved.b?.entries||[]]){if(ids.has(e.id))throw Error('Duplicate rack instance ID');ids.add(e.id);}
    if(saved.route&&(!saved.b||!Number.isInteger(saved.route.index)||saved.route.index<0||saved.route.index>saved.a.entries.length))throw Error('Invalid saved junction');
    for(const key of ['inputDbB','outputDbA','outputDbB'])if(!Number.isFinite(saved[key])||saved[key]<-48||saved[key]>12)throw Error('Invalid saved gain');
    const backup=await this.snapshot();if(saved.b)await this.ensureB();
    const apply=async value=>{
      this.route=null;this.a.junction=null;this.syncTap();
      await this.a.restoreState(value.a);if(value.b)await this.b.restoreState(value.b);
      this.visible=value.visible;this.route=value.route;this.a.junction=this.route;this.mutedA=value.mutedA;
      // Diagnostics restore never activates an independent physical input.
      this.enabledB=Boolean(value.visible&&value.route&&value.enabledB);
      this.setInputDbB(value.inputDbB);this.a.setOutputDb(value.outputDbA);this.b?.setOutputDb(value.outputDbB);
      if(value.sourceTrim)for(const mode of ['live','file'])this.source.setTrimDb(value.sourceTrim[mode],mode);
      this.syncTap();this.syncSource();await this.a.applyRouting();this.changed();
    };
    await this.transition(async()=>{
      this.inTransaction=true;
      try{await apply(saved);}catch(error){await apply(backup);throw error;}
      finally{this.inTransaction=false;}
    });
  });}
}
