import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {StudioLayout} from '../../examples/wam/projects/StudioLayout.js';
function fixture(saved = null, broken = false, densityControl) {
  const workspaces = new EventTarget(); workspaces.current = 'projects';
  const attributes = new Map(), writes = [];
  const button = Object.assign(new EventTarget(), {setAttribute: (k,v) => attributes.set(k,v), focus() {this.focused = true;}});
  const root = {dataset: {}, ownerDocument: {activeElement: null}}, sidebar = {contains: node => node === 'inside'};
  const storage = {getItem() {if (broken) throw Error('Denied');return saved;}, setItem(k,v) {if (broken) throw Error('Denied');writes.push([k,v]);}};
  const layout = new StudioLayout({workspaces,button,sidebar,root,storage,densityControl});
  return {layout, workspaces,button,sidebar,root,attributes,writes, show(name) {workspaces.current=name;workspaces.dispatchEvent(new Event('change'));}};
}
test('Studio sidebar preference restores, toggles accessibly and persists without project or audio dependencies', () => {
  const f = fixture('collapsed'); assert.equal(f.sidebar.inert,true); assert.equal(f.attributes.get('aria-expanded'),'false');
  f.button.dispatchEvent(new Event('click')); assert.equal(f.sidebar.inert,false);assert.equal(f.attributes.get('aria-label'),'Hide sidebar');
  assert.deepEqual(f.writes,[['nam-a2.studio-sidebar','expanded']]);
  f.root.ownerDocument.activeElement='inside';f.layout.setCollapsed(true);assert.equal(f.button.focused,true);
});
test('collapsed Studio never hides or disables Tone sidebar; returning preserves preference', () => {
  const f = fixture('collapsed');f.show('tone');assert.equal(f.sidebar.inert,false);f.show('projects');assert.equal(f.sidebar.inert,true);
  f.layout.destroy();assert.equal(f.sidebar.inert,false);assert.equal(f.root.dataset.studioSidebar,undefined);
  f.button.dispatchEvent(new Event('click')); assert.equal(f.writes.length,0);
});
test('unavailable or invalid local preference keeps sidebar usable', () => {
  for (const [saved,broken] of [['invalid',false],[null,true]]) {
    const f = fixture(saved,broken);assert.equal(f.sidebar.inert,false);f.layout.setCollapsed(true);assert.equal(f.sidebar.inert,true);
  }
});
test('one import/new control in the persistent Studio toolbar; ruler and tracks share one viewport', async () => {
  const html = await readFile(new URL('../../examples/wam/index.html',import.meta.url),'utf8');
  const header = html.slice(html.indexOf('<header class="rack-header projects-header">'),html.indexOf('<div class="rack-canvas tracks-canvas"'));
  for (const id of ['projectImport','projectNew','projectSave','projectAddTrack','projectUndo','projectRedo','studioSidebarToggle']) {
    assert.match(header,new RegExp(`id="${id}"`));assert.equal(html.split(`id="${id}"`).length-1,1);
  }
  assert.match(html, /id="studioSidebarToggle"[^>]*aria-controls="hostSidebar"/);
  assert.match(html, /class="project-track-viewport"[^>]*aria-label="Tracks and timeline"[^>]*tabindex="0"/);
  const viewport=html.slice(html.indexOf('class="project-track-viewport"'));
  assert.ok(viewport.indexOf('project-ruler-row')<viewport.indexOf('id="projectTracks"'));
});

test('track density defaults compact, persists locally and leaves project/audio state untouched',()=>{
 const f=fixture();assert.equal(f.root.dataset.studioDensity,'compact');f.layout.setDensity('comfortable');
 assert.equal(f.root.dataset.studioDensity,'comfortable');assert.deepEqual(f.writes,[['nam-a2.studio-density','comfortable']]);
 f.layout.setDensity('bad value');assert.equal(f.root.dataset.studioDensity,'compact');f.show('tone');assert.equal(f.root.dataset.studioDensity,'compact');
 f.layout.destroy();assert.equal(f.root.dataset.studioDensity,undefined);
});
test('comfortable density restores with a live control, and its listener is removed on disposal',()=>{
 const control=new EventTarget();control.value='compact';const f=fixture('comfortable',false,control);
 assert.equal(f.root.dataset.studioDensity,'comfortable');assert.equal(control.value,'comfortable');
 control.value='compact';control.dispatchEvent(new Event('change'));assert.equal(f.root.dataset.studioDensity,'compact');
 f.layout.destroy();control.value='comfortable';control.dispatchEvent(new Event('change'));assert.equal(f.writes.length,1);assert.equal(f.root.dataset.studioDensity,undefined);
});
