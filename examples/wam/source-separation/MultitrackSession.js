const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

export class MultitrackSession extends EventTarget {
  constructor(tracks = []) {
    super();
    this.tracks = tracks.map(track => ({id: track.id, label: track.label, role: track.role || 'other', muted: false, solo: false, volume: 1, pan: 0}));
    this.zoom = 1;this.viewMode='instruments';
    this.loop = {enabled: true, start: 0, end: 1};
  }
  emit() { this.dispatchEvent(new CustomEvent('change', {detail: this.getState()})); }
  updateTrack(id, changes) {
    const track = this.tracks.find(item => item.id === id);
    if (!track) throw new Error(`Unknown track: ${id}`);
    if ('volume' in changes) track.volume = clamp(changes.volume, 0, 1.5);
    if ('pan' in changes) track.pan = clamp(changes.pan, -1, 1);
    if ('muted' in changes) track.muted = !!changes.muted;
    if ('solo' in changes) track.solo = !!changes.solo;
    this.emit();
  }
  setViewMode(value) {if(!['instruments','mix'].includes(value))throw Error('Vue inconnue.');this.viewMode=value;this.emit();}
  setZoom(value) { this.zoom = clamp(value, 1, 16); this.emit(); }
  resetZoom() { this.setZoom(1); }
  setLoop({enabled = this.loop.enabled, start = this.loop.start, end = this.loop.end} = {}) {
    start = clamp(start, 0, 1); end = clamp(end, 0, 1); if (start > end) [start, end] = [end, start];
    this.loop = {enabled: !!enabled, start, end}; this.emit();
  }
  isAudible(track) { return !track.muted && (!this.tracks.some(item => item.solo) || track.solo); }
  getState() { return {version: 1, tracks: this.tracks.map(track => ({...track})), zoom: this.zoom, viewMode:this.viewMode, loop: {...this.loop}}; }
}
