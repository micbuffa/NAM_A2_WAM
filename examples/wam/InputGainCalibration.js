export const GAIN_ANALYSIS_SECONDS = 5;
export function calibratedInputGain(peak) {
  if (!Number.isFinite(peak) || peak < 0) throw Error('Invalid input measurement.');
  if (peak < 10 ** (-50 / 20)) throw Error('Signal too weak. Check the input channel and guitar volume, then try again.');
  if (peak >= .999) throw Error('The audio input is clipping. Lower the gain on your audio interface, then try again.');
  const requestedDb = -6 - 20 * Math.log10(peak);
  const db = Math.round(Math.max(-48, Math.min(12, requestedDb)) * 2) / 2;
  return {db, peakDb: 20 * Math.log10(peak), limited: requestedDb > 12};
}

// Raw mono tap before software trim: changing the existing trim cannot bias it.
// No audio is retained. Overlapping 8192-sample windows cover polling intervals.
export class InputGainCalibration {
  constructor({context, source, channel, progress = () => {}, poll = fn => setInterval(fn, 25), unpoll = id => clearInterval(id)}) {
    Object.assign(this, {context, source, channel, progress, poll, unpoll});
  }
  start() {
    if (this.running) throw Error('Input gain analysis is already running.');
    if (this.context.state !== 'running') throw Error('Start the audio engine before analysing input gain.');
    const tap = this.source.createLiveTap(this.channel);
    this.tap = tap;
    const analyser = this.analyser = this.context.createAnalyser();
    analyser.fftSize = 8192; tap.node.connect(analyser);
    this.samples = new Float32Array(analyser.fftSize);
    this.running = true; this.peak = 0; this.startAt = this.context.currentTime;
    this.changed = () => this.cancel('Input changed. Gain analysis cancelled.');
    this.source.addEventListener('change', this.changed);
    this.stateChanged = () => { if (this.context.state !== 'running') this.cancel('Audio engine paused. Gain analysis cancelled.'); };
    this.context.addEventListener('statechange', this.stateChanged);
    return new Promise((resolve, reject) => {
      this.resolve = resolve; this.reject = reject;
      this.timer = this.poll(() => this.tick()); this.progress(0);
    });
  }
  tick() {
    if (!this.running) return;
    this.analyser.getFloatTimeDomainData(this.samples);
    for (const value of this.samples) this.peak = Math.max(this.peak, Math.abs(value));
    const elapsed = this.context.currentTime - this.startAt;
    this.progress(Math.min(GAIN_ANALYSIS_SECONDS, elapsed));
    if (elapsed >= GAIN_ANALYSIS_SECONDS) {
      this.cleanup();
      try { this.resolve(calibratedInputGain(this.peak)); } catch (error) { this.reject(error); }
    }
  }
  cleanup() {
    this.running = false; this.unpoll(this.timer);
    this.source.removeEventListener('change', this.changed);
    this.context.removeEventListener('statechange', this.stateChanged);
    this.tap.release(); this.analyser.disconnect(); this.samples = null;
  }
  cancel(message = 'Gain analysis cancelled. Gain unchanged.') {
    if (!this.running) return;
    this.cleanup(); this.reject(Error(message));
  }
}
