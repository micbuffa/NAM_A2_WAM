import { FACTORY_PRESETS } from './factory-presets.js';

// Keep the historical flat parameter state readable by existing WAM hosts.
// Metadata is removed before passing the state to ParamMgr.
const STATE_KEY = '__wamFactoryPreset';
export const withFactoryPresets = Base => class extends Base {
    _factoryPresetId = 'default';

    getFactoryPresets() {
        return FACTORY_PRESETS.map(({id, name}) => ({id, name}));
    }

    async loadFactoryPreset(id) {
        const preset = FACTORY_PRESETS.find(item => item.id === id);
        if (!preset) throw new RangeError(`Unknown factory preset: ${id}`);
        await this.setState({...preset.parameters, [STATE_KEY]: {version: 1, id}});
    }

    getFactoryPresetStatus(values = this._wamNode.getParamsValues()) {
        const preset = FACTORY_PRESETS.find(item => item.id === this._factoryPresetId);
        if (!preset) return {id: null, name: 'Current settings', modified: false};
        const modified = Object.entries(preset.parameters).some(([key, expected]) => {
            const actual = typeof values[key] === 'object' ? values[key]?.value : values[key];
            return !Number.isFinite(actual) || Math.abs(actual - expected) > 1e-5 * Math.max(1, Math.abs(expected));
        });
        return {id: preset.id, name: preset.name, modified};
    }

    async getState() {
        return {...await super.getState(), [STATE_KEY]: {version: 1, id: this._factoryPresetId}};
    }

    async setState(state) {
        if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('Invalid amplifier state');
        const {[STATE_KEY]: metadata, ...parameters} = state;
        // Restore actual saved controls, never reload the named factory sound:
        // a saved preset may have been edited, or the catalogue may have evolved.
        await super.setState(parameters);
        this._factoryPresetId = metadata?.version === 1 && FACTORY_PRESETS.some(item => item.id === metadata.id)
            ? metadata.id : null;
    }
};
