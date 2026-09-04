const DATABASE_NAME = 'nam-a2-wam';
const DATABASE_VERSION = 1;
const STORE_NAME = 'tone3000-downloads';

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

export default class Tone3000Downloads {
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
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, {keyPath: 'identity'});
      }
    };
    this._database = await requestResult(request);
    this._database.onversionchange = () => { this._database.close(); this._database = null; };
    return this._database;
  }

  async list() {
    const database = await this.open();
    if (!database) return [];
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    const downloads = await requestResult(request);
    return downloads.sort((a, b) => String(b.downloadedAt || '').localeCompare(String(a.downloadedAt || '')));
  }

  async save(download) {
    if (!download?.identity || !download?.text) throw new Error('A downloaded model identity and data are required');
    const database = await this.open();
    if (!database) return download;
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(download);
    await transactionDone(transaction);
    return download;
  }

  async delete(identity) {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(identity);
    await transactionDone(transaction);
  }

  async clear() {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    await transactionDone(transaction);
  }

  close() {
    this._database?.close();
    this._database = null;
  }
}

export {DATABASE_NAME, DATABASE_VERSION, STORE_NAME};
