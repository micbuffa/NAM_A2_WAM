const finite = (value, min, max) => {
  if (!Number.isFinite(Number(value))) throw Error('Valeur audio invalide.');
  return Math.max(min, Math.min(max, Number(value)));
};

// One clock and one scheduled start for all stems. Host owns the final routing.
export class MultitrackEngine extends EventTarget {
  constructor(context) {
    super();
    this.context = context; this.outputNode = context.createGain();
    this.normalizationNode=context.createGain();this.normalizationNode.connect(this.outputNode);this.normalizationGain=1;this.normalizationNode.gain.value=1;this.audioVersion=0;
    this.tracks = []; this.voices = []; this.offset = 0; this.playing = false;
    this.loop = true; this.generation = 0;
    this.contextChanged = () => this.changed();
    context.addEventListener?.('statechange', this.contextChanged);
  }
  setNormalizationGain(value) {
    if(!Number.isFinite(value)||value<=0||value>10**(24/20))throw Error('Gain de normalisation invalide.');
    this.normalizationGain=value;const param=this.normalizationNode.gain,now=this.context.currentTime;
    param.cancelScheduledValues?.(now);
    if(this.playing)param.setTargetAtTime(value,now,.01);
    else if(param.setValueAtTime)param.setValueAtTime(value,now);
    else param.value=value;
    this.changed();
  }
  changed() { this.dispatchEvent(new Event('statechange')); }
  get ready() { return !this.destroyed && !!this.tracks.length && !this.preparing && !this.starting && (!this.context.state || this.context.state === 'running'); }
  async prepare() {
    if (this.destroyed) throw Error('Lecteur fermé.');
    if (this.pendingResume) return this.pendingResume;
    this.preparing = true; this.changed();
    let resume;
    try { resume = this.context.resume(); }
    catch (error) { this.preparing = false; this.changed(); throw error; }
    this.pendingResume = Promise.resolve(resume).then(() => {
      if (this.context.state === 'closed') throw Error('Le moteur audio est fermé.');
    }).finally(() => { this.pendingResume = null; this.preparing = false; this.changed(); });
    return this.pendingResume;
  }
  get duration() { return this.tracks[0]?.buffer.duration || 0; }
  get position() {
    let value = this.offset + (this.playing ? Math.max(0, this.context.currentTime - this.startedAt) : 0);
    if (this.playing && this.loop && this.duration) {
      const {start,end}=this.loopBounds;
      if(value>=end)value=start+(value-start)%(end-start);
    }
    return Math.min(value, this.duration);
  }
  get loopBounds() { return this.loopRegion || {start:0,end:this.duration}; }
  setLoopRegion(start,end) {
    start=finite(start,0,this.duration);end=finite(end,0,this.duration);
    if(end-start<1/(this.tracks[0]?.buffer?.sampleRate||44100))throw Error('B doit être supérieur à A.');
    const resume=this.playing||this.waiting;this.pause();this.loopRegion={start,end};
    if(this.loop&&(this.offset<start||this.offset>=end))this.offset=start;
    this.changed();if(resume)return this.play();
  }
  resetLoopRegion() {
    const resume=this.playing||this.waiting;this.pause();this.loopRegion=null;this.changed();if(resume)return this.play();
  }
  load(tracks) {
    if (!tracks.length || tracks.some(t => !t.buffer || t.buffer.length !== tracks[0].buffer.length || t.buffer.sampleRate !== tracks[0].buffer.sampleRate)) throw Error('Les pistes doivent être alignées.');
    this.stop(); this.loopRegion=null;this.audioVersion++; this.tracks = tracks; this.changed();
  }
  releaseVoices() {
    for (const voice of this.voices) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch {}
      voice.source.disconnect(); voice.gain.disconnect(); voice.pan.disconnect();
    }
    this.voices = [];
  }
  async play() {
    if (this.destroyed || !this.tracks.length || this.playing || this.starting) return;
    const generation = ++this.generation; this.starting = true; this.changed();
    try {
    await this.prepare();
    if (this.destroyed || generation !== this.generation) return;
    if (this.offset >= this.duration) this.offset = 0;
    if(this.loop && (this.offset<this.loopBounds.start||this.offset>=this.loopBounds.end))this.offset=this.loopBounds.start;
    this.startedAt = this.context.currentTime + .03;
    this.playing = true;
    this.voices = this.tracks.map(track => {
      const source = this.context.createBufferSource(), gain = this.context.createGain(), pan = this.context.createStereoPanner();
      source.buffer = track.buffer; source.loop = this.loop;source.loopStart=this.loopBounds.start;source.loopEnd=this.loopBounds.end;
      source.connect(gain).connect(pan).connect(this.normalizationNode);
      source.start(this.startedAt, this.offset);
      return {id: track.id, source, gain, pan};
    });
    this.voices[0].source.onended = () => {
      if (!this.loop && this.playing) { this.offset = this.duration; this.playing = false; this.releaseVoices(); this.changed(); }
    };
    this.sync(this.mixTracks || []);
    } finally { this.starting = false; this.changed(); }
  }
  pause() { ++this.generation; this.offset = this.position; this.playing = false; this.releaseVoices(); this.changed(); }
  stop() { this.pause(); this.offset = 0; this.changed(); }
  seek(seconds) { const value = finite(seconds, 0, this.duration), resume = this.playing; this.pause(); this.offset = value; if (resume) return this.play(); }
  setLoop(enabled) {
    const position = this.position;
    this.loop = !!enabled; this.offset = position;
    if (this.playing) this.startedAt = this.context.currentTime;
    for (const voice of this.voices) voice.source.loop = this.loop;
    if(this.loop&&this.loopRegion&&(position<this.loopBounds.start||position>=this.loopBounds.end))return this.seek(this.loopBounds.start);
    this.changed();
  }
  sync(tracks) {
    this.mixTracks = tracks; const hasSolo = tracks.some(t => t.solo);
    for (const voice of this.voices) {
      const track = tracks.find(t => t.id === voice.id);
      const volume = track && !track.muted && (!hasSolo || track.solo) ? finite(track.volume, 0, 1.5) : 0;
      voice.gain.gain.setTargetAtTime(volume, this.context.currentTime, .01);
      voice.pan.pan.setTargetAtTime(track ? finite(track.pan, -1, 1) : 0, this.context.currentTime, .01);
    }
  }
  destroy() { this.stop(); this.destroyed = true; this.tracks = []; this.context.removeEventListener?.('statechange', this.contextChanged); this.normalizationNode.disconnect();this.outputNode.disconnect(); this.changed(); }
}
