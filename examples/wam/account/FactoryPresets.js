// Read-only presets shipped with the rack. A Factory preset is a recipe, not a
// saved state: a Factory NAM model plus a few parameters, applied on top of
// the default (guest) rack when loaded, so no model data is duplicated here.
// The four captures are full rigs or amp+cab captures: the cabinet stage
// stays on AUTO, which bypasses it for them.
const factoryAssetUrl = (manifestUrl, relativePath) =>
  new URL(`models/${relativePath.split('/').map(encodeURIComponent).join('/')}`, manifestUrl);

export const FACTORY_PRESETS = [
  {id: 'factory:twin-clean', name: 'Twin Clean', category: 'Clean',
    model: 'factory:OLD/Fender Twin Reverb Amp and Cab Captures/Fender Twin Reverb.nam',
    parameters: {bass: 5, middle: 5, treble: 6}},
  {id: 'factory:british-edge', name: 'British Edge', category: 'Crunch',
    model: 'factory:tone3000/2dor/Marshall JCM800 2203 Modified (EL34) community pack--t44209/captures/[AMP] JCM800-2203-MODIFIED-LO Edge of Breakup - SM57--m567092.nam',
    parameters: {bass: 5, middle: 6, treble: 5}},
  {id: 'factory:modern-metal', name: 'Modern Metal', category: 'High gain',
    model: 'factory:tone3000/jpisoutoftune/Full Rig Peavey 5150 + Mesa 4x12--t32868/captures/Full Rig Peavey 5150 Maxon Mesa OS SM57 - jp_is_out_of_tune--m418388.nam',
    parameters: {noiseEnabled: 1, noise: -58, bass: 6, middle: 4, treble: 6}},
  {id: 'factory:svt-bass', name: 'SVT Bass', category: 'Bass',
    model: 'factory:OLD/Bass/Ampeg SVT Classic with 6x10/Ampeg SVT - MD 421.nam',
    parameters: {bass: 6, middle: 5, treble: 4}},
];

export const isFactoryPreset = (id) => String(id).startsWith('factory:');

export class FactoryPresetStore {
  // baseState(): the default rack state the recipes start from.
  constructor({manifestUrl, baseState, presets = FACTORY_PRESETS, fetchImpl = globalThis.fetch?.bind(globalThis)}) {
    Object.assign(this, {manifestUrl, baseState, presets, fetch: fetchImpl});
  }

  get scope() { return 'factory'; }

  async list() { return this.presets.map(({id, name, category}) => ({id, name, category, factory: true})); }

  async manifest() {
    this._manifest ||= this.fetch(this.manifestUrl).then((response) => {
      if (!response.ok) throw new Error(`Factory manifest: HTTP ${response.status}`);
      return response.json();
    }).catch((error) => { this._manifest = null; throw error; });
    return this._manifest;
  }

  async get(id) {
    const preset = this.presets.find((candidate) => candidate.id === id);
    if (!preset) throw new Error('Unknown Factory preset');
    const asset = (await this.manifest()).assets?.find((candidate) => candidate.id === preset.model);
    if (!asset) throw new Error(`Factory model missing: ${preset.name}`);
    const response = await this.fetch(factoryAssetUrl(this.manifestUrl, asset.relativePath));
    if (!response.ok) throw new Error(`Factory model: HTTP ${response.status}`);
    const data = await response.text();

    const state = structuredClone(await this.baseState());
    const nam = state.a.entries.find((entry) => entry.kind === 'nam');
    if (!nam) throw new Error('The default rack has no NAM stage');
    const provenance = {...asset.provenance, identity: asset.id, source: 'Factory', title: asset.provenance?.title || asset.displayName,
      gear: asset.provenance?.gear || asset.metadata?.gear_type,
      imageUrl: asset.imagePath ? factoryAssetUrl(this.manifestUrl, asset.imagePath).href : ''};
    const parameterValues = {...nam.state.parameterValues};
    for (const [key, value] of Object.entries(preset.parameters || {})) parameterValues[key] = {id: key, value, normalized: false};
    // The base model's level calibration does not apply to another model.
    nam.state = {...nam.state, model: {data, name: asset.filename, provenance}, measuredCalibration: null, metadata: null, parameterValues};
    nam.bypass = false;
    return {id: preset.id, name: preset.name, category: preset.category, factory: true, state};
  }
}
