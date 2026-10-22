import test from 'node:test';
import assert from 'node:assert/strict';
import AccountApi, {ApiError} from '../../examples/wam/account/api.js';
import AccountFavorites, {decodeAsset, encodeAsset} from '../../examples/wam/account/AccountFavorites.js';
import {LocalPresetStore, DATABASE_NAME, deleteLocalPresets} from '../../examples/wam/account/PresetStore.js';
import LocalDataImport from '../../examples/wam/account/LocalDataImport.js';
import PresetsPanel from '../../examples/wam/account/PresetsPanel.js';
import RackDraftStore from '../../examples/wam/account/RackDraft.js';
import {importSummary, initials} from '../../examples/wam/account/AccountPanel.js';
import {FACTORY_PRESETS, FactoryPresetStore, isFactoryPreset} from '../../examples/wam/account/FactoryPresets.js';

const fakeDocument = ({csrf = 'token-1', user = null} = {}) => {
  const meta = csrf === null ? null : {content: csrf, getAttribute() { return this.content; }, setAttribute(_, value) { this.content = value; }};
  return {meta, querySelector: () => meta, getElementById: (id) => id === 'currentUser' ? {textContent: JSON.stringify(user)} : null};
};

const recordingFetch = (responses) => {
  const calls = [];
  const fetchImpl = async (path, options) => {
    calls.push({path, ...options});
    const {status = 200, body = null} = responses.shift() || {};
    return {status, ok: status >= 200 && status < 300, json: async () => body};
  };
  return {calls, fetchImpl};
};

// IndexedDB fake with keyPath support and get(), enough for LocalPresetStore and RackDraftStore.
const fakeIndexedDB = () => {
  const stores = new Map();
  const database = {
    objectStoreNames: {contains: (name) => stores.has(name)},
    createObjectStore: (name, {keyPath}) => stores.set(name, {keyPath, records: new Map()}),
    close() {},
    transaction(name) {
      const {keyPath, records} = stores.get(name);
      const transaction = {};
      const request = (result) => { const req = {}; queueMicrotask(() => { req.result = result(); req.onsuccess?.(); }); return req; };
      const complete = () => queueMicrotask(() => transaction.oncomplete?.());
      transaction.objectStore = () => ({
        getAll: () => request(() => [...records.values()].map((value) => structuredClone(value))),
        get: (key) => request(() => structuredClone(records.get(key))),
        put(value) { records.set(value[keyPath], structuredClone(value)); complete(); return request(() => value[keyPath]); },
        delete(key) { records.delete(key); complete(); return request(() => undefined); },
      });
      return transaction;
    },
  };
  return {open() { const req = {}; queueMicrotask(() => { req.result = database; if (!stores.size) req.onupgradeneeded?.(); req.onsuccess?.(); }); return req; }};
};

test('account API is only available on the Rails page (CSRF meta present)', () => {
  assert.equal(new AccountApi({document: fakeDocument({csrf: null}), fetchImpl: async () => {}}).available, false);
  const api = new AccountApi({document: fakeDocument({user: {id: 7, email: 'a@example.com'}}), fetchImpl: async () => {}});
  assert.equal(api.available, true);
  assert.deepEqual(api.initialUser(), {id: 7, email: 'a@example.com'});
});

test('writes send the CSRF token and adopt a rotated token', async () => {
  const document = fakeDocument();
  const {calls, fetchImpl} = recordingFetch([{body: {user: {id: 1}, csrfToken: 'token-2'}}, {status: 201, body: {id: 3}}, {body: []}]);
  const api = new AccountApi({document, fetchImpl});
  await api.signOut();
  await api.createPreset('Crunch', {version: 1});
  await api.listPresets();
  assert.equal(calls[0].headers['X-CSRF-Token'], 'token-1');
  assert.equal(calls[0].credentials, 'same-origin');
  assert.equal(calls[1].headers['X-CSRF-Token'], 'token-2');
  assert.deepEqual(JSON.parse(calls[1].body), {name: 'Crunch', state: {version: 1}});
  assert.equal(calls[2].headers['X-CSRF-Token'], undefined);
  assert.equal(document.meta.content, 'token-2');
});

test('API errors carry the HTTP status and server message', async () => {
  const {fetchImpl} = recordingFetch([{status: 401, body: {error: 'Not signed in'}}]);
  const api = new AccountApi({document: fakeDocument(), fetchImpl});
  await assert.rejects(api.listPresets(), (error) => error instanceof ApiError && error.status === 401 && error.message === 'Not signed in');
});

test('favorites use the browser store when signed out and the account when signed in', async () => {
  const local = {saved: [], list: async () => [{identity: 'local', asset: {id: 'local'}}], save: async (asset) => { local.saved.push(asset); return asset; }, delete: async () => {}};
  const api = {listFavorites: async (kind) => [{assetRef: `${kind}:1`, savedAt: 'now', metadata: {id: `${kind}:1`, bytes: {$bytes: 'AQID'}}}],
    saveFavorite: async (kind, assetRef, metadata) => { api.saved = {kind, assetRef, metadata}; return {assetRef, savedAt: 'now'}; }};
  const account = {signedIn: false, api};
  const favorites = new AccountFavorites({account, kind: 'ir', local});

  assert.equal((await favorites.listFavorites())[0].identity, 'local');
  await favorites.saveFavorite({id: 'x'});
  assert.equal(local.saved.length, 1);

  account.signedIn = true;
  const [record] = await favorites.list();
  assert.equal(record.identity, 'ir:1');
  assert.deepEqual([...record.asset.bytes], [1, 2, 3]);
  await favorites.save({id: 'ir:2', bytes: new Uint8Array([4, 5]), missing: undefined});
  assert.deepEqual(api.saved, {kind: 'ir', assetRef: 'ir:2', metadata: {id: 'ir:2', bytes: {$bytes: 'BAU='}}});
});

test('asset encoding round-trips binary fields', () => {
  const asset = {id: 'a', name: 'IR', bytes: new Uint8Array(70000).map((_, index) => index % 256)};
  const decoded = decodeAsset(JSON.parse(JSON.stringify(encodeAsset(asset))));
  assert.equal(decoded.name, 'IR');
  assert.deepEqual(decoded.bytes, asset.bytes);
});

test('static-distribution guest presets persist the whole chain in IndexedDB', async () => {
  let next = 0;
  const store = new LocalPresetStore({indexedDBImpl: fakeIndexedDB(), randomId: () => `p${++next}`});
  const state = {version: 1, nam: {parameterValues: {inputGain: {id: 'inputGain', value: 6}}, model: {name: 'A2', data: '{}'}},
    cabinet: {ir: {samples: [0.5, -0.25]}}};
  const created = await store.create('Crunch', state);
  assert.deepEqual(Object.keys(created).sort(), ['createdAt', 'id', 'name', 'updatedAt']);
  assert.deepEqual((await store.get('p1')).state, state);
  await store.update('p1', {name: 'Crunch 2'});
  assert.equal((await store.list())[0].name, 'Crunch 2');
  assert.deepEqual((await store.get('p1')).state, state);
  await store.delete('p1');
  assert.deepEqual(await store.list(), []);
  await assert.rejects(store.get('p1'), /not found/);
});

test('local data import is offered once per account and sent in batches', async () => {
  const storage = new Map();
  const calls = [];
  const prompts = [];
  const account = {user: {id: 5, email: 'a@example.com'}, api: {importLocalData: async (data) => { calls.push(data); return {}; }}};
  const localFavorites = {nam_model: {list: async () => Array.from({length: 12}, (_, index) => ({identity: `m${index}`, asset: {id: `m${index}`}}))},
    ir: {list: async () => [{identity: 'ir1', asset: {id: 'ir1'}}]}};
  const importer = new LocalDataImport({account, localFavorites, readLocalPreferences: () => ({autoLevel: false}),
    encodeAsset: (asset) => ({...asset, encoded: true}), confirm: async (options) => { prompts.push(options); return true; },
    storage: {getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)}});

  assert.deepEqual(await importer.offer(), {favorites: 13, preferences: true});
  assert.match(prompts[0].message, /has 13 favorites, your level preferences saved/);
  assert.deepEqual(calls[0], {preferences: {autoLevel: false}});
  assert.deepEqual(calls.slice(1, 3).map((call) => call.favorites.length), [10, 3]);
  assert.deepEqual(calls[1].favorites[0], {kind: 'nam_model', assetRef: 'm0', metadata: {id: 'm0', encoded: true}});
  assert.equal(calls.length, 3, 'presets are never sent');

  assert.equal(await importer.offer(), null, 'offered only once per account');
  assert.equal(prompts.length, 1);

  // Settings > Account asks again on demand.
  assert.deepEqual(await importer.offer({force: true}), {favorites: 13, preferences: true});
  assert.equal(prompts.length, 2);
});

test('a forced import of an empty browser reports zero counts without asking', async () => {
  const prompts = [];
  const importer = new LocalDataImport({account: {user: {id: 3, email: 'c@example.com'}, api: {importLocalData: async () => assert.fail('nothing to send')}},
    localFavorites: {}, readLocalPreferences: () => ({}),
    encodeAsset: (asset) => asset, confirm: async (options) => { prompts.push(options); return true; }, storage: null});
  assert.deepEqual(await importer.offer({force: true}), {favorites: 0, preferences: false});
  assert.equal(await importer.offer(), null);
  assert.deepEqual(prompts, []);
});

test('the account section summarises an import in one sentence', () => {
  assert.equal(importSummary(null), '');
  assert.equal(importSummary({favorites: 0, preferences: false}), 'This browser has no guest data to import.');
  assert.equal(importSummary({favorites: 2, preferences: true}), 'Imported 2 favorites, your amp preferences.');
  assert.equal(initials('gui.besse@example.com'), 'GB');
  assert.equal(initials('solo@example.com'), 'SO');
});

test('declining the import is remembered and sends nothing', async () => {
  const calls = [];
  const storage = new Map();
  const importer = new LocalDataImport({account: {user: {id: 9, email: 'b@example.com'}, api: {importLocalData: async (data) => calls.push(data)}},
    localPresets: {available: true, all: async () => [{name: 'P', state: {}}]}, localFavorites: {}, readLocalPreferences: () => ({}),
    encodeAsset: (asset) => asset, confirm: async () => false,
    storage: {getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)}});
  assert.equal(await importer.offer(), null);
  assert.deepEqual(calls, []);
  assert.ok(storage.has('nam-a2-wam.account.import-offered.9'));
});

test('a Factory preset applies its model and parameters on top of the default rack', async () => {
  const base = {version: 2, a: {entries: [
    {id: 'n', kind: 'nam', bypass: true, state: {model: {data: 'old', name: 'old.nam'}, measuredCalibration: {compensationDb: 3}, metadata: {x: 1},
      parameterValues: {bass: {id: 'bass', value: 5, normalized: false}, inputGain: {id: 'inputGain', value: 2, normalized: false}}}},
    {id: 'c', kind: 'cabinet', state: {routingMode: 'auto'}}]}};
  const manifestUrl = 'https://rack.test/plugins/nam-wam/models-manifest.json';
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    return String(url) === manifestUrl
      ? {ok: true, json: async () => ({assets: [{id: 'factory:amp', filename: 'Amp A.nam', relativePath: 'Packs/Amp A.nam', displayName: 'Amp A'}]})}
      : {ok: true, text: async () => 'MODEL'};
  };
  const store = new FactoryPresetStore({manifestUrl, baseState: () => base, fetchImpl,
    presets: [{id: 'factory:test', name: 'Test', category: 'Clean', model: 'factory:amp', parameters: {bass: 7, noiseEnabled: 1}}]});

  assert.deepEqual(await store.list(), [{id: 'factory:test', name: 'Test', category: 'Clean', factory: true}]);
  const {state, name} = await store.get('factory:test');
  assert.equal(name, 'Test');
  assert.equal(requested[1], 'https://rack.test/plugins/nam-wam/models/Packs/Amp%20A.nam');
  const nam = state.a.entries[0];
  assert.deepEqual([nam.state.model.data, nam.state.model.name, nam.state.model.provenance.identity, nam.state.model.provenance.source],
    ['MODEL', 'Amp A.nam', 'factory:amp', 'Factory']);
  assert.equal(nam.state.measuredCalibration, null, 'the base model calibration is dropped');
  assert.equal(nam.bypass, false);
  assert.deepEqual(nam.state.parameterValues.bass, {id: 'bass', value: 7, normalized: false});
  assert.equal(nam.state.parameterValues.inputGain.value, 2, 'other parameters keep the default rack values');
  assert.equal(base.a.entries[0].state.model.data, 'old', 'the default rack is not modified');
  await assert.rejects(store.get('factory:nope'), /Unknown Factory preset/);
  assert.ok(isFactoryPreset('factory:test') && !isFactoryPreset('42'));
});

test('every Factory preset names a model of the shipped catalogue', async () => {
  const {readFile} = await import('node:fs/promises');
  const {assets} = JSON.parse(await readFile(new URL('../../src/nam-wam/models-manifest.json', import.meta.url), 'utf8'));
  for (const preset of FACTORY_PRESETS) assert.ok(assets.some((asset) => asset.id === preset.model), preset.name);
});

test('the active preset is remembered in the account when signed in, in the browser otherwise', async () => {
  const values = new Map();
  const storage = {getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key)};
  const guest = new PresetsPanel({account: null, storage, root: {}});
  assert.equal(guest.lastPresetId, null);
  guest.setActive('local-1');
  assert.deepEqual([guest.activeId, guest.lastPresetId], ['local-1', 'local-1']);
  guest.setActive(null);
  assert.equal(guest.lastPresetId, null);

  const sent = [];
  const account = {signedIn: true, user: {preferences: {lastPresetId: 7}},
    updatePreference(key, value) { sent.push({[key]: value}); this.user.preferences[key] = value; return Promise.resolve(); }};
  const member = new PresetsPanel({account, storage, root: {}});
  assert.equal(member.lastPresetId, 7);
  member.setActive('factory:twin-clean');
  assert.deepEqual(sent, [{lastPresetId: 'factory:twin-clean'}]);
  assert.equal(values.size, 0, 'an account preset is not written to the browser');

  const throwing = {getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }};
  const blocked = new PresetsPanel({account: null, storage: throwing, root: {}});
  blocked.setActive('local-2');
  assert.deepEqual([blocked.activeId, blocked.lastPresetId], ['local-2', null]);
});

// Just enough DOM for PresetsPanel.attach() and render().
const fakePresetDom = () => {
  const element = () => ({hidden: false, disabled: false, textContent: '', value: '', title: '', children: [],
    attributes: new Set(), setAttribute(name, value) { this[`@${name}`] = value; }, toggleAttribute(name, force) { if (force) this.attributes.add(name); else this.attributes.delete(name); },
    classList: {toggle() {}}, append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; }});
  const elements = new Map();
  globalThis.document ??= {createElement: element};
  globalThis.Option ??= class { constructor(text, value) { Object.assign(this, {text, value}); } };
  return {getElementById: (id) => elements.get(id) || elements.set(id, element()).get(id)};
};

const presetHarness = ({account = null, last = null, presets = [{id: 1, name: 'Lead'}, {id: 2, name: 'Clean'}]} = {}) => {
  const values = new Map(last === null ? [] : [['nam-a2-wam.last-preset', String(last)]]);
  const storage = {getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key)};
  const rack = {state: {sound: 'default'}};
  const store = {list: async () => presets, get: async (id) => ({state: {sound: `preset ${id}`}})};
  const panel = new PresetsPanel({account, localStore: store, remoteStore: store, factoryStore: null, storage, root: fakePresetDom(),
    captureState: async () => structuredClone(rack.state), applyState: async (state) => { rack.state = structuredClone(state); },
    defaultState: () => ({sound: 'default'})});
  return {panel, rack};
};

test('the rack reopens the last preset when the page loads', async () => {
  const {panel, rack} = presetHarness({last: 2});
  await panel.attach();
  assert.equal(panel.activeId, 2);
  assert.deepEqual(rack.state, {sound: 'preset 2'});
  assert.equal(await panel.isModified(), false);

  const gone = presetHarness({last: 'deleted'});
  await gone.panel.attach();
  assert.equal(gone.panel.activeId, null, 'a deleted preset leaves the rack untitled');
  assert.deepEqual(gone.rack.state, {sound: 'default'});
});

test('signing in reopens the account preset unless the rack has unsaved changes', async () => {
  const account = Object.assign(new EventTarget(), {signedIn: false, user: null,
    updatePreference(key, value) { this.user.preferences[key] = value; return Promise.resolve(); }});
  const signIn = () => {
    Object.assign(account, {signedIn: true, user: {email: 'a@b.c', preferences: {lastPresetId: 1}}});
    account.dispatchEvent(new CustomEvent('change', {detail: {previous: null, user: account.user}}));
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  const clean = presetHarness({account});
  await clean.panel.attach();
  signIn();
  await settle();
  assert.deepEqual([clean.panel.activeId, clean.rack.state], [1, {sound: 'preset 1'}]);

  Object.assign(account, {signedIn: false, user: null});
  account.dispatchEvent(new CustomEvent('change', {detail: {previous: {id: 1}, user: null}}));
  await settle();
  assert.deepEqual([clean.panel.activeId, clean.rack.state], [null, {sound: 'default'}], 'signing out goes back to the default rack');

  const edited = presetHarness({account});
  await edited.panel.attach();
  edited.rack.state = {sound: 'tweaked'};
  signIn();
  await settle();
  assert.deepEqual([edited.panel.activeId, edited.rack.state], [null, {sound: 'tweaked'}], 'unsaved changes stay until saved');
});

test('saving asks a guest to sign in, then saves the rack as it is', async () => {
  const account = Object.assign(new EventTarget(), {signedIn: false, user: null,
    updatePreference(key, value) { this.user.preferences[key] = value; return Promise.resolve(); }});
  const reasons = [];
  let accept = false;
  const requestSignIn = async (reason) => {
    reasons.push(reason);
    if (!accept) return false;
    Object.assign(account, {signedIn: true, user: {email: 'a@b.c', preferences: {lastPresetId: 1}}});
    account.dispatchEvent(new CustomEvent('change', {detail: {previous: null, user: account.user}}));
    return true;
  };
  const created = [];
  const store = {list: async () => [{id: 1, name: 'Lead'}, ...created.map(({name}) => ({id: 9, name}))],
    get: async (id) => ({state: {sound: `preset ${id}`}}), create: async (name, state) => { created.push({name, state}); return {id: 9, name}; }};
  const rack = {state: {sound: 'default'}};
  const panel = new PresetsPanel({account, localStore: store, remoteStore: store, factoryStore: null, requestSignIn, root: fakePresetDom(),
    storage: {getItem: () => null, setItem() {}, removeItem() {}},
    captureState: async () => structuredClone(rack.state), applyState: async (state) => { rack.state = structuredClone(state); },
    defaultState: () => ({sound: 'default'})});
  panel.askNewPreset = async () => ({name: 'Mine', source: 'current'});
  await panel.attach();
  assert.equal(panel.needsSignIn, true);
  assert.deepEqual(panel.presets, [], 'a guest has no presets of their own, only Factory ones');
  const dom = panel.$('presetSelect').children[1].children[0];
  assert.deepEqual([dom.text, dom.disabled], ['Sign in to save presets', true]);
  assert.match(panel.$('presetScope').textContent, /^Sign in to save your presets/);

  await panel.save();
  await panel.create();
  assert.equal(reasons.length, 2, 'Save and New preset both ask to sign in');
  assert.deepEqual(created, [], 'nothing is saved when the guest cancels');

  accept = true;
  await panel.save();
  assert.equal(panel.needsSignIn, false);
  assert.deepEqual(created, [{name: 'Mine', state: {sound: 'default'}}], 'the rack on screen is saved, not the account\'s last preset');
  assert.equal(panel.activeId, 9);
  assert.deepEqual(panel.presets.map(({name}) => name), ['Lead', 'Mine'], 'signed in, the account presets are listed');

  const guest = presetHarness();
  assert.equal(guest.panel.needsSignIn, false, 'without accounts (static distribution) guests still save in this browser');
});

test('the online rack deletes the guest presets an earlier version stored in this browser', async () => {
  const deleted = [];
  const indexedDBImpl = {deleteDatabase(name) { deleted.push(name); const request = {}; setTimeout(() => request.onblocked()); return request; }};
  await deleteLocalPresets({indexedDBImpl});
  assert.deepEqual(deleted, [DATABASE_NAME]);
  await deleteLocalPresets({indexedDBImpl: null}); // no IndexedDB: nothing to delete
  await deleteLocalPresets({indexedDBImpl: {deleteDatabase() { throw new Error('SecurityError'); }}});
});

test('drafts are stored per scope in IndexedDB', async () => {
  const drafts = new RackDraftStore({indexedDBImpl: fakeIndexedDB()});
  assert.equal(await drafts.get('guest'), null);
  await drafts.put('guest', {state: {sound: 'g'}, presetId: null});
  await drafts.put('user:1', {state: {sound: 'u'}, presetId: 4, baseline: '{}'});
  assert.deepEqual([(await drafts.get('guest')).state, (await drafts.get('user:1')).presetId], [{sound: 'g'}, 4]);
  await drafts.delete('guest');
  assert.equal(await drafts.get('guest'), null);
  assert.equal((await drafts.get('user:1')).baseline, '{}');
});

test('unsaved changes are kept as a draft and brought back on the next page load', async () => {
  const records = new Map();
  const draftStore = {get: async (scope) => structuredClone(records.get(scope) ?? null),
    put: async (scope, draft) => { records.set(scope, structuredClone({scope, ...draft})); }, delete: async (scope) => { records.delete(scope); }};
  const store = {list: async () => [{id: 1, name: 'Lead'}], get: async (id) => ({state: {sound: `preset ${id}`}}),
    update: async (id) => ({id, name: 'Lead'})};
  const page = (last = null) => {
    const rack = {state: {sound: 'default'}, listeners: []};
    const values = new Map(last === null ? [] : [['nam-a2-wam.last-preset', String(last)]]);
    const panel = new PresetsPanel({account: null, localStore: store, factoryStore: null, draftStore, draftDelay: 0, root: fakePresetDom(),
      watchRack: (listener) => rack.listeners.push(listener),
      storage: {getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key)},
      captureState: async () => structuredClone(rack.state), applyState: async (state) => { rack.state = structuredClone(state); },
      defaultState: () => ({sound: 'default'})});
    const edit = async (sound) => { rack.state = {sound}; rack.listeners.forEach((listener) => listener()); await new Promise((resolve) => setTimeout(resolve, 5)); };
    return {panel, rack, edit};
  };

  const first = page(1);
  await first.panel.attach();
  await first.edit('tweaked');
  assert.deepEqual(records.get('guest').state, {sound: 'tweaked'});
  assert.equal(records.get('guest').presetId, 1);
  await first.edit('preset 1');
  assert.equal(records.has('guest'), false, 'back to the preset: no draft');
  await first.edit('tweaked again');

  const reloaded = page(1);
  await reloaded.panel.attach();
  assert.deepEqual(reloaded.rack.state, {sound: 'tweaked again'}, 'the unsaved rack comes back');
  assert.equal(reloaded.panel.activeId, 1, 'still attached to the preset it started from');
  assert.equal(await reloaded.panel.isModified(), true);
  await reloaded.panel.save();
  assert.equal(records.has('guest'), false, 'saving drops the draft');

  await reloaded.edit('yet another');
  await reloaded.panel.load(1);
  assert.equal(records.has('guest'), false, 'loading (or reverting) drops the draft');
});

test('the header shows unsaved changes while the rack differs from its preset', async () => {
  const records = new Map();
  const draftStore = {get: async (scope) => structuredClone(records.get(scope) ?? null),
    put: async (scope, draft) => { records.set(scope, structuredClone({scope, ...draft})); }, delete: async (scope) => { records.delete(scope); }};
  const store = {list: async () => [{id: 1, name: 'Lead'}], get: async (id) => ({state: {sound: `preset ${id}`}}),
    update: async (id) => ({id, name: 'Lead'})};
  const page = () => {
    const rack = {state: {sound: 'default'}, listeners: []}, root = fakePresetDom(), values = new Map([['nam-a2-wam.last-preset', '1']]);
    const panel = new PresetsPanel({account: null, localStore: store, factoryStore: null, draftStore, draftDelay: 0, checkDelay: 0, root,
      watchRack: (listener) => rack.listeners.push(listener),
      storage: {getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key)},
      captureState: async () => structuredClone(rack.state), applyState: async (state) => { rack.state = structuredClone(state); },
      defaultState: () => ({sound: 'default'})});
    const changes = [];
    panel.addEventListener('change', ({detail}) => changes.push(detail));
    const edit = async (sound) => { rack.state = {sound}; rack.listeners.forEach((listener) => listener()); await new Promise((resolve) => setTimeout(resolve, 5)); };
    const shown = () => {
      const save = root.getElementById('presetSaveButton');
      const modified = !root.getElementById('presetUnsaved').hidden;
      assert.equal(save.disabled, !modified, 'Save is disabled exactly when there is nothing to save');
      assert.equal(save['@variant'], modified ? 'primary' : 'secondary');
      return [modified, save.attributes.has('dot')];
    };
    return {panel, edit, shown, changes};
  };

  const first = page();
  await first.panel.attach();
  assert.deepEqual(first.shown(), [false, false], 'a loaded preset is clean');
  await first.edit('tweaked');
  assert.deepEqual(first.shown(), [true, true], 'an edit shows the badge and the Save dot');
  assert.equal(first.changes.at(-1).meta, 'My preset · Stored in this browser · Unsaved changes');
  await first.edit('preset 1');
  assert.deepEqual(first.shown(), [false, false], 'back to the preset: clean again');
  await first.edit('tweaked');
  await first.panel.save();
  assert.deepEqual(first.shown(), [false, false], 'saving clears it');
  await first.edit('tweaked again');
  await first.panel.load(1);
  assert.deepEqual(first.shown(), [false, false], 'loading (or reverting) clears it');
  await first.edit('kept as a draft');

  const reloaded = page();
  await reloaded.panel.attach();
  assert.deepEqual(reloaded.shown(), [true, true], 'a restored draft is still unsaved');
});
