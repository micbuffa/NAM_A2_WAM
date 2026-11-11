import test from 'node:test';
import assert from 'node:assert/strict';
import {saveShortcut, installSaveShortcut} from '../../examples/wam/SaveShortcut.js';

const doc = (dialogs = []) => ({querySelectorAll: () => dialogs.map(name => ({classList: {contains: c => c === name}}))});
const event = (key, values = {}, dialogs = []) => ({key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, repeat: false,
  target: {ownerDocument: doc(dialogs)}, ...values});

test('⌘S on Mac and Ctrl+S elsewhere save, other combinations are left alone', () => {
  assert.equal(saveShortcut(event('s', {metaKey: true}), {mac: true}), 'save');
  assert.equal(saveShortcut(event('S', {ctrlKey: true})), 'save');
  for (const [values, options] of [[{ctrlKey: true}, {mac: true}], [{metaKey: true}, {}], [{metaKey: true, ctrlKey: true}, {mac: true}],
    [{ctrlKey: true, shiftKey: true}, {}], [{ctrlKey: true, altKey: true}, {}], [{ctrlKey: true, defaultPrevented: true}, {}], [{}, {}]])
    assert.equal(saveShortcut(event('s', values), options), null);
  assert.equal(saveShortcut(event('z', {ctrlKey: true})), null);
});

test('typing, key repeat and dialogs only stop the browser save, except the FX editor', () => {
  const field = {matches: selector => selector.startsWith('input')};
  assert.equal(saveShortcut(event('s', {ctrlKey: true, composedPath: () => [field]})), 'ignore');
  assert.equal(saveShortcut(event('s', {ctrlKey: true, repeat: true})), 'ignore');
  assert.equal(saveShortcut(event('s', {ctrlKey: true}, ['tl-modal'])), 'ignore');
  assert.equal(saveShortcut(event('s', {ctrlKey: true}, ['fx-editor'])), 'save');
  assert.equal(saveShortcut(event('s', {ctrlKey: true, composedPath: () => [{tagName: 'PLUGIN-GUI'}]})), 'save');
});

test('the shortcut presses the current workspace button only when it is shown and enabled', () => {
  let listener; const root = {addEventListener: (type, fn) => { listener = fn; }};
  const button = (values) => ({clicks: 0, offsetParent: {}, disabled: false, click() { this.clicks++; }, ...values});
  const preset = button(), project = button({disabled: true}), workspaces = {current: 'tone'};
  const shortcut = installSaveShortcut({root, workspaces, mac: false, buttons: {tone: () => preset, projects: () => project}});
  assert.deepEqual(shortcut, {label: 'Ctrl+S', aria: 'Control+S'});
  let prevented = 0; const press = () => listener(event('s', {ctrlKey: true, preventDefault: () => prevented++}));
  press(); assert.equal(preset.clicks, 1);
  workspaces.current = 'projects'; press(); assert.equal(project.clicks, 0);
  project.disabled = false; project.offsetParent = null; press(); assert.equal(project.clicks, 0);
  project.offsetParent = {}; press(); assert.equal(project.clicks, 1);
  assert.equal(prevented, 4);
});
