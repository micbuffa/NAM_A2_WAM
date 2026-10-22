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
  control.value = 'projects';
  control.dispatchEvent(new Event('change'));
  assert.equal(workspaces.current, 'projects');
  assert.deepEqual(seen, ['projects']);
  assert.equal(storage.values.get('nam-a2-wam.workspace'), 'projects');

  workspaces.show('elsewhere');
  assert.equal(workspaces.current, 'projects', 'unknown workspaces are ignored');
  workspaces.show('tone');
  assert.equal(control.value, 'tone', 'showing a workspace updates the control');
});

test('a remembered workspace is restored, and broken storage falls back to Tone', () => {
  const control = Object.assign(new EventTarget(), {value: 'tone'});
  const root = {dataset: {}};
  new Workspaces({control, root, storage: memoryStorage({'nam-a2-wam.workspace': 'projects'})});
  assert.deepEqual([root.dataset.workspace, control.value], ['projects', 'projects']);
  const throwing = {getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }};
  const fallback = new Workspaces({control, root: {dataset: {}}, storage: throwing});
  assert.equal(fallback.current, 'tone');
  fallback.show('projects');
  assert.equal(fallback.current, 'projects');
});

test('a workspace remembered as Tracks opens Projects', () => {
  const control = Object.assign(new EventTarget(), {value: 'tone'});
  const root = {dataset: {}};
  new Workspaces({control, root, storage: memoryStorage({'nam-a2-wam.workspace': 'tracks'})});
  assert.equal(root.dataset.workspace, 'projects');
});
