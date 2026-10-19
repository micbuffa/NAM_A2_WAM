// The rack's unsaved changes, kept in this browser so a reload does not lose
// them (a draft, not a preset). One draft per scope: 'guest', or a user id,
// so a sound never moves from one account to another. IndexedDB rather than
// localStorage: the state embeds the NAM model and the IR.
// A draft is {scope, state, presetId, baseline, savedAt}: presetId is the
// preset it started from (or null), baseline that rack as JSON (or null).
const DATABASE_NAME = 'nam-a2-wam-draft';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

export default class RackDraftStore {
  constructor({indexedDBImpl = globalThis.indexedDB} = {}) {
    this.indexedDB = indexedDBImpl;
    this._database = null;
  }

  async open() {
    if (!this.indexedDB) throw new Error('Drafts need IndexedDB');
    if (this._database) return this._database;
    const request = this.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, {keyPath: 'scope'});
    };
    this._database = await requestResult(request);
    this._database.onversionchange = () => { this._database.close(); this._database = null; };
    return this._database;
  }

  async run(mode, action) {
    const database = await this.open();
    return requestResult(action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME)));
  }

  // Resolves with the draft, or null.
  async get(scope) { return (await this.run('readonly', (store) => store.get(scope))) || null; }

  put(scope, {state, presetId = null, baseline = null}) {
    return this.run('readwrite', (store) => store.put({scope, state, presetId, baseline, savedAt: new Date().toISOString()}));
  }

  delete(scope) { return this.run('readwrite', (store) => store.delete(scope)); }
}

export {DATABASE_NAME};
