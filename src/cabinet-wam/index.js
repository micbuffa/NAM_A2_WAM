import WebAudioModule from '../../third_party/wam-examples/packages/sdk/src/WebAudioModule.js';
import CabinetNode from './CabinetNode.js';
import {loadDefaultAsset, factoryImageFor} from '../shared/defaultAssets.js';
import {ToneCallbackSession} from '../shared/ToneCallbackSession.js';
const baseUrl=new URL('.',import.meta.url).href.replace(/\/$/,'');
export default class CabinetPlugin extends WebAudioModule {
  static tone3000Config = {};
  // Optional host account integration: {favorites} (see gui.js).
  static account = {};
  // Factory IR catalogue, for hosts that build presets from Factory assets.
  static factoryManifestUrl = new URL('./irs-manifest.json', import.meta.url).href;
  _descriptorUrl=`${baseUrl}/descriptor.json`;
  async initialize(state){await this._loadDescriptor();await super.initialize();if(state)await this.audioNode.setState(structuredClone(state));await loadDefaultAsset(this.audioNode,'ir',new URL('./irs-manifest.json',import.meta.url));this.toneSession=new ToneCallbackSession(this,'cabinet');this.audioNode.toneSession=this.toneSession;return this;}
  async createAudioNode(initialState){await CabinetNode.addModules(this.audioContext,this.moduleId,`${baseUrl}/../../build-wasm/dist/nam-simd.wasm`);const node=new CabinetNode(this);await node._initialize();if(initialState)await node.setState(initialState);return node;}
  // Picture of the loaded IR for host cards (Factory IRs resolved from the manifest).
  async resolveImageUrl(){const ir=this.audioNode.getIrSnapshot();if(!ir)return'';return (await factoryImageFor(CabinetPlugin.factoryManifestUrl,'IRs',{identity:ir.metadata?.identity||ir.id,filename:ir.name}))||ir.metadata?.imageUrl||'';}
  createGui(){return this._guiPromise ||= import('./gui.js').then(({createElement})=>createElement(this)).catch(error=>{this._guiPromise=null;throw error;});}
  destroyGui(gui){gui?.destroy?.();gui?.remove();this._guiPromise=null;}
  static configureTone3000(config){CabinetPlugin.tone3000Config={...config};}
  static configureAccount(config){CabinetPlugin.account={...config};}
}
