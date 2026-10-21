/* eslint-disable max-len */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-classes-per-file */
import WebAudioModule from "../utils/sdk/src/WebAudioModule.js";
import CompositeAudioNode from "../utils/sdk-parammgr/src/CompositeAudioNode.js";
import ParamMgrFactory from "../utils/sdk-parammgr/src/ParamMgrFactory.js";
import { createTonelabPedal } from "../utils/tonelab-pedal.js";

/**
 * @typedef {import('../sdk-parammgr').ParamMgrNode} ParamMgrNode
 */

class BigMuffNode extends CompositeAudioNode {
  /**
   * @type {ParamMgrNode}
   */
  _wamNode;

  /**
   * @param {AudioWorkletNode} output
   * @param {ParamMgrNode} paramMgr
   */
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

  /**
   * @param {string} name
   */
  getParamValue(name) {
    return this._wamNode.getParamValue(name);
  }

  /**
   * @param {string} name
   * @param {number} value
   */
  setParamValue(name, value) {
    return this._wamNode.setParamValue(name, value);
  }
}

/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBasetUrl = (relativeURL) => {
  const baseURL = relativeURL.href.substring(0, relativeURL.href.lastIndexOf("/"));
  return baseURL;
};

export default class BigMuffPlugin extends WebAudioModule {
  /**
   * Faust generated WebAudio AudioWorkletNode Constructor
   */
  _PluginFactory;

  _baseURL = getBasetUrl(new URL(".", import.meta.url));

  _descriptorUrl = `${this._baseURL}/descriptor.json`;

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

  async createAudioNode(initialState) {
    const factory = new this._PluginFactory(this.audioContext, this._baseURL);
    const faustNode = await factory.load();
    const paramMgrNode = await ParamMgrFactory.create(this, {
      internalParamsConfig: Object.fromEntries(faustNode.parameters),
    });
    const node = new BigMuffNode(this.audioContext);
    node.setup(faustNode, paramMgrNode);
    if (initialState) node.setState(initialState);
    return node;
  }

  createGui() {
    return createTonelabPedal(this, {
      name: "Big Muff",
      color: "#e0483e",
      // The original background is a photo of the whole pedal (knobs included): keep its colours only.
      skin: { background: "linear-gradient(135deg, #e3e5e7 0%, #a7abaf 42%, #eef0f1 58%, #8d9195 100%)", ink: "#c0262d", vendorInk: "#2f3235", font: "Francois One" },
      bypass: "/BigMuff/bypass",
      knobs: [
        { id: "/BigMuff/Input", label: "Input", unit: "dB" },
        { id: "/BigMuff/Drive", label: "Sustain" },
        { id: "/BigMuff/Tone", label: "Tone" },
        { id: "/BigMuff/Output", label: "Volume", unit: "%" },
      ],
    });
  }
}
