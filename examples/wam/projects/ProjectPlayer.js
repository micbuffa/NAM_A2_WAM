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
// it while stopped, once its preset rack is in. Ordinary Play auditions the
// recorded audio exclusively on these track channels; recording keeps monitoring.
//
// A loop (setLoop) replays one region of every track: each turn restarts all
// tracks together on the audio clock, scheduled slightly ahead, so tracks of
// any length stay aligned (a track shorter than the region is silent until
// the next turn). With the loop on, playing from outside the region starts
// at the region's start.
import {trackGain} from './ProjectsModel.js';

const START_DELAY = 0.03; // seconds: lets every track start on the same sample
const RAMP = 0.01;
const LOOKAHEAD = 0.25; // seconds: the next loop turn is scheduled this early
export const MIN_LOOP = 0.05; // seconds: a shorter region does not loop

// Identifies a track's file: replacing the file reloads it, other edits do not.
const disconnect = (from, to) => { try { from.disconnect(to); } catch { /* Not connected. */ } };

const audioKey = (audio) => (audio ? [audio.url, audio.byteSize, audio.filename].join('|') : null);

export class ProjectPlayer extends EventTarget {
  // fetchAudio(url) -> Promise<Response>; timers: {setTimeout, clearTimeout} (tests).
  constructor(context, {fetchAudio = (url) => fetch(url, {credentials: 'same-origin'}), timers = globalThis, retryDelay = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
    super();
    Object.assign(this, {context, fetchAudio, timers, retryDelay});
    this.output = context.createGain();
    this.channels = new Map(); // track id -> {playback, gain, pan, insert, key, buffer, voices, monitoring}
    this.liveInput = null; // the live guitar
    this.liveTrack = null; // the track it plays through (liveTrackId())
    this.offset = 0;
    this.startedAt = 0;
    this.playing = false;
    this.generation = 0;
    this.loop = {enabled: false, start: 0, end: 0}; // seconds
    this.looping = false; // this playback wraps at the loop's end
    this.scheduledUntil = 0; // context time up to which loop turns are scheduled
    this.timer = null;
  }

  get duration() {
    return Math.max(this.recording ? this.offset + Math.max(0, this.context.currentTime - this.startedAt) : 0, ...[...this.channels.values()].map((channel) => channel.buffer?.duration ?? 0));
  }

  get position() {
    return this.playing ? this.positionAt(this.context.currentTime) : this.offset;
  }

  // Whether the loop is on and long enough to loop.
  get loopActive() {
    return this.loop.enabled && this.loop.end - this.loop.start >= MIN_LOOP;
  }

  // Position at a context time of the current playback, wrapped by the loop.
  positionAt(time) {
    const position = this.offset + Math.max(0, time - this.startedAt);
    const {start, end} = this.loop;
    if (this.looping && position >= end) return start + ((position - end) % (end - start));
    return this.recording ? position : Math.min(this.duration, position);
  }

  // Context time at which the loop turn playing at `time` ends.
  turnEnd(time) {
    const {start, end} = this.loop;
    const first = this.startedAt + end - this.offset;
    return time < first ? first : first + (Math.floor((time - first) / (end - start)) + 1) * (end - start);
  }

  // The loop region {enabled, start, end} in seconds; while playing, playback
  // restarts from where it is with the new region.
  setLoop({enabled = this.loop.enabled, start = this.loop.start, end = this.loop.end} = {}) {
    const [a, b] = [Number(start) || 0, Number(end) || 0].map((value) => Math.max(0, value)).sort((x, y) => x - y);
    const playing = this.playing;
    this.pause();
    this.loop = {enabled: Boolean(enabled), start: a, end: b};
    this.changed();
    if (playing) return this.play();
  }

  // The track the live guitar plays through now, if any: a monitoring track
  // (dry without its preset), a selected one once its preset rack is in.
  get liveId() {
    // Audition recorded tracks during Play. Live monitoring resumes on pause,
    // and remains available while actually recording a new part.
    if (this.playing && !this.recording) return null;
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
          insert: null, key: null, buffer: null, voices: new Set(), monitoring: false};
        channel.playback.connect(channel.gain).connect(channel.pan).connect(this.output);
        this.channels.set(track.id, channel);
      }
      channel.monitoring = Boolean(track.inputMonitoring);
      channel.playback.gain.setTargetAtTime(channel.monitoring ? 0 : 1, now, RAMP);
      channel.gain.gain.setTargetAtTime(trackGain(track, tracks), now, RAMP);
      channel.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, track.pan / 100)), now, RAMP);
      const key = audioKey(track.audio);
      if (key !== channel.key && key !== channel.adoptedAudio?.key) {
        this.settleAudioReference(channel);
        channel.key = key;
        this.stopVoice(channel);
        channel.buffer = null;
        channel.error = null; channel.loading = false; channel.url = track.audio?.url;
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

  // The server saved the exact pending WAV. Reuse its already decoded (or
  // in-flight) buffer when the blob URL becomes a protected server URL.
  adoptAudioReference(id, fromURL, audio, release = () => {}) {
    const channel = this.channels.get(id);
    if (!channel || channel.url !== fromURL || (!channel.buffer && !channel.loading)) { release(); return false; }
    channel.adoptedAudio = {key: audioKey(audio), url: audio.url, release};
    if (!channel.loading) this.settleAudioReference(channel);
    return true;
  }
  settleAudioReference(channel) {
    const adopted = channel.adoptedAudio; if (!adopted) return;
    channel.adoptedAudio = null; channel.key = adopted.key; channel.url = adopted.url; adopted.release();
  }

  async load(id, channel, url) {
    if (channel.loading) return;
    const {key} = channel;
    const current = () => this.channels.get(id) === channel && channel.key === key;
    channel.loading = true; channel.error = null; channel.attempt = 0; this.changed();
    try {
      let bytes;
      // Bounded retries for temporary network/server failures, never polling.
      for (let attempt=0; attempt<3; attempt++) {
        if (!current()) return;
        channel.attempt = attempt; this.changed();
        try {
          const response = await this.fetchAudio(url);
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;
            throw error;
          }
          bytes = await response.arrayBuffer(); break;
        } catch(error) {
          if (!current()) return;
          if (attempt === 2 || !(error.retryable || error instanceof TypeError)) throw error;
          await this.retryDelay(250 * (attempt+1));
        }
      }
      if (!current()) return;
      const buffer = await this.context.decodeAudioData(bytes);
      if (!current()) return;
      channel.buffer = buffer; channel.loading = false; channel.error = null;
      this.settleAudioReference(channel);
      if (this.playing) this.joinPlayback(channel);
      this.dispatchEvent(new CustomEvent('load', {detail: {id, buffer}}));
      this.changed();
    } catch (error) {
      if (!current()) return;
      channel.loading = false; channel.error = error;
      this.settleAudioReference(channel);
      this.dispatchEvent(new CustomEvent('error', {detail: {id, error}}));
      this.changed();
    }
  }

  retryFailed() {
    return Promise.all([...this.channels].filter(([,channel]) => channel.error && !channel.loading)
      .map(([id,channel]) => this.load(id,channel,channel.url)));
  }

  // Capture and every backing source share this exact context timestamp.
  startRecording(when, offset) {
    this.pause();
    this.offset = offset; this.startedAt = when; this.playing = true; this.recording = true; this.looping = false;
    for (const channel of this.channels.values()) this.startVoice(channel, when, offset);
    this.changed();
  }

  async play() {
    if (this.playing || !this.duration) return;
    const generation = ++this.generation;
    await this.context.resume();
    if (generation !== this.generation || this.playing) return;
    const {start, end} = this.loop;
    if (this.loopActive && (this.offset < start || this.offset >= end)) this.offset = start;
    else if (this.offset >= this.duration) this.offset = 0;
    this.startedAt = this.context.currentTime + START_DELAY;
    this.playing = true;
    this.looping = this.loopActive;
    if (this.looping) {
      this.scheduledUntil = this.turnEnd(this.startedAt);
      for (const channel of this.channels.values()) this.startVoice(channel, this.startedAt, this.offset, this.scheduledUntil);
      this.armLoop();
    } else {
      for (const channel of this.channels.values()) this.startVoice(channel, this.startedAt, this.offset);
    }
    this.changed();
  }

  // Schedules the next loop turn of every track LOOKAHEAD before it starts.
  armLoop() {
    const delay = Math.max(0, this.scheduledUntil - LOOKAHEAD - this.context.currentTime);
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      if (!this.playing || !this.looping) return;
      const turn = this.scheduledUntil;
      const end = turn + this.loop.end - this.loop.start;
      // A late timer starts the turn now, at the position it should have reached.
      const when = Math.max(turn, this.context.currentTime + START_DELAY);
      for (const channel of this.channels.values()) this.startVoice(channel, when, this.loop.start + when - turn, end);
      this.scheduledUntil = end;
      this.armLoop();
    }, delay * 1000);
  }

  // A track loaded during playback joins it in time (and its next loop turn if already scheduled).
  joinPlayback(channel) {
    const when = this.context.currentTime + START_DELAY;
    if (!this.looping) return this.startVoice(channel, when, this.positionAt(when));
    const end = Math.min(this.turnEnd(when), this.scheduledUntil);
    this.startVoice(channel, when, this.positionAt(when), end);
    if (end < this.scheduledUntil) this.startVoice(channel, end, this.loop.start, this.scheduledUntil);
  }

  pause() {
    ++this.generation;
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    if (!this.playing) return;
    this.offset = this.position;
    this.playing = false;
    this.recording = false;
    this.looping = false;
    for (const channel of this.channels.values()) this.stopVoice(channel);
    this.changed();
  }

  // Back to the start, or to the loop's start (the transport's "Return to start").
  stop() {
    this.pause();
    this.offset = this.loopActive ? this.loop.start : 0;
    this.changed();
  }

  seek(seconds) {
    const playing = this.playing;
    this.pause();
    this.offset = Math.max(0, Math.min(this.duration, Number(seconds) || 0));
    this.changed();
    if (playing) return this.play();
  }

  // Plays a track's buffer from `offset` at `when`, until `until` (a loop turn's end) if given.
  startVoice(channel, when, offset, until) {
    if (!channel.buffer || offset >= channel.buffer.duration || (until !== undefined && when >= until)) return;
    const source = this.context.createBufferSource();
    source.buffer = channel.buffer;
    source.connect(channel.playback);
    source.onended = () => {
      if (!channel.voices.delete(source)) return;
      source.disconnect();
      // The longest track has ended: the project stops at its end.
      if (this.playing && !this.recording && !this.looping && ![...this.channels.values()].some((entry) => entry.voices.size)) {
        this.offset = this.duration;
        this.playing = false;
        this.changed();
      }
    };
    source.start(when, offset);
    if (until !== undefined) source.stop(until);
    channel.voices.add(source);
  }

  stopVoice(channel) {
    for (const source of channel.voices) {
      source.onended = null;
      try { source.stop(); } catch { /* Not started yet. */ }
      source.disconnect();
    }
    channel.voices.clear();
  }

  remove(id, channel) {
    this.settleAudioReference(channel);
    this.stopVoice(channel);
    if (id === this.liveId) this.unrouteLive();
    if (channel.insert) disconnect(channel.insert.output, channel.gain);
    channel.playback.disconnect();
    channel.gain.disconnect();
    channel.pan.disconnect();
    this.channels.delete(id);
  }

  changed() {
    const playback = this.playing && !this.recording;
    for (const channel of this.channels.values()) channel.playback.gain.setTargetAtTime(playback || !channel.monitoring ? 1 : 0, this.context.currentTime, RAMP);
    this.routeLive();
    this.dispatchEvent(new Event('statechange'));
  }

  destroy() {
    this.stop();
    for (const [id, channel] of this.channels) this.remove(id, channel);
    this.output.disconnect();
  }
}
