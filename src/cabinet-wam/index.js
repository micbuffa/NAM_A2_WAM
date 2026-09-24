import WebAudioModule from '../../third_party/wam-examples/packages/sdk/src/WebAudioModule.js';
import CabinetNode from './CabinetNode.js';
import {loadDefaultAsset} from '../shared/defaultAssets.js';
import {ToneCallbackSession} from '../shared/ToneCallbackSession.js';
const baseUrl=new URL('.',import.meta.url).href.replace(/\/$/,'');
export default class CabinetPlugin extends WebAudioModule {
  static tone3000Config = {};
  _descriptorUrl=`${baseUrl}/descriptor.json`;
  async initialize(state){await this._loadDescriptor();await super.initialize();if(state)await this.audioNode.setState(structuredClone(state));await loadDefaultAsset(this.audioNode,'ir',new URL('./irs-manifest.json',import.meta.url));this.toneSession=new ToneCallbackSession(this,'cabinet');this.audioNode.toneSession=this.toneSession;return this;}
  async createAudioNode(initialState){await CabinetNode.addModules(this.audioContext,this.moduleId,`${baseUrl}/../../build-wasm/dist/nam-simd.wasm`);const node=new CabinetNode(this);await node._initialize();if(initialState)await node.setState(initialState);return node;}
  createGui(){return this._guiPromise ||= import('./gui.js').then(({createElement})=>createElement(this)).catch(error=>{this._guiPromise=null;throw error;});}
  destroyGui(gui){gui?.destroy?.();gui?.remove();this._guiPromise=null;}
  static configureTone3000(config){CabinetPlugin.tone3000Config={...config};}
}
