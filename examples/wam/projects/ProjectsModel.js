// Pure helpers of the Projects workspace (unit-tested under Node).
export const BPM_RANGE = {min: 30, max: 300, default: 120};
export const INSTRUMENTS = [
  {id: 'guitar', label: 'Guitar'}, {id: 'bass', label: 'Bass'}, {id: 'vocals', label: 'Vocals'},
  {id: 'drums', label: 'Drums'}, {id: 'keys', label: 'Keys'}, {id: 'other', label: 'Other'},
];
export const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.aif,.aiff,.ogg,.flac,audio/*';

export const twoDigits = (count) => String(count).padStart(2, '0');
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function clampBpm(value) {
  const bpm = Math.round(Number(value));
  return Number.isFinite(bpm) ? Math.min(BPM_RANGE.max, Math.max(BPM_RANGE.min, bpm)) : BPM_RANGE.default;
}

// "take_01-final.wav" -> "take 01-final"
export const nameFromFile = (filename = '') => filename.replace(/\.[^.]+$/u, '').replaceAll('_', ' ').trim() || 'Untitled project';

// Summaries from GET /api/projects -> the two groups of the project picker.
export function groupProjects(projects = []) {
  return {mine: projects.filter((project) => project.owned), shared: projects.filter((project) => !project.owned)};
}

export const projectOptionLabel = (project) => `${project.name} · ${plural(project.trackCount ?? project.tracks?.length ?? 0, 'track')}`;

// What the header says about the open project.
export function describeProject(project, {dirty = false} = {}) {
  if (!project) return null;
  const tracks = project.tracks?.length ?? project.trackCount ?? 0;
  return {
    kicker: [project.owned ? 'Recording project' : `Shared by ${project.owner?.name || 'another user'}`, plural(tracks, 'track'),
      project.owned && shareSummary(project.shares)].filter(Boolean).join(' · '),
    meta: project.owned
      ? 'Build your project track by track, with an independent mix and tone on every guitar and bass track.'
      : 'Read-only: you can listen and try a mix, but changes are not saved.',
    saveState: !project.owned ? 'Read-only' : dirty ? 'Unsaved changes' : 'Saved',
  };
}

// "Shared with Ana" / "Shared with 3 people"; '' when not shared.
export function shareSummary(shares = []) {
  if (!shares?.length) return '';
  return shares.length === 1 ? `Shared with ${shares[0].name || shares[0].email}` : `Shared with ${shares.length} people`;
}

// Avatar letters: "Ana Lima" -> "AL", "bob@example.com" -> "BO".
export function initials(name = '') {
  const words = name.split('@')[0].split(/[\s._-]+/u).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

// Track fields edited locally and sent by "Save project".
export const TRACK_FIELDS = ['name', 'instrument', 'presetId', 'factoryPreset', 'volume', 'pan', 'mute', 'solo', 'inputMonitoring'];
export const PRESET_INSTRUMENTS = ['guitar', 'bass'];
export const usesPreset = (instrument) => PRESET_INSTRUMENTS.includes(instrument);
export const instrumentLabel = (id) => INSTRUMENTS.find((entry) => entry.id === id)?.label ?? id;

// Volume 0..100, 80 = 0 dB, 0.3 dB per step (TONELAB mockup); 0 is silence.
export const volumeToDb = (volume) => (Number(volume) <= 0 ? -Infinity : (Number(volume) - 80) * 0.3);
export function volumeLabel(volume) {
  const db = volumeToDb(volume);
  if (db === -Infinity) return '−∞ dB';
  return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`;
}
export const panLabel = (pan) => (Number(pan) === 0 ? 'Center' : `${Number(pan) < 0 ? 'Left' : 'Right'} ${Math.abs(Number(pan))}`);

// "Guitar 3" for the third guitar track.
export function defaultTrackName(instrument, tracks = []) {
  const count = tracks.filter((track) => track.instrument === instrument).length + 1;
  return `${instrumentLabel(instrument)} ${count}`;
}

// A change of instrument drops a preset the new instrument cannot use.
export function withInstrument(track, instrument) {
  return usesPreset(instrument) ? {...track, instrument} : {...track, instrument, presetId: null, factoryPreset: null};
}

// Input monitoring plays the live guitar through one track's preset: one track at a time.
export function toggleMonitoring(tracks, id) {
  return tracks.map((track) => ({...track, inputMonitoring: track.id === id ? !track.inputMonitoring && usesPreset(track.instrument) : false}));
}

// The track the live guitar plays through in Projects: the one monitoring the
// input, else the selected guitar or bass track with a preset (over its
// recording), else none (the guitar keeps Tone's sound).
export function liveTrackId(tracks, selectedId) {
  const monitored = tracks.find((track) => track.inputMonitoring);
  if (monitored) return monitored.id;
  const selected = tracks.find((track) => track.id === selectedId);
  return selected && usesPreset(selected.instrument) && presetValue(selected) ? selected.id : null;
}

// The changed fields of each track, compared with the saved project.
export function trackChanges(saved = [], current = []) {
  return current.flatMap((track) => {
    const before = saved.find((entry) => entry.id === track.id);
    if (!before) return [];
    const changes = Object.fromEntries(TRACK_FIELDS.filter((key) => before[key] !== track[key]).map((key) => [key, track[key]]));
    return Object.keys(changes).length ? [{id: track.id, changes}] : [];
  });
}

// Timeline order: a track moved to an index of the list; whether it differs from the saved one.
export function moveTrack(tracks, id, index) {
  const moved = tracks.find((track) => track.id === id);
  if (!moved) return tracks;
  const rest = tracks.filter((track) => track !== moved);
  rest.splice(Math.max(0, Math.min(rest.length, index)), 0, moved);
  return rest;
}

export const orderChanged = (saved = [], current = []) => saved.map((track) => track.id).join() !== current.map((track) => track.id).join();

// Preset value of the inspector select: "" (none), "factory:…" or "account:<id>".
export const presetValue = (track) => track.factoryPreset ?? (track.presetId ? `account:${track.presetId}` : '');
export function presetFields(value) {
  if (value.startsWith('factory:')) return {presetId: null, factoryPreset: value};
  if (value.startsWith('account:')) return {presetId: Number(value.slice(8)), factoryPreset: null};
  return {presetId: null, factoryPreset: null};
}

// Playback gain of a track: its volume, unless muted or another track is soloed.
export function trackGain(track, tracks = []) {
  const soloed = tracks.some((entry) => entry.solo);
  if (track.mute || (soloed && !track.solo)) return 0;
  const db = volumeToDb(track.volume);
  return db === -Infinity ? 0 : 10 ** (db / 20);
}

// The timeline counts 4/4 bars: at least `minBars`, enough for the longest track.
export const BEATS_PER_BAR = 4;
export const barSeconds = (bpm) => (60 * BEATS_PER_BAR) / clampBpm(bpm);
export function timelineLength(duration, bpm, minBars = 16) {
  const bar = barSeconds(bpm);
  const bars = Math.max(minBars, Math.ceil((Number(duration) || 0) / bar - 1e-9));
  return {bars, seconds: bars * bar};
}

// Ruler labels: bar numbers (1, 5, 9…) at least `spacing` pixels apart.
export function rulerBars(bars, width, spacing = 56) {
  const step = [1, 2, 4, 8, 16, 32, 64].find((candidate) => (width / bars) * candidate >= spacing) ?? 128;
  return Array.from({length: Math.floor((bars - 1) / step) + 1}, (_, index) => ({bar: index * step + 1, fraction: (index * step) / bars}));
}

// 83.456 s -> "01:23.45"
export function formatClock(seconds) {
  const hundredths = Math.floor(Math.max(0, Number(seconds) || 0) * 100);
  return `${twoDigits(Math.floor(hundredths / 6000))}:${twoDigits(Math.floor(hundredths / 100) % 60)}.${twoDigits(hundredths % 100)}`;
}

// Bar and beat at a position, counted from 1: "3.2".
export function barBeat(seconds, bpm) {
  const beats = Math.floor(Math.max(0, Number(seconds) || 0) / (60 / clampBpm(bpm)) + 1e-9);
  return `${Math.floor(beats / BEATS_PER_BAR) + 1}.${(beats % BEATS_PER_BAR) + 1}`;
}

// A loop drawn from one position to another (either way), in seconds: whole
// bars covering both ends (at least one), or exact positions when `free`;
// within the timeline's `length` ({bars, seconds}).
export function snapLoop(from, to, length, {free = false} = {}) {
  const bar = length.seconds / length.bars;
  const [a, b] = [from, to].map((value) => Math.max(0, Math.min(length.seconds, Number(value) || 0))).sort((x, y) => x - y);
  if (free) return {start: a, end: b};
  const start = Math.min(length.bars - 1, Math.floor(a / bar + 1e-9));
  return {start: start * bar, end: Math.max(start + 1, Math.ceil(b / bar - 1e-9)) * bar};
}

// The loop over the bars around a position: from its bar, `bars` long (the
// loop button's region when none is drawn).
export function loopAround(seconds, length, bars = 4) {
  const bar = length.seconds / length.bars;
  const start = Math.max(0, Math.min(length.bars - bars, Math.floor((Number(seconds) || 0) / bar + 1e-9)));
  return {start: start * bar, end: Math.min(length.bars, start + bars) * bar};
}

// What the transport says about a loop: "Bars 5–8" for whole bars, else
// bar.beat positions ("3.2–5.1"); '' without a region.
export function loopLabel({start = 0, end = 0} = {}, bpm) {
  if (!(end > start)) return '';
  const bar = barSeconds(bpm);
  const whole = [start, end].every((value) => Math.abs(value / bar - Math.round(value / bar)) < 1e-6);
  if (!whole) return `${barBeat(start, bpm)}–${barBeat(end, bpm)}`;
  const [first, last] = [Math.round(start / bar) + 1, Math.round(end / bar)];
  return first === last ? `Bar ${first}` : `Bars ${first}–${last}`;
}

// A loop is remembered in bars (so it follows a tempo change): {enabled, start, end}.
export function loopToBars({enabled = false, start = 0, end = 0} = {}, bpm) {
  const bar = barSeconds(bpm);
  return {enabled: Boolean(enabled), start: start / bar, end: end / bar};
}
export function loopFromBars(bars, bpm) {
  const bar = barSeconds(bpm);
  const [start, end] = [bars?.start, bars?.end].map(Number);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start) || start < 0) return {enabled: false, start: 0, end: 0};
  return {enabled: Boolean(bars.enabled), start: start * bar, end: end * bar};
}

// The remembered loops ([{id, enabled, start, end}] in bars), the most recent
// last, at most `limit`; a loop without a region is forgotten.
export function rememberLoop(loops, id, bars, limit = 50) {
  const rest = (Array.isArray(loops) ? loops : []).filter((entry) => String(entry?.id) !== String(id));
  if (bars.end > bars.start) rest.push({id, ...bars});
  return rest.slice(-limit);
}
export const rememberedLoop = (loops, id) => (Array.isArray(loops) ? loops : []).find((entry) => String(entry?.id) === String(id));
