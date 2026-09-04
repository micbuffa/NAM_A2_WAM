const DATABASE_NAME = 'nam-a2-wam-favorites';
const DATABASE_VERSION = 1;
const STORE_NAME = 'models';

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

export default class ModelFavorites {
  constructor({indexedDBImpl = globalThis.indexedDB} = {}) {
    this.indexedDB = indexedDBImpl;
    this._database = null;
  }

  get available() { return Boolean(this.indexedDB); }

  async open() {
    if (!this.available) return null;
    if (this._database) return this._database;
    const request = this.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, {keyPath: 'identity'});
    };
    this._database = await requestResult(request);
    this._database.onversionchange = () => { this._database.close(); this._database = null; };
    return this._database;
  }

  async list() {
    const database = await this.open();
    if (!database) return [];
    const records = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
    return records.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
  }

  async save(asset) {
    if (!asset?.id) throw new Error('A model identity is required');
    const record = {identity: asset.id, savedAt: new Date().toISOString(), asset};
    const database = await this.open();
    if (!database) return record;
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
    return record;
  }

  async delete(identity) {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(identity);
    await transactionDone(transaction);
  }

  close() {
    this._database?.close();
    this._database = null;
  }
}

export {DATABASE_NAME, DATABASE_VERSION, STORE_NAME};
