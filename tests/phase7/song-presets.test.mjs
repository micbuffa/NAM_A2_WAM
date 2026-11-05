import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SONG_PRESET, MAX_CHOICES, STORAGE_KEY, SongPresets, linkSongPresets} from '../../examples/wam/backing-track-player/SongPresets.js';

function memoryStorage() {
  const values = new Map();
  return {getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), values};
}

const factory = {id: 'bt-0123456789abcdef', title: 'Born To Be Wild'};

test('a track plays through its chosen preset, else its own, else the default', async () => {
  const songs = new SongPresets({storage: memoryStorage()});
  assert.equal(songs.presetFor(factory), DEFAULT_SONG_PRESET);
  assert.equal(songs.presetFor({...factory, preset: 'factory:british-edge'}), 'factory:british-edge', 'a Factory track can name its preset');
  await songs.remember(factory, 42);
  assert.equal(songs.presetFor({...factory, preset: 'factory:british-edge'}), 42, "the user's choice wins");
  assert.equal(songs.presetFor(factory, (id) => id !== 42), DEFAULT_SONG_PRESET, 'a deleted preset falls back');
  assert.equal(songs.presetFor(null), DEFAULT_SONG_PRESET);
});

test('files from this device are not remembered', async () => {
  const storage = memoryStorage(), songs = new SongPresets({storage});
  const file = {id: 'local-1', local: true, title: 'my-backing.mp3'};
  await songs.remember(file, 'factory:modern-metal');
  assert.equal(storage.values.size, 0);
  assert.equal(songs.presetFor(file), DEFAULT_SONG_PRESET);
});

test('guests keep their choices in this browser, the newest ones first to stay', async () => {
  const storage = memoryStorage(), songs = new SongPresets({storage});
  for (let i = 0; i <= MAX_CHOICES; i++) await songs.remember({id: `studio-${i + 1}`}, i + 1);
  const kept = JSON.parse(storage.values.get(STORAGE_KEY));
  assert.equal(Object.keys(kept).length, MAX_CHOICES);
  assert.equal(kept['studio-1'], undefined, 'the oldest choice goes');
  await songs.remember({id: 'studio-2'}, 7);
  assert.equal(Object.keys(JSON.parse(storage.values.get(STORAGE_KEY))).at(-1), 'studio-2', 'a new choice moves last');
  assert.equal(new SongPresets({storage}).choice({id: 'studio-2'}), 7);
});

test('signed-in users keep their choices in the account preferences', async () => {
  const updates = [], storage = memoryStorage();
  const account = {signedIn: true, user: {preferences: {songPresets: {[factory.id]: 'factory:svt-bass'}}},
    updatePreference(key, value) { updates.push([key, value]); this.user.preferences[key] = value; return Promise.resolve(); }};
  const songs = new SongPresets({account, storage});
  assert.equal(songs.choice(factory), 'factory:svt-bass');
  await songs.remember(factory, 'factory:svt-bass');
  assert.equal(updates.length, 0, 'an unchanged choice is not sent');
  await songs.remember({id: 'studio-3'}, 12);
  assert.deepEqual(updates, [['songPresets', {[factory.id]: 'factory:svt-bass', 'studio-3': 12}]]);
  assert.equal(storage.values.size, 0, 'nothing in this browser');
});

// A Play along player, presets panel and rack dock reduced to what the link uses.
function linkFixture({modified = false, play = true, activeId = 'factory:twin-clean'} = {}) {
  const player = Object.assign(new EventTarget(), {engine: {track: null}, library: {tracks: [{...factory, preset: 'factory:modern-metal'}]}});
  const names = {'factory:twin-clean': 'Twin Clean', 'factory:modern-metal': 'Modern Metal', 'factory:british-edge': 'British Edge'};
  const presets = Object.assign(new EventTarget(), {activeId, externalEditor: null, loads: [], modified,
    find: (id) => (names[id] ? {id, name: names[id]} : null), isModified: async () => presets.modified,
    load: async (id) => { presets.loads.push(id); presets.activeId = id; }});
  presets.choose = (id) => { presets.activeId = id; presets.dispatchEvent(new CustomEvent('preset-chosen', {detail: {id}})); };
  const dock = {collapsed: true, setCollapsed(value) { this.collapsed = value; }};
  const reports = [], state = {play};
  const songs = new SongPresets({storage: memoryStorage()});
  const start = (track) => player.dispatchEvent(new CustomEvent('load-progress', {detail: {title: track.title, id: track.id, local: !!track.local, progress: 0, phase: 'transfer'}}));
  return {player, presets, dock, reports, state, songs, start,
    link: () => linkSongPresets({player, presets, songs, dock, isPlay: () => state.play, report: (text) => reports.push(text)})};
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('a track that starts loading in Play opens the rack on its preset', async () => {
  const f = linkFixture();
  await f.link();
  f.start(factory);
  await settle();
  assert.deepEqual(f.presets.loads, ['factory:modern-metal'], "the library track's own preset (the engine track has no preset)");
  assert.equal(f.dock.collapsed, false);
  f.player.dispatchEvent(new CustomEvent('track-change', {detail: {id: factory.id, title: factory.title, local: false}}));
  await settle();
  assert.equal(f.presets.loads.length, 1, 'already active once loaded');
  f.start({id: 'local-1', title: 'my-backing.mp3', local: true});
  await settle();
  assert.deepEqual(f.presets.loads, ['factory:modern-metal', 'factory:twin-clean'], 'a device file gets the default');
});

test('unsaved rack changes stay, outside Play and in Studio nothing moves', async () => {
  const f = linkFixture({modified: true});
  await f.link();
  f.start(factory);
  await settle();
  assert.deepEqual(f.presets.loads, []);
  assert.match(f.reports[0], /Unsaved rack changes kept: “Modern Metal” was not loaded/);
  f.presets.modified = false;
  f.state.play = false;
  f.start(factory);
  await settle();
  f.state.play = true;
  f.presets.externalEditor = {};
  f.start(factory);
  await settle();
  assert.deepEqual(f.presets.loads, []);
  assert.equal(f.dock.collapsed, false, 'only the first, in Play, opened the dock');
});

test('the track restored with the page gets its preset quietly', async () => {
  const f = linkFixture({modified: true});
  f.player.engine.track = {id: factory.id, title: factory.title, local: false};
  await f.link();
  assert.deepEqual(f.reports, [], 'a restored draft is kept without a message');
  f.presets.modified = false;
  const g = linkFixture();
  g.player.engine.track = {id: factory.id, title: factory.title, local: false};
  await g.link();
  assert.deepEqual(g.presets.loads, ['factory:modern-metal']);
});

test('a preset the user picks while a track is open in Play becomes its preset', async () => {
  const f = linkFixture();
  await f.link();
  f.presets.choose('factory:british-edge');
  assert.equal(f.songs.choice(factory), null, 'no track open yet');
  f.start(factory);
  await settle();
  f.presets.choose('factory:british-edge');
  await settle();
  assert.equal(f.songs.choice(factory), 'factory:british-edge');
  assert.deepEqual(f.presets.loads, ['factory:modern-metal'], 'the automatic load is not a choice');

  f.start({id: 'studio-9', title: 'Jam'});
  await settle();
  assert.deepEqual(f.presets.loads.at(-1), 'factory:twin-clean');
  f.start(factory);
  await settle();
  assert.equal(f.presets.loads.at(-1), 'factory:british-edge', 'coming back to the track brings the chosen preset');

  f.state.play = false;
  f.presets.choose('factory:twin-clean');
  f.state.play = true;
  f.presets.externalEditor = {};
  f.presets.choose('factory:twin-clean');
  await settle();
  assert.equal(f.songs.choice(factory), 'factory:british-edge', 'outside Play and in Studio nothing is remembered');

  f.presets.externalEditor = null;
  f.player.dispatchEvent(new CustomEvent('track-change', {detail: null}));
  f.presets.choose('factory:twin-clean');
  await settle();
  assert.equal(f.songs.choice(factory), 'factory:british-edge', 'no track open after the player is cleared');
});
