import {confirmDialog, promptDialog} from './dialogs.js';

// Sidebar preset list (#presetsPanel): save the whole rack, load, rename,
// delete. Uses the account store when signed in, IndexedDB otherwise.
// The preset last loaded or saved is marked active (aria-current); changes
// made after loading it are kept only by "Update" or "Save as new".
export default class PresetsPanel {
  constructor({account, localStore, remoteStore, captureState, applyState, suggestName = () => '', report = () => {},
    root = document}) {
    Object.assign(this, {account, localStore, remoteStore, captureState, applyState, suggestName, report});
    this.$ = (id) => root.getElementById(id);
    this.presets = [];
    this.activeId = null;
    this.loadingId = null;
  }

  get store() { return this.account?.signedIn ? this.remoteStore : this.localStore; }

  attach() {
    this.$('presetsPanel').hidden = false;
    this.$('presetSave').onclick = () => this.save();
    this.$('presetUpdate').onclick = () => this.update();
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
      if (!this.presets.some((preset) => preset.id === this.activeId)) this.activeId = null;
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
      const active = preset.id === this.activeId;
      const loading = preset.id === this.loadingId;
      item.className = `preset-item${active ? ' active' : ''}${loading ? ' loading' : ''}`;
      if (active) item.setAttribute('aria-current', 'true');
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'preset-load';
      load.textContent = preset.name;
      load.title = active ? `${preset.name} (active) — click to reload` : `Load ${preset.name}`;
      load.disabled = this.loadingId !== null;
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
    list.setAttribute('aria-busy', String(this.loadingId !== null));
    const active = this.presets.find((preset) => preset.id === this.activeId);
    const update = this.$('presetUpdate');
    update.hidden = !active;
    update.disabled = this.loadingId !== null;
    if (active) {
      update.textContent = `Update “${active.name}”`;
      update.title = `Replace “${active.name}” with the current rack`;
    }
    if (empty) this.status('No preset saved yet.');
    else this.status(`${this.presets.length} preset${this.presets.length === 1 ? '' : 's'}.`);
  }

  // Default names must not collide: two presets of the same amp would
  // otherwise look like one preset listed twice.
  uniqueName(base) {
    const names = new Set(this.presets.map((preset) => preset.name));
    if (!names.has(base)) return base;
    let index = 2;
    while (names.has(`${base} ${index}`)) index++;
    return `${base} ${index}`;
  }

  async save() {
    const suggestion = (await Promise.resolve(this.suggestName()).catch(() => '')) || 'Preset';
    const name = await promptDialog({title: 'Save as new preset', label: 'Preset name', value: this.uniqueName(suggestion.slice(0, 90)),
      confirmLabel: 'Save preset'});
    if (!name) return;
    this.$('presetSave').disabled = true;
    try {
      const state = await this.captureState();
      const created = await this.store.create(name, state);
      this.activeId = created.id;
      await this.refresh();
      this.status(`Saved “${name}”.`);
    } catch (error) { this.status(`Could not save the preset: ${error.message}`, true); }
    finally { this.$('presetSave').disabled = false; }
  }

  // Overwrites the active preset with the current rack (pedals, gains, both lanes).
  async update() {
    const active = this.presets.find((preset) => preset.id === this.activeId);
    if (!active) return;
    this.$('presetUpdate').disabled = true;
    try {
      await this.store.update(active.id, {state: await this.captureState()});
      await this.refresh();
      this.status(`Updated “${active.name}”.`);
      this.report(`Preset “${active.name}” updated.`);
    } catch (error) { this.status(`Could not update “${active.name}”: ${error.message}`, true); }
    finally { this.$('presetUpdate').disabled = false; }
  }

  async load(preset) {
    if (this.loadingId !== null) return;
    this.loadingId = preset.id;
    this.render();
    this.status(`Loading “${preset.name}”…`);
    this.report(`Loading preset “${preset.name}”…`);
    try {
      const {state} = await this.store.get(preset.id);
      await this.applyState(state);
      this.activeId = preset.id;
      this.loadingId = null;
      this.render();
      this.status(`Loaded “${preset.name}”.`);
      this.report(`Preset “${preset.name}” active.`);
    } catch (error) {
      this.loadingId = null;
      this.render();
      this.status(`Could not load “${preset.name}”: ${error.message}`, true);
      this.report(`Could not load preset “${preset.name}”: ${error.message}`, true);
    }
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
