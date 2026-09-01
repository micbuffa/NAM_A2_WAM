import addFunctionModule from '../../third_party/wam-examples/packages/sdk/src/addFunctionModule.js';
import WamNode from '../../third_party/wam-examples/packages/sdk/src/WamNode.js';
import getNamProcessor from './NamProcessor.js';

export default class NamNode extends WamNode {
  static async addModules(audioContext, moduleId, wasmUrl) {
    await super.addModules(audioContext, moduleId);
    await addFunctionModule(audioContext.audioWorklet, getNamProcessor, moduleId);
    const bytes = await fetch(wasmUrl).then((response) => {
      if (!response.ok) throw new Error(`Cannot load NAM WASM: ${response.status}`);
      return response.arrayBuffer();
    });
    this.wasmModule = await WebAssembly.compile(bytes);
  }

  constructor(module) {
    super(module, {numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'discrete',
      processorOptions: {wasmModule: NamNode.wasmModule, useSab: false}});
    this._namRequestId = 0;
    this._namPending = new Map();
    this._model = null;
    this._metadata = null;
    this._gui = null;
    this._meterListeners = new Set();
    this._modelListeners = new Set();
  }

  _onMessage(message) {
    const data = message.data;
    if (data.type === 'nam-meter') {
      this._meterListeners.forEach((listener) => listener(data));
      return;
    }
    if (!data.namResponse) {
      super._onMessage(message);
      return;
    }
    const pending = this._namPending.get(data.requestId);
    if (!pending) return;
    this._namPending.delete(data.requestId);
    if (data.ok) pending.resolve(data.content); else pending.reject(new Error(data.error));
  }

  _requestNam(namRequest, payload = {}, transfer = []) {
    const requestId = ++this._namRequestId;
    return new Promise((resolve, reject) => {
      this._namPending.set(requestId, {resolve, reject});
      this.port.postMessage({namRequest, requestId, ...payload}, transfer);
    });
  }

  async loadModelText(text, name = 'model.nam', provenance = null) {
    const metadata = NamNode.inspectMetadata(text, name);
    const encoded = new TextEncoder().encode(text);
    const result = await this._requestNam('load', {modelData: encoded.buffer, name}, [encoded.buffer]);
    this._model = {name, data: text, ...(provenance ? {provenance} : {})};
    this._metadata = {...metadata, expectedSampleRate: result.expectedSampleRate,
      ...(provenance ? {source: 'TONE3000', provenance} : {})};
    this._gui?.setModelStatus({status: 'ready', metadata: this._metadata, loadMs: result.loadMs});
    this._modelListeners.forEach((listener) => listener(this._metadata, this._model));
    return {...result, metadata: this._metadata};
  }

  static inspectMetadata(text, name) {
    const json = JSON.parse(text);
    const architecture = json.architecture || 'Unknown';
    let subtype = architecture;
    if (architecture === 'SlimmableContainer') subtype = 'A2 Lite + Full';
    else if (architecture === 'WaveNet') {
      const channels = json.config?.layers?.[0]?.channels;
      subtype = channels === 3 ? 'A2 Lite' : channels === 8 ? 'A2 Full' : 'WaveNet';
    }
    const metadata = json.metadata || {};
    return {name, architecture, subtype, version: json.version || 'Unknown', rawMetadata: metadata,
      expectedSampleRate: json.sample_rate ?? -1,
      modeledBy: metadata.modeled_by ?? metadata.modeledBy ?? 'Unknown'};
  }

  async setParameterValues(values) {
    await super.setParameterValues(values);
    this._gui?.syncParameters(await super.getParameterValues(false));
  }

  async getState() {
    const parameterState = await super.getState();
    return {parameterValues: parameterState.parameterValues, model: this._model,
      metadata: this._metadata, stateVersion: 1};
  }

  async setState(state) {
    if (state.model?.data) await this.loadModelText(state.model.data, state.model.name, state.model.provenance);
    await super.setState({parameterValues: state.parameterValues || {}});
    this._gui?.syncParameters(await super.getParameterValues(false));
  }

  startDiagnostic() { return this._requestNam('diagnostic/start'); }
  stopDiagnostic() { return this._requestNam('diagnostic/stop'); }
  setDiagnosticPassThrough(enabled) { return this._requestNam('diagnostic/passthrough', {enabled}); }
  getNamStatus() { return this._requestNam('status'); }
  addMeterListener(listener) { this._meterListeners.add(listener); }
  removeMeterListener(listener) { this._meterListeners.delete(listener); }
  addModelListener(listener) { this._modelListeners.add(listener); }
  removeModelListener(listener) { this._modelListeners.delete(listener); }

  set gui(value) { this._gui = value; }
  get gui() { return this._gui; }

  destroy() {
    this._gui?.destroy();
    this._meterListeners.clear();
    this._modelListeners.clear();
    super.destroy();
  }
}
