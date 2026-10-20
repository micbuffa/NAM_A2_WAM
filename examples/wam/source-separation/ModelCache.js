const result = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// One record per complete model version: publication of all files is atomic.
export class ModelCache {
  constructor({indexedDB = globalThis.indexedDB} = {}) { this.indexedDB = indexedDB; }
  async open() {
    if (!this.indexedDB) throw Error('Le cache IndexedDB est indisponible dans ce navigateur.');
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        const request = this.indexedDB.open('nam-source-separation-models', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('models', {keyPath: 'key'});
        request.onsuccess = () => {
          request.result.onversionchange = () => { request.result.close(); this.database = null; };
          resolve(request.result);
        };
        request.onerror = () => { this.database = null; reject(request.error); };
        request.onblocked = () => { this.database = null; reject(Error('Fermez les autres onglets pour ouvrir le cache.')); };
      });
    }
    return this.database;
  }
  async list() { const db = await this.open(); return result(db.transaction('models').objectStore('models').getAll()); }
  async get(key) { const db = await this.open(); return result(db.transaction('models').objectStore('models').get(key)); }
  async write(operation) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('models', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || Error('Échec de stockage du modèle.'));
      operation(tx.objectStore('models'));
    });
  }
  put(record) { return this.write(store => store.put(record)); }
  delete(key) { return this.write(store => store.delete(key)); }
  async close() { const db = await this.database; db?.close(); this.database = null; }
}
