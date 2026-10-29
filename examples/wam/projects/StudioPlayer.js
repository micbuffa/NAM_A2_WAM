import {ProjectPlayer} from './ProjectPlayer.js';
import {trackGain} from './ProjectsModel.js';

// One host output and one transport. A transient separation deck and the
// persisted project never play together. Personal recordings remain untouched.
export class StudioPlayer extends EventTarget {
  constructor(context, options) {
    super();
    this.base = new ProjectPlayer(context, options);
    this.context = context;
    this.output = this.base.output;
    for (const type of ['load', 'error']) this.base.addEventListener(type, ({detail}) => this.dispatchEvent(new CustomEvent(type, {detail})));
    // Live routing and preset changes still matter while preview audio plays.
    this.base.addEventListener('statechange', () => this.changed());
    this.previewChanged = () => this.changed();
    this.previewError = ({detail}) => this.dispatchEvent(new CustomEvent('error', {detail: {error: detail}}));
  }
  get channels() { return this.base.channels; }
  get liveId() { return this.base.liveId; }
  get playing() { return this.preview ? Boolean(this.preview.playing || this.preview.waiting || this.preview.starting) : this.base.playing; }
  get waiting() { return Boolean(this.preview?.waiting); }
  get duration() { return this.preview ? this.preview.duration : this.base.duration; }
  get availableDuration() { return this.preview ? this.preview.availableDuration : this.base.duration; }
  get ready() { return this.preview ? this.preview.availableFrames > 0 : this.base.duration > 0 && (!this.savedStemIds?.length || this.savedStemIds.every(id => this.base.channels.get(id)?.buffer)); }
  get position() { return this.preview ? this.preview.position : this.base.position; }
  get loop() { return this.preview ? this.previewLoop : this.base.loop; }
  setTracks(tracks, liveId) { this.savedStemIds = tracks.filter(track => track.origin === 'stem' && track.audio).map(track => track.id); this.base.setTracks(tracks, liveId); }
  retryFailed() { return this.base.retryFailed(); }
  setInsert(id, insert) { this.base.setInsert(id, insert); }
  setLiveInput(node) { this.base.setLiveInput(node); }
  play() { if (this.recordingLock) return; if (this.ready) return (this.preview ?? this.base).play(); }
  pause() { if (this.recordingLock) return; return (this.preview ?? this.base).pause(); }
  stop() {
    if (this.recordingLock) return;
    if (!this.preview) return this.base.stop();
    this.preview.pause();
    this.preview.seek(this.previewLoop.enabled ? this.previewLoop.start : 0);
  }
  seek(seconds) { if (this.recordingLock) return; return (this.preview ?? this.base).seek(seconds); }
  setLoop(changes) {
    if (this.recordingLock) return;
    if (!this.preview) return this.base.setLoop(changes);
    const next = {...this.previewLoop, ...changes};
    const [start, end] = [next.start, next.end].map(value => Math.max(0, Math.min(this.duration, Number(value) || 0))).sort((a,b) => a-b);
    const resume = this.playing || this.waiting;
    this.preview.pause();
    this.previewLoop = {...next, start, end};
    this.preview.loop = Boolean(next.enabled && end - start >= .05);
    this.preview.loopRegion = end > start ? {start, end} : null;
    this.preview.regionCache = null;
    this.changed();
    if (resume) return this.preview.play();
  }
  setPreview(engine, tracks = []) {
    if (engine === this.preview) return this.syncPreview(tracks);
    const position = this.position;
    this.base.pause();
    if (this.preview) {
      this.preview.pause();
      this.preview.removeEventListener('statechange', this.previewChanged);
      this.preview.removeEventListener('player-error', this.previewError);
      this.preview.outputNode.disconnect(this.output);
    }
    this.preview = engine;
    if (engine) {
      engine.pause();
      engine.loop = false;
      engine.loopRegion = null;
      this.previewLoop = {enabled: false, start: 0, end: 0};
      engine.outputNode.connect(this.output);
      engine.addEventListener('statechange', this.previewChanged);
      engine.addEventListener('player-error', this.previewError);
      engine.seek(position);
      this.syncPreview(tracks);
    } else this.base.seek(position);
    this.changed();
  }
  syncPreview(tracks) {
    if (!this.preview) return;
    // Keep the exact Studio 0..100 fader curve; normalization is a fixed
    // factor here, not audio normalization or a second master volume.
    this.preview.normalizationNode.gain.value = 2;
    this.preview.sync(tracks.map(track => ({id: track.streamId, volume: trackGain(track, tracks) / 2, pan: track.pan / 100, muted: false, solo: false})));
  }
  changed() { this.dispatchEvent(new Event('statechange')); }
  destroy() { this.setPreview(null); this.base.destroy(); }
}
