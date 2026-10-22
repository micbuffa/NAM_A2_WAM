import test from 'node:test';
import assert from 'node:assert/strict';
import {BackingTrackMix} from '../../examples/wam/backing-track-player/BackingTrackMix.js';
import {linkPlayAlong} from '../../examples/wam/backing-track-player/PlayAlong.js';

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
