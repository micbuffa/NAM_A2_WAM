import {validateSegmentSeconds} from './SegmentSettings.js';
import {modelKey} from './ModelDownloadManager.js';

export class DemucsRunner {
  constructor({manager, workerFactory = () => new Worker(new URL('./demucs-worker.js', import.meta.url))}) {
    this.manager = manager; this.workerFactory = workerFactory;
  }
  async separate(model, channels, onProgress = () => {}, {segmentSeconds = 0} = {}) {
    validateSegmentSeconds(segmentSeconds);
    if (this.busy) throw Error('Une séparation est déjà en cours.');
    if (model.runtime !== 'demucs-ort-wasm' || channels.length !== 2 || channels.some(c => !(c instanceof Float32Array) || !c.every(Number.isFinite)) || !channels[0].length || channels[0].length !== channels[1].length || channels[0].length > 86400 * model.sampleRate) throw Error('Extrait stéréo 44,1 kHz requis (24 heures maximum).');
    this.busy = true; this.cancelled = false;
    try {
      onProgress({phase: 'cache', progress: 0});
      if ((await this.manager.getStatus(model)).state !== 'installed') throw Error('Téléchargez et vérifiez le modèle avant la séparation.');
      const record = await this.manager.cache.get(modelKey(model));
      if (this.cancelled) throw new DOMException('Annulé', 'AbortError');
      const results = []; let elapsedMs = 0, heapBytes = 0;
      // FT is a bag of four specialists. Terminate each Worker before loading
      // the next one so their multi-GiB WASM memories cannot accumulate.
      for (let index = 0; index < record.files.length; index++) {
        if (this.cancelled) throw new DOMException('Annulé', 'AbortError');
        const trackInfo = {totalTracks:model.roles.length, ...(record.files.length > 1 ? {trackIndex:index,trackRole:model.roles[index]} : {})};
        const result = await this.runFile(model, record.files[index], channels, data => onProgress({...data, modelIndex: index, totalModels: record.files.length, ...trackInfo}),segmentSeconds);
        elapsedMs += result.elapsedMs; heapBytes = Math.max(heapBytes, result.heapBytes);
        if (record.files.length === 1) results.push(...result.stems);
        else results.push(result.stems[index * 2], result.stems[index * 2 + 1]);
        const completed = record.files.length === 1 ? model.roles.map((_, i) => i) : [index];
        for (const trackIndex of completed) onProgress({phase:'track-complete',modelIndex:index,totalModels:record.files.length,trackIndex,totalTracks:model.roles.length,trackRole:model.roles[trackIndex]});
      }
      return {stems: results, sampleRate: model.sampleRate, elapsedMs, heapBytes, modelId: model.id, backend: 'wasm', roles: model.roles};
    } finally { this.worker?.terminate(); this.worker = null; this.reject = null; this.busy = false; }
  }
  async runFile(model, file, channels, onProgress, segmentSeconds) {
    try {
      return await new Promise((resolve, reject) => {
        let chunkInfo={};
        this.reject = reject; this.worker = this.workerFactory();
        this.worker.onerror = event => reject(Error(event.message || 'Échec du Worker WASM.'));
        this.worker.onmessage = ({data}) => {
          if (data.type === 'error' || data.msg === 'WASM_ERROR') reject(Error(data.message || 'Échec de l’inférence.'));
          else if (data.type === 'result') {
            if (data.stems?.length !== model.roles.length * 2 || data.stems.some(c => !(c instanceof Float32Array) || c.length !== channels[0].length || !c.every(Number.isFinite))) return reject(Error('Sorties de séparation invalides.'));
            resolve(data);
          } else if (data.type === 'progress') {chunkInfo=data;onProgress(data);}
          else if (data.msg === 'PROGRESS_UPDATE') onProgress({...chunkInfo,phase: 'inference', progress: data.data});
        };
        // Cache reads are copies; transfers release them here without altering IndexedDB.
        const left = channels[0].slice(), right = channels[1].slice();
        this.worker.postMessage({files: [file], left, right, targets: model.targets,segmentSeconds}, [file, left.buffer, right.buffer]);
      });
    } finally { this.worker?.terminate(); this.worker = null; this.reject = null; }
  }
  cancel() { this.cancelled = true; this.worker?.terminate(); this.reject?.(new DOMException('Annulé', 'AbortError')); }
}
