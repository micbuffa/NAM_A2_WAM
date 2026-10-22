import {actionsRow, button, confirmDialog, createDialog, promptDialog} from './dialogs.js';
import {isFactoryPreset} from './FactoryPresets.js';

const LAST_PRESET_KEY = 'nam-a2-wam.last-preset';

// Presets, as in the TONELAB mockup: the sidebar picker (#presetsPanel, "My
// presets" then "Factory") and "New preset", plus the preset header above
// the rack (name, rename, Delete, Save). A preset is the whole rack. My
// presets use the account store when signed in; without accounts (static
// distribution), IndexedDB. Factory
// presets are read-only recipes (FactoryPresets.js). The preset last loaded
// or saved is the active one: Save overwrites it, or creates a new preset
// when it is a Factory one or there is none. 'change' (detail {name, meta})
// fires on every render: the Tracks workspace shows the active tone. The
// preset last loaded, created or deleted is remembered (account preference
// when signed in, this browser otherwise) and reopened when the page loads,
// and when signing in unless the rack has unsaved changes: those stay on
// screen until the user saves them. With requestSignIn (the online rack),
// saving needs an account: Save and New preset ask a guest to sign in, then
// carry on with the rack as it is. With draftStore (RackDraft.js), unsaved
// changes are kept as a draft a moment after the rack changes, and brought
// back when the page loads; saving, loading or reverting drops the draft.
// While the rack differs from that preset, the header shows "Unsaved
// changes" and Save gets a dot (checked checkDelay after each change);
// otherwise Save is disabled.
export default class PresetsPanel extends EventTarget {
  // requestSignIn(reason): resolves with true once signed in, false if cancelled.
  // watchRack(listener): calls listener whenever the rack changes.
  constructor({account, localStore, remoteStore, factoryStore, captureState, applyState, defaultState, suggestName = () => '',
    requestSignIn = null, draftStore = null, watchRack = null, draftDelay = 1000, checkDelay = 250, report = () => {}, root = document,
    storage = globalThis.localStorage}) {
    super();
    Object.assign(this, {account, localStore, remoteStore, factoryStore, captureState, applyState, defaultState, suggestName, requestSignIn,
      draftStore, watchRack, draftDelay, checkDelay, report, storage});
    this.$ = (id) => root.getElementById(id);
    this.presets = [];
    this.factory = [];
    this.activeId = null;
    this.loadingId = null;
    this.baseline = null; // the rack as last loaded or saved (JSON), to spot unsaved changes
    this.syncing = Promise.resolve(); // the reaction to the last sign-in or sign-out
    this.signingInToSave = false;
    this.draftTimer = null;
    this.modified = false; // shown in the header; follows isModified()
    this.checkTimer = null;
  }

  // Drafts never cross accounts.
  get draftScope() { return this.account?.signedIn ? `user:${this.account.user.id}` : 'guest'; }

  get needsSignIn() { return Boolean(this.requestSignIn && this.account && !this.account.signedIn); }

  get store() { return this.account?.signedIn ? this.remoteStore : this.localStore; }
  // Option values are strings; account preset ids are numbers.
  find(id) { return [...this.presets, ...this.factory].find((preset) => String(preset.id) === String(id)) || null; }
  get active() { return this.activeId === null ? null : this.find(this.activeId); }
  get busy() { return this.loadingId !== null; }

  // The id of the preset to reopen, or null.
  get lastPresetId() {
    if (this.account?.signedIn) return this.account.user.preferences?.lastPresetId ?? null;
    try { return this.storage?.getItem(LAST_PRESET_KEY) ?? null; } catch { return null; }
  }

  // Makes a preset active (null: none) and remembers it in the current scope.
  setActive(id) {
    this.activeId = id;
    if (this.account?.signedIn) {
      this.account.updatePreference('lastPresetId', id).catch((error) => console.warn('Last preset not saved', error));
      return;
    }
    try {
      if (id === null) this.storage?.removeItem(LAST_PRESET_KEY);
      else this.storage?.setItem(LAST_PRESET_KEY, String(id));
    } catch { /* Storage can be unavailable in privacy modes. */ }
  }

  async attach() {
    this.$('presetsPanel').hidden = false;
    this.$('presetHeaderActions').hidden = false;
    this.$('presetSelect').onchange = (event) => { const id = event.target.value; if (id) this.load(id); };
    this.$('presetNew').onclick = () => this.create();
    this.$('presetSaveButton').onclick = () => this.save();
    this.$('presetDelete').onclick = () => this.active && this.remove(this.active);
    this.$('presetRename').onclick = () => this.active && this.rename(this.active);
    this.$('presetRevert').onclick = () => this.active && this.load(this.active.id);
    this.account?.addEventListener('change', ({detail: {previous, user}}) => {
      this.syncing = this.accountChanged({signedOut: Boolean(previous && !user)})
        .catch((error) => this.report(`Presets not updated: ${error.message}`, true));
    });
    await this.refresh();
    await this.markClean();
    if (!await this.restoreDraft()) await this.reopenLast();
    this.watchRack?.(() => { this.scheduleDraft(); this.scheduleCheck(); });
    // A change made just before closing the page is not lost to the delay.
    globalThis.addEventListener?.('pagehide', () => { if (this.draftTimer !== null) this.writeDraft().catch(() => {}); });
    return this;
  }

  scheduleCheck() {
    clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => this.checkModified().catch((error) => console.warn('Unsaved state not checked', error)), this.checkDelay);
  }

  // A result computed against a baseline replaced meanwhile (load, save) is stale.
  async checkModified() {
    this.checkTimer = null;
    if (this.busy) return this.scheduleCheck();
    const baseline = this.baseline;
    const modified = await this.isModified();
    if (baseline === this.baseline && !this.busy) this.setModified(modified);
  }

  setModified(modified) {
    if (this.modified === modified) return;
    this.modified = modified;
    this.render();
  }

  scheduleDraft() {
    if (!this.draftStore) return;
    clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.writeDraft().catch((error) => console.warn('Draft not saved', error)), this.draftDelay);
  }

  // Keeps the rack as a draft while it differs from the preset (or default
  // rack) it started from; drops the draft once it no longer does.
  async writeDraft() {
    clearTimeout(this.draftTimer);
    this.draftTimer = null;
    if (this.busy) return this.scheduleDraft();
    const scope = this.draftScope;
    const state = await this.captureState();
    if (this.baseline !== null && JSON.stringify(state) === this.baseline) return this.draftStore.delete(scope);
    await this.draftStore.put(scope, {state, presetId: this.activeId, baseline: this.baseline});
  }

  async dropDraft() {
    clearTimeout(this.draftTimer);
    this.draftTimer = null;
    await this.draftStore?.delete(this.draftScope).catch((error) => console.warn('Draft not deleted', error));
  }

  // The rack now matches a saved or loaded preset.
  async settle() {
    await this.markClean();
    await this.dropDraft();
  }

  // Brings back the unsaved rack of this scope, still attached to the preset
  // it started from when that one exists. Resolves with true if it did; the
  // draft then replaces reopening the last preset.
  async restoreDraft() {
    if (!this.draftStore) return false;
    let draft = null;
    try { draft = await this.draftStore.get(this.draftScope); } catch { return false; }
    if (!draft?.state) return false;
    const from = draft.presetId === null ? null : this.find(draft.presetId);
    try {
      await this.applyState(structuredClone(draft.state));
    } catch (error) {
      this.report(`Could not restore your unsaved rack: ${error.message}`, true);
      await this.dropDraft();
      return false;
    }
    this.activeId = from ? from.id : null;
    this.baseline = from || draft.presetId === null ? draft.baseline ?? null : null;
    this.modified = true;
    this.render();
    this.status('Restored your unsaved changes.');
    this.report('Restored your unsaved rack.');
    return true;
  }

  async markClean() {
    try { this.baseline = JSON.stringify(await this.captureState()); } catch { this.baseline = null; }
    clearTimeout(this.checkTimer);
    this.checkTimer = null;
    this.setModified(this.baseline === null);
  }

  // Unreadable racks count as modified: nothing is overwritten on a doubt.
  async isModified() {
    if (this.baseline === null) return true;
    try { return JSON.stringify(await this.captureState()) !== this.baseline; } catch { return true; }
  }

  // Loads the remembered preset if it still exists and is not already active.
  async reopenLast() {
    const id = this.lastPresetId;
    if (id === null || this.busy || String(id) === String(this.activeId) || !this.find(id)) return;
    await this.load(id);
  }

  // Signing out puts the rack back to its default, so the account's sound
  // does not stay on screen. Signing in reopens the account's last preset,
  // unless the rack has unsaved changes or the guest signed in to save it.
  async accountChanged({signedOut}) {
    const modified = !signedOut && (this.signingInToSave || await this.isModified());
    if (signedOut) {
      this.activeId = null;
      await this.applyState(this.defaultState());
      this.report('Signed out: the rack is back to its default settings.');
    }
    await this.refresh();
    if (signedOut) await this.markClean();
    else {
      // The guest's draft is now this account's rack, or gone.
      await this.draftStore?.delete('guest').catch(() => {});
      if (modified) this.scheduleDraft();
      else if (!await this.restoreDraft()) await this.reopenLast();
    }
  }

  status(text, error = false) {
    const element = this.$('presetStatus');
    element.textContent = text;
    element.classList.toggle('error', error);
  }

  scopeText() {
    return this.account?.signedIn ? `Synced to ${this.account.user.email}` : 'Stored in this browser';
  }

  // A guest who must sign in to save has no presets of their own: only Factory.
  async refresh() {
    this.$('presetScope').textContent = this.account?.signedIn ? `My presets are synced to ${this.account.user.email}.`
      : this.needsSignIn ? 'Sign in to save your presets and find them on every device.'
        : 'My presets are stored in this browser. Sign in to keep them on every device.';
    this.factory = this.factoryStore ? await this.factoryStore.list() : [];
    try {
      this.presets = this.needsSignIn ? [] : await this.store.list();
      this.status('');
    } catch (error) {
      this.presets = [];
      this.status(`Presets unavailable: ${error.message}`, true);
    }
    if (!this.active) this.activeId = null;
    this.render();
  }

  render() {
    const option = (preset) => new Option(preset.factory ? `${preset.name} · ${preset.category}` : preset.name, preset.id);
    const group = (label, presets, empty) => {
      const element = document.createElement('optgroup');
      element.label = label;
      element.append(...(presets.length ? presets.map(option) : [Object.assign(new Option(empty, ''), {disabled: true})]));
      return element;
    };
    const select = this.$('presetSelect');
    const placeholder = Object.assign(new Option('Untitled rack', ''), {disabled: true, hidden: true});
    select.replaceChildren(placeholder, group('My presets', this.presets, this.needsSignIn ? 'Sign in to save presets' : 'No preset saved yet'), ...(this.factory.length ? [group('Factory', this.factory)] : []));
    select.value = this.activeId === null ? '' : String(this.activeId);
    select.disabled = this.busy;
    this.$('presetCount').textContent = String(this.presets.length + this.factory.length);
    this.$('presetNew').disabled = this.busy;

    const active = this.active;
    const mine = active && !active.factory;
    const name = active?.name || 'Untitled rack';
    const meta = !active ? 'Not saved as a preset' : active.factory ? `Factory · ${active.category}` : `My preset · ${this.scopeText()}`;
    this.$('presetTitle').textContent = name;
    this.$('presetMeta').textContent = meta;
    this.$('presetUnsaved').hidden = !this.modified;
    this.$('presetRename').hidden = !mine;
    const revert = this.$('presetRevert');
    revert.hidden = !active;
    revert.disabled = this.busy;
    const remove = this.$('presetDelete');
    remove.disabled = !mine || this.busy;
    remove.title = mine ? `Delete “${active.name}”` : active ? 'Factory presets cannot be deleted' : 'No preset selected';
    const save = this.$('presetSaveButton');
    this.renderSave();
    save.toggleAttribute('dot', this.modified);
    save.title = this.needsSignIn ? 'Sign in to save the current rack'
      : mine ? `Save the current rack to “${active.name}”` : 'Save the current rack as a new preset';
    this.$('presetNew').title = this.needsSignIn ? 'Sign in to create a preset' : '';
    this.dispatchEvent(new CustomEvent('change', {detail: {name, meta: this.modified ? `${meta} · Unsaved changes` : meta, modified: this.modified}}));
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

  async suggestedName() {
    const base = this.active?.factory ? this.active.name : (await Promise.resolve(this.suggestName()).catch(() => '')) || 'Preset';
    return this.uniqueName(base.slice(0, 90));
  }

  // New preset dialog: a name and, with chooseSource, what the preset starts
  // from (Save stores the rack as it is, so it only asks for the name).
  // Resolves with {name, source: 'current' | 'default'} or null.
  async askNewPreset({chooseSource = true} = {}) {
    const value = await this.suggestedName();
    const currentLabel = this.active ? `${this.active.name}, with your changes` : 'The rack as it is now';
    return new Promise((resolve) => {
      const {dialog, body, id} = createDialog({title: chooseSource ? 'New preset' : 'Save preset', eyebrow: 'Preset library', className: 'new-preset-dialog'});
      const form = document.createElement('form');
      form.method = 'dialog';
      const label = Object.assign(document.createElement('label'), {htmlFor: `${id}-name`, textContent: 'Preset name'});
      const name = Object.assign(document.createElement('input'), {id: `${id}-name`, required: true, maxLength: 100, value, autocomplete: 'off'});
      const legend = Object.assign(document.createElement('p'), {className: 'preset-source-title', textContent: 'Start from'});
      const choice = (source, title, detail, checked) => {
        const card = Object.assign(document.createElement('label'), {className: 'preset-source'});
        const radio = Object.assign(document.createElement('input'), {type: 'radio', name: `${id}-source`, value: source, checked});
        const text = document.createElement('span');
        text.append(Object.assign(document.createElement('strong'), {textContent: title}), Object.assign(document.createElement('small'), {textContent: detail}));
        card.append(radio, text);
        return card;
      };
      const sources = Object.assign(document.createElement('div'), {className: 'preset-sources', role: 'radiogroup'});
      sources.setAttribute('aria-label', 'Start from');
      sources.append(choice('current', 'Current rack', currentLabel, true),
        choice('default', 'Default rack', 'NAM amp and cabinet, default settings', false));
      const cancel = button('Cancel', {value: 'cancel'});
      cancel.onclick = () => dialog.close('cancel');
      const submit = button(chooseSource ? 'Create preset' : 'Save preset', {type: 'submit', primary: true, value: 'ok'});
      form.append(label, name, ...(chooseSource ? [legend, sources] : []), actionsRow(cancel, submit));
      body.append(form);
      dialog.addEventListener('close', () => {
        const source = form.querySelector('input[type=radio]:checked')?.value || 'current';
        resolve(dialog.returnValue === 'ok' && name.value.trim() ? {name: name.value.trim(), source} : null);
      }, {once: true});
      dialog.showModal();
      name.select();
    });
  }

  // A guest signs in first; the rack stays as it is meanwhile. Resolves with
  // true when the action can go on.
  async signInToSave() {
    if (!this.needsSignIn) return true;
    this.signingInToSave = true;
    try {
      if (!await this.requestSignIn('Sign in to save this sound as a preset.')) return false;
      await this.syncing;
      return Boolean(this.account.signedIn);
    } finally { this.signingInToSave = false; }
  }

  async create({chooseSource = true} = {}) {
    if (!await this.signInToSave()) return;
    const request = await this.askNewPreset({chooseSource});
    if (!request) return;
    this.$('presetNew').disabled = true;
    try {
      const state = request.source === 'default' ? await this.defaultState() : await this.captureState();
      if (request.source === 'default') await this.applyState(structuredClone(state));
      const created = await this.store.create(request.name, state);
      this.setActive(created.id);
      await this.settle();
      await this.refresh();
      this.status(`Created “${request.name}”.`);
      this.report(`Preset “${request.name}” created.`);
    } catch (error) { this.status(`Could not create the preset: ${error.message}`, true); }
    finally { this.$('presetNew').disabled = this.busy; }
  }

  // Overwrites the active preset of mine with the current rack (pedals, gains,
  // both lanes); otherwise saves the rack as a new preset.
  async save() {
    if (!await this.signInToSave()) return;
    const active = this.active;
    if (!active || active.factory) return this.create({chooseSource: false});
    this.$('presetSaveButton').disabled = true;
    try {
      await this.store.update(active.id, {state: await this.captureState()});
      await this.settle();
      await this.refresh();
      this.status(`Saved “${active.name}”.`);
      this.report(`Preset “${active.name}” saved.`);
    } catch (error) { this.status(`Could not save “${active.name}”: ${error.message}`, true); }
    finally { this.renderSave(); }
  }

  // Nothing to save while the rack matches its preset (or the default rack):
  // Save then turns neutral and inactive; New preset still copies the rack.
  renderSave() {
    const save = this.$('presetSaveButton');
    save.disabled = this.busy || !this.modified;
    save.setAttribute('variant', this.modified ? 'primary' : 'secondary');
  }

  async load(id) {
    const preset = this.find(id);
    if (!preset || this.busy) return;
    this.loadingId = preset.id;
    this.render();
    this.status(`Loading “${preset.name}”…`);
    try {
      const {state} = await (isFactoryPreset(preset.id) ? this.factoryStore : this.store).get(preset.id);
      await this.applyState(state);
      this.setActive(preset.id);
      await this.settle();
      this.status(`Loaded “${preset.name}”.`);
      this.report(`Preset “${preset.name}” active.`);
    } catch (error) {
      this.status(`Could not load “${preset.name}”: ${error.message}`, true);
      this.report(`Could not load preset “${preset.name}”: ${error.message}`, true);
    } finally {
      this.loadingId = null;
      this.render();
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
      if (this.activeId === preset.id) this.setActive(null);
      await this.refresh();
      this.status(`Deleted “${preset.name}”.`);
    } catch (error) { this.status(`Could not delete: ${error.message}`, true); }
  }
}
