import test from 'node:test';
import assert from 'node:assert/strict';
import {RackDock} from '../../examples/wam/RackDock.js';

function fixture(saved = null, broken = false) {
  const attributes = new Map(), writes = [];
  const button = Object.assign(new EventTarget(), {setAttribute: (k, v) => attributes.set(k, v)});
  const root = {dataset: {}};
  const storage = {getItem() { if (broken) throw Error('Denied'); return saved; }, setItem(k, v) { if (broken) throw Error('Denied'); writes.push([k, v]); }};
  return {dock: new RackDock({button, root, storage}), button, root, attributes, writes};
}

test('the rack dock restores its collapsed state, toggles accessibly and remembers it', () => {
  const f = fixture('collapsed');
  assert.equal(f.root.dataset.rackDock, 'collapsed');
  assert.equal(f.attributes.get('aria-expanded'), 'false');
  assert.equal(f.attributes.get('aria-label'), 'Expand the rack');
  f.button.dispatchEvent(new Event('click'));
  assert.equal(f.root.dataset.rackDock, 'expanded');
  assert.equal(f.attributes.get('aria-expanded'), 'true');
  assert.deepEqual(f.writes, [['nam-a2.rack-dock', 'expanded']]);
  f.dock.destroy();
  assert.equal(f.root.dataset.rackDock, undefined);
  f.button.dispatchEvent(new Event('click'));
  assert.equal(f.writes.length, 1);
});

test('without storage the rack dock starts expanded and still collapses', () => {
  for (const [saved, broken] of [['invalid', false], [null, true]]) {
    const f = fixture(saved, broken);
    assert.equal(f.root.dataset.rackDock, 'expanded');
    f.dock.setCollapsed(true);
    assert.equal(f.root.dataset.rackDock, 'collapsed');
  }
});
