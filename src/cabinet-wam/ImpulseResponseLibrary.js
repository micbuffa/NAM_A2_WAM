const DATABASE_NAME = 'neuralwamp-cabinet-library';
const DATABASE_VERSION = 1;
const DOWNLOADS_STORE = 'downloads';
const FAVORITES_STORE = 'favorites';

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

export default class ImpulseResponseLibrary {
  constructor({indexedDBImpl = globalThis.indexedDB} = {}) { this.indexedDB = indexedDBImpl; this._database = null; }
  get available() { return Boolean(this.indexedDB); }

  async open() {
    if (!this.available) return null;
    if (this._database) return this._database;
    const request = this.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      for (const store of [DOWNLOADS_STORE, FAVORITES_STORE]) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, {keyPath: 'identity'});
      }
    };
    this._database = await requestResult(request);
    this._database.onversionchange = () => { this._database.close(); this._database = null; };
    return this._database;
  }

  async list(store) {
    const database = await this.open();
    if (!database) return [];
    const records = await requestResult(database.transaction(store, 'readonly').objectStore(store).getAll());
    return records.sort((a, b) => String(b.savedAt || b.downloadedAt || '').localeCompare(String(a.savedAt || a.downloadedAt || '')));
  }

  listDownloads() { return this.list(DOWNLOADS_STORE); }
  listFavorites() { return this.list(FAVORITES_STORE); }

  async put(store, record) {
    if (!record?.identity) throw new Error('An impulse-response identity is required');
    const database = await this.open();
    if (!database) return record;
    const transaction = database.transaction(store, 'readwrite');
    transaction.objectStore(store).put(record);
    await transactionDone(transaction);
    return record;
  }

  saveDownload(record) {
    if (!record?.bytes) throw new Error('Downloaded impulse-response data is required');
    return this.put(DOWNLOADS_STORE, {...record, downloadedAt: record.downloadedAt || new Date().toISOString()});
  }

  saveFavorite(asset) { return this.put(FAVORITES_STORE, {identity: asset.id, savedAt: new Date().toISOString(), asset}); }

  async delete(store, identity) {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(store, 'readwrite');
    transaction.objectStore(store).delete(identity);
    await transactionDone(transaction);
  }

  deleteDownload(identity) { return this.delete(DOWNLOADS_STORE, identity); }
  deleteFavorite(identity) { return this.delete(FAVORITES_STORE, identity); }

  async clearDownloads() {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(DOWNLOADS_STORE, 'readwrite');
    transaction.objectStore(DOWNLOADS_STORE).clear();
    await transactionDone(transaction);
  }

  close() { this._database?.close(); this._database = null; }
}

export {DATABASE_NAME, DATABASE_VERSION, DOWNLOADS_STORE, FAVORITES_STORE};
