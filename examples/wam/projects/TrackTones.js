// Guitar and bass tracks play through their preset: each one gets its own rack
// (NAM, cabinet and pedals, exactly as the preset sounds in Tone), built when
// the project opens or the preset changes, and plugged into the ProjectPlayer
// as the track's insert. The recorded DI gets the preset's file trim; the live
// guitar (input monitoring) arrives already trimmed by the Tone input.
// NAM A2 models run in their Lite variant on playback tracks (measured: four
// Full racks beside Tone already underrun, eight Lite ones do not); the track
// you play through live (input monitoring, or the selected track) gets the Full variant.
import {DEFAULT_SOURCE_TRIM_DB} from '../SourceManager.js';
import {presetValue, usesTrackPreset} from './ProjectsModel.js';

// A track rack listens to no device: this stands in for its SourceManager.
export class TrackSource extends EventTarget {
  mode = null;
  liveInput = null;
  trimDb = {...DEFAULT_SOURCE_TRIM_DB};
  setSecondary() {}
  setTrimDb(db, mode = 'file') { this.trimDb[mode] = db; return db; }
}

// Tracks that need a rack: a guitar or bass track with a preset, and audio or
// the live guitar (liveId: liveTrackId()), which gets the Full variant.
export const modelVariant = (track, liveId = null) => (track.id === liveId ? 'full' : 'lite');

export const needsTone = (track, liveId = null) => usesTrackPreset(track) && Boolean(presetValue(track)) && Boolean(track.audio || track.id === liveId);

export class TrackTones extends EventTarget {
  // createRack(): Promise<FxRack>; resolvePreset(track, projectId): Promise<rack state>.
  constructor({context, player, createRack, resolvePreset}) {
    super();
    Object.assign(this, {context, player, createRack, resolvePreset});
    this.tones = new Map(); // track id -> {key, preset, state: 'loading' | 'ready' | 'error', error, rack, insert, previous}
    this.tracks = [];
    this.projectId = null;
    this.liveId = null;
  }

  // {state, error} of a track's rack, or null when it plays dry.
  status(id) {
    const tone = this.tones.get(id);
    return tone ? {state: tone.state, error: tone.error ?? null} : null;
  }

  // After player.setTracks(tracks, liveId): builds, replaces or releases the racks.
  setTracks(tracks, projectId, liveId = null) {
    Object.assign(this, {tracks, projectId, liveId});
    const wanted = new Map(tracks.filter((track) => needsTone(track, liveId)).map((track) => [track.id, {track, key: `${projectId}|${presetValue(track)}`}]));
    for (const [id, tone] of [...this.tones]) if (wanted.get(id)?.key !== tone.key) this.release(id);
    for (const [id, {track, key}] of wanted) {
      const tone = this.tones.get(id);
      if (!tone) void this.build(track, projectId, key);
      else if (tone.state === 'ready') void this.setVariant(tone, modelVariant(track, liveId));
      else tone.variant = modelVariant(track, liveId); // applied once the preset is loaded
    }
  }

  // The NAM stages of a track's rack (lanes A and B), in the given variant.
  async setVariant(tone, variant) {
    if (tone.applied === variant) return;
    tone.applied = variant;
    const nams = [tone.rack.a, tone.rack.b].filter(Boolean).flatMap((lane) => lane.entries).filter((entry) => entry.kind === 'nam');
    await Promise.all(nams.map((entry) => entry.plugin?.audioNode.setModelVariant(variant))).catch((error) => {
      tone.applied = null;
      this.dispatchEvent(new CustomEvent('error', {detail: {id: tone.id, error}}));
    });
  }

  // A preset was saved again (value: presetValue()): its tracks rebuild their
  // rack; each keeps playing through the previous one until the new one is ready.
  refresh(value) {
    for (const track of this.tracks.filter((entry) => needsTone(entry, this.liveId))) {
      const tone = this.tones.get(track.id);
      if (tone?.preset === value) void this.build(track, this.projectId, tone.key, tone);
    }
  }

  async build(track, projectId, key, previous = null) {
    const {id} = track;
    const tone = {id, key, preset: presetValue(track), state: 'loading', variant: modelVariant(track, this.liveId), previous};
    this.tones.set(id, tone);
    this.changed(id);
    const current = () => this.tones.get(id) === tone;
    try {
      const [created, resolved] = await Promise.allSettled([this.createRack(), this.resolvePreset(track, projectId)]);
      const rack = created.value;
      if (rack && (resolved.status === 'rejected' || !current())) rack.destroy();
      if (!current()) return;
      if (!rack) throw created.reason;
      if (resolved.status === 'rejected') throw resolved.reason;
      const state = structuredClone(resolved.value);
      // A raw recorded DI must enter at the same trim used during live monitoring.
      if (track.presetSnapshot) state.sourceTrim = {...state.sourceTrim, file: state.sourceTrim?.live ?? 0};
      tone.rack = rack;
      await rack.setState(state);
      if (!current()) return;
      await this.setVariant(tone, tone.variant);
      if (!current()) return;
      const input = this.context.createGain();
      input.channelCount = 1;
      input.channelCountMode = 'explicit';
      input.gain.value = 10 ** ((state.sourceTrim?.file ?? DEFAULT_SOURCE_TRIM_DB.file) / 20);
      input.connect(rack.a.input);
      tone.insert = {input, live: rack.a.input, output: rack.output};
      this.player.setInsert(id, tone.insert);
      tone.state = 'ready';
    } catch (error) {
      if (!current()) return;
      if (tone.previous) this.player.setInsert(id, null);
      tone.state = 'error';
      tone.error = error;
      this.dispatchEvent(new CustomEvent('error', {detail: {id, error}}));
    }
    this.dispose(tone.previous);
    tone.previous = null;
    this.changed(id);
  }

  release(id) {
    const tone = this.tones.get(id);
    if (!tone) return;
    this.tones.delete(id);
    this.player.setInsert(id, null);
    this.dispose(tone);
    this.changed(id);
  }

  // A rack no longer played, and the ones it was replacing.
  dispose(tone) {
    for (; tone; tone = tone.previous) {
      const {insert, rack} = tone;
      insert?.input.disconnect();
      // After a preset still being applied (the rack's queue), not in the middle of it.
      if (rack) void rack.enqueue(() => rack.destroy());
    }
  }

  changed(id) { this.dispatchEvent(new CustomEvent('change', {detail: {id}})); }

  destroy() { for (const id of [...this.tones.keys()]) this.release(id); }
}
