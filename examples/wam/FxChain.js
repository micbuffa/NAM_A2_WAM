import {AudioLevel} from './AudioLevel.js';
import {cabinetRoutingDecision} from './CabinetRouting.js';

const clone = value => structuredClone(value);
const disconnect = (node, target) => { try { target ? node.disconnect(target) : node.disconnect(); } catch {} };

// One controller per project. Catalogue records describe types, entries own instances.
export class FxChain extends EventTarget {
  constructor({context, registry, groupId}) {
    super(); Object.assign(this, {context, registry, groupId});
    this.input=context.createGain(); this.output=context.createGain();
    this.transitionGain=context.createGain();this.transitionGain.connect(this.output);
    this.inputMeter=new AudioLevel(context,this.input);this.outputMeter=new AudioLevel(context,this.output);
    // Each future lane owns its input selection and gains. Device preferences stay outside WAM state.
    this.lane={id:'lane-a',input:{channelIndex:0},topology:'single'};
    this.outputDb=0;
    this.entries=[]; this.edges=[]; this.pending=Promise.resolve();
  }
  enqueue(operation) {
    const result=this.pending.then(operation); this.pending=result.catch(()=>{}); return result;
  }
  changed() { this.dispatchEvent(new Event('change')); }
  find(id) { const entry=this.entries.find(e=>e.id===id); if(!entry)throw Error('Plugin instance no longer exists');return entry; }
  wrap({id=crypto.randomUUID(), kind='effect', plugin, record, missingState, bypass=false}) {
    const input=this.context.createGain(), output=this.context.createGain();
    const entry={id,kind,plugin,record,input,output,bypass,missingState,gui:null,guiPromise:null,disposed:false,cleanups:[]};
    entry.meter=new AudioLevel(this.context,input);
    if(kind==='effect') {
      entry.dry=this.context.createGain();entry.wet=this.context.createGain();
      input.connect(entry.dry).connect(output);
      if(plugin)input.connect(plugin.audioNode).connect(entry.wet).connect(output);
      entry.dry.gain.value=bypass||!plugin?1:0;entry.wet.gain.value=bypass||!plugin?0:1;
    } else {
      // Speaker interpretation explicitly averages stereo L/R into mono before core DSP.
      input.channelCount=1;input.channelCountMode='explicit';input.channelInterpretation='speakers';
      input.connect(plugin.audioNode).connect(output);
    }
    if(plugin) {
      const updateBypass=data=>{
        if(kind!=='nam'||data?.id!=='bypass')return;
        const bypass=Number(data.value)>=.5;if(entry.bypass===bypass)return;
        entry.bypass=bypass;
        this.enqueue(()=>this.applyRouting()).catch(error=>this.dispatchEvent(new CustomEvent('error',{detail:error})));
      };
      const listener=event=>{updateBypass(event.detail?.data);this.changed();};
      plugin.audioNode.addEventListener?.('wam-automation',listener);
      entry.cleanups.push(()=>plugin.audioNode.removeEventListener?.('wam-automation',listener));
      if(kind==='nam'){
        const bypassListener=event=>{updateBypass(event.detail);this.changed();};
        plugin.audioNode.addEventListener('bypass-change',bypassListener);
        entry.cleanups.push(()=>plugin.audioNode.removeEventListener('bypass-change',bypassListener));
      }
      const toneError=event=>this.dispatchEvent(new CustomEvent('error',{detail:new Error(event.detail)}));
      plugin.audioNode.addEventListener?.('tone-error',toneError);
      entry.cleanups.push(()=>plugin.audioNode.removeEventListener?.('tone-error',toneError));
      if(kind==='effect') {
        const failed=()=>{entry.error='Audio processor failed; dry bypass enabled';entry.bypass=true;entry.dry.gain.setTargetAtTime(1,this.context.currentTime,.008);entry.wet.gain.setTargetAtTime(0,this.context.currentTime,.008);this.changed();};
        plugin.audioNode.addEventListener?.('processorerror',failed);
        entry.cleanups.push(()=>plugin.audioNode.removeEventListener?.('processorerror',failed));
      }
    }
    return entry;
  }
  async initialize(nam,cabinet,prefix='') {
    this.entries=[this.wrap({id:prefix+'nam',kind:'nam',plugin:nam}),this.wrap({id:prefix+'cabinet',kind:'cabinet',plugin:cabinet})];
    const update=()=>this.applyRouting().catch(error=>this.dispatchEvent(new CustomEvent('error',{detail:error})));
    nam.audioNode.addModelListener(update);
    cabinet.audioNode.addEventListener('routing-mode',update);
    this.entries[0].cleanups.push(()=>nam.audioNode.removeModelListener(update));
    this.entries[1].cleanups.push(()=>cabinet.audioNode.removeEventListener('routing-mode',update));
    this.entries[1].cleanups.push(cabinet.audioNode.addChangeListener(()=>this.changed()));
    this.reconnect();await this.applyRouting();
  }
  async applyRouting() {
    const cab=this.entries.find(e=>e.kind==='cabinet');if(!cab)return;
    const path=[...(this.upstreamEntries?.()||[]),...this.entries.slice(0,this.entries.indexOf(cab))];
    const nam=path.findLast(e=>e.kind==='nam'&&!e.bypass);
    const mode=cab.plugin.audioNode.routingMode;
    const decision=cabinetRoutingDecision(mode,nam?.plugin.audioNode.getModelSnapshot());
    await cab.plugin.audioNode.setParameterValues({bypass:{id:'bypass',value:Number(decision.bypass),normalized:false}});
    cab.bypass=decision.bypass;cab.routingStatus=decision.text;
    cab.gui?.setRoutingStatus(mode,decision.text);this.changed();
  }
  reconnect() {
    for(const [from,to] of this.edges)disconnect(from,to);
    this.edges=[];let previous=this.input;
    for(const entry of this.entries){previous.connect(entry.input);this.edges.push([previous,entry.input]);previous=entry.output;}
    previous.connect(this.transitionGain);this.edges.push([previous,this.transitionGain]);this.dispatchEvent(new Event('graphchange'));this.changed();
  }
  async transition(operation) {
    const gain=this.transitionGain.gain,t=this.context.currentTime;
    gain.cancelScheduledValues(t);gain.setValueAtTime(gain.value,t);gain.linearRampToValueAtTime(0,t+.008);
    // Do not wait for an audio clock that may be suspended.
    await new Promise(resolve=>setTimeout(resolve,12));
    try{return await operation();}finally{gain.cancelScheduledValues(this.context.currentTime);gain.setTargetAtTime(1,this.context.currentTime,.008);}
  }
  setOutputDb(db) {
    if(!Number.isFinite(Number(db)))throw Error('Invalid output gain');
    this.outputDb=Math.max(-48,Math.min(12,Number(db)));
    this.output.gain.setTargetAtTime(10**(this.outputDb/20),this.context.currentTime,.008);
    return this.outputDb;
  }
  swap(id,targetId) {return this.enqueue(async()=>{
    const entry=this.find(id),target=this.find(targetId);if(entry===target)return;
    await this.transition(()=>{
      const a=this.entries.indexOf(entry),b=this.entries.indexOf(target);
      [this.entries[a],this.entries[b]]=[this.entries[b],this.entries[a]];
      this.reconnect();
    });
  });}
  move(id,beforeId=null) {return this.enqueue(async()=>{
    const entry=this.find(id);if(beforeId===id)return;
    const target=beforeId?this.find(beforeId):null;
    await this.transition(()=>{
      const oldIndex=this.entries.indexOf(entry);
      if(this.junction&&oldIndex<this.junction.index)this.junction.index--;
      this.entries=this.entries.filter(e=>e!==entry);
      const newIndex=target?this.entries.indexOf(target):this.entries.length;
      if(this.junction&&newIndex<this.junction.index)this.junction.index++;
      this.entries.splice(newIndex,0,entry);
      this.reconnect();
    });
  });}
  insert(record,beforeId=null,splitSide='after') { return this.enqueue(async()=>{
    if(beforeId)this.find(beforeId);
    const plugin=await this.registry.instantiate(record,{groupId:this.groupId,audioContext:this.context});
    const entry=this.wrap({plugin,record});
    try{await this.transition(()=>{const index=beforeId?this.entries.indexOf(this.find(beforeId)):this.entries.length;if(this.junction&&(index<this.junction.index||(index===this.junction.index&&splitSide==='before')))this.junction.index++;this.entries.splice(index,0,entry);this.reconnect();});}
    catch(error){this.entries=this.entries.filter(e=>e!==entry);this.dispose(entry);this.reconnect();throw error;}
    return entry;
  }); }
  remove(id) { return this.enqueue(async()=>{
    const entry=this.find(id);if(entry.kind!=='effect')throw Error('Core plugins cannot be removed');
    await this.transition(()=>{if(this.junction&&this.entries.indexOf(entry)<this.junction.index)this.junction.index--;this.entries=this.entries.filter(e=>e!==entry);this.reconnect();this.dispose(entry);});
  }); }
  setBypass(id,bypass) { return this.enqueue(async()=>{
    const e=this.find(id);
    if(e.kind==='cabinet'){e.plugin.audioNode.setRoutingMode(bypass?'bypass':'on');await this.applyRouting();}
    else if(e.kind==='nam')await e.plugin.audioNode.setParameterValues({bypass:{id:'bypass',value:Number(bypass),normalized:false}});
    else {e.dry.gain.setTargetAtTime(bypass||!e.plugin?1:0,this.context.currentTime,.008);e.wet.gain.setTargetAtTime(bypass||!e.plugin?0:1,this.context.currentTime,.008);}
    e.bypass=bypass;if(e.kind==='nam')await this.applyRouting();this.changed();
  }); }
  async getGui(id) {
    const e=this.find(id);if(!e.plugin)throw Error('Unavailable plugin; its saved state is retained');
    if(!e.guiPromise)e.guiPromise=Promise.resolve().then(()=>e.plugin.createGui()).then(gui=>{
      if(e.disposed){e.plugin.destroyGui?.(gui);throw Error('Instance removed while editor was opening');}
      if(!gui)throw Error('Plugin did not provide an editor');e.gui=gui;return gui;
    }).catch(error=>{e.guiPromise=null;throw error;});
    return e.guiPromise;
  }
  getState() {return this.enqueue(()=>this.captureState());}
  async captureState() {
    for(const e of this.entries)if(e.kind!=='effect'){
      const state=await e.plugin.audioNode.getState();e.bypass=Number(state.parameterValues?.bypass?.value)>=.5;
    }
    return {version:1,entries:await Promise.all(this.entries.map(async e=>({
    id:e.id,kind:e.kind,pluginUri:e.record?.catalogue?.uri||e.record?.entryUrl,
    bypass:e.bypass,state:clone(e.plugin?await e.plugin.audioNode.getState():e.missingState)
  })))};
  }
  setState(state) {return this.enqueue(()=>this.restoreState(state));}
  async restoreState(state) {
    const saved=clone(state);
    if(saved?.version!==1||!Array.isArray(saved.entries))throw Error('Unsupported chain state');
    const ids=new Set();
    for(const e of saved.entries){if(!e.id||ids.has(e.id)||!['nam','cabinet','effect'].includes(e.kind))throw Error('Invalid instance IDs or kinds');ids.add(e.id);}
    for(const kind of ['nam','cabinet'])if(saved.entries.filter(e=>e.kind===kind).length!==1)throw Error(`State requires one ${kind}`);
    const prepared=[];
    try {
      for(const item of saved.entries.filter(e=>e.kind==='effect')){
        const record=this.registry.records.find(r=>r.entryUrl===new URL(item.pluginUri,this.registry.catalogueUrl).href);
        let plugin,error;
        try{if(!record)throw Error('Plugin absent from catalogue');plugin=await this.registry.instantiate(record,{groupId:this.groupId,audioContext:this.context,state:item.state});}
        catch(cause){error=cause.message;}
        const entry=this.wrap({...item,plugin,record,missingState:item.state});
        if(!record)entry.record={name:item.pluginUri,catalogue:{uri:item.pluginUri}};
        entry.error=error;prepared.push(entry);
      }
      const old=this.entries,core=old.filter(e=>e.kind!=='effect');
      const backups=await Promise.all(core.map(async e=>clone(await e.plugin.audioNode.getState())));
      await this.transition(async()=>{
        try{for(const e of core)await e.plugin.audioNode.setState(saved.entries.find(item=>item.kind===e.kind).state);}
        catch(error){for(let i=0;i<core.length;i++)await core[i].plugin.audioNode.setState(backups[i]);throw error;}
        this.entries=saved.entries.map(item=>{
          const e=item.kind==='effect'?prepared.find(p=>p.id===item.id):core.find(c=>c.kind===item.kind);
          e.id=item.id;e.bypass=item.bypass;if(e.plugin?.toneSession)e.plugin.toneSession.identity=e.id;return e;
        });this.reconnect();for(const e of old)if(e.kind==='effect')this.dispose(e);
      });await this.applyRouting();
    }catch(error){for(const e of prepared)if(!this.entries.includes(e))this.dispose(e);throw error;}
    this.changed();
  }
  dispose(e) {
    e.meter.destroy();e.disposed=true;for(const cleanup of e.cleanups)cleanup?.();
    try{if(e.gui)e.plugin.destroyGui?.(e.gui);}catch{}
    e.gui?.remove();disconnect(e.input);disconnect(e.output);if(e.dry)disconnect(e.dry);if(e.wet)disconnect(e.wet);
    if(e.plugin){disconnect(e.plugin.audioNode);e.plugin.audioNode.destroy?.();}
  }
  destroy(){for(const [a,b]of this.edges)disconnect(a,b);for(const e of this.entries)this.dispose(e);this.entries=[];this.inputMeter.destroy();this.outputMeter.destroy();disconnect(this.input);disconnect(this.transitionGain);disconnect(this.output);}
}
