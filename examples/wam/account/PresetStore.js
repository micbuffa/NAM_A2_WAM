// Preset storage with one interface for guests of the static distribution
// (IndexedDB in this browser) and signed-in users of the online rack (Rails
// API). A preset state is the whole WAM chain:
// {version, nam: NamNode#getState(), cabinet: CabinetNode#getState()}.
const DATABASE_NAME = 'nam-a2-wam-presets';
const DATABASE_VERSION = 1;
const STORE_NAME = 'presets';

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

const summary = ({id, name, createdAt, updatedAt}) => ({id, name, createdAt, updatedAt});
const byRecent = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));

export class LocalPresetStore {
  constructor({indexedDBImpl = globalThis.indexedDB, randomId = () => crypto.randomUUID()} = {}) {
    this.indexedDB = indexedDBImpl;
    this.randomId = randomId;
    this._database = null;
  }

  get available() { return Boolean(this.indexedDB); }
  get scope() { return 'local'; }

  async open() {
    if (!this.available) throw new Error('Presets need IndexedDB, which this browser does not provide here');
    if (this._database) return this._database;
    const request = this.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, {keyPath: 'id'});
    };
    this._database = await requestResult(request);
    this._database.onversionchange = () => { this._database.close(); this._database = null; };
    return this._database;
  }

  async all() {
    const database = await this.open();
    return (await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll())).sort(byRecent);
  }

  async list() { return (await this.all()).map(summary); }

  async get(id) {
    const database = await this.open();
    const record = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id));
    if (!record) throw new Error('Preset not found');
    return record;
  }

  async put(record) {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
    return record;
  }

  async create(name, state) {
    const now = new Date().toISOString();
    return summary(await this.put({id: this.randomId(), name, state, createdAt: now, updatedAt: now}));
  }

  async update(id, {name, state}) {
    const record = await this.get(id);
    return summary(await this.put({...record, ...(name === undefined ? {} : {name}), ...(state === undefined ? {} : {state}),
      updatedAt: new Date().toISOString()}));
  }

  async delete(id) {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
  }
}

// The online rack keeps presets in the account only: it deletes what an
// earlier version stored in this browser for guests. Resolves either way.
export function deleteLocalPresets({indexedDBImpl = globalThis.indexedDB} = {}) {
  return new Promise((resolve) => {
    if (!indexedDBImpl) return resolve();
    try {
      const request = indexedDBImpl.deleteDatabase(DATABASE_NAME);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    } catch { resolve(); }
  });
}

export class RemotePresetStore {
  constructor({api}) { this.api = api; }
  get available() { return true; }
  get scope() { return 'account'; }
  list() { return this.api.listPresets(); }
  get(id) { return this.api.getPreset(id); }
  create(name, state) { return this.api.createPreset(name, state); }
  update(id, attributes) { return this.api.updatePreset(id, attributes); }
  delete(id) { return this.api.deletePreset(id); }
}

export {DATABASE_NAME, STORE_NAME};
