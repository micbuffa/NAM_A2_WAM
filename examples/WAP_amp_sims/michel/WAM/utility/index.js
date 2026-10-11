import {WebAudioModule} from '../shared/sdk.js';
import {UtilityNode} from './Node.js';
export default class UtilityModule extends WebAudioModule {
  _descriptorUrl = new URL('./descriptor.json', import.meta.url).href;
  async initialize(state) {
    await this._loadDescriptor();
    this.audioNode = await this.createAudioNode(state);
    this.initialized = true;
    return this;
  }
  async createAudioNode(state) { return new UtilityNode(this).initialize(state); }
  async createGui() {
    this.audioNode.checkAlive();
    if (!this._guiPromise) this._guiPromise = import('./gui.js').then(async ({createGui}) => {
      const gui = await createGui(this);
      if (this.audioNode.destroyed) { gui.destroy(); throw Error('Utility destroyed'); }
      return this._gui = gui;
    }).catch(error => { this._guiPromise = null; throw error; });
    return this._guiPromise;
  }
  destroyGui(gui) {
    gui?.destroy(); gui?.remove();
    if (!gui || gui === this._gui) { this._gui = null; this._guiPromise = null; }
  }
}
