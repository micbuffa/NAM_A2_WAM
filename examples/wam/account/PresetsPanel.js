import {confirmDialog, promptDialog} from './dialogs.js';

// Sidebar preset list (#presetsPanel): save the whole WAM chain, load,
// rename, delete. Uses the account store when signed in, IndexedDB otherwise.
export default class PresetsPanel {
  constructor({account, localStore, remoteStore, captureState, applyState, suggestName = () => '', root = document}) {
    Object.assign(this, {account, localStore, remoteStore, captureState, applyState, suggestName});
    this.$ = (id) => root.getElementById(id);
    this.presets = [];
  }

  get store() { return this.account?.signedIn ? this.remoteStore : this.localStore; }

  attach() {
    this.$('presetsPanel').hidden = false;
    this.$('presetSave').onclick = () => this.save();
    this.account?.addEventListener('change', () => this.refresh());
    return this.refresh();
  }

  status(text, error = false) {
    const element = this.$('presetStatus');
    element.textContent = text;
    element.classList.toggle('error', error);
  }

  async refresh() {
    this.$('presetScope').textContent = this.account?.signedIn
      ? `Saved to ${this.account.user.email}.` : 'Stored in this browser. Sign in to keep them on every device.';
    try {
      this.presets = await this.store.list();
      this.render();
    } catch (error) {
      this.presets = [];
      this.render();
      this.status(`Presets unavailable: ${error.message}`, true);
    }
  }

  render() {
    const list = this.$('presetList');
    list.replaceChildren(...this.presets.map((preset) => {
      const item = document.createElement('li');
      item.className = 'preset-item';
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'preset-load';
      load.textContent = preset.name;
      load.title = `Load ${preset.name}`;
      load.onclick = () => this.load(preset);
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'preset-icon';
      rename.textContent = '✎';
      rename.setAttribute('aria-label', `Rename ${preset.name}`);
      rename.onclick = () => this.rename(preset);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'preset-icon';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `Delete ${preset.name}`);
      remove.onclick = () => this.remove(preset);
      item.append(load, rename, remove);
      return item;
    }));
    const empty = !this.presets.length;
    list.hidden = empty;
    if (empty) this.status('No preset saved yet.');
    else this.status(`${this.presets.length} preset${this.presets.length === 1 ? '' : 's'}.`);
  }

  async save() {
    const suggestion = (await Promise.resolve(this.suggestName()).catch(() => '')) || `Preset ${this.presets.length + 1}`;
    const name = await promptDialog({title: 'Save preset', label: 'Preset name', value: suggestion.slice(0, 100), confirmLabel: 'Save preset'});
    if (!name) return;
    this.$('presetSave').disabled = true;
    try {
      const state = await this.captureState();
      await this.store.create(name, state);
      await this.refresh();
      this.status(`Saved “${name}”.`);
    } catch (error) { this.status(`Could not save the preset: ${error.message}`, true); }
    finally { this.$('presetSave').disabled = false; }
  }

  async load(preset) {
    this.status(`Loading “${preset.name}”…`);
    try {
      const {state} = await this.store.get(preset.id);
      await this.applyState(state);
      this.status(`Loaded “${preset.name}”.`);
    } catch (error) { this.status(`Could not load “${preset.name}”: ${error.message}`, true); }
  }

  async rename(preset) {
    const name = await promptDialog({title: 'Rename preset', label: 'Preset name', value: preset.name, confirmLabel: 'Rename'});
    if (!name || name === preset.name) return;
    try {
      await this.store.update(preset.id, {name});
      await this.refresh();
      this.status(`Renamed to “${name}”.`);
    } catch (error) { this.status(`Could not rename: ${error.message}`, true); }
  }

  async remove(preset) {
    if (!await confirmDialog({title: 'Delete preset', message: `Delete “${preset.name}”? This cannot be undone.`, confirmLabel: 'Delete'})) return;
    try {
      await this.store.delete(preset.id);
      await this.refresh();
      this.status(`Deleted “${preset.name}”.`);
    } catch (error) { this.status(`Could not delete: ${error.message}`, true); }
  }
}
