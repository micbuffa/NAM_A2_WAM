import test from 'node:test';
import assert from 'node:assert/strict';
import AccountApi, {ApiError} from '../../examples/wam/account/api.js';
import AccountFavorites, {decodeAsset, encodeAsset} from '../../examples/wam/account/AccountFavorites.js';
import {LocalPresetStore} from '../../examples/wam/account/PresetStore.js';
import LocalDataImport from '../../examples/wam/account/LocalDataImport.js';
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

// IndexedDB fake with keyPath support and get(), enough for LocalPresetStore.
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
        put(value) { records.set(value[keyPath], structuredClone(value)); complete(); },
        delete(key) { records.delete(key); complete(); },
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

test('guest presets persist the whole chain in IndexedDB', async () => {
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
  const localPresets = {available: true, all: async () => Array.from({length: 4}, (_, index) => ({id: `p${index}`, name: `P${index}`, state: {version: 1}}))};
  const localFavorites = {nam_model: {list: async () => Array.from({length: 12}, (_, index) => ({identity: `m${index}`, asset: {id: `m${index}`}}))},
    ir: {list: async () => [{identity: 'ir1', asset: {id: 'ir1'}}]}};
  const importer = new LocalDataImport({account, localPresets, localFavorites, readLocalPreferences: () => ({autoLevel: false}),
    encodeAsset: (asset) => ({...asset, encoded: true}), confirm: async (options) => { prompts.push(options); return true; },
    storage: {getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)}});

  assert.deepEqual(await importer.offer(), {presets: 4, favorites: 13, preferences: true});
  assert.match(prompts[0].message, /4 presets, 13 favorites, your level preferences/);
  assert.deepEqual(calls[0], {preferences: {autoLevel: false}});
  assert.deepEqual(calls.slice(1, 3).map((call) => call.favorites.length), [10, 3]);
  assert.deepEqual(calls[1].favorites[0], {kind: 'nam_model', assetRef: 'm0', metadata: {id: 'm0', encoded: true}});
  assert.deepEqual(calls.slice(3).map((call) => call.presets.length), [3, 1]);
  assert.deepEqual(calls[3].presets[0], {name: 'P0', state: {version: 1}});

  assert.equal(await importer.offer(), null, 'offered only once per account');
  assert.equal(prompts.length, 1);

  // Settings > Account asks again on demand.
  assert.deepEqual(await importer.offer({force: true}), {presets: 4, favorites: 13, preferences: true});
  assert.equal(prompts.length, 2);
});

test('a forced import of an empty browser reports zero counts without asking', async () => {
  const prompts = [];
  const importer = new LocalDataImport({account: {user: {id: 3, email: 'c@example.com'}, api: {importLocalData: async () => assert.fail('nothing to send')}},
    localPresets: {available: true, all: async () => []}, localFavorites: {}, readLocalPreferences: () => ({}),
    encodeAsset: (asset) => asset, confirm: async (options) => { prompts.push(options); return true; }, storage: null});
  assert.deepEqual(await importer.offer({force: true}), {presets: 0, favorites: 0, preferences: false});
  assert.equal(await importer.offer(), null);
  assert.deepEqual(prompts, []);
});

test('the account section summarises an import in one sentence', () => {
  assert.equal(importSummary(null), '');
  assert.equal(importSummary({presets: 0, favorites: 0, preferences: false}), 'This browser has no guest data to import.');
  assert.equal(importSummary({presets: 1, favorites: 2, preferences: true}), 'Imported 1 preset, 2 favorites, your amp preferences.');
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
