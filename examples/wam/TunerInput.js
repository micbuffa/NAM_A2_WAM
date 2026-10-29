// The tuner follows the physical channel feeding the chosen lane, before gain
// and effects. A routed B shares A's physical input, rather than its wet signal.
export function tunerInputs(source, rack) {
  const live = source.mode === 'live', a = source.liveInput?.channelIndex;
  const channels = rack.activeB ? [['a', a], ['b', rack.route ? a : rack.channelB]] : [['a', a]];
  return channels.map(([id, channel]) => ({
    id, channel,
    label: `Chain ${id.toUpperCase()} · ${live && Number.isInteger(channel) ? `Input ${channel + 1}` : 'Source'}${id === 'b' && rack.route ? ' (shared with A)' : ''}`,
    available: live ? Number.isInteger(channel) && channel >= 0 && channel < source.liveInput?.channelCount : source.mode === 'file' && (id === 'a' || !!rack.route),
  }));
}

export class TunerInput extends EventTarget {
  constructor({source, rack}) {
    super(); Object.assign(this, {source, rack}); this.selected = 'a';
    this.changed = () => { this.sync(); this.dispatchEvent(new Event('change')); };
    source.addEventListener('change', this.changed); rack.addEventListener('change', this.changed);
  }
  get choices() { return tunerInputs(this.source, this.rack); }
  select(id) {
    if (!this.choices.some(choice => choice.id === id)) throw Error('Tuner input unavailable');
    this.selected = id; this.changed();
  }
  connect(destination) { this.disconnect(); this.destination = destination; this.sync(); }
  sync() {
    if (!this.rack.activeB) this.selected = 'a';
    const choice = this.choices.find(entry => entry.id === this.selected);
    const upstream = this.source.mode === 'live' ? this.source.liveSplitter : this.source.sourceTrim;
    const channel = this.source.mode === 'live' ? choice?.channel : null;
    if (this.destination && choice?.available && upstream === this.upstream && channel === this.channel && this.tap) return;
    this.release();
    if (!this.destination || !choice?.available) return;
    if (this.source.mode === 'live') this.tap = this.source.createLiveTap(channel);
    else {
      const destination = this.destination;
      upstream.connect(destination);
      this.tap = {release() { try { upstream.disconnect(destination); } catch {} }};
    }
    if (this.source.mode === 'live') this.tap.node.connect(this.destination);
    this.upstream = upstream; this.channel = channel;
  }
  release() { this.tap?.release(); this.tap = null; this.upstream = null; this.channel = null; }
  disconnect() { this.release(); this.destination = null; }
  destroy() { this.disconnect(); this.source.removeEventListener('change', this.changed); this.rack.removeEventListener('change', this.changed); }
}
