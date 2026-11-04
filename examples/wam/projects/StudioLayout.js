// Studio track density (compact / comfortable). UI-only preference: never
// modifies projects, audio routing or transport. The left column's collapse
// moved to HostNav.js.
const DENSITY_KEY = 'nam-a2.studio-density';
export class StudioLayout {
  constructor({densityControl, root = document.body, storage = globalThis.localStorage}) {
    Object.assign(this, {densityControl, root, storage});
    this.density = 'compact';
    try { if (storage?.getItem(DENSITY_KEY) === 'comfortable') this.density = 'comfortable'; } catch { /* Session-only preference. */ }
    this.changeDensity = () => this.setDensity(densityControl.value);
    densityControl?.addEventListener('change', this.changeDensity);
    this.render();
  }
  setDensity(value) {
    this.density = value === 'comfortable' ? 'comfortable' : 'compact';
    try { this.storage?.setItem(DENSITY_KEY, this.density); } catch { /* Keep usable without storage. */ }
    this.render();
  }
  render() {
    this.root.dataset.studioDensity = this.density;
    if (this.densityControl) this.densityControl.value = this.density;
  }
  destroy() {
    delete this.root.dataset.studioDensity;
    this.densityControl?.removeEventListener('change', this.changeDensity);
  }
}
