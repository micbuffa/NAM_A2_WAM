import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AudioDevicesDialog} from '../../examples/wam/AudioDevicesDialog.js';

function fixture({recoverHidden = true, options = 1} = {}) {
  const close = {};
  const dialog = {open: false, showModal() { this.open = true; this.shown = (this.shown ?? 0) + 1; }, close(value) { this.open = false; this.returnValue = value; }, querySelector: () => close};
  const nav = new EventTarget();
  const item = {dataset: {}, title: ''};
  const recover = {hidden: recoverHidden};
  const input = {options: {length: options}};
  let notify;
  class Observer { constructor(callback) { notify = callback; } observe() {} }
  const view = new AudioDevicesDialog({dialog, nav, item, recover, input, Observer});
  return {view, dialog, nav, item, recover, input, close, notify: () => notify()};
}

test('the nav Audio devices entry opens the popup once, and its close button closes it', () => {
  const f = fixture();
  f.nav.dispatchEvent(new Event('devices'));
  f.nav.dispatchEvent(new Event('devices'));
  assert.equal(f.dialog.open, true);
  assert.equal(f.dialog.shown, 1);
  f.close.onclick();
  assert.equal(f.dialog.open, false);
});

test('the nav entry flags recovery and a missing input device', () => {
  const f = fixture();
  assert.equal('alert' in f.item.dataset, false);
  assert.equal(f.item.title, 'Audio devices');
  f.recover.hidden = false; f.notify();
  assert.equal('alert' in f.item.dataset, true);
  assert.match(f.item.title, /recovering/);
  f.recover.hidden = true; f.input.options.length = 0; f.notify();
  assert.match(f.item.title, /no audio input device/);
  f.input.options.length = 2; f.notify();
  assert.equal('alert' in f.item.dataset, false);
});

test('device controls live in the popup, outside the navigation column', async () => {
  const html = await readFile(new URL('../../examples/wam/index.html', import.meta.url), 'utf8');
  const sidebar = html.slice(html.indexOf('<aside class="host-sidebar"'), html.indexOf('</aside>'));
  const dialog = html.slice(html.indexOf('<dialog class="tl-modal host-devices-dialog"'), html.indexOf('</dialog>'));
  for (const id of ['inputDevice', 'outputDevice', 'authorizeOutput', 'refreshDevices', 'recoverAudio']) {
    assert.match(dialog, new RegExp(`id="${id}"`));
    assert.doesNotMatch(sidebar, new RegExp(`id="${id}"`));
  }
});
