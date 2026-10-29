// Fixed-scale, tiled canvas for an append-only recording. A new packet repaints
// only its dirty pixel columns (including a possibly updated last peak bin).
// Earlier canvases are never resized/removed on append. Only a viewport/scale
// change triggers a complete repaint from the small retained peak envelope.
export class LiveWaveform {
  constructor(container, {createCanvas = () => document.createElement('canvas'), ratio = globalThis.devicePixelRatio || 1, height = 46} = {}) {
    Object.assign(this, {container, createCanvas, ratio, height}); this.tiles = new Map(); this.tileWidth = 512;
    this.drawnColumns = 0; this.fullRepaints = 0;
    container.style.position = 'relative'; container.style.height = `${height}px`; container.style.overflow = 'hidden';
  }
  render(wave, pixelsPerSecond, dirtyStart = 0, dirtyEnd = wave.peaks.length) {
    const changed = this.scale !== pixelsPerSecond || this.wave !== wave;
    this.wave = wave; this.scale = pixelsPerSecond;
    if (!(pixelsPerSecond > 0)) return;
    if (changed) { this.fullRepaints++; for (const tile of this.tiles.values()) tile.context.clearRect(0, 0, this.tileWidth, this.height); dirtyStart = 0; dirtyEnd = wave.peaks.length; }
    const pixelsPerBin = wave.peakFrames / wave.sampleRate * pixelsPerSecond;
    const from = Math.max(0, Math.floor(dirtyStart * pixelsPerBin)), end = Math.ceil(dirtyEnd * pixelsPerBin);
    for (let x = from; x < end; x++) {
      const index = Math.floor(x / this.tileWidth); let tile = this.tiles.get(index);
      if (!tile) {
        const canvas = this.createCanvas(); canvas.width = this.tileWidth * this.ratio; canvas.height = this.height * this.ratio;
        Object.assign(canvas.style, {position: 'absolute', left: `${index * this.tileWidth}px`, top: '0', width: `${this.tileWidth}px`, height: `${this.height}px`});
        const context = canvas.getContext('2d'); context.scale(this.ratio, this.ratio); context.fillStyle = '#91a675';
        this.container.append(canvas); tile = {canvas, context}; this.tiles.set(index, tile);
      }
      const local = x % this.tileWidth, a = Math.floor(x / pixelsPerBin), b = Math.min(wave.peaks.length, Math.ceil((x + 1) / pixelsPerBin));
      let peak = 0; for (let bin = a; bin < b; bin++) peak = Math.max(peak, wave.peaks[bin] ?? 0);
      tile.context.clearRect(local, 0, 1, this.height);
      if (peak) { const h = Math.max(1, Math.min(1, peak) * (this.height - 2)); tile.context.fillRect(local, (this.height - h) / 2, 1, h); }
      this.drawnColumns++;
    }
  }
  destroy() { for (const tile of this.tiles.values()) tile.canvas.remove(); this.tiles.clear(); }
}
