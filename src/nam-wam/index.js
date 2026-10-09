import WebAudioModule from '../../third_party/wam-examples/packages/sdk/src/WebAudioModule.js';
import NamNode from './NamNode.js';
import {loadDefaultAsset} from '../shared/defaultAssets.js';
import {factoryAssetUrl} from '../shared/assetBrowser.js';
import {ToneCallbackSession} from '../shared/ToneCallbackSession.js';

const baseUrl = new URL('.', import.meta.url).href.replace(/\/$/, '');

export default class NamPlugin extends WebAudioModule {
  static tone3000Config = {};
  _descriptorUrl = `${baseUrl}/descriptor.json`;

  async initialize(state) {
    await this._loadDescriptor();
    await super.initialize();
    if (state) await this.audioNode.setState(structuredClone(state));
    await loadDefaultAsset(this.audioNode, 'nam', new URL('./models-manifest.json', import.meta.url));
    this.toneSession=new ToneCallbackSession(this,'nam');
    this.audioNode.toneSession=this.toneSession;
    return this;
  }

  async createAudioNode(initialState) {
    await NamNode.addModules(this.audioContext, this.moduleId, `${baseUrl}/../../build-wasm/dist/nam-simd.wasm`);
    const node = new NamNode(this);
    await node._initialize();
    if (initialState) await node.setState(initialState);
    return node;
  }

  async getCaptureChoices() {
    const gui=this.audioNode.gui;
    if(gui){const collection=gui.mainCaptureCollection();return {items:collection.items.map((item,index)=>({id:collection.remote?`tone3000:${gui._toneId}:${item.id}`:item.id,name:item.filename||item.name||`Capture ${index+1}`})),index:collection.index,busy:!!(gui._mainCaptureLoading||gui._toneModelLoading)};}
    const metadata=this.audioNode.getModelSnapshot(),identity=metadata?.provenance?.identity;
    if(metadata?.provenance?.source!=='Factory')return {items:metadata?[{id:'current',name:metadata.name}]:[],index:metadata?0:-1};
    this._captureManifest ||= fetch(new URL('./models-manifest.json',import.meta.url)).then(response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}).catch(error=>{this._captureManifest=null;throw error;});
    const {assets}=await this._captureManifest,current=assets.find(asset=>asset.id===identity);
    this._captureChoices=current?assets.filter(asset=>current.provenance?.toneId!=null?String(asset.provenance?.toneId)===String(current.provenance.toneId):JSON.stringify(asset.groups)===JSON.stringify(current.groups)):[];
    return {items:this._captureChoices.map(asset=>({id:asset.id,name:asset.filename})),index:this._captureChoices.findIndex(asset=>asset.id===identity)};
  }

  async selectCapture(id) {
    if(this.audioNode.gui){const choices=await this.getCaptureChoices();const index=choices.items.findIndex(item=>item.id===id);if(index>=0&&!await this.audioNode.gui.selectMainCapture(index))throw Error('Capture could not be loaded');return;}
    const asset=this._captureChoices?.find(asset=>asset.id===id);if(!asset)return;
    const manifest=new URL('./models-manifest.json',import.meta.url),response=await fetch(factoryAssetUrl(manifest,'models',asset.relativePath));
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const provenance={...asset.provenance,identity:asset.id,source:'Factory',title:asset.provenance?.title||asset.displayName,metadata:asset.metadata,imageUrl:asset.imagePath?factoryAssetUrl(manifest,'models',asset.imagePath).href:''};
    await this.audioNode.loadModelText(await response.text(),asset.filename,provenance);
  }

  createGui() { return this._guiPromise ||= import('./gui.js').then(({createElement})=>createElement(this)).catch(error=>{this._guiPromise=null;throw error;}); }
  destroyGui(gui) { gui?.destroy?.(); gui?.remove(); this._guiPromise=null; }

  static configureTone3000(config) { NamPlugin.tone3000Config = {...config}; }
}
