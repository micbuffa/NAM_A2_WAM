import {timelineTracks} from './ProjectsModel.js';
import {backendLabel, isWebNN, WEBNN_BACKENDS, validateWebNNSelection} from '../source-separation/StudioWebNN.js';
import {ModelCache} from '../source-separation/ModelCache.js';
import {ModelDownloadManager} from '../source-separation/ModelDownloadManager.js';
import {detectCapabilities} from '../source-separation/Capabilities.js';
import {OnnxDemucsRunner} from '../source-separation/OnnxDemucsRunner.js';
import {PreparedDemucsRunner} from '../source-separation/PreparedDemucsRunner.js';
import {ProgressiveMultitrackEngine} from '../source-separation/ProgressiveMultitrackEngine.js';
import {makeTracks} from '../source-separation/AudioData.js';

export const STEM_NAMES = {drums: 'Drums', bass: 'Bass', other: 'Other', vocals: 'Vocals', guitar: 'Guitar', piano: 'Piano'};
export const PRODUCT_MODELS = ['htdemucs_4s_onnx', 'bs_roformer_sw_6s'];
export const separationSources = tracks => tracks.filter(track => !track.removedAt && track.audio?.url && ['original', 'legacy'].includes(track.origin ?? 'legacy'));
const abort = () => new DOMException('Stopped', 'AbortError');
let nextTrackId = -1;

// The model cache is persistent; working PCM and the mix are RAM-only in P5.2.
// No account API writes occur here. Workers own inference, validation and peaks.
export class StudioSeparation extends EventTarget {
  constructor({context, player, manager = new ModelDownloadManager({cache: new ModelCache(),
    allowedOrigins: ['https://media.githubusercontent.com', 'https://huggingface.co', 'https://us.aws.cdn.hf.co', 'https://cas-bridge.xethub.hf.co', 'https://cdn-lfs.hf.co', 'https://cdn-lfs-us-1.hf.co']}),
    runners, engineFactory = context => new ProgressiveMultitrackEngine(context),
    capabilities = detectCapabilities, fetchAudio = (url, options) => fetch(url, {...options, credentials: 'same-origin'}),
    decode = bytes => new OfflineAudioContext(2, 1, 44100).decodeAudioData(bytes),
    loadModels = async () => { const response = await fetch(new URL('../source-separation/studio-models.json', import.meta.url)); if (!response.ok) throw Error('Model catalogue unavailable'); return (await response.json()).models; }}) {
    super();
    Object.assign(this, {context, player, manager, engineFactory, capabilities, fetchAudio, decode, loadModels});
    this.runners = runners ?? {
      demucs: new OnnxDemucsRunner({manager, keepAlive: true}),
      roformer: new PreparedDemucsRunner({manager, workerFactory: () => new Worker(new URL('../source-separation/roformer-worker.js', import.meta.url), {type: 'module'})}),
    };
    this.epoch = 0;
    this.models = [];
    this.backend = 'wasm';
    this.status = 'Choose accompaniment audio to separate.';
    this.mode = 'original';
    this.manager.addEventListener('progress', ({detail}) => {
      if (!this.busy || detail.id !== this.model?.id) return;
      const percent = detail.total ? Math.min(100, Math.floor(detail.received / detail.total * 100)) : null;
      this.setStatus(detail.state === 'downloading' ? `Downloading model${percent === null ? '' : ` · ${percent}%`}`
        : ({checking: 'Checking model cache…', verifying: 'Verifying model SHA-256…', saving: 'Saving model cache…', installed: 'Model downloaded · preparing…'}[detail.state] ?? this.status), percent);
    });
  }
  get model() { return this.models.find(model => model.id === this.modelId); }
  get viewTracks() { return this.mode === 'stems' ? this.result?.tracks ?? this.savedTracks : null; }
  get hasAudio() { return Boolean(this.result?.engine.availableFrames || (!this.result && this.savedTracks?.length)); }
  changed() { this.dispatchEvent(new Event('change')); }
  setStatus(status, progress = null) { this.status = status; this.progress = progress; this.changed(); }
  async init() {
    const [models, capabilities] = await Promise.all([this.loadModels(), this.capabilities()]);
    this.models = PRODUCT_MODELS.map(id => models.find(model => model.id === id));
    if (this.models.some(model => !model)) throw Error('Incomplete Studio model catalogue');
    this.modelId = this.savedBatches?.find(batch => batch.id === this.activeSavedId)?.manifest.modelId ?? PRODUCT_MODELS[0];
    this.gpu = capabilities.webgpu;
    this.backend = this.gpu ? 'webgpu' : 'wasm';
    if (!this.activeSavedId) this.setStatus('Choose accompaniment audio, then Separate instruments.');
  }
  // Invalidates every async callback before terminating workers. A late decode,
  // cache lookup or old worker message cannot publish into a different project.
  stop({reset = false} = {}) {
    ++this.epoch;
    this.abortController?.abort();
    for (const runner of Object.values(this.runners)) runner.cancel();
    for (const id of this.manager.tasks.keys()) this.manager.cancel(id);
    if (this.result && !this.result.engine.complete) this.result.engine.finish(true);
    this.busy = false;
    if (reset) {
      this.clearResult();
    }
    this.setStatus(reset ? 'Ready for a new separation.' : this.hasAudio ? 'Separation stopped · partial result kept in RAM.' : 'Separation stopped.');
  }
  clearResult() {
    this.player.setPreview(null);
    this.result?.engine.destroy();
    this.result = null;
    this.mode = 'original';
    this.effectiveBackend = null;
  }
  configure(modelId, backend) {
    if (!this.models.some(model => model.id === modelId) || !['webgpu', 'wasm', ...WEBNN_BACKENDS].includes(backend) || (backend === 'webgpu' && !this.gpu)) throw Error('Unavailable model or backend');
    validateWebNNSelection(modelId, backend);
    this.stop({reset: true});
    this.modelId = modelId;
    this.backend = backend;
    this.setStatus(`${this.model.label} · ${backendLabel(backend)} · ready to download or use cache.`);
  }
  show(mode) {
    if (!['original', 'stems'].includes(mode) || (mode === 'stems' && !this.result && !this.savedTracks?.length)) return;
    this.mode = mode;
    this.player.setPreview(mode === 'stems' && this.result ? this.result.engine : null, this.result?.tracks);
    this.changed();
  }
  restore(project) {
    this.savedBatches = project?.separations ?? [];
    this.projectTracks = project?.tracks ?? [];
    this.savedProject = project;
    this.selectSaved(project?.activeSeparationId);
  }
  selectSaved(id) {
    this.activeSavedId = this.savedBatches.find(batch => batch.id === Number(id) && batch.state === 'ready')?.id ?? null;
    if (this.savedProject) this.savedProject = {...this.savedProject,activeSeparationId:this.activeSavedId};
    this.savedTracks = timelineTracks(this.savedProject);
    if (!this.savedTracks.length) this.savedTracks = null;
    this.mode = this.savedTracks?.length ? 'stems' : 'original';
    const batch = this.savedBatches.find(batch => batch.id === this.activeSavedId);
    if (batch && PRODUCT_MODELS.includes(batch.manifest.modelId)) this.modelId = batch.manifest.modelId;
    this.setStatus(batch ? `Saved project · ${this.savedTracks?.length ?? 0} tracks · ${backendLabel(batch.manifest.backend)} · ${(batch.manifest.frames / 44100).toFixed(1)} s${batch.manifest.partial ? ' · interrupted result' : ''}` : 'Choose accompaniment audio to separate.');
  }
  updateTrack(id, fields) {
    const track = this.result?.tracks.find(track => track.id === id);
    if (!track) return false;
    for (const key of ['volume', 'pan', 'mute', 'solo']) if (key in fields) track[key] = fields[key];
    this.player.syncPreview(this.result.tracks);
    return true;
  }
  async run({track, seconds = 0, projectId}) {
    if (this.busy) return;
    if (!this.model || !separationSources([track]).length || ![0, 5, 10, 30, 60].includes(seconds)) throw Error('Choose an accompaniment audio file.');
    if (this.result) this.clearResult();
    const epoch = ++this.epoch, model = this.model;
    const current = () => { if (epoch !== this.epoch) throw abort(); };
    this.abortController = new AbortController();
    this.busy = true;
    this.effectiveBackend = this.backend;
    this.player.pause();
    this.setStatus('Reading accompaniment audio…');
    try {
      const response = await this.fetchAudio(track.audio.url, {signal: this.abortController.signal});
      if (!response.ok) throw Error(`Audio HTTP ${response.status}`);
      const bytes = await response.arrayBuffer(); current();
      const audio = await this.decode(bytes); current();
      if (audio.sampleRate !== 44100 || !audio.length) throw Error('Audio must decode at 44.1 kHz.');
      const length = seconds ? Math.min(audio.length, seconds * 44100) : audio.length;
      if (length > 86400 * 44100) throw Error('Audio exceeds 24 hours.');
      const channels = [audio.getChannelData(0).slice(0, length), audio.getChannelData(Math.min(1, audio.numberOfChannels - 1)).slice(0, length)];
      this.setStatus('Checking model cache…');
      await this.manager.download(model); current();
      const engine = this.engineFactory(this.context);
      engine.startStream({roles: model.roles, totalFrames: length});
      const tracks = model.roles.map((role, index) => ({id: nextTrackId--, streamId: `${role}-${index}`, name: STEM_NAMES[role], origin: 'stem',
        instrument: role === 'piano' ? 'keys' : role, volume: 80, pan: 0, mute: false, solo: false, inputMonitoring: false,
        audio: {filename: `${STEM_NAMES[role]} · in RAM`}, peaks: new Float32Array(Math.min(2048, length))}));
      this.result = {engine, tracks, projectId, sourceId: track.id, modelId: model.id, requestedBackend: this.backend, sourceFrames: audio.length, excerptSeconds: seconds, totalFrames: length};
      this.show('stems');
      const progress = data => {
        current();
        if (data.backend) this.effectiveBackend = data.backend;
        if (data.phase === 'fallback') this.setStatus(`Experimental/GPU backend unavailable · switching to CPU / WASM (${data.message})`);
        else if (data.phase === 'load') this.setStatus(`Loading model · ${backendLabel(this.effectiveBackend)}…`);
        else if (data.phase === 'chunk-ready') this.setStatus(`Separating · ${Math.floor(data.completedFrames / data.totalFrames * 100)}% · ${(data.completedFrames / 44100).toFixed(1)} s ready`, data.completedFrames / data.totalFrames * 100);
        else if (data.phase === 'track-complete') this.setStatus(`Separation · track ${data.trackIndex + 1}/${data.totalTracks} · ${STEM_NAMES[data.trackRole]} · done!`, 100);
        else if (data.phase === 'validation') this.setStatus(`Checking experimental WebNN audio against WASM · segment ${data.chunkIndex + 1}/${data.totalChunks}…`, this.progress ?? 0);
        else if (data.phase === 'inference') this.setStatus(`Model loaded · separating${data.totalChunks ? ` · segment ${data.chunkIndex + 1}/${data.totalChunks}` : ''}…`, this.progress ?? 0);
      };
      let backend = this.backend;
      this.effectiveBackend = backend;
      const runner = model.runtime === 'bs-roformer-onnx' ? this.runners.roformer : this.runners.demucs;
      if (model.runtime === 'bs-roformer-onnx') {
        const prepare = backend => runner.prepare(model, backend, {onProgress: data => { current(); this.setStatus(`Loading model · stage ${data.completed}/${data.total}`, data.completed / data.total * 100); }});
        this.setStatus('Loading model and preparing first inference…');
        try { await prepare(backend); }
        catch (error) {
          current();
          if (backend !== 'webgpu' || error.name === 'AbortError') throw error;
          backend = 'wasm';
          this.setStatus('GPU preparation failed · loading CPU / WASM fallback…');
          await prepare(backend);
        }
        current();
      }
      const result = await runner.separate(model, channels, {backend, fallback: true, onProgress: progress, onChunk: data => {
        current();
        if (data.peaks?.length !== tracks.length || data.peaks.some((peaks, i) => !(peaks instanceof Float32Array) || peaks.length !== tracks[i].peaks.length || !peaks.every(Number.isFinite))) throw Error('Worker waveform envelope invalid');
        if (data.evidence) this.result.webnnEvidence = data.evidence;
        engine.append(data.startFrame, makeTracks(this.context, data));
        for (let i = 0; i < tracks.length; i++) {
          const peaks = data.peaks?.[i];
          if (!peaks) throw Error('Worker waveform envelope missing');
          for (let bin = 0; bin < peaks.length; bin++) tracks[i].peaks[bin] = Math.max(tracks[i].peaks[bin], peaks[bin]);
        }
        this.dispatchEvent(new Event('audio'));
      }});
      current();
      engine.finish();
      this.result.webnnEvidence = result.evidence ?? null;
      this.result.fallbackReason = result.fallbackReason ?? null;
      this.effectiveBackend = result.backend ?? backend;
      this.setStatus(`Done · ${model.roles.length} instruments · ${backendLabel(this.effectiveBackend)}${result.fallbackReason ? ` (fallback: ${result.fallbackReason})` : ''} · in RAM, not saved to account.`, 100);
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (this.result && !this.result.engine.complete) this.result.engine.finish(true);
      this.setStatus(`${error.name === 'AbortError' ? 'Separation stopped.' : `Separation failed: ${error.message}`}${this.hasAudio ? ' Partial result kept in RAM.' : ''}`);
    } finally {
      if (epoch === this.epoch) { this.busy = false; this.changed(); }
    }
  }
}
