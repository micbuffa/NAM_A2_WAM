import WebAudioModule from "../utils/sdk/src/WebAudioModule.js";
import CompositeAudioNode from "../utils/sdk-parammgr/src/CompositeAudioNode.js";
import ParamMgrFactory from "../utils/sdk-parammgr/src/ParamMgrFactory.js";

import { createTonelabPedal } from "../utils/tonelab-pedal.js";

class Kpp_fuzzNode extends CompositeAudioNode {
  _wamNode;

  setup(output, paramMgr) {
    this.connect(output, 0, 0);
    paramMgr.addEventListener("wam-midi", (e) => output.midiMessage(e.detail.data.bytes));
    this._wamNode = paramMgr;
    this._output = output;
  }

  destroy() {
    super.destroy();
    if (this._output) this._output.destroy();
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
export default class Kpp_fuzzPlugin extends WebAudioModule {
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
    return super.initialize(state);
  }

  // The plugin redefines the async method createAudionode()
  // that must return an <Audionode>
  // It also listen to plugin state change event to update the audionode internal state
  async createAudioNode(initialState) {
    const factory = new this._PluginFactory(this.audioContext, this._baseURL);
    const faustNode = await factory.load();
    const paramMgrNode = await ParamMgrFactory.create(this, {
      internalParamsConfig: Object.fromEntries(faustNode.parameters),
    });
    const node = new Kpp_fuzzNode(this.audioContext);
    node.setup(faustNode, paramMgrNode);

    if (initialState) node.setState(initialState);

    return node;
  }

  createGui() {
    return createTonelabPedal(this, {
      name: "KPP Fuzz",
      color: "#8bd450",
      skin: { background: "linear-gradient(to top, #0ba300, #5df984)", ink: "#ffffff", font: "Skranji" },
      bypass: "/Kpp_fuzz/99_bypass",
      knobs: [
        { id: "/Kpp_fuzz/fuzz", label: "Fuzz", unit: "%" },
        { id: "/Kpp_fuzz/tone", label: "Tone", unit: "dB" },
        { id: "/Kpp_fuzz/volume", label: "Volume" },
      ],
    });
  }
}
