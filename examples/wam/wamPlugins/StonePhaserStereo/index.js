/* eslint-disable no-underscore-dangle */
/* eslint-disable max-classes-per-file */
/* eslint-disable max-len */

import WebAudioModule from "../utils/sdk/src/WebAudioModule.js";
import CompositeAudioNode from "../utils/sdk-parammgr/src/CompositeAudioNode.js";
import ParamMgrFactory from "../utils/sdk-parammgr/src/ParamMgrFactory.js";
import { createTonelabPedal } from "../utils/tonelab-pedal.js";

/**
 * @typedef {import('../sdk-parammgr').ParamMgrNode} ParamMgrNode
 */

class StonePhaserStereoNode extends CompositeAudioNode {
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

export default class StonePhaserStereoPlugin extends WebAudioModule {
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
    const node = new StonePhaserStereoNode(this.audioContext);
    node.setup(faustNode, paramMgrNode);
    if (initialState) node.setState(initialState);
    return node;
  }

  createGui() {
    return createTonelabPedal(this, {
      name: "Stone Phaser",
      color: "#e07b39",
      skin: { image: new URL("./Gui/img/background/psyche10.jpg", import.meta.url).href, background: "#222", ink: "#ffffff", font: "Francois One" },
      bypass: "/StonePhaserStereo/Bypass",
      knobs: [
        { id: "/StonePhaserStereo/LFO", label: "Rate", unit: "Hz", log: true },
        { id: "/StonePhaserStereo/Feedback", label: "Feedback", unit: "%" },
        { id: "/StonePhaserStereo/Mix", label: "Mix", unit: "%" },
        { id: "/StonePhaserStereo/Lo-cut", label: "Lo-cut", unit: "Hz", log: true },
        { id: "/StonePhaserStereo/Stereo_phase", label: "Stereo", format: (v) => `${v.toFixed(0)}\u00b0` },
      ],
      switches: [
        { id: "/StonePhaserStereo/Color", label: "Color" },
      ],
    });
  }
}
