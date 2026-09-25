import test from 'node:test';
import assert from 'node:assert/strict';
import AccountApi, {ApiError} from '../../examples/wam/account/api.js';
import AccountFavorites, {decodeAsset, encodeAsset} from '../../examples/wam/account/AccountFavorites.js';
import {LocalPresetStore} from '../../examples/wam/account/PresetStore.js';
import LocalDataImport from '../../examples/wam/account/LocalDataImport.js';

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
  await api.verifyCode('a@example.com', '123456');
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

  assert.deepEqual(await importer.offer(), {presets: 4, favorites: 13});
  assert.match(prompts[0].message, /4 presets, 13 favorites, your level preferences/);
  assert.deepEqual(calls[0], {preferences: {autoLevel: false}});
  assert.deepEqual(calls.slice(1, 3).map((call) => call.favorites.length), [10, 3]);
  assert.deepEqual(calls[1].favorites[0], {kind: 'nam_model', assetRef: 'm0', metadata: {id: 'm0', encoded: true}});
  assert.deepEqual(calls.slice(3).map((call) => call.presets.length), [3, 1]);
  assert.deepEqual(calls[3].presets[0], {name: 'P0', state: {version: 1}});

  assert.equal(await importer.offer(), null, 'offered only once per account');
  assert.equal(prompts.length, 1);
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
