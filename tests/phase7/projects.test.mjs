import test from 'node:test';
import assert from 'node:assert/strict';
import {barBeat, loopAround, loopFromBars, loopLabel, loopToBars, rememberLoop, rememberedLoop, snapLoop, clampBpm, initials, moveTrack, orderChanged, shareSummary, defaultTrackName, describeProject, formatClock, groupProjects, liveTrackId, nameFromFile, panLabel, presetFields, presetValue,
  usesTrackPreset, originLabel, projectOptionLabel, rulerBars, timelineLength, toggleMonitoring, trackChanges, trackGain, volumeLabel, withInstrument}
  from '../../examples/wam/projects/ProjectsModel.js';
import {ProjectPlayer} from '../../examples/wam/projects/ProjectPlayer.js';
import {TrackTones, needsTone} from '../../examples/wam/projects/TrackTones.js';
import {ProjectsWorkspace, takeLinkedProject} from '../../examples/wam/projects/ProjectsWorkspace.js';
import AccountApi from '../../examples/wam/account/api.js';
import {RemotePresetStore} from '../../examples/wam/account/PresetStore.js';

test('tempo is clamped to whole BPM between 30 and 300', () => {
  assert.deepEqual([clampBpm('96'), clampBpm(12), clampBpm(999), clampBpm(120.6), clampBpm('abc')], [96, 30, 300, 121, 120]);
});

test('project names default to the imported file name', () => {
  assert.equal(nameFromFile('late_night-take.wav'), 'late night-take');
  assert.equal(nameFromFile('.wav'), 'Untitled project');
});

test('the picker groups my projects and the ones shared with me', () => {
  const projects = [{id: 1, name: 'Mine', owned: true, trackCount: 1}, {id: 2, name: 'Theirs', owned: false, trackCount: 3}];
  const {mine, shared} = groupProjects(projects);
  assert.deepEqual([mine.map((p) => p.id), shared.map((p) => p.id)], [[1], [2]]);
  assert.equal(projectOptionLabel(projects[0]), 'Mine · 1 track');
  assert.equal(projectOptionLabel(projects[1]), 'Theirs · 3 tracks');
});

test('the header tells owned, dirty and shared projects apart', () => {
  const owned = {name: 'Song', owned: true, tracks: [{}, {}]};
  assert.equal(describeProject(owned).kicker, 'Project · 2 tracks');
  assert.equal(describeProject(owned).saveState, 'Saved');
  assert.equal(describeProject(owned, {dirty: true}).saveState, 'Unsaved changes');
  const shared = {name: 'Jam', owned: false, owner: {name: 'bob@example.com'}, tracks: [{}]};
  assert.equal(describeProject(shared).kicker, 'Shared by bob@example.com · 1 track');
  assert.equal(describeProject(shared, {dirty: true}).saveState, 'Read-only');
  assert.equal(describeProject(null), null);
});

test('tracks are sent as JSON, or multipart with their audio file', async () => {
  const calls = [];
  const document = {querySelector: () => ({getAttribute: () => 'token', setAttribute() {}})};
  const fetchImpl = async (path, options) => { calls.push({path, options}); return {ok: true, status: 201, json: async () => ({id: 9})}; };
  const api = new AccountApi({document, fetchImpl});

  await api.updateTrack(3, 7, {volume: 55});
  assert.equal(calls[0].path, '/api/projects/3/tracks/7');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].options.body, '{"volume":55}');

  const audio = new File(['RIFF'], 'take.wav', {type: 'audio/wav'});
  await api.createTrack(3, {name: 'Take', presetId: null}, audio);
  const {options} = calls[1];
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['Content-Type'], undefined, 'fetch sets the multipart boundary');
  assert.equal(options.headers['X-CSRF-Token'], 'token');
  assert.ok(options.body instanceof FormData);
  assert.deepEqual([options.body.get('name'), options.body.get('presetId'), options.body.get('audio').name], ['Take', '', 'take.wav']);
});

test('volume is 0..100 with 80 at 0 dB, pan is -100..100', () => {
  assert.deepEqual([volumeLabel(80), volumeLabel(100), volumeLabel(50), volumeLabel(0)], ['0.0 dB', '+6.0 dB', '−9.0 dB', '−∞ dB']);
  assert.deepEqual([panLabel(0), panLabel(-30), panLabel(100)], ['Center', 'Left 30', 'Right 100']);
});

test('new tracks are numbered per instrument', () => {
  const tracks = [{instrument: 'guitar'}, {instrument: 'bass'}, {instrument: 'guitar'}];
  assert.equal(defaultTrackName('guitar', tracks), 'Guitar 3');
  assert.equal(defaultTrackName('drums', tracks), 'Drums 1');
});

test('only guitar and bass keep a preset and can monitor the input, one track at a time', () => {
  const track = {id: 1, instrument: 'guitar', presetId: 4, factoryPreset: null};
  assert.deepEqual(withInstrument(track, 'bass'), {...track, instrument: 'bass'});
  assert.deepEqual(withInstrument(track, 'vocals'), {id: 1, instrument: 'vocals', presetId: null, factoryPreset: null});

  const tracks = [{id: 1, instrument: 'guitar', inputMonitoring: false}, {id: 2, instrument: 'bass', inputMonitoring: true},
    {id: 3, instrument: 'drums', inputMonitoring: false}];
  assert.deepEqual(toggleMonitoring(tracks, 1).map((t) => t.inputMonitoring), [true, false, false]);
  assert.deepEqual(toggleMonitoring(tracks, 2).map((t) => t.inputMonitoring), [false, false, false]);
  assert.deepEqual(toggleMonitoring(tracks, 3).map((t) => t.inputMonitoring), [false, false, false]);
});

test('the inspector preset value round-trips account and Factory presets', () => {
  assert.equal(presetValue({presetId: 7, factoryPreset: null}), 'account:7');
  assert.equal(presetValue({presetId: null, factoryPreset: 'factory:svt-bass'}), 'factory:svt-bass');
  assert.equal(presetValue({presetId: null, factoryPreset: null}), '');
  assert.deepEqual(presetFields('account:7'), {presetId: 7, factoryPreset: null});
  assert.deepEqual(presetFields('factory:svt-bass'), {presetId: null, factoryPreset: 'factory:svt-bass'});
  assert.deepEqual(presetFields(''), {presetId: null, factoryPreset: null});
});

test('only the changed fields of each track are saved', () => {
  const saved = [{id: 1, name: 'Rhythm', volume: 80, pan: 0, audio: {filename: 'a.wav'}}, {id: 2, name: 'Bass', volume: 80}];
  const current = [{...saved[0], volume: 60, pan: -20, audio: null}, {...saved[1]}, {id: 3, name: 'New'}];
  assert.deepEqual(trackChanges(saved, current), [{id: 1, changes: {volume: 60, pan: -20}}]);
});

test('a track plays at its volume unless muted or another track is soloed', () => {
  const tracks = [{id: 1, volume: 80, mute: false, solo: false}, {id: 2, volume: 60, mute: false, solo: false}, {id: 3, volume: 0, mute: false, solo: false}];
  assert.deepEqual(tracks.map((track) => Number(trackGain(track, tracks).toFixed(3))), [1, 0.501, 0]);
  assert.equal(trackGain({...tracks[0], mute: true}, tracks), 0);
  const soloed = [{...tracks[0], solo: true}, tracks[1]];
  assert.deepEqual(soloed.map((track) => trackGain(track, soloed)), [1, 0]);
});

test('the timeline counts 4/4 bars at the project tempo', () => {
  assert.deepEqual(timelineLength(0, 120), {bars: 16, seconds: 32});
  assert.deepEqual(timelineLength(70, 120), {bars: 35, seconds: 70});
  assert.deepEqual(timelineLength(70.1, 120), {bars: 36, seconds: 72});
  assert.deepEqual(rulerBars(16, 900).map(({bar}) => bar), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepEqual(rulerBars(16, 300).map(({bar}) => bar), [1, 5, 9, 13]);
  assert.equal(rulerBars(16, 300)[1].fraction, 0.25);
  assert.deepEqual([formatClock(0), formatClock(83.456), formatClock(-1)], ['00:00.00', '01:23.45', '00:00.00']);
  assert.deepEqual([barBeat(0, 120), barBeat(0.5, 120), barBeat(2, 120), barBeat(2.49, 120)], ['1.1', '1.2', '2.1', '2.1']);
});

// A Web Audio stand-in: params record their targets, sources their start/stop.
function fakeContext() {
  const node = (extra = {}) => ({targets: new Set(), connect(target) { this.targets.add(target); return target; },
    disconnect(target) { if (target) this.targets.delete(target); else { this.targets.clear(); this.disconnected = true; } }, ...extra});
  const param = () => ({value: 0, setTargetAtTime(value) { this.value = value; }});
  const context = {currentTime: 10, sources: [], resumed: 0,
    createGain: () => node({gain: param()}), createStereoPanner: () => node({pan: param()}),
    createBufferSource: () => { const source = node({start(when, offset) { Object.assign(this, {when, offset}); }, stop(until) { if (until === undefined) this.stopped = true; else this.until = until; }});
      context.sources.push(source); return source; },
    resume: async () => { context.resumed += 1; },
    decodeAudioData: async (data) => ({duration: data.byteLength, length: data.byteLength})};
  return context;
}
const audioOf = (seconds) => ({url: `/audio/${seconds}`, byteSize: seconds, filename: `${seconds}.wav`});
const fetchAudio = async (url) => ({ok: true, arrayBuffer: async () => new ArrayBuffer(Number(url.split('/').pop()))});
const loaded = (player, count) => new Promise((resolve) => {
  let seen = 0;
  player.addEventListener('load', () => { if (++seen === count) resolve(); });
});

test('a loop drawn on the ruler covers whole bars, or exact positions with Alt', () => {
  const length = {bars: 16, seconds: 32}; // 120 BPM: 2 s bars
  assert.deepEqual(snapLoop(9, 3.5, length), {start: 2, end: 10}, 'drawn backwards: bars 2 to 5');
  assert.deepEqual(snapLoop(4.2, 4.3, length), {start: 4, end: 6}, 'at least one bar');
  assert.deepEqual(snapLoop(31.5, 40, length), {start: 30, end: 32}, 'within the timeline');
  assert.deepEqual(snapLoop(3.5, 9, length, {free: true}), {start: 3.5, end: 9});
  assert.deepEqual(loopAround(9, length), {start: 8, end: 16}, 'the loop button: 4 bars from the playhead bar');
  assert.deepEqual(loopAround(31, length), {start: 24, end: 32});
  assert.equal(loopLabel({start: 8, end: 16}, 120), 'Bars 5–8');
  assert.equal(loopLabel({start: 8, end: 10}, 120), 'Bar 5');
  assert.equal(loopLabel({start: 2.5, end: 9}, 120), '2.2–5.3');
  assert.equal(loopLabel({start: 0, end: 0}, 120), '');
});

test('each project remembers its loop in bars, which follow a tempo change', () => {
  const bars = loopToBars({enabled: true, start: 16, end: 24}, 120);
  assert.deepEqual(bars, {enabled: true, start: 8, end: 12});
  assert.deepEqual(loopFromBars(bars, 60), {enabled: true, start: 32, end: 48}, 'bars 9-12 at half the tempo');
  for (const invalid of [undefined, {start: 3, end: 3}, {start: 'x', end: 4}, {start: -1, end: 2}]) {
    assert.deepEqual(loopFromBars(invalid, 120), {enabled: false, start: 0, end: 0});
  }
  let loops = rememberLoop(null, 1, bars);
  loops = rememberLoop(loops, 2, {enabled: false, start: 0, end: 4});
  loops = rememberLoop(loops, 1, {enabled: false, start: 8, end: 12});
  const ids = (list) => list.map((entry) => entry.id);
  assert.deepEqual(ids(loops), [2, 1], 'the most recent last');
  assert.deepEqual(rememberedLoop(loops, '1'), {id: 1, enabled: false, start: 8, end: 12});
  assert.deepEqual(ids(rememberLoop(loops, 2, {enabled: false, start: 0, end: 0})), [1], 'a cleared loop is forgotten');
  assert.deepEqual(ids(rememberLoop(loops, 3, bars, 2)), [1, 3], 'the oldest goes past the limit');
});

test('the project player starts every track on one clock and follows the mix', async () => {
  const context = fakeContext();
  const player = new ProjectPlayer(context, {fetchAudio});
  const tracks = [{id: 1, volume: 80, pan: -50, mute: false, solo: false, audio: audioOf(4)},
    {id: 2, volume: 80, pan: 0, mute: false, solo: false, audio: audioOf(6)}, {id: 3, volume: 80, pan: 0, mute: false, solo: false, audio: null}];
  const ready = loaded(player, 2);
  player.setTracks(tracks);
  await ready;
  assert.equal(player.duration, 6);
  assert.equal(player.channels.get(1).pan.pan.value, -0.5);

  await player.play();
  assert.equal(context.resumed, 1);
  assert.equal(context.sources.length, 2);
  assert.ok(context.sources.every((source) => source.when === context.sources[0].when && source.offset === 0));
  context.currentTime += 1.03;
  assert.ok(Math.abs(player.position - 1) < 1e-9);

  player.setTracks(tracks.map((track) => (track.id === 2 ? {...track, solo: true} : track)));
  assert.deepEqual([player.channels.get(1).gain.gain.value, player.channels.get(2).gain.gain.value], [0, 1]);
  assert.equal(context.sources.length, 2, 'a mix change does not restart playback');

  await player.seek(5);
  assert.equal(context.sources.length, 3, 'past its end, the 4 s track stays silent');
  assert.equal(context.sources.at(-1).offset, 5);
  player.pause();
  assert.equal(player.playing, false);
  assert.ok(context.sources.every((source) => source.stopped));
  player.stop();
  assert.equal(player.position, 0);
});

test('the project stops when its longest track ends, and a removed track stops at once', async () => {
  const context = fakeContext();
  const player = new ProjectPlayer(context, {fetchAudio});
  const ready = loaded(player, 2);
  player.setTracks([{id: 1, volume: 80, pan: 0, audio: audioOf(2)}, {id: 2, volume: 80, pan: 0, audio: audioOf(3)}]);
  await ready;
  await player.play();
  const [short, long] = context.sources;
  short.onended();
  assert.equal(player.playing, true);
  long.onended();
  assert.equal(player.playing, false);
  assert.equal(player.position, 3);

  await player.play(); // from the start again
  assert.equal(context.sources.at(-1).offset, 0);
  player.setTracks([{id: 2, volume: 80, pan: 0, audio: audioOf(3)}]);
  assert.ok(context.sources.at(-2).stopped);
  assert.equal(player.channels.size, 1);
  player.setTracks([]);
  assert.equal(player.playing, false);
});

// Timers run by hand: run() fires the pending one.
const near = (actual, expected) => assert.ok(actual.flat().every((value, index) => Math.abs(value - expected.flat()[index]) < 1e-9),
  `${JSON.stringify(actual)} ≈ ${JSON.stringify(expected)}`);
const scheduled = (sources) => sources.map(({when, offset, until}) => [when, offset, until]);

function fakeTimers() {
  const timers = {pending: null, setTimeout(callback, ms) { timers.pending = {callback, ms}; return 1; },
    clearTimeout() { timers.pending = null; }, run() { const {callback} = timers.pending; timers.pending = null; callback(); }};
  return timers;
}

test('a loop replays its region on every track together, each turn scheduled ahead', async () => {
  const context = fakeContext();
  const timers = fakeTimers();
  const player = new ProjectPlayer(context, {fetchAudio, timers});
  const ready = loaded(player, 2);
  player.setTracks([{id: 1, volume: 80, pan: 0, audio: audioOf(10)}, {id: 2, volume: 80, pan: 0, audio: audioOf(3)}]);
  await ready;
  player.setLoop({enabled: true, start: 6, end: 2}); // drawn backwards
  assert.deepEqual(player.loop, {enabled: true, start: 2, end: 6});
  player.seek(1);
  await player.play();
  let start = context.currentTime + 0.03;
  near(scheduled(context.sources), [[start, 2, start + 4], [start, 2, start + 4]]); // before the region: from its start
  await player.seek(2.5);
  start = context.currentTime + 0.03;
  near(scheduled(context.sources.slice(-2)), [[start, 2.5, start + 3.5], [start, 2.5, start + 3.5]]); // within it: from there
  await player.seek(1);
  start = context.currentTime + 0.03;
  context.sources.splice(0, context.sources.length - 2);
  assert.ok(Math.abs(timers.pending.ms - (0.03 + 4 - 0.25) * 1000) < 1e-6, 'the next turn is scheduled a little before it starts');

  timers.run();
  const turn = start + 4;
  near(scheduled(context.sources.slice(2)), [[turn, 2, turn + 4], [turn, 2, turn + 4]]); // the short track too
  context.currentTime = turn + 1.5;
  near([[player.position]], [[3.5]]);
  context.sources[0].onended(); // the first turn ended: the loop plays on
  context.sources[1].onended();
  assert.equal(player.playing, true);

  context.currentTime = turn + 4.5; // a late timer: the turn starts now, where it should be
  timers.run();
  near(scheduled(context.sources.slice(-1)), [[turn + 4.53, 2.53, turn + 8]]);

  player.stop();
  assert.equal(player.position, 2, 'Return to start goes to the loop start');
  assert.equal(timers.pending, null);
});

test('with the loop on, playing from after it starts at its start; without it, playback runs to the end', async () => {
  const context = fakeContext();
  const timers = fakeTimers();
  const player = new ProjectPlayer(context, {fetchAudio, timers});
  const ready = loaded(player, 1);
  player.setTracks([{id: 1, volume: 80, pan: 0, audio: audioOf(10)}]);
  await ready;
  player.setLoop({enabled: true, start: 2, end: 2.01});
  assert.equal(player.loopActive, false, 'a region shorter than 50 ms does not loop');
  player.setLoop({start: 2, end: 4});
  player.seek(5);
  await player.play();
  assert.equal(context.sources.at(-1).offset, 2);
  context.currentTime += 1;
  await player.setLoop({enabled: false}); // while playing: restarts where it is
  assert.equal(player.playing, true);
  assert.equal(context.sources.at(-1).until, undefined);
  assert.equal(timers.pending, null);
  context.currentTime += 3;
  assert.ok(player.position > 5, 'plays on past the region');
  player.stop();
  assert.equal(player.position, 0);
});

test('a file that cannot be loaded is reported for its track', async () => {
  const player = new ProjectPlayer(fakeContext(), {fetchAudio: async () => ({ok: false, status: 404})});
  const failed = new Promise((resolve) => player.addEventListener('error', ({detail}) => resolve(detail)));
  player.setTracks([{id: 7, volume: 80, pan: 0, audio: audioOf(1)}]);
  const {id, error} = await failed;
  assert.equal(id, 7);
  assert.match(error.message, /404/u);
  assert.equal(player.duration, 0);
});

test('a track plays through its insert, and input monitoring replaces its recording with the live guitar', () => {
  const context = fakeContext();
  const player = new ProjectPlayer(context, {fetchAudio});
  const track = {id: 1, instrument: 'guitar', volume: 80, pan: 0, audio: null, inputMonitoring: false};
  player.setTracks([track]);
  const channel = player.channels.get(1);
  assert.ok(channel.playback.targets.has(channel.gain));

  const insert = {input: context.createGain(), live: context.createGain(), output: context.createGain()};
  player.setInsert(1, insert);
  assert.ok(channel.playback.targets.has(insert.input) && !channel.playback.targets.has(channel.gain));
  assert.ok(insert.output.targets.has(channel.gain));

  const live = context.createGain();
  player.setLiveInput(live);
  assert.equal(live.targets.size, 0, 'no track monitors the input yet');
  player.setTracks([{...track, inputMonitoring: true}], 1);
  assert.equal(player.liveId, 1);
  assert.ok(live.targets.has(insert.live));
  assert.equal(channel.playback.gain.value, 0, 'the recording is replaced');

  player.setInsert(1, null);
  assert.ok(live.targets.has(channel.gain) && !live.targets.has(insert.live), 'without its preset, the guitar plays dry');
  assert.ok(!insert.output.targets.has(channel.gain));
  player.setTracks([{...track, inputMonitoring: false}]);
  assert.equal(live.targets.size, 0);
  assert.equal(channel.playback.gain.value, 1);
});

test('the live guitar follows the selected guitar or bass track with a preset, unless a track monitors the input', () => {
  const tracks = [{id: 1, instrument: 'guitar', factoryPreset: 'factory:twin-clean'}, {id: 2, instrument: 'drums'},
    {id: 3, instrument: 'bass', presetId: null}, {id: 4, instrument: 'bass', presetId: 5}];
  assert.deepEqual([1, 2, 3, 4, null].map((id) => liveTrackId(tracks, id)), [1, null, null, 4, null]);
  assert.equal(liveTrackId(toggleMonitoring(tracks, 3), 1), 3, 'the monitoring track wins over the selection');

  const context = fakeContext();
  const player = new ProjectPlayer(context, {fetchAudio});
  const changes = [];
  player.addEventListener('statechange', () => changes.push(player.liveId));
  const live = context.createGain();
  player.setLiveInput(live);
  player.setTracks([{id: 1, instrument: 'guitar', volume: 80, pan: 0, audio: null}], 1);
  assert.equal(player.liveId, null, 'Tone keeps the guitar until the preset rack is in');
  assert.equal(live.targets.size, 0);
  const insert = {input: context.createGain(), live: context.createGain(), output: context.createGain()};
  player.setInsert(1, insert);
  assert.equal(changes.at(-1), 1, 'the host hears that the guitar now plays through the track');
  assert.ok(live.targets.has(insert.live));
  assert.equal(player.channels.get(1).playback.gain.value, 1, 'the recording keeps playing');
  player.setTracks([{id: 1, instrument: 'guitar', volume: 80, pan: 0, audio: null}], null);
  assert.equal(player.liveId, null);
  assert.equal(live.targets.size, 0);
});

function fakeRack(log) {
  const variants = [];
  const gain = () => ({connect() {}, disconnect() {}});
  const rack = {a: {input: gain(), entries: [{kind: 'nam', plugin: {audioNode: {setModelVariant: async (variant) => variants.push(variant)}}}]},
    b: null, output: gain(), variants, states: [],
    setState: async (state) => rack.states.push(state),
    enqueue: (operation) => Promise.resolve().then(operation),
    destroy() { rack.destroyed = true; log.push('destroy'); }};
  return rack;
}

test('guitar and bass tracks with a preset get a rack, in the Lite variant unless the live guitar plays through them', async () => {
  assert.deepEqual([
    needsTone({instrument: 'guitar', factoryPreset: 'factory:twin-clean', audio: {}}),
    needsTone({id: 2, instrument: 'guitar', factoryPreset: 'factory:twin-clean', audio: null, inputMonitoring: true}, 2),
    needsTone({instrument: 'guitar', factoryPreset: 'factory:twin-clean', audio: null}),
    needsTone({id: 3, instrument: 'guitar', factoryPreset: 'factory:twin-clean', audio: null}, 3),
    needsTone({instrument: 'drums', audio: {}}), needsTone({instrument: 'bass', presetId: null, audio: {}}),
  ], [true, true, false, true, false, false]);

  const log = [], racks = [], inserts = [];
  const player = {setInsert: (id, insert) => inserts.push([id, insert])};
  const tones = new TrackTones({context: fakeContext(), player, createRack: async () => { const rack = fakeRack(log); racks.push(rack); return rack; },
    resolvePreset: async (track, projectId) => ({preset: presetValue(track), projectId, sourceTrim: {file: -12, live: 0}})});
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
  const guitar = {id: 1, instrument: 'guitar', factoryPreset: 'factory:british-edge', audio: {}, inputMonitoring: false};
  tones.setTracks([guitar, {id: 2, instrument: 'drums', audio: {}}], 9);
  assert.equal(tones.status(1).state, 'loading');
  assert.equal(tones.status(2), null);
  await settled();
  assert.equal(tones.status(1).state, 'ready');
  assert.deepEqual(racks[0].states, [{preset: 'factory:british-edge', projectId: 9, sourceTrim: {file: -12, live: 0}}]);
  assert.deepEqual(racks[0].variants, ['lite']);
  const [[id, insert]] = inserts;
  assert.equal(id, 1);
  assert.ok(Math.abs(insert.input.gain.value - 10 ** (-12 / 20)) < 1e-9, 'the DI gets the preset file trim');
  assert.equal(insert.live, racks[0].a.input);

  tones.setTracks([{...guitar, inputMonitoring: true}], 9, 1);
  await settled();
  assert.deepEqual(racks[0].variants, ['lite', 'full']);
  assert.equal(racks.length, 1, 'the same preset keeps its rack');

  tones.setTracks([{...guitar, factoryPreset: 'factory:twin-clean'}], 9);
  await settled();
  assert.equal(racks.length, 2);
  assert.ok(racks[0].destroyed);
  assert.deepEqual(inserts.at(-2), [1, null]);
  tones.setTracks([], 9);
  await settled();
  assert.ok(racks[1].destroyed);
  assert.equal(tones.status(1), null);
});

test('a preset that cannot be loaded leaves the track dry and is reported', async () => {
  const errors = [], log = [];
  const tones = new TrackTones({context: fakeContext(), player: {setInsert() { throw new Error('not expected'); }},
    createRack: async () => fakeRack(log), resolvePreset: async () => { throw new Error('HTTP 404'); }});
  tones.addEventListener('error', ({detail}) => errors.push([detail.id, detail.error.message]));
  tones.setTracks([{id: 4, instrument: 'bass', presetId: 3, audio: {}}], 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(tones.status(4).state, 'error');
  assert.deepEqual(errors, [[4, 'HTTP 404']]);
  assert.deepEqual(log, ['destroy'], 'the rack built meanwhile is released');
});

test('a preset saved again in Tone rebuilds its tracks\' racks, swapping once the new one is ready', async () => {
  const log = [], racks = [], inserts = [];
  let version = 1;
  const tones = new TrackTones({context: fakeContext(), player: {setInsert: (id, insert) => inserts.push([id, insert])},
    createRack: async () => { const rack = fakeRack(log); racks.push(rack); return rack; },
    resolvePreset: async () => ({version})});
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
  const saved = {id: 1, instrument: 'guitar', presetId: 7, audio: {}};
  tones.setTracks([saved, {id: 2, instrument: 'bass', presetId: 8, audio: {}}], 3);
  await settled();
  assert.equal(racks.length, 2);

  version = 2;
  tones.refresh('account:7');
  assert.equal(tones.status(1).state, 'loading');
  assert.ok(!racks[0].destroyed, 'the track keeps playing its previous rack meanwhile');
  await settled();
  assert.equal(tones.status(1).state, 'ready');
  assert.deepEqual(racks[2].states, [{version: 2}]);
  assert.equal(inserts.at(-1)[1].live, racks[2].a.input, 'the new rack replaces the previous one directly');
  assert.ok(racks[0].destroyed);
  assert.ok(!racks[1].destroyed, 'tracks with another preset keep their rack');
});

test('the account preset store reports its writes', async () => {
  const api = {createPreset: async (name) => ({id: 5, name}), updatePreset: async (id) => ({id}), deletePreset: async () => null};
  const store = new RemotePresetStore({api});
  const changes = [];
  store.addEventListener('change', ({detail}) => changes.push(detail));
  await store.create('Clean', {a: {}});
  await store.update(5, {state: {a: {}}});
  await store.update(5, {name: 'Crunch'});
  await store.delete(5);
  assert.deepEqual(changes, [{action: 'create', id: 5, state: undefined}, {action: 'update', id: 5, state: {a: {}}},
    {action: 'update', id: 5, state: undefined}, {action: 'delete', id: 5, state: undefined}]);
});

test('tracks move to an index of the timeline; the order is saved when it changed', () => {
  const tracks = [{id: 1}, {id: 2}, {id: 3}];
  assert.deepEqual(moveTrack(tracks, 3, 0).map((track) => track.id), [3, 1, 2]);
  assert.deepEqual(moveTrack(tracks, 1, 2).map((track) => track.id), [2, 3, 1]);
  assert.deepEqual(moveTrack(tracks, 2, 9).map((track) => track.id), [1, 3, 2]);
  assert.equal(moveTrack(tracks, 7, 0), tracks);
  assert.equal(orderChanged(tracks, [...tracks]), false);
  assert.equal(orderChanged(tracks, moveTrack(tracks, 3, 0)), true);
});

test('a shared-project link opens that project and leaves the URL clean', () => {
  const stored = new Map(), replaced = [];
  const storage = {setItem: (key, value) => stored.set(key, value)};
  const history = {state: null, replaceState: (state, title, url) => replaced.push(String(url))};
  assert.equal(takeLinkedProject({location: {href: 'https://rack.test/rack/?project=12&auto'}, history, storage}), true);
  assert.equal(stored.get('nam-a2-wam.project'), '12');
  assert.deepEqual(replaced, ['https://rack.test/rack/?auto=']);
  assert.equal(takeLinkedProject({location: {href: 'https://rack.test/rack/'}, history, storage}), false);
  assert.equal(replaced.length, 1);
});

test('the owner sees who a project is shared with', () => {
  assert.equal(shareSummary([]), '');
  assert.equal(shareSummary([{name: 'Ana Lima', email: 'ana@example.com'}]), 'Shared with Ana Lima');
  assert.equal(shareSummary([{email: 'a@x.io'}, {email: 'b@x.io'}]), 'Shared with 2 people');
  assert.equal(describeProject({owned: true, tracks: [], shares: [{email: 'bob@example.com', name: 'bob@example.com'}]}).kicker,
    'Project · 0 tracks · Shared with bob@example.com');
  assert.equal(describeProject({owned: false, owner: {name: 'Bob'}, tracks: [], shares: undefined}).kicker, 'Shared by Bob · 0 tracks');
  assert.deepEqual([initials('Ana Lima'), initials('bob@example.com'), initials('jean-luc.picard@x.io'), initials('')], ['AL', 'BO', 'JL', '?']);
});


test('accompaniment guitar and bass never create tone racks or take the live input', () => {
  for (const origin of ['original', 'stem', 'mix', 'unknown']) {
    const accompaniment = {id: 1, origin, instrument: 'guitar', factoryPreset: 'factory:twin-clean', inputMonitoring: true, audio: {url: '/stem.wav'}};
    assert.equal(usesTrackPreset(accompaniment), false);
    assert.equal(needsTone(accompaniment, 1), false);
    assert.equal(liveTrackId([accompaniment], 1), null);
    assert.equal(toggleMonitoring([{...accompaniment, inputMonitoring: false}], 1)[0].inputMonitoring, false);
    const changed = withInstrument(accompaniment, 'bass');
    assert.equal(changed.origin, origin);
    assert.equal(changed.factoryPreset, null);
    assert.equal(changed.inputMonitoring, false);
  }
  for (const origin of ['personal', 'legacy', undefined]) {
    assert.equal(usesTrackPreset({origin, instrument: 'guitar'}), true);
    assert.equal(usesTrackPreset({origin, instrument: 'drums'}), false);
  }
  assert.equal(originLabel({origin: 'stem'}), 'Separated stem');
});


test('a temporary instrument preview is never presented as saved to the account', () => {
  const description = describeProject({owned:true,name:'Song',tracks:[{id:1}]}, {previewTracks:Array.from({length:6},()=>({origin:'stem'}))});
  assert.equal(description.saveState,'Instruments in RAM');
  assert.match(description.kicker,/6 tracks/u);
  assert.match(description.meta,/other tracks remain in Project/u);
});


test('project labels count the active separation rather than adding four and six archived stems', () => {
  const project = {name:'Wonderwall',owned:true,activeSeparationId:6,trackCount:10,tracks:[
    {id:1,origin:'original'}, {id:2,origin:'mix'},
    ...Array.from({length:4},()=>({origin:'stem',separationId:4})),
    ...Array.from({length:6},()=>({origin:'stem',separationId:6}))]};
  assert.equal(projectOptionLabel(project),'Wonderwall · 6 tracks');
  assert.match(describeProject(project).kicker,/6 tracks/);
  project.activeSeparationId=4;
  assert.equal(projectOptionLabel(project),'Wonderwall · 4 tracks');
  project.activeSeparationId=null;
  assert.equal(projectOptionLabel(project),'Wonderwall · 1 track');
});


test('refreshing a project summary discards stale embedded tracks from its initial import', () => {
  const w={projects:[{id:7,name:'Song',tracks:[{id:1,origin:'original'}]}]};
  const project={id:7,name:'Song',bpm:120,activeSeparationId:6,tracks:Array.from({length:6},()=>({origin:'stem',separationId:6}))};
  ProjectsWorkspace.prototype.replaceSummary.call(w,project);
  assert.equal(projectOptionLabel(w.projects[0]),'Song · 6 tracks');
  assert.equal(w.projects[0].tracks,undefined);
});
