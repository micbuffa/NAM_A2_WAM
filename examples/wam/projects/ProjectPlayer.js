// Playback of a project: each track's audio file is fetched and decoded once,
// then all tracks start from one clock, each through its own gain (volume,
// mute, solo) and pan. The host connects `output`. Tracks may differ in length:
// the project ends with its longest track.
//
// A track can play through an insert (a guitar or bass track's preset rack):
//   playback ─► insert.input ─┐
//   live ─────► insert.live ──┴─► insert.output ─► gain ─► pan ─► output
// The live guitar plays through one track (liveTrackId()): with input
// monitoring it replaces the track's recorded part; the selected track plays
// it over its recording, once its preset rack is in.
import {trackGain} from './ProjectsModel.js';

const START_DELAY = 0.03; // seconds: lets every track start on the same sample
const RAMP = 0.01;

// Identifies a track's file: replacing the file reloads it, other edits do not.
const disconnect = (from, to) => { try { from.disconnect(to); } catch { /* Not connected. */ } };

const audioKey = (audio) => (audio ? [audio.url, audio.byteSize, audio.filename].join('|') : null);

export class ProjectPlayer extends EventTarget {
  // fetchAudio(url) -> Promise<Response>
  constructor(context, {fetchAudio = (url) => fetch(url, {credentials: 'same-origin'})} = {}) {
    super();
    Object.assign(this, {context, fetchAudio});
    this.output = context.createGain();
    this.channels = new Map(); // track id -> {playback, gain, pan, insert, key, buffer, voice, monitoring}
    this.liveInput = null; // the live guitar
    this.liveTrack = null; // the track it plays through (liveTrackId())
    this.offset = 0;
    this.startedAt = 0;
    this.playing = false;
    this.generation = 0;
  }

  get duration() {
    return Math.max(0, ...[...this.channels.values()].map((channel) => channel.buffer?.duration ?? 0));
  }

  get position() {
    if (!this.playing) return this.offset;
    return Math.min(this.duration, this.offset + Math.max(0, this.context.currentTime - this.startedAt));
  }

  // The track the live guitar plays through now, if any: a monitoring track
  // (dry without its preset), a selected one once its preset rack is in.
  get liveId() {
    const channel = this.channels.get(this.liveTrack);
    return channel && (channel.insert || channel.monitoring) ? this.liveTrack : null;
  }

  // The project's tracks (ids, audio and mix) and the track the live guitar
  // plays through. Removed tracks stop; new or replaced files load in the
  // background ("load" / "error" events).
  setTracks(tracks, liveTrack = null) {
    this.liveTrack = liveTrack;
    const ids = new Set(tracks.map((track) => track.id));
    for (const [id, channel] of this.channels) if (!ids.has(id)) this.remove(id, channel);
    const now = this.context.currentTime;
    for (const track of tracks) {
      let channel = this.channels.get(track.id);
      if (!channel) {
        channel = {playback: this.context.createGain(), gain: this.context.createGain(), pan: this.context.createStereoPanner(),
          insert: null, key: null, buffer: null, voice: null, monitoring: false};
        channel.playback.connect(channel.gain).connect(channel.pan).connect(this.output);
        this.channels.set(track.id, channel);
      }
      channel.monitoring = Boolean(track.inputMonitoring);
      channel.playback.gain.setTargetAtTime(channel.monitoring ? 0 : 1, now, RAMP);
      channel.gain.gain.setTargetAtTime(trackGain(track, tracks), now, RAMP);
      channel.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, track.pan / 100)), now, RAMP);
      const key = audioKey(track.audio);
      if (key !== channel.key) {
        channel.key = key;
        this.stopVoice(channel);
        channel.buffer = null;
        if (key) void this.load(track.id, channel, track.audio.url);
      }
    }
    if (!this.channels.size) this.stop();
    this.routeLive();
    this.changed();
  }

  // Routes a track through an insert {input, live, output} (null: dry).
  setInsert(id, insert) {
    const channel = this.channels.get(id);
    if (!channel || channel.insert === insert) return;
    this.unrouteLive();
    if (channel.insert) {
      disconnect(channel.playback, channel.insert.input);
      disconnect(channel.insert.output, channel.gain);
    } else {
      disconnect(channel.playback, channel.gain);
    }
    channel.insert = insert;
    if (insert) {
      channel.playback.connect(insert.input);
      insert.output.connect(channel.gain);
    } else {
      channel.playback.connect(channel.gain);
    }
    this.routeLive();
    this.changed(); // liveId may have changed
  }

  // The live guitar node (SourceManager's trimmed input); null disconnects it.
  setLiveInput(node) {
    if (node === this.liveInput) return;
    this.unrouteLive();
    this.liveInput = node;
    this.routeLive();
  }

  // Connects the live guitar to the monitoring track (unchanged connections stay).
  routeLive() {
    const channel = this.channels.get(this.liveId);
    const target = this.liveInput && channel ? channel.insert?.live ?? channel.gain : null;
    if (target === this.liveTarget) return;
    this.unrouteLive();
    if (target) this.liveInput.connect(target);
    this.liveTarget = target;
  }

  unrouteLive() {
    if (this.liveInput && this.liveTarget) disconnect(this.liveInput, this.liveTarget);
    this.liveTarget = null;
  }

  async load(id, channel, url) {
    const {key} = channel;
    try {
      const response = await this.fetchAudio(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      if (this.channels.get(id) !== channel || channel.key !== key) return;
      channel.buffer = buffer;
      if (this.playing) this.startVoice(channel, this.context.currentTime + START_DELAY, this.position + START_DELAY);
      this.dispatchEvent(new CustomEvent('load', {detail: {id, buffer}}));
      this.changed();
    } catch (error) {
      if (this.channels.get(id) !== channel || channel.key !== key) return;
      this.dispatchEvent(new CustomEvent('error', {detail: {id, error}}));
    }
  }

  async play() {
    if (this.playing || !this.duration) return;
    const generation = ++this.generation;
    await this.context.resume();
    if (generation !== this.generation || this.playing) return;
    if (this.offset >= this.duration) this.offset = 0;
    this.startedAt = this.context.currentTime + START_DELAY;
    this.playing = true;
    for (const channel of this.channels.values()) this.startVoice(channel, this.startedAt, this.offset);
    this.changed();
  }

  pause() {
    ++this.generation;
    if (!this.playing) return;
    this.offset = this.position;
    this.playing = false;
    for (const channel of this.channels.values()) this.stopVoice(channel);
    this.changed();
  }

  // Back to the start (the transport's "Return to start").
  stop() {
    this.pause();
    this.offset = 0;
    this.changed();
  }

  seek(seconds) {
    const playing = this.playing;
    this.pause();
    this.offset = Math.max(0, Math.min(this.duration, Number(seconds) || 0));
    this.changed();
    if (playing) return this.play();
  }

  startVoice(channel, when, offset) {
    if (!channel.buffer || offset >= channel.buffer.duration) return;
    const source = this.context.createBufferSource();
    source.buffer = channel.buffer;
    source.connect(channel.playback);
    source.onended = () => {
      if (channel.voice !== source) return;
      channel.voice = null;
      source.disconnect();
      // The longest track has ended: the project stops at its end.
      if (this.playing && ![...this.channels.values()].some((entry) => entry.voice)) {
        this.offset = this.duration;
        this.playing = false;
        this.changed();
      }
    };
    source.start(when, offset);
    channel.voice = source;
  }

  stopVoice(channel) {
    const source = channel.voice;
    if (!source) return;
    channel.voice = null;
    source.onended = null;
    try { source.stop(); } catch { /* Not started yet. */ }
    source.disconnect();
  }

  remove(id, channel) {
    this.stopVoice(channel);
    if (id === this.liveId) this.unrouteLive();
    if (channel.insert) disconnect(channel.insert.output, channel.gain);
    channel.playback.disconnect();
    channel.gain.disconnect();
    channel.pan.disconnect();
    this.channels.delete(id);
  }

  changed() { this.dispatchEvent(new Event('statechange')); }

  destroy() {
    this.stop();
    for (const [id, channel] of this.channels) this.remove(id, channel);
    this.output.disconnect();
  }
}
