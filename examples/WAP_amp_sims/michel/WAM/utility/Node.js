import {CompositeAudioNode, ParamMgrFactory} from '../shared/parammgr.js';
import DeathGate from '../../../../wam/wamPlugins/deathgate/index.js';

export const config = {
  inputGain: {label:'Input Gain',defaultValue:1,minValue:0.01,maxValue:2},
  noiseGate: {label:'Noise Gate',defaultValue:-120,minValue:-120,maxValue:0,units:'dB'},
  leftInput: {label:'Left Input',type:'boolean',defaultValue:1,minValue:0,maxValue:1,discreteStep:1},
  rightInput: {label:'Right Input',type:'boolean',defaultValue:1,minValue:0,maxValue:1,discreteStep:1},
};
const gateId = '/deathgate/NoiseGate';
const deadZoneId = '/deathgate/DeadZone';
export class UtilityNode extends CompositeAudioNode {
  constructor(module) {
    super(module.audioContext);
    this.plugin = module;
    this.values = Object.fromEntries(Object.entries(config).map(([id,p]) => [id,p.defaultValue]));
    this.cleaned = new WeakSet();
    this.listeners = new Set(); this._queue = Promise.resolve(); this.destroyed = false;
    this.nodes = [];
  }
  async initialize(state) {
    try {
      this.gate = await DeathGate.createInstance(this.plugin.groupId, this.context);
      this.checkAlive();
      const info = await this.gate.audioNode.getParameterInfo();
      if (!info[gateId] || !info[deadZoneId]) throw Error('Unexpected DeathGate parameters');
      const ctx = this.context;
      this.splitter = ctx.createChannelSplitter(2);
      this.merger = ctx.createChannelMerger(2);
      this.routes = [ctx.createGain(),ctx.createGain()];
      this.inputGain = ctx.createGain();
      this._output = ctx.createGain();
      this.nodes.push(this.splitter,this.merger,...this.routes,this.inputGain,this._output);
      AudioNode.prototype.connect.call(this,this.splitter);
      this.routes.forEach((gain,i) => { this.splitter.connect(gain,i); gain.connect(this.merger,0,i); });
      this.merger.connect(this.inputGain); this.inputGain.connect(this.gate.audioNode);
      this.gate.audioNode.connect(this._output);
      const internalParamsConfig = Object.fromEntries(Object.entries(config).map(([id,p]) => [id,{...p,onChange:value => {
        // ParamMgr buffers carry modulation relative to a positive intrinsic minimum.
        value += Math.max(0,p.minValue);
        if (p.type==='boolean') value = Math.round(value);
        if (this.destroyed || this.loading || !this._wamNode) return;
        if (Math.abs(value-this._wamNode.getParamValue(id)) > 1e-5) return;
        const current = this._wamNode.getParamValue(id);
        if (Math.abs(current-this.values[id])>1e-7) this.applyValue(id,current);
      }}]));
      this._wamNode = await ParamMgrFactory.create(this.plugin,{paramsConfig:config,internalParamsConfig});
      this.checkAlive();
      for (const [id,value] of Object.entries(this.values)) this.applyValue(id,value);
      if (state) await this.setState(state);
      return this;
    } catch (error) { await this.cleanup(); throw error; }
  }
  checkAlive() { if (this.destroyed) throw Error('Utility destroyed'); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  applyValue(id,value) {
    this.checkAlive();
    this.values[id] = value;
    if (id === 'inputGain') this.inputGain.gain.value = value;
    else if (id === 'noiseGate') this.gate.audioNode.setParamValue(gateId,value);
    else this.routes[id === 'leftInput' ? 0 : 1].gain.value = value;
    for (const fn of this.listeners) fn();
  }
  validate(values) {
    for (const [id,value] of Object.entries(values)) {
      const p = config[id];
      if (!p || !Number.isFinite(value) || value<p.minValue || value>p.maxValue || (p.type==='boolean' && !Number.isInteger(value)))
        throw Error(`Invalid Utility parameter: ${id}`);
    }
  }
  async setParameterValues(updates) {
    await this._queue; this.checkAlive();
    const values = {};
    for (const [id,data] of Object.entries(updates)) {
      const p = this._wamNode.getParam(id);
      if (!p || !Number.isFinite(data.value)) throw Error(`Invalid Utility parameter: ${id}`);
      values[id] = data.normalized ? p.info.denormalize(data.value) : data.value;
      if (config[id].type==='boolean') values[id] = Math.round(values[id]);
    }
    this.validate(values);
    await this._wamNode.setParameterValues(Object.fromEntries(Object.entries(values).map(([id,value]) => [id,{id,value,normalized:false}])));
    for (const [id,value] of Object.entries(values)) this.applyValue(id,value);
  }
  getParamValue(id) { return this._wamNode.getParamValue(id); }
  setParamValue(id,value) { return this.setParameterValues({[id]:{id,value,normalized:false}}); }
  async getState() {
    await this._queue; this.checkAlive();
    return {version:1,plugin:'utility',parameterValues:{...this.values},gateState:await this.gate.audioNode.getState()};
  }
  setState(state) {
    state = structuredClone(state);
    // Old WAP saves contain plain params, without an embedded gate state.
    if (state && !('version' in state)) {
      state = {version:1,plugin:'utility',parameterValues:{...this.values,...state}};
      for (const [alias,id] of [['inputLeft','leftInput'],['inputRight','rightInput']]) {
        if (alias in state.parameterValues) {
          state.parameterValues[id] = Number(state.parameterValues[alias]); delete state.parameterValues[alias];
        }
      }
      for (const id of ['leftInput','rightInput']) state.parameterValues[id] = Number(state.parameterValues[id]);
    }
    try {
      if (state?.version!==1 || state.plugin!=='utility' || !state.parameterValues || Object.keys(state.parameterValues).length!==4)
        throw Error('Invalid Utility state');
      this.validate(state.parameterValues);
      if (state.gateState) {
        if (Object.keys(state.gateState).length!==2) throw Error('Invalid DeathGate state');
        const values = state.gateState;
        for (const id of [gateId,deadZoneId]) {
          const data = values?.[id];
          if (!Number.isFinite(data) || data < -120 || data > 0) throw Error('Invalid DeathGate state');
        }
      }
    } catch(error) { return Promise.reject(error); }
    const task = this._queue.then(async () => {
      this.checkAlive(); this.loading = true;
      try {
        this._wamNode.clearEvents(); this.gate.audioNode.clearEvents();
        for (const id of Object.keys(config)) this._wamNode.getParam(id).cancelScheduledValues(this.context.currentTime);
        for (const id of [gateId,deadZoneId]) this.gate.audioNode._wamNode.getParam(id).cancelScheduledValues(this.context.currentTime);
        if (state.gateState) await this.gate.audioNode.setState(state.gateState);
        for (const [id,value] of Object.entries(state.parameterValues)) {
          this._wamNode.getParam(id).value = value; this.applyValue(id,value);
        }
      } finally { this.loading = false; }
    });
    this._queue = task.catch(() => {}); return task;
  }
  async cleanup() {
    this.destroyed = true;
    this.plugin.destroyGui(this.plugin._gui);
    AudioNode.prototype.disconnect.call(this);
    for (const node of this.nodes) node.disconnect();
    this.listeners.clear();
    const managers = [this._wamNode,this.gate?.audioNode].filter(node=>node&&!this.cleaned.has(node));
    for (const node of managers) this.cleaned.add(node);
    await Promise.all(managers.map(node=>node.destroy()));
  }
  destroy() {
    if (!this._destroyPromise) { this.destroyed = true; this._destroyPromise = this.cleanup(); }
    return this._destroyPromise;
  }
}
