import {WebAudioModule} from './sdk.js';
import {CompositeAudioNode, ParamMgrFactory} from './parammgr.js';

const knobs = ['volume','master','drive','bass','middle','treble','presence','reverb'];
const frequencies = [60,170,350,1000,3500,10000];
export const defaults = {blues:8, cleanfull:11, modernmetal:8};
const limits = {
  LS1Freq:[1,24000], LS2Freq:[1,24000], LS3Freq:[1,24000], HP1Freq:[1,24000],
  LS1Gain:[-40,40], LS2Gain:[-40,40], LS3Gain:[-40,40], gain1:[0,20], gain2:[0,20], HP1Q:[0,100],
  LCF:[1,24000], HCF:[1,24000], F1:[1,24000], F2:[1,24000], F3:[1,24000], F4:[1,24000],
  Q1:[0,100], Q2:[0,100], Q3:[0,100], Q4:[0,100], CG:[0,10],
};
function valuesOf(engine) {
  const values = {};
  for (const id of [...knobs, ...Object.keys(limits)]) if (engine.params[id] !== undefined) values[id] = Number(engine.params[id]);
  frequencies.forEach((f,i) => values[`eq${f}`] = Number(engine.params.EQ[i]));
  values.bypass = engine.params.status === 'disable' ? 1 : 0;
  if ('preampPos' in engine.params) {
    values.preampPos = engine.params.preampPos === 'after' ? 1 : 0;
    values.filterstate = engine.params.filterstate ? 1 : 0;
  }
  return values;
}
function bounds(id) {
  if (id.startsWith('eq')) return [-40,40];
  if (['bypass','preampPos','filterstate'].includes(id)) return [0,1];
  return limits[id] || [0,10];
}

export class AmpNode extends CompositeAudioNode {
  constructor(module, Engine, baseURL) {
    super(module.audioContext);
    this.plugin = module; this.slug = module.slug; this.baseURL = baseURL;
    this.engine = new Engine(module.audioContext, baseURL.href);
    AudioNode.prototype.connect.call(this, this.engine._input);
    this._output = this.engine._output;
    this.listeners = new Set(); this._queue = Promise.resolve(); this.destroyed = false;
  }
  async initialize(initialState) {
    try {
      await this.engine.ready();
      this.factoryPresets = this.engine.presets().map((data,index) => ({id:`factory-${index}`,name:data.name,data:structuredClone(data)}));
      this.selectedPreset = `factory-${defaults[this.slug]}`;
      this.presetData = structuredClone(this.factoryPresets[defaults[this.slug]].data);
      await this.engine.applyPreset(this.presetData);
      this.engine.status = 'enable';
      this.values = valuesOf(this.engine);
      const paramsConfig = {}, internalParamsConfig = {};
      for (const [id, value] of Object.entries(this.values)) {
        const [minValue,maxValue] = bounds(id);
        paramsConfig[id] = {label:id,defaultValue:value,minValue,maxValue,
          ...(['bypass','preampPos','filterstate'].includes(id) ? {type:'boolean',discreteStep:1} : {})};
        internalParamsConfig[id] = {...paramsConfig[id], onChange: value => {
          if (this.destroyed || this.loading || !this._wamNode) return;
          // Ignore a stale worklet buffer immediately after a preset/state transaction.
          if (Math.abs(value - this._wamNode.getParamValue(id)) > 0.0001) return;
          this.applyValue(id, value);
        }};
      }
      this.config = paramsConfig;
      this._wamNode = await ParamMgrFactory.create(this.plugin, {paramsConfig,internalParamsConfig});
      if (initialState) await this.setState(initialState);
      return this;
    } catch (error) { await this.destroy(); throw error; }
  }
  checkAlive() { if (this.destroyed) throw Error('Amplifier has been destroyed'); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { for (const fn of this.listeners) fn(); }
  applyValue(id,value) {
    this.checkAlive();
    const info = this.config[id];
    if (!info || !Number.isFinite(value) || value < info.minValue || value > info.maxValue) throw Error(`Invalid parameter ${id}: ${value}`);
    if (Math.abs(this.values[id] - value) < 0.00001) return;
    if (['bypass','preampPos','filterstate'].includes(id)) value = Math.round(value);
    if (id === 'bypass') this.engine.status = value ? 'disable' : 'enable';
    else if (id.startsWith('eq')) {
      const eq = [...this.engine.params.EQ]; eq[frequencies.indexOf(Number(id.slice(2)))] = value; this.engine.EQ = eq;
    } else this.engine[id] = value;
    this.values[id] = value; this.notify();
  }
  async setParameterValues(updates) {
    await this._queue;
    this.checkAlive();
    const converted = {};
    for (const [id, data] of Object.entries(updates)) {
      const p = this._wamNode.getParam(id);
      if (!p || !Number.isFinite(data.value)) throw Error(`Invalid parameter ${id}`);
      let value = data.normalized ? p.info.denormalize(data.value) : data.value;
      if (this.config[id].type === 'boolean') value = Math.round(value);
      const c = this.config[id];
      if (value < c.minValue || value > c.maxValue) throw Error(`Parameter out of range: ${id}`);
      converted[id] = {id,value,normalized:false};
    }
    await this._wamNode.setParameterValues(converted);
    for (const [id,{value}] of Object.entries(converted)) this.applyValue(id,value);
  }
  getParamValue(id) { return this._wamNode.getParamValue(id); }
  setParamValue(id,value) { return this.setParameterValues({[id]:{id,value,normalized:false}}); }
  getFactoryPresets() { return this.plugin.presetMenu.map(preset => ({...preset})); }
  transaction(fn) {
    const task = this._queue.then(async () => { this.checkAlive(); this.loading = true; this.notify();
      try { return await fn(); } finally { this.loading = false; if (!this.destroyed) this.notify(); }
    });
    this._queue = task.catch(() => {}); return task;
  }
  async syncManager() {
    // Cancel any previous automation when a whole sound is loaded.
    this._wamNode.clearEvents();
    for (const [id,value] of Object.entries(this.values)) {
      const param = this._wamNode.getParam(id);
      param.cancelScheduledValues(this.context.currentTime);
      param.value = value;
    }
  }
  loadFactoryPreset(id) {
    const preset = this.factoryPresets.find(p => p.id === id);
    if (!preset) return Promise.reject(Error(`Unknown preset: ${id}`));
    return this.transaction(async () => {
      const bypass = this.values.bypass;
      await this.engine.applyPreset(preset.data);
      this.checkAlive();
      this.engine.status = bypass ? 'disable' : 'enable';
      this.presetData = structuredClone(preset.data); this.selectedPreset = id;
      this.values = valuesOf(this.engine); await this.syncManager();
    });
  }
  async getState() {
    await this._queue; this.checkAlive();
    return structuredClone({version:1,plugin:this.slug,presetId:this.selectedPreset,preset:this.presetData,
      parameterValues:this.values});
  }
  setState(state) {
    state = structuredClone(state);
    if (state?.version !== 1 || state.plugin !== this.slug || !this.factoryPresets.some(p=>p.id===state.presetId) || !state.preset || !state.parameterValues)
      return Promise.reject(Error('Invalid amplifier state'));
    const factory = this.factoryPresets.find(p=>p.id===state.presetId);
    if (JSON.stringify(state.preset)!==JSON.stringify(factory.data)) return Promise.reject(Error('Invalid preset blueprint'));
    for (const [id,info] of Object.entries(this.config)) {
      const value = state.parameterValues[id];
      if (!Number.isFinite(value) || value<info.minValue || value>info.maxValue || (info.type==='boolean' && !Number.isInteger(value))) return Promise.reject(Error(`Invalid saved parameter: ${id}`));
    }
    return this.transaction(async () => {
      await this.engine.applyPreset(state.preset);
      this.checkAlive();
      this.presetData = state.preset; this.selectedPreset = state.presetId;
      this.values = valuesOf(this.engine);
      // Macro drive first, then advanced controls. Hidden topology is reconstructed by the preset blueprint.
      for (const id of Object.keys(this.config)) this.applyValue(id,state.parameterValues[id]);
      await this.syncManager();
    });
  }
  destroy() {
    if (this._destroyPromise) return this._destroyPromise;
    this.destroyed = true;
    this.plugin.destroyGui(this.plugin._gui);
    AudioNode.prototype.disconnect.call(this);
    this.engine.destroy(); this.listeners.clear();
    this._destroyPromise = this._wamNode ? Promise.resolve(this._wamNode.destroy()) : Promise.resolve();
    return this._destroyPromise;
  }
}

export function createAmpModule(slug, Engine, baseURL, presetMenu) {
  return class AmpModule extends WebAudioModule {
    slug = slug;
    presetMenu = presetMenu;
    _descriptorUrl = new URL('descriptor.json',baseURL).href;
    async initialize(state) {
      await this._loadDescriptor();
      this.audioNode = await this.createAudioNode(state);
      this.initialized = true; return this;
    }
    async createAudioNode(state) { return new AmpNode(this,Engine,baseURL).initialize(state); }
    async createGui() {
      this.audioNode.checkAlive();
      if (!this._guiPromise) this._guiPromise = import('./gui.js').then(async ({createGui}) => {
        this.audioNode.checkAlive(); const gui=await createGui(this,baseURL);
        if(this.audioNode.destroyed){gui.destroy();throw Error('Amplifier has been destroyed');}
        return this._gui=gui;
      }).catch(error => {this._guiPromise=null; throw error;});
      return this._guiPromise;
    }
    destroyGui(gui) {
      gui?.destroy(); gui?.remove();
      if (!gui || gui===this._gui) {this._gui=null;this._guiPromise=null;}
    }
  };
}
