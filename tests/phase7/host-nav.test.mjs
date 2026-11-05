import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HostNav} from '../../examples/wam/HostNav.js';
import {Workspaces} from '../../examples/wam/Workspaces.js';

function item(nav) {
  const attributes = new Map();
  return {dataset: {nav}, disabled: false, closest() { return this; },
    setAttribute: (k, v) => attributes.set(k, String(v)), removeAttribute: (k) => attributes.delete(k), getAttribute: (k) => attributes.get(k) ?? null};
}
function fixture(saved = null, broken = false) {
  const items = ['tone', 'projects', 'devices'].map(item);
  const nav = Object.assign(new EventTarget(), {querySelectorAll: () => items});
  const attributes = new Map();
  const toggle = Object.assign(new EventTarget(), {setAttribute: (k, v) => attributes.set(k, v)});
  const root = {dataset: {}}, writes = [];
  const storage = {getItem() { if (broken) throw Error('Denied'); return saved; }, setItem(k, v) { if (broken) throw Error('Denied'); writes.push([k, v]); }};
  const hostNav = new HostNav({nav, toggle, root, storage});
  const by = Object.fromEntries(items.map((entry) => [entry.dataset.nav, entry]));
  return {hostNav, by, toggle, attributes, root, writes};
}

test('collapse preference restores, toggles accessibly and persists', () => {
  const f = fixture('collapsed');
  assert.equal(f.root.dataset.hostNav, 'collapsed');
  assert.equal(f.attributes.get('aria-expanded'), 'false');
  assert.equal(f.attributes.get('aria-label'), 'Expand navigation');
  f.toggle.dispatchEvent(new Event('click'));
  assert.equal(f.root.dataset.hostNav, 'expanded');
  assert.equal(f.attributes.get('aria-label'), 'Collapse navigation');
  assert.deepEqual(f.writes, [['nam-a2.host-nav', 'expanded']]);
  f.hostNav.destroy();
  assert.equal(f.root.dataset.hostNav, undefined);
});

test('unavailable storage keeps the navigation expanded and usable', () => {
  const f = fixture(null, true);
  assert.equal(f.root.dataset.hostNav, 'expanded');
  f.hostNav.setCollapsed(true);
  assert.equal(f.root.dataset.hostNav, 'collapsed');
});

test('nav drives Workspaces: Studio always leads to its Home, devices is an action', () => {
  const f = fixture();
  const root = {dataset: {}};
  const workspaces = new Workspaces({control: f.hostNav, root, storage: null});
  assert.equal(root.dataset.workspace, 'tone');
  assert.equal(f.by.tone.getAttribute('aria-current'), 'page');
  const events = [];
  for (const name of ['home', 'devices']) f.hostNav.addEventListener(name, () => events.push(name));
  f.hostNav.click({target: f.by.projects});
  assert.equal(workspaces.current, 'projects');
  assert.equal(f.by.projects.getAttribute('aria-current'), 'page');
  assert.equal(f.by.tone.getAttribute('aria-current'), null);
  f.hostNav.click({target: f.by.projects});
  assert.equal(workspaces.current, 'projects');
  f.hostNav.click({target: f.by.devices});
  assert.deepEqual(events, ['home', 'home', 'devices']);
  assert.equal(workspaces.current, 'projects');
});

test('locking (recording) disables workspace entries but keeps Audio devices', () => {
  const f = fixture();
  const workspaces = new Workspaces({control: f.hostNav, root: {dataset: {}}, storage: null});
  f.hostNav.disabled = true;
  assert.equal(f.by.tone.disabled, true);
  assert.equal(f.by.projects.disabled, true);
  assert.equal(f.by.devices.disabled, false);
  f.hostNav.activate('projects');
  assert.equal(workspaces.current, 'tone');
  f.hostNav.disabled = false;
  f.hostNav.activate('projects');
  assert.equal(workspaces.current, 'projects');
});

test('the left column holds navigation entries, Audio devices and Tuner at the bottom, then the collapse toggle', async () => {
  const html = await readFile(new URL('../../examples/wam/index.html', import.meta.url), 'utf8');
  const sidebar = html.slice(html.indexOf('<aside class="host-sidebar"'), html.indexOf('<main class="rack-stage"'));
  for (const nav of ['tone', 'projects', 'devices']) assert.match(sidebar, new RegExp(`data-nav="${nav}"`));
  assert.match(sidebar, /class="host-nav host-nav-bottom">[\s\S]*?<button[^>]*data-nav="devices"[^>]*>[\s\S]*?<\/button>\s*<button[^>]*id="tunerButton"[\s\S]*id="settingsButton"[\s\S]*id="hostNavToggle"[^>]*aria-controls="hostSidebar"/);
  assert.doesNotMatch(html, /id="workspaceSwitch"|id="studioSidebarToggle"|data-nav="home"/);
});
