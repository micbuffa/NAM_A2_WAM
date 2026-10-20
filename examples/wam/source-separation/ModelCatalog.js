export const DEMO_MODEL_CATALOG = Object.freeze([
  {id: 'demo-4-stems', label: 'Demo · 4 stems', description: 'Batterie, basse, voix et guitare', roles: ['drums', 'bass', 'vocals', 'guitar'], backends: ['wasm'], size: 0, installed: true, recommendation: 'Prototype de lecture multipiste'},
  {id: 'demo-5-stems', label: 'Demo · 5 stems', description: 'Batterie, basse, voix, guitare et autre', roles: ['drums', 'bass', 'vocals', 'guitar', 'other'], backends: ['wasm'], size: 0, installed: true, recommendation: 'Comparer cinq pistes'},
]);

export class ModelCatalog {
  constructor(models = DEMO_MODEL_CATALOG) { this.models = [...models]; }
  list({backend, query = ''} = {}) {
    const needle = query.trim().toLocaleLowerCase();
    return this.models.filter(model => (!backend || model.backends.includes(backend)) &&
      (!needle || `${model.label} ${model.description}`.toLocaleLowerCase().includes(needle)));
  }
  get(id) { return this.models.find(model => model.id === id) || null; }
  recommend({useCase = 'guitar', backend = 'wasm'} = {}) {
    const candidates = this.list({backend});
    return candidates.find(model => model.roles.includes(useCase)) || (useCase ? null : candidates[0] || null);
  }
}
