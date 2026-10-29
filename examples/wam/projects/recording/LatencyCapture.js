// Bounded, preallocated windows on the audio clock. This processor captures
// only: probes come from independently scheduled BufferSources, never input.
export class LatencyCapture {
  constructor({startFrame, windowFrames, intervalFrames, count}, emit) {
    if (![startFrame,windowFrames,intervalFrames,count].every(Number.isSafeInteger) || startFrame < 0 || windowFrames < 1 || windowFrames > 400000 || intervalFrames < windowFrames || count !== 6) throw Error('Invalid latency capture plan.');
    Object.assign(this,{startFrame,windowFrames,intervalFrames,count,emit});
    this.windows=Array.from({length:count},()=>new Float32Array(windowFrames));
    this.endFrame=startFrame+(count-1)*intervalFrames+windowFrames; this.done=false; this.started=false;
  }
  arm(startFrame) {
    if(this.started||!Number.isSafeInteger(startFrame)||startFrame<0)throw Error('Invalid calibration start.');
    this.startFrame=startFrame;this.endFrame=startFrame+(this.count-1)*this.intervalFrames+this.windowFrames;
  }
  process(input, frame, length) {
    if (this.done) return;
    if ((this.started && this.expected !== undefined && frame !== this.expected) || (!this.started && frame > this.startFrame)) return this.fail(`Calibration capture lost audio frames (frame ${frame}, expected ${this.expected ?? 'first'}, start ${this.startFrame}, started ${this.started}).`);
    this.expected=frame+length;
    for (let i=0;i<length;i++) {
      const absolute=frame+i; if (absolute<this.startFrame) continue;
      if (absolute>=this.endFrame) {this.done=true;return;}
      this.started=true;
      const relative=absolute-this.startFrame, index=Math.floor(relative/this.intervalFrames), offset=relative%this.intervalFrames;
      if (offset>=this.windowFrames) continue;
      if (!input || i>=input.length || !Number.isFinite(input[i])) return this.fail('Calibration input was interrupted.');
      this.windows[index][offset]=input[i];
      if (offset===this.windowFrames-1) {const samples=this.windows[index];this.windows[index]=null;this.emit({type:'window',index,samples});}
    }
  }
  fail(message) {this.done=true;this.emit({type:'error',message});}
}
