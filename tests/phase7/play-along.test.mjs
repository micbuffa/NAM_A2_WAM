import test from 'node:test';
import assert from 'node:assert/strict';
import {BackingTrackMix} from '../../examples/wam/backing-track-player/BackingTrackMix.js';
import {linkPlayAlong, linkSpaceKey, spaceAction, typesSpace} from '../../examples/wam/backing-track-player/PlayAlong.js';
import {PlayAlongMemory, STORAGE_KEY, playAlongSettings} from '../../examples/wam/backing-track-player/PlayAlongMemory.js';

function fakeContext() {
  const param = () => ({value: 0, setTargetAtTime(value) { this.value = value; }});
  const node = () => ({connections: new Set(), gain: param(), pan: param(),
    connect(to) { this.connections.add(to); return to; }, disconnect(to) { if (to) this.connections.delete(to); else this.connections.clear(); }});
  return {destination: node(), state: 'running', currentTime: 0, createGain: node, createStereoPanner: node, createChannelSplitter: node,
    createAnalyser: () => ({...node(), getFloatTimeDomainData(data) { data.fill(0); }})};
}

// A player that flips `playing` and announces it like the real ones.
function fakePlayer(event) {
  const player = Object.assign(new EventTarget(), {playing: false});
  player.play = () => { player.playing = true; player.dispatchEvent(new Event(event)); };
  player.pause = () => { player.playing = false; player.dispatchEvent(new Event(event)); };
  return player;
}

test('the Play along mix sums the rack and the backing track into the given destination', () => {
  const context = fakeContext(), rackOutput = context.createGain(), toneGate = context.createGain();
  const engine = Object.assign(fakePlayer('transport-change'), {outputNode: context.createGain(), mix: .5, guitarPan: 0});
  const player = Object.assign(new EventTarget(), {engine});
  const mix = new BackingTrackMix(context, rackOutput, player, {destination: toneGate});
  assert.ok(mix.output.connections.has(toneGate));
  assert.ok(!mix.output.connections.has(context.destination), 'only the destination given');
  assert.ok(rackOutput.connections.has(mix.guitarPan));
  assert.ok(engine.outputNode.connections.has(mix.backingGain));
  assert.equal(typeof player.readMixLevel, 'function');
  mix.destroy();
  assert.equal(mix.output.connections.size, 0);
  assert.equal(new BackingTrackMix(context, rackOutput, player).output.connections.has(context.destination), true, 'speakers by default');
});

test('one player at a time: the backing track and the open project pause each other', () => {
  const engine = fakePlayer('transport-change'), projectPlayer = fakePlayer('statechange');
  const workspaces = Object.assign(new EventTarget(), {current: 'tone'});
  const unlink = linkPlayAlong({engine, projectPlayer, workspaces});
  projectPlayer.play();
  engine.play();
  assert.deepEqual([engine.playing, projectPlayer.playing], [true, false]);
  projectPlayer.play();
  assert.deepEqual([engine.playing, projectPlayer.playing], [false, true]);
  unlink();
  engine.play();
  assert.deepEqual([engine.playing, projectPlayer.playing], [true, true], 'unlinked');
});

test('leaving Tone pauses the backing track, the open project keeps playing', () => {
  const engine = fakePlayer('transport-change'), projectPlayer = fakePlayer('statechange');
  const workspaces = Object.assign(new EventTarget(), {current: 'tone'});
  linkPlayAlong({engine, projectPlayer, workspaces});
  engine.play();
  workspaces.current = 'projects';
  workspaces.dispatchEvent(new Event('change'));
  assert.equal(engine.playing, false);
  projectPlayer.play();
  workspaces.current = 'tone';
  workspaces.dispatchEvent(new Event('change'));
  assert.equal(projectPlayer.playing, true);
});

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values};
};

// The dock and its engine, enough for the memory: state in, setState out.
function fakeDock(state = {}) {
  const engine = {loading: false, applied: null,
    state: {version: 1, track: null, position: 0, loop: {enabled: true, startSeconds: 0, endSeconds: 0}, rate: 1, volumeDb: -12,
      muted: false, normalized: false, autoNormalize: true, mix: .5, guitarPan: 0, ...state},
    getState() { return structuredClone(this.state); },
    async setState(next) { this.applied = next; this.state = structuredClone(next); }};
  const dock = Object.assign(new EventTarget(), {engine, expanded: false, setExpanded(value) { this.expanded = value; }});
  return dock;
}
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

test('Play along settings are saved in this browser, without position or a local file', async () => {
  const storage = memoryStorage(), dock = fakeDock();
  const memory = new PlayAlongMemory({player: dock, storage, delay: 0});
  await memory.restore();
  dock.engine.state = {...dock.engine.state, track: {id: 'bt-e593dafe4c5eefe3', title: 'Cryin'}, position: 42, rate: .85,
    loop: {enabled: true, startSeconds: 10, endSeconds: 20}};
  dock.expanded = true;
  dock.dispatchEvent(new Event('transport-change')); // the element forwards the engine's events
  await tick();
  const saved = JSON.parse(storage.values.get(STORAGE_KEY));
  assert.equal(saved.trackId, 'bt-e593dafe4c5eefe3');
  assert.equal(saved.rate, .85);
  assert.equal(saved.expanded, true);
  assert.deepEqual(saved.loop, {enabled: true, startSeconds: 10, endSeconds: 20});
  assert.equal('position' in saved, false);
  assert.equal(playAlongSettings({...dock.engine.state, track: {id: 'local:x', local: true}}, false).trackId, null, 'device files are not remembered');
});

test('restoring loads the remembered track at its loop start, without playing', async () => {
  const settings = {trackId: 'bt-e593dafe4c5eefe3', rate: .9, volumeDb: -6, mix: .7, guitarPan: .2, expanded: true,
    loop: {enabled: true, startSeconds: 12, endSeconds: 30}};
  const dock = fakeDock();
  await new PlayAlongMemory({player: dock, storage: memoryStorage({[STORAGE_KEY]: JSON.stringify(settings)})}).restore();
  const applied = dock.engine.applied;
  assert.deepEqual(applied.track, {id: 'bt-e593dafe4c5eefe3'});
  assert.deepEqual([applied.rate, applied.volumeDb, applied.mix, applied.guitarPan, applied.position], [.9, -6, .7, .2, 12]);
  assert.equal(applied.autoNormalize, true, 'missing keys keep the engine defaults');
  assert.equal(dock.expanded, true);
});

test('signed in, the account settings win and changes are saved to the account', async () => {
  const writes = [];
  const account = {signedIn: true, user: {preferences: {playAlong: {trackId: null, mix: .3, expanded: false}}},
    updatePreference: async (key, value) => { writes.push([key, value]); }};
  const storage = memoryStorage({[STORAGE_KEY]: JSON.stringify({mix: .9})});
  const dock = fakeDock();
  await new PlayAlongMemory({player: dock, account, storage, delay: 0}).restore();
  assert.equal(dock.engine.applied.mix, .3);
  dock.engine.state.volumeDb = -3;
  dock.dispatchEvent(new Event('transport-change'));
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'playAlong');
  assert.equal(writes[0][1].volumeDb, -3);
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY)).volumeDb, -3, 'this browser keeps a copy');
});

test('a broken restore keeps the defaults and still remembers later changes', async () => {
  const storage = memoryStorage({[STORAGE_KEY]: JSON.stringify({trackId: 'bt-0000000000000000'})}), dock = fakeDock();
  dock.engine.setState = async () => { throw new Error('Track missing from library'); };
  const warn = console.warn; console.warn = () => {};
  try { await new PlayAlongMemory({player: dock, storage, delay: 0}).restore(); } finally { console.warn = warn; }
  dock.engine.state.mix = .8;
  dock.dispatchEvent(new Event('transport-change'));
  await tick();
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY)).mix, .8);
});

test('Space pauses whichever player plays, else plays the shown workspace\'s', () => {
  const engine = {playing: false, buffer: {}, loading: false, play: () => 'engine play', pause: () => 'engine pause'};
  const projectPlayer = {playing: false, duration: 10, play: () => 'project play', pause: () => 'project pause'};
  const action = (workspace) => spaceAction({engine, projectPlayer, workspace})?.() ?? null;
  assert.equal(action('tone'), 'engine play');
  assert.equal(action('projects'), 'project play');
  projectPlayer.playing = true;
  assert.equal(action('tone'), 'project pause', 'the project playing in Tone pauses');
  projectPlayer.playing = false;
  engine.playing = true;
  assert.equal(action('projects'), 'engine pause');
  Object.assign(engine, {playing: false, buffer: null});
  projectPlayer.duration = 0;
  assert.equal(action('tone'), null, 'nothing to play');
  assert.equal(action('projects'), null);
});

test('Space types in text fields but plays from buttons and sliders, not in a dialog', () => {
  const element = (localName, extra = {}) => ({localName, closest: (selector) => (extra.inField && selector.includes('textarea') ? {} : null), ...extra});
  assert.equal(typesSpace(element('input', {type: 'text'})), true);
  assert.equal(typesSpace(element('input', {type: 'number'})), true);
  assert.equal(typesSpace(element('input', {type: 'range'})), false);
  assert.equal(typesSpace(element('button')), false);
  assert.equal(typesSpace(element('div', {inField: true})), true);

  const root = new EventTarget();
  let open = null;
  root.querySelector = () => open;
  const played = [];
  const engine = {playing: false, buffer: {}, play: () => played.push('engine')};
  const projectPlayer = {playing: false, duration: 0};
  const unlink = linkSpaceKey({engine, projectPlayer, workspaces: {current: 'tone'}, root, run: (operation) => operation()});
  const press = (type = 'keydown', extra = {}) => {
    const {target = element('button'), ...fields} = extra;
    const event = Object.assign(new Event(type, {cancelable: true}), {key: ' ', composedPath: () => [target], ...fields});
    root.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(press(), true);
  assert.equal(press('keyup'), true, 'the keyup would click a native button');
  assert.equal(press('keydown', {repeat: true}), true, 'a held key plays once');
  assert.equal(press('keydown', {target: element('input', {type: 'text'})}), false);
  assert.equal(press('keydown', {metaKey: true}), false);
  open = {};
  assert.equal(press(), false, 'a dialog is open');
  assert.deepEqual(played, ['engine']);
  unlink();
  open = null;
  assert.equal(press(), false);
});
