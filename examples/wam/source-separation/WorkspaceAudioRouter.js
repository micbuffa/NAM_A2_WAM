// A single post-rack BackingTrackMix consumes this stable backing output.
// Players own their settings; switching pauses the previous backing, never the rack.
export class WorkspaceAudioRouter extends EventTarget {
  constructor(context){super();this.context=context;this.outputNode=context.createGain();this.sources=new Map();this.active='tracks';const owner=this;this.engine={outputNode:this.outputNode,get playing(){return !!owner.current?.state().playing;},get mix(){return owner.current?.state().mix??.5;},get guitarPan(){return owner.current?.state().guitarPan??0;}};}
  get current(){return this.sources.get(this.active);}
  notify(){this.dispatchEvent(new Event('transport-change'));}
  attach(name,{outputNode,events,state,pause}){
    if(this.sources.has(name))throw Error('Lecteur déjà enregistré.');
    const gate=this.context.createGain();gate.gain.value=name===this.active?1:0;outputNode.connect(gate).connect(this.outputNode);
    const changed=()=>{if(this.active===name)this.notify();};
    for(const type of ['transport-change','mix-change','guitar-pan-change'])events.addEventListener(type,changed);
    let attached=true;const detach=()=>{if(!attached)return;attached=false;pause();for(const type of ['transport-change','mix-change','guitar-pan-change'])events.removeEventListener(type,changed);outputNode.disconnect(gate);gate.disconnect();this.sources.delete(name);this.notify();};
    this.sources.set(name,{state,pause,gate,detach});this.notify();return detach;
  }
  select(name){if(!['tracks','multitracks'].includes(name))return;if(name===this.active)return;this.current?.pause();this.active=name;for(const [id,s]of this.sources)s.gate.gain.value=id===name?1:0;this.notify();}
  attachMixer(player){const detach=this.attach('multitracks',{outputNode:player.engine.outputNode,events:player,state:()=>player.engine,pause:()=>player.activeEngine?.pause()});player.readMixLevel=()=>this.readMixLevel?.();return {destroy:()=>{detach();player.readMixLevel=null;}};}
  destroy(){for(const s of [...this.sources.values()])s.detach();this.sources.clear();this.outputNode.disconnect();}
}
