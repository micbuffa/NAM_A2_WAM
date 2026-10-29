import {RingBuffer} from '../../source-separation/vendor/ringbuf/index.js';

// One producer (the audio thread). No messaging or growing PCM allocations per quantum.
// control: written frames, producer stopped, failure. Only this producer writes them.
export class CaptureWriter {
  constructor({storage, control, startFrame, maxFrames}) {
    Object.assign(this, {ring: new RingBuffer(storage, Float32Array), control: new Int32Array(control), startFrame, maxFrames});
    this.frames = 0; this.stopped = false;
  }
  fail() { Atomics.store(this.control, 2, 1); this.stop(); }
  stop() { this.stopped = true; Atomics.store(this.control, 1, 1); }
  process(input, frame, length) {
    if (this.stopped || frame + length <= this.startFrame) return;
    if (frame > this.startFrame + this.frames) return this.fail();
    const from = Math.max(0, this.startFrame - frame), count = length - from;
    if (!input || input.length < length || this.frames + count > this.maxFrames || this.ring.available_write() < count) return this.fail();
    this.ring.push(input, count, from);
    this.frames += count;
    Atomics.store(this.control, 0, this.frames);
  }
}
