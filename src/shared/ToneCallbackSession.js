import Tone3000Client from '../nam-wam/tone3000/Tone3000Client.js';
import {TONE3000_CALLBACK_CHANNEL, TONE3000_CALLBACK_STORAGE_KEY} from '../nam-wam/tone3000/Tone3000Auth.js';
import Tone3000Downloads from '../nam-wam/tone3000/Tone3000Downloads.js';
import ImpulseResponseLibrary from '../cabinet-wam/ImpulseResponseLibrary.js';

const OWNER='nam-a2-wam.tone3000.instance';
// Authentication is shared; selection ownership and application are not.
export class ToneCallbackSession {
  constructor(plugin,kind) {
    this.plugin=plugin;this.kind=kind;this.identity=plugin.instanceId;
    this.client=new Tone3000Client(plugin.constructor.tone3000Config||{});
    this.receive=data=>{if(data?.type===TONE3000_CALLBACK_CHANNEL&&data.href)this.complete({href:data.href}).catch(error=>{this.error=error.message;plugin.audioNode.dispatchEvent(new CustomEvent('tone-error',{detail:error.message}));});};
    this.message=event=>{if(event.origin===location.origin)this.receive(event.data);};
    this.storage=event=>{if(event.key===TONE3000_CALLBACK_STORAGE_KEY&&event.newValue){try{this.receive(JSON.parse(event.newValue));}catch{}}};
    window.addEventListener('message',this.message);window.addEventListener('storage',this.storage);
    this.channel=typeof BroadcastChannel==='function'?new BroadcastChannel(TONE3000_CALLBACK_CHANNEL):null;
    if(this.channel)this.channel.onmessage=event=>this.receive(event.data);
  }
  key(){return `${this.kind}:${this.identity}`;}
  claim(){sessionStorage.setItem(OWNER,this.key());this.lastHref='';}
  async complete(locationLike=window.location) {
    if(this.disposed||sessionStorage.getItem(OWNER)!==this.key()||!/[?&](code|error|canceled)=/.test(locationLike.href)||this.lastHref===locationLike.href)return;
    this.lastHref=locationLike.href;
    const gui=this.plugin.audioNode.gui;
    // Cached editors retain maintainer/export workflows; no new GUI is created here.
    if(gui){gui._tonePopup?.close();gui._tonePopup=null;await gui.completeTone3000Callback(locationLike);sessionStorage.removeItem(OWNER);return;}
    const result=await this.client.completeAuthorization(locationLike);
    sessionStorage.removeItem(OWNER);
    if(locationLike===window.location)history.replaceState({},document.title,location.pathname);
    if(!result.ok)throw Error(result.error);
    if(!result.toneId||this.disposed)return;
    const node=this.plugin.audioNode,revision=node.assetRevision;
    const [tone,models]=await Promise.all([this.client.getTone(result.toneId,{architecture:this.kind==='nam'?'2':''}),this.kind==='nam'?this.client.getCompatibleModels(result.toneId):this.client.listModels(result.toneId,{architecture:''})]);
    const model=models[0];if(!model)throw Error('No compatible captures found');
    const provenance={source:'TONE3000',toneId:result.toneId,modelId:model.id,identity:`tone3000${this.kind==='nam'?'':'-ir'}:${result.toneId}:${model.id}`,title:tone.title||tone.name,gear:tone.gear,license:tone.license,creator:tone.user?.username||tone.creator?.name,imageUrl:tone.images?.[0]||tone.image_url||''};
    if(this.kind==='nam'){
      const download=await this.client.downloadModel(model);if(this.disposed||node.assetRevision!==revision)return;
      await node.loadModelText(download.text,download.name,provenance);
      const library=new Tone3000Downloads();try{await library.save({...provenance,...download,downloadedAt:new Date().toISOString()});}finally{library.close();}
    }else{
      const download=await this.client.downloadImpulseResponse(model);const buffer=await node.context.decodeAudioData(download.bytes.buffer.slice(0));if(this.disposed||node.assetRevision!==revision)return;
      await node.loadImpulseResponse(buffer.getChannelData(0),download.name,provenance.identity,provenance);
      const library=new ImpulseResponseLibrary();try{await library.saveDownload({...provenance,...download,downloadedAt:new Date().toISOString()});}finally{library.close();}
    }
  }
  destroy(){this.disposed=true;window.removeEventListener('message',this.message);window.removeEventListener('storage',this.storage);this.channel?.close();}
}
