import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspaces} from '../../examples/wam/Workspaces.js';

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values};
};

test('workspaces start on Tone, switch from the control and remember the choice', () => {
  const control = Object.assign(new EventTarget(), {value: 'tone'});
  const root = {dataset: {}};
  const storage = memoryStorage();
  const workspaces = new Workspaces({control, root, storage});
  assert.equal(root.dataset.workspace, 'tone');
  assert.equal(storage.values.size, 0, 'the default is not written');

  const seen = [];
  workspaces.addEventListener('change', (event) => seen.push(event.detail.workspace));
  control.value = 'tracks';
  control.dispatchEvent(new Event('change'));
  assert.equal(workspaces.current, 'tracks');
  assert.deepEqual(seen, ['tracks']);
  assert.equal(storage.values.get('nam-a2-wam.workspace'), 'tracks');

  workspaces.show('elsewhere');
  assert.equal(workspaces.current, 'tracks', 'unknown workspaces are ignored');
  workspaces.show('tone');
  assert.equal(control.value, 'tone', 'showing a workspace updates the control');
});

test('a remembered workspace is restored, and broken storage falls back to Tone', () => {
  const control = Object.assign(new EventTarget(), {value: 'tone'});
  const root = {dataset: {}};
  new Workspaces({control, root, storage: memoryStorage({'nam-a2-wam.workspace': 'tracks'})});
  assert.deepEqual([root.dataset.workspace, control.value], ['tracks', 'tracks']);
  const throwing = {getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }};
  const fallback = new Workspaces({control, root: {dataset: {}}, storage: throwing});
  assert.equal(fallback.current, 'tone');
  fallback.show('tracks');
  assert.equal(fallback.current, 'tracks');
});

test('the Tracks cards describe the active tone and the guitar source', async () => {
  const {describeTone, describeGuitar} = await import('../../examples/wam/TracksPanel.js');
  assert.deepEqual(describeTone(), {name: 'Untitled rack', meta: 'Not saved as a preset · 1 chain'});
  assert.deepEqual(describeTone({name: 'British Edge', meta: 'Factory · Crunch', chains: 2}), {name: 'British Edge', meta: 'Factory · Crunch · 2 chains'});

  const off = describeGuitar({source: 'live', live: false, inputDb: -6, outputDb: 1.5});
  assert.equal(off.detail, 'Monitoring is off');
  assert.equal(off.action, 'Enable live input');
  assert.equal(off.levels, 'Input -6.0 dB · Output +1.5 dB');

  const live = describeGuitar({source: 'live', live: true, input: {label: 'Scarlett 2i2', channelIndex: 1, channelCount: 2}});
  assert.equal(live.state, 'live');
  assert.equal(live.detail, 'Listening through the active tone · Scarlett 2i2 · input 2/2');
  assert.equal(live.action, 'Disable live input');

  const file = describeGuitar({source: 'clean-riff.wav', live: false});
  assert.deepEqual([file.name, file.detail, file.action], ['Dry guitar file', 'clean-riff.wav', null]);
});
