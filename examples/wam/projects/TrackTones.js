// Guitar and bass tracks play through their preset: each one gets its own rack
// (NAM, cabinet and pedals, exactly as the preset sounds in Tone), built when
// the project opens or the preset changes, and plugged into the ProjectPlayer
// as the track's insert. The recorded DI gets the preset's file trim; the live
// guitar (input monitoring) arrives already trimmed by the Tone input.
// NAM A2 models run in their Lite variant on playback tracks (measured: four
// Full racks beside Tone already underrun, eight Lite ones do not); the track
// you play through live (input monitoring) gets the Full variant.
import {DEFAULT_SOURCE_TRIM_DB} from '../SourceManager.js';
import {presetValue, usesPreset} from './ProjectsModel.js';

// A track rack listens to no device: this stands in for its SourceManager.
export class TrackSource extends EventTarget {
  mode = null;
  liveInput = null;
  trimDb = {...DEFAULT_SOURCE_TRIM_DB};
  setSecondary() {}
  setTrimDb(db, mode = 'file') { this.trimDb[mode] = db; return db; }
}

// Tracks that need a rack: a guitar or bass track with a preset, and audio or input monitoring.
export const modelVariant = (track) => (track.inputMonitoring ? 'full' : 'lite');

export const needsTone = (track) => usesPreset(track.instrument) && Boolean(presetValue(track)) && Boolean(track.audio || track.inputMonitoring);

export class TrackTones extends EventTarget {
  // createRack(): Promise<FxRack>; resolvePreset(track, projectId): Promise<rack state>.
  constructor({context, player, createRack, resolvePreset}) {
    super();
    Object.assign(this, {context, player, createRack, resolvePreset});
    this.tones = new Map(); // track id -> {key, state: 'loading' | 'ready' | 'error', error, rack, insert}
  }

  // {state, error} of a track's rack, or null when it plays dry.
  status(id) {
    const tone = this.tones.get(id);
    return tone ? {state: tone.state, error: tone.error ?? null} : null;
  }

  // After player.setTracks(tracks): builds, replaces or releases the racks.
  setTracks(tracks, projectId) {
    const wanted = new Map(tracks.filter(needsTone).map((track) => [track.id, {track, key: `${projectId}|${presetValue(track)}`}]));
    for (const [id, tone] of [...this.tones]) if (wanted.get(id)?.key !== tone.key) this.release(id);
    for (const [id, {track, key}] of wanted) {
      const tone = this.tones.get(id);
      if (!tone) void this.build(track, projectId, key);
      else if (tone.state === 'ready') void this.setVariant(tone, modelVariant(track));
      else tone.variant = modelVariant(track); // applied once the preset is loaded
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

  async build(track, projectId, key) {
    const {id} = track;
    const tone = {id, key, state: 'loading', variant: modelVariant(track)};
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
      const state = resolved.value;
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
      tone.state = 'error';
      tone.error = error;
      this.dispatchEvent(new CustomEvent('error', {detail: {id, error}}));
    }
    this.changed(id);
  }

  release(id) {
    const tone = this.tones.get(id);
    if (!tone) return;
    this.tones.delete(id);
    this.player.setInsert(id, null);
    tone.insert?.input.disconnect();
    // After a preset still being applied (the rack's queue), not in the middle of it.
    if (tone.rack) void tone.rack.enqueue(() => tone.rack.destroy());
    this.changed(id);
  }

  changed(id) { this.dispatchEvent(new CustomEvent('change', {detail: {id}})); }

  destroy() { for (const id of [...this.tones.keys()]) this.release(id); }
}
