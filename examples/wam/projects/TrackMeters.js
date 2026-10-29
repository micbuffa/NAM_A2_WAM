// Post-fader level for every visible track, including accompaniment and transient
// separation voices. Only tiny sample windows are read at 10Hz, never whole PCM.
export class TrackMeters {
  constructor({context, player, timeline}) {
    Object.assign(this, {context, player, timeline}); this.entries = new Map();
    this.timer = setInterval(() => this.update(), 100); this.timer.unref?.();
  }
  release(id, entry) {
    for (const node of entry.nodes) try { node.disconnect(entry.analyser); } catch { /* voice already removed */ }
    entry.analyser.disconnect(); this.entries.delete(id);
  }
  update() {
    const rows = this.timeline.rows;
    for (const [id, entry] of this.entries) if (!rows.has(id)) this.release(id, entry);
    for (const [id, row] of rows) {
      const preview = this.player.preview;
      const nodes = preview ? (preview.voices ?? []).filter(v => v.id === row.track.streamId).map(v => v.pan)
        : [this.player.channels.get(id)?.pan].filter(Boolean);
      let entry = this.entries.get(id);
      if (entry && (entry.nodes.length !== nodes.length || nodes.some(node => !entry.nodes.includes(node)))) { this.release(id, entry); entry = null; }
      if (!entry && nodes.length) {
        const analyser = this.context.createAnalyser(); analyser.fftSize = 256;
        entry = {analyser, nodes, samples: new Float32Array(256)};
        for (const node of nodes) node.connect(analyser);
        this.entries.set(id, entry);
      }
      let peak = 0;
      if (entry && this.context.state !== 'suspended') {
        entry.analyser.getFloatTimeDomainData(entry.samples);
        for (const value of entry.samples) peak = Math.max(peak, Math.abs(value));
        if (preview) peak *= preview.normalizationNode?.gain.value ?? 1;
      }
      this.timeline.setLevel(id, peak);
    }
  }
  destroy() { clearInterval(this.timer); for (const [id, entry] of this.entries) this.release(id, entry); }
}
