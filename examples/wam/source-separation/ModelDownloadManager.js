export const modelKey = model => JSON.stringify([model.id, model.version, model.files.map(file => file.sha256)]);
export async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export class ModelDownloadManager extends EventTarget {
  constructor({cache, fetchImpl = globalThis.fetch.bind(globalThis), baseURL = import.meta.url, allowedOrigins = []}) {
    super(); this.cache = cache; this.fetch = fetchImpl; this.baseURL = baseURL;
    this.allowedOrigins = new Set([new URL(baseURL).origin, ...allowedOrigins]);
    this.tasks = new Map(); this.states = new Map();
  }
  validate(model) {
    if (!model?.id || !model.version || !model.license?.name || !model.license?.url || !model.files?.length) throw Error('Manifeste de modèle incomplet.');
    return model.files.map(file => {
      const url = new URL(file.url, this.baseURL);
      const local = url.origin === new URL(this.baseURL).origin;
      if (!this.allowedOrigins.has(url.origin) || (!local && url.protocol !== 'https:') || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error('Origine de téléchargement non autorisée.');
      if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size <= 0) throw Error('Taille ou hash du modèle invalide.');
      return {...file, url: url.href};
    });
  }
  notify(model, state) {
    const detail = {id: model.id, ...state}; this.states.set(model.id, detail);
    this.dispatchEvent(new CustomEvent('progress', {detail}));
  }
  async verifyRecord(model, record) {
    if (!record || record.files?.length !== model.files.length) return false;
    for (let i = 0; i < model.files.length; i++) {
      const bytes = record.files[i];
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength !== model.files[i].size || await sha256(bytes) !== model.files[i].sha256) return false;
    }
    return true;
  }
  async getStatus(model) {
    if (this.tasks.has(model.id)) return this.states.get(model.id) || {state: 'downloading'};
    const record = await this.cache.get(modelKey(model));
    if (!record) return {state: 'missing'};
    return {state: await this.verifyRecord(model, record) ? 'installed' : 'corrupt', size: record.size};
  }
  download(model) {
    if (this.tasks.has(model.id)) return this.tasks.get(model.id).promise;
    const controller = new AbortController();
    const task = {controller}; this.tasks.set(model.id, task);
    task.promise = this.run(model, controller.signal).finally(() => this.tasks.delete(model.id));
    return task.promise;
  }
  async run(model, signal) {
    try {
      const manifest = this.validate(model);
      this.notify(model, {state: 'checking'});
      if (await this.verifyRecord(model, await this.cache.get(modelKey(model)))) {
        this.notify(model, {state: 'installed', cached: true}); return;
      }
      const total = manifest.reduce((sum, file) => sum + file.size, 0);
      let received = 0; const files = [];
      this.notify(model, {state: 'downloading', received, total});
      for (const file of manifest) {
        signal.throwIfAborted();
        const response = await this.fetch(file.url, {signal, credentials: 'omit'});
        if (!response.ok || (response.url && !this.allowedOrigins.has(new URL(response.url).origin))) throw Error('Téléchargement refusé ou redirection non autorisée.');
        const reader = response.body?.getReader(); let bytes;
        if (reader) {
          const data = new Uint8Array(file.size); let offset = 0;
          const abortRead = () => { reader.cancel().catch(() => {}); };
          signal.addEventListener('abort', abortRead, {once: true});
          try {
            while (true) {
              signal.throwIfAborted();
              const {done, value} = await reader.read(); signal.throwIfAborted(); if (done) break;
              if (offset + value.length > file.size) throw Error('Le fichier dépasse la taille déclarée.');
              data.set(value, offset); offset += value.length; received += value.length;
              this.notify(model, {state: 'downloading', received, total});
            }
          } finally { signal.removeEventListener('abort', abortRead); await reader.cancel().catch(() => {}); reader.releaseLock(); }
          if (offset !== file.size) throw Error('Téléchargement incomplet.');
          bytes = data.buffer;
        } else { bytes = await response.arrayBuffer(); received += bytes.byteLength; }
        signal.throwIfAborted();
        this.notify(model, {state: 'verifying', received, total});
        if (bytes.byteLength !== file.size || await sha256(bytes) !== file.sha256) throw Error('Vérification SHA-256 échouée.');
        files.push(bytes);
      }
      signal.throwIfAborted();
      this.notify(model, {state: 'saving', received: total, total});
      await this.cache.put({key: modelKey(model), id: model.id, version: model.version, label: model.label,
        size: total, files, installedAt: new Date().toISOString()});
      this.notify(model, {state: 'installed', received: total, total});
    } catch (error) {
      this.notify(model, {state: signal.aborted ? 'cancelled' : 'error', message: error.name === 'QuotaExceededError' ? 'Espace de stockage insuffisant.' : error.message});
      throw error;
    }
  }
  cancel(id) { this.tasks.get(id)?.controller.abort(); }
  async remove(model) {
    const task = this.tasks.get(model.id);
    if (task) { this.cancel(model.id); await task.promise.catch(() => {}); }
    await this.cache.delete(modelKey(model)); this.notify(model, {state: 'missing'});
  }
}
