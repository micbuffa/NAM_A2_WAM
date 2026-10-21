import {WebAudioModule} from "./runtime/sdk.js";
import {CompositeAudioNode, ParamMgrFactory} from "./runtime/parammgr.js";


class deathgateNode extends CompositeAudioNode {
  _wamNode;

  setup(output, paramMgr) {
    this.connect(output, 0, 0);
    paramMgr.addEventListener("wam-midi", (e) => output.midiMessage(e.detail.data.bytes));
    this._wamNode = paramMgr;
    this._output = output;
  }

  destroy() {
    if (!this._destroyPromise) {
      this.module.destroyGui();
      AudioNode.prototype.disconnect.call(this);
      this._output?.disconnect();
      this._output?.destroy();
      this._destroyPromise = Promise.resolve(super.destroy());
    }
    return this._destroyPromise;
  }

  getParamValue(name) {
    return this._wamNode.getParamValue(name);
  }

  setParamValue(name, value) {
    return this._wamNode.setParamValue(name, value);
  }
}

const getBasetUrl = (relativeURL) => {
  const baseURL = relativeURL.href.substring(0, relativeURL.href.lastIndexOf("/"));
  return baseURL;
};

// Definition of a new plugin
export default class deathgatePlugin extends WebAudioModule {
  _PluginFactory;

  _baseURL = getBasetUrl(new URL(".", import.meta.url));
  _descriptorUrl = this._baseURL + "/descriptor.json";

  async _loadDescriptor() {
    const url = this._descriptorUrl;
    if (!url) throw new TypeError("Descriptor not found");
    const response = await fetch(url);
    const descriptor = await response.json();
    Object.assign(this.descriptor, descriptor);
  }

  async initialize(state) {
    await this._loadDescriptor();
    const imported = await import("./Node.js");
    this._PluginFactory = imported[Object.keys(imported)[0]];
    this.audioNode = await this.createAudioNode(state);
    this.initialized = true;
    return this;
  }

  // The plugin redefines the async method createAudionode()
  // that must return an <Audionode>
  // It also listen to plugin state change event to update the audionode internal state
  async createAudioNode(initialState) {
    const factory = new this._PluginFactory(this.audioContext, this._baseURL);
    const faustNode = await factory.load();
    if (!faustNode) throw Error('DeathGate audio initialization failed');
    let paramMgrNode;
    try {
      paramMgrNode = await ParamMgrFactory.create(this, {
        internalParamsConfig: Object.fromEntries(faustNode.parameters),
      });
    } catch (error) { faustNode.disconnect(); faustNode.destroy(); throw error; }
    const node = new deathgateNode(this.audioContext);
    node.setup(faustNode, paramMgrNode);

    try { if (initialState) await node.setState(initialState); }
    catch (error) { await node.destroy(); throw error; }

    return node;
  }

  destroyGui(gui) {
    for (const editor of gui ? [gui] : this._guis || []) {
      editor.destroy?.(); editor.remove(); this._guis?.delete(editor);
    }
  }

  async createGui() {
    const {createTonelabPedal} = await import("../utils/tonelab-pedal.js");
    const gui = await createTonelabPedal(this, {
      name: "DeathGate",
      color: "#9aa5b1",
      skin: { image: new URL("./Gui/img/background/psyche9.jpg", import.meta.url).href, background: "#222", ink: "#ffffff", vendorInk: "#1d2023", font: "Faster One" },
      knobs: [
        { id: "/deathgate/NoiseGate", label: "Gate", unit: "dB" },
        { id: "/deathgate/DeadZone", label: "Dead zone", unit: "dB" },
      ],
    });
    (this._guis ||= new Set()).add(gui);
    return gui;
  }
}
