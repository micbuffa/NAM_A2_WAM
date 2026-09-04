import addFunctionModule from '../../third_party/wam-examples/packages/sdk/src/addFunctionModule.js';
import WamNode from '../../third_party/wam-examples/packages/sdk/src/WamNode.js';
import getNamProcessor from './NamProcessor.js';
import {modelLevelCompensationDb, modelLoudnessFromNam} from './ModelLevel.js';

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
    this._modelVariant = 'full';
    this._autoLevel = true;
    this._measuredCalibration = null;
    this._gui = null;
    this._meterListeners = new Set();
    this._spectrumListeners = new Set();
    this._modelListeners = new Set();
  }

  _onMessage(message) {
    const data = message.data;
    if (data.type === 'nam-meter') {
      this._meterListeners.forEach((listener) => listener(data));
      return;
    }
    if (data.type === 'nam-spectrum') {
      this._spectrumListeners.forEach((listener) => listener(data));
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
    this._measuredCalibration = null;
    const metadata = NamNode.inspectMetadata(text, name, this._modelVariant);
    const compensationDb = modelLevelCompensationDb(metadata.loudness, this._autoLevel);
    const encoded = new TextEncoder().encode(text);
    const result = await this._requestNam('load', {modelData: encoded.buffer, name, variant: this._modelVariant, compensationDb}, [encoded.buffer]);
    this._model = {name, data: text, ...(provenance ? {provenance} : {})};
    this._metadata = {...metadata, subtype: result.slimmable ? `A2 ${result.variant === 'lite' ? 'Lite' : 'Full'}` : metadata.subtype,
      availableVariants: result.slimmable ? ['full', 'lite'] : [], activeVariant: result.slimmable ? result.variant : null,
      autoLevelEnabled: this._autoLevel,
      autoLevelCompensationDb: Number.isFinite(Number(result.compensationDb)) ? Number(result.compensationDb) : compensationDb,
      levelMode: this._autoLevel ? 'metadata' : 'off',
      expectedSampleRate: result.expectedSampleRate,
      ...(provenance ? {source: provenance.source || 'TONE3000', provenance} : {})};
    this._gui?.setModelStatus({status: 'ready', metadata: this._metadata, loadMs: result.loadMs});
    this._modelListeners.forEach((listener) => listener(this._metadata, this._model));
    return {...result, metadata: this._metadata};
  }

  static inspectMetadata(text, name, variant = 'full') {
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
      loudness: modelLoudnessFromNam(json, variant),
      expectedSampleRate: json.sample_rate ?? -1,
      modeledBy: metadata.modeled_by ?? metadata.modeledBy ?? 'Unknown'};
  }

  async setParameterValues(values) {
    await super.setParameterValues(values);
    this._gui?.syncParameters(await super.getParameterValues(false));
  }

  async setModelVariant(variant) {
    this._modelVariant = variant === 'lite' ? 'lite' : 'full';
    const result = await this._requestNam('variant', {variant: this._modelVariant});
    if (result.applied && this._metadata) {
      const refreshed = NamNode.inspectMetadata(this._model.data, this._model.name, this._modelVariant);
      const requestedCompensationDb = modelLevelCompensationDb(refreshed.loudness, this._autoLevel);
      const normalization = await this._requestNam('normalization', {compensationDb:requestedCompensationDb});
      this._metadata = {...this._metadata, ...refreshed, subtype: `A2 ${this._modelVariant === 'lite' ? 'Lite' : 'Full'}`,
        activeVariant: this._modelVariant, availableVariants: ['full', 'lite'], autoLevelEnabled:this._autoLevel,
        autoLevelCompensationDb:Number.isFinite(Number(normalization.compensationDb)) ? Number(normalization.compensationDb) : requestedCompensationDb,
        levelMode:this._autoLevel?'metadata':'off'};
      this._measuredCalibration = null;
      this._gui?.setModelStatus({status: 'ready', metadata: this._metadata, loadMs: 0});
    }
    return result;
  }

  async setAutoLevel(enabled) {
    this._autoLevel = Boolean(enabled);
    const requestedCompensationDb = modelLevelCompensationDb(this._metadata?.loudness, this._autoLevel);
    const result = await this._requestNam('normalization', {compensationDb:requestedCompensationDb});
    const compensationDb = Number.isFinite(Number(result.compensationDb)) ? Number(result.compensationDb) : requestedCompensationDb;
    if (this._metadata) {
      this._metadata = {...this._metadata, autoLevelEnabled:this._autoLevel, autoLevelCompensationDb:compensationDb,
        levelMode:this._autoLevel?'metadata':'off'};
      this._measuredCalibration = null;
      this._gui?.setModelStatus({status:'ready',metadata:this._metadata,loadMs:0});
    }
    return compensationDb;
  }

  async calibrateModelLevel() {
    if (!this._model || !this._metadata) throw new Error('Load a NAM model before calibrating its level');
    const calibration = await this._requestNam('calibrate');
    this._autoLevel = true;
    this._measuredCalibration = calibration;
    this._metadata = {...this._metadata, autoLevelEnabled:true, autoLevelCompensationDb:calibration.compensationDb,
      levelMode:'measured', measuredCalibration:calibration};
    this._gui?.setModelStatus({status:'ready',metadata:this._metadata,loadMs:0});
    return calibration;
  }

  async applyMeasuredModelLevel(calibration) {
    if (!this._model || !this._metadata || !calibration || !Number.isFinite(Number(calibration.compensationDb)))
      throw new Error('Measured level calibration is unavailable');
    const result = await this._requestNam('normalization', {compensationDb:Number(calibration.compensationDb)});
    this._autoLevel = true;
    this._measuredCalibration = {...calibration, compensationDb:result.compensationDb};
    this._metadata = {...this._metadata, autoLevelEnabled:true, autoLevelCompensationDb:result.compensationDb,
      levelMode:'measured', measuredCalibration:this._measuredCalibration};
    this._gui?.setModelStatus({status:'ready',metadata:this._metadata,loadMs:0});
    return this._measuredCalibration;
  }

  async useMetadataModelLevel() {
    return this.setAutoLevel(true);
  }

  async getState() {
    const parameterState = await super.getState();
    return {parameterValues: parameterState.parameterValues, model: this._model, modelVariant: this._modelVariant, autoLevel:this._autoLevel,
      measuredCalibration:this._measuredCalibration, metadata: this._metadata, stateVersion: 4};
  }

  async setState(state) {
    if (state.modelVariant) this._modelVariant = state.modelVariant === 'lite' ? 'lite' : 'full';
    if (typeof state.autoLevel === 'boolean') this._autoLevel = state.autoLevel;
    if (state.model?.data) await this.loadModelText(state.model.data, state.model.name, state.model.provenance);
    if (state.measuredCalibration && this._metadata) await this.applyMeasuredModelLevel(state.measuredCalibration);
    await super.setState({parameterValues: state.parameterValues || {}});
    this._gui?.syncParameters(await super.getParameterValues(false));
  }

  startDiagnostic() { return this._requestNam('diagnostic/start'); }
  stopDiagnostic() { return this._requestNam('diagnostic/stop'); }
  setDiagnosticPassThrough(enabled) { return this._requestNam('diagnostic/passthrough', {enabled}); }
  getNamStatus() { return this._requestNam('status'); }
  addMeterListener(listener) { this._meterListeners.add(listener); }
  removeMeterListener(listener) { this._meterListeners.delete(listener); }
  addSpectrumListener(listener) { this._spectrumListeners.add(listener); }
  removeSpectrumListener(listener) { this._spectrumListeners.delete(listener); }
  setSpectrumEnabled(enabled) { return this._requestNam('spectrum/enabled', {enabled:Boolean(enabled)}); }
  addModelListener(listener) { this._modelListeners.add(listener); }
  removeModelListener(listener) { this._modelListeners.delete(listener); }

  set gui(value) { this._gui = value; }
  get gui() { return this._gui; }

  destroy() {
    this._gui?.destroy();
    this._meterListeners.clear();
    this._spectrumListeners.clear();
    this._modelListeners.clear();
    super.destroy();
  }
}
