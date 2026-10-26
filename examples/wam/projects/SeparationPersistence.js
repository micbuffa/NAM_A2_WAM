import {wavHeader} from './StemWav.js';

// Copies only one published stereo packet at a time to the encoder Worker.
// Native Blob parts avoid a whole-song merge or PCM interleaving on the UI.
export class StemEncoder {
  constructor(workerFactory = () => new Worker(new URL('./stem-wav-worker.js', import.meta.url), {type:'module'})) { this.workerFactory = workerFactory; }
  async encode(result, index) {
    const frames = result.engine.availableFrames, parts = [wavHeader(frames)], worker = this.workerFactory();
    try {
      for (const chunk of result.engine.chunks) {
        const buffer = chunk.tracks[index].buffer;
        const left = buffer.getChannelData(0).slice(), right = buffer.getChannelData(1).slice();
        parts.push(await new Promise((resolve, reject) => {
          worker.onmessage = ({data}) => data.error ? reject(Error(data.error)) : resolve(data.bytes);
          worker.onerror = event => reject(Error(event.message || 'WAV encoding failed'));
          worker.postMessage({left, right}, [left.buffer, right.buffer]);
        }));
      }
      return new Blob(parts, {type:'audio/wav'});
    } finally { worker.terminate(); }
  }
}
export function resultManifest(result, model, backend) {
  return {modelId: model.id, modelVersion: model.version, modelHashes: model.files.map(file=>file.sha256), roles: model.roles,
    webnnEvidence:result.webnnEvidence ?? null, backend, requestedBackend: result.requestedBackend, sampleRate:44100, frames:result.engine.availableFrames,
    sourceFrames:result.sourceFrames ?? result.totalFrames, excerptSeconds:result.excerptSeconds ?? 0, totalFrames:result.totalFrames, partial:Boolean(result.engine.partial)};
}
export class SeparationPersistence {
  constructor({api, encoder = new StemEncoder(), token = () => crypto.randomUUID()}) { Object.assign(this,{api,encoder,token}); }
  async save(result, model, backend, onProgress = () => {}) {
    if (!result.engine.complete || !result.engine.availableFrames) throw Error('Wait for separation to finish or stop it before saving.');
    result.saveToken ??= this.token();
    const staged = await this.api.createSeparation(result.projectId, {token:result.saveToken, sourceTrackId:result.sourceId, manifest:resultManifest(result,model,backend)});
    result.stagingId = staged.id;
    if (staged.state !== 'ready') {
      for (let index=0; index<result.tracks.length; index++) {
        const track = result.tracks[index], role = model.roles[index];
        onProgress({index,total:result.tracks.length,role,phase:'encoding'});
        const audio = staged.uploadedRoles.includes(role) ? null : await this.encoder.encode(result,index);
        onProgress({index,total:result.tracks.length,role,phase:'uploading'});
        const count = Math.max(1,Math.ceil(track.peaks.length * result.engine.availableFrames / result.totalFrames));
        await this.api.uploadSeparationPart(result.projectId,staged.id,role,{volume:track.volume,pan:track.pan,mute:track.mute,solo:track.solo,peaks:JSON.stringify(Array.from(track.peaks.subarray(0,count)))},audio);
      }
    }
    return this.api.publishSeparation(result.projectId,staged.id);
  }
}
