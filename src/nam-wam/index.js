import WebAudioModule from '../../third_party/wam-examples/packages/sdk/src/WebAudioModule.js';
import NamNode from './NamNode.js';
import {createElement} from './gui.js';

const baseUrl = new URL('.', import.meta.url).href.replace(/\/$/, '');

export default class NamPlugin extends WebAudioModule {
  static tone3000Config = {};
  _descriptorUrl = `${baseUrl}/descriptor.json`;

  async initialize(state) {
    await this._loadDescriptor();
    return super.initialize(state);
  }

  async createAudioNode(initialState) {
    await NamNode.addModules(this.audioContext, this.moduleId, `${baseUrl}/../../build-wasm/dist/nam-simd.wasm`);
    const node = new NamNode(this);
    await node._initialize();
    if (initialState) await node.setState(initialState);
    return node;
  }

  createGui() { return createElement(this); }

  static configureTone3000(config) { NamPlugin.tone3000Config = {...config}; }
}
