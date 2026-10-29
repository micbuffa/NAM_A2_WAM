export const MAX_TAKE_BYTES = 100 * 1024 ** 2;
export const PEAK_FRAMES = 1024;
// Position raw DI on the project clock exactly once. Negative positions crop;
// positive positions insert silence. IEEE Float32 WAV preserves the DI samples.
export function takeLayout({startProjectFrame, compensationFrames, capturedFrames, sampleRate}) {
  if (![startProjectFrame, compensationFrames, capturedFrames, sampleRate].every(Number.isSafeInteger) || startProjectFrame < 0 || compensationFrames < 0 || capturedFrames < 1 || sampleRate < 8000 || sampleRate > 192000) throw Error('Invalid recording frame metadata.');
  const offset = startProjectFrame - compensationFrames;
  const skip = Math.min(capturedFrames, Math.max(0, -offset));
  const padding = Math.max(0, offset), frames = padding + capturedFrames - skip;
  if (frames < 1 || 44 + frames * 4 > MAX_TAKE_BYTES) throw Error('Recording is empty or exceeds the 100 MiB take limit.');
  return {skip, padding, frames};
}
export function monoHeader(frames, sampleRate) {
  const bytes = new Uint8Array(44), view = new DataView(bytes.buffer);
  const text = (offset, value) => [...value].forEach((c, i) => bytes[offset + i] = c.charCodeAt(0));
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 4, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 3, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 32, true); text(36, 'data'); view.setUint32(40, frames * 4, true);
  return bytes;
}
export function encodeTake(chunks, metadata) {
  const take = new IncrementalTake(metadata);
  for (const chunk of chunks) take.append(chunk);
  return take.finish(metadata.capturedFrames);
}

// One pass over newly drained PCM. Retain immutable WAV packets, not a second
// whole raw take. Finish composes the header + packets without merging PCM.
export class IncrementalTake {
  constructor(metadata) {
    this.metadata = metadata; this.capturedFrames = 0; this.frames = 0;
    this.parts = []; this.peaks = []; this.dirty = Infinity; this.encodedFrames = 0;
    const offset = metadata.startProjectFrame - metadata.compensationFrames;
    this.skip = Math.max(0, -offset); this.padding = Math.max(0, offset);
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(metadata.sampleRate) || metadata.sampleRate < 8000 || metadata.sampleRate > 192000 || this.padding * 4 + 44 >= MAX_TAKE_BYTES) throw Error('Invalid recording frame metadata.');
    // Silent project prefix is represented by bounded Blob packets once.
    const zeros = new Blob([new Uint8Array(16384 * 4)]);
    for (let n = this.padding; n > 0; n -= 16384) this.parts.push(n >= 16384 ? zeros : zeros.slice(0, n * 4));
    this.frames = this.padding;
  }
  append(samples) {
    const from = Math.min(samples.length, Math.max(0, this.skip - this.capturedFrames));
    this.capturedFrames += samples.length;
    const count = samples.length - from;
    if (44 + (this.frames + count) * 4 > MAX_TAKE_BYTES) throw Error('Recording reached the 100 MiB take limit.');
    if (!count) return;
    const bytes = new Uint8Array(count * 4), view = new DataView(bytes.buffer);
    this.dirty = Math.min(this.dirty, Math.floor(this.frames / PEAK_FRAMES));
    for (let i = from; i < samples.length; i++, this.frames++) {
      const value = samples[i]; if (!Number.isFinite(value)) throw Error('Recording contains invalid samples.');
      view.setFloat32((i - from) * 4, value, true);
      const bin = Math.floor(this.frames / PEAK_FRAMES); this.peaks[bin] = Math.max(this.peaks[bin] ?? 0, Math.abs(value));
    }
    this.parts.push(new Blob([bytes])); this.encodedFrames += count;
  }
  delta() {
    if (!Number.isFinite(this.dirty)) return null;
    const peakStart = this.dirty, peaks = new Float32Array(this.peaks.length - peakStart);
    for (let i = 0; i < peaks.length; i++) peaks[i] = this.peaks[peakStart + i] ?? 0;
    this.dirty = Infinity;
    return {frames: this.capturedFrames, timelineFrames: this.frames, sampleRate: this.metadata.sampleRate, peakFrames: PEAK_FRAMES, peakStart, peaks};
  }
  finish(capturedFrames) {
    if (capturedFrames !== this.capturedFrames) throw Error('Recording lost audio frames.');
    const layout = takeLayout({...this.metadata, capturedFrames});
    if (layout.frames !== this.frames) throw Error('Recording placement mismatch.');
    const peaks = Float32Array.from({length: Math.ceil(this.frames / PEAK_FRAMES)}, (_, i) => this.peaks[i] ?? 0);
    const audio = new Blob([monoHeader(this.frames, this.metadata.sampleRate), ...this.parts], {type: 'audio/wav'});
    this.parts = []; // Blob owns its immutable packets; release the builder references.
    return {audio, peaks, frames: this.frames, encodedFrames: this.encodedFrames};
  }
}
