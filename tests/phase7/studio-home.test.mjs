import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';

function workspace({project = {id: 1, name: 'Jam', owned: true}, dirty = false, busy = false} = {}) {
  const w = Object.create(ProjectsWorkspace.prototype);
  Object.defineProperty(w, 'dirty', {get: () => dirty});
  Object.assign(w, {project, recording: busy ? {busy: true} : null, saving: false, renders: 0, events: [],
    render() { this.renders++; }, setProject(next) { this.project = next; }, confirmPreviewDiscard: async () => true});
  w.dispatchEvent = (event) => { w.events.push(event.detail?.project ?? null); return true; };
  return w;
}

test('Home closes the open project and tells the navigation', async () => {
  const w = workspace();
  assert.equal(await w.home(), true);
  assert.equal(w.project, null);
  assert.deepEqual(w.events, [null]);
});

test('Home is refused while recording, and keeps a project whose preview is not discarded', async () => {
  const busy = workspace({busy: true});
  assert.equal(await busy.home(), false);
  assert.equal(busy.project.name, 'Jam');
  const preview = workspace();
  preview.confirmPreviewDiscard = async () => false;
  assert.equal(await preview.home(), false);
  assert.equal(preview.project.name, 'Jam');
});

test('Studio loads on Home; only a shared-project link opens one, once signed in', async () => {
  const opened = [];
  const make = (openLinked, signedIn) => {
    const w = Object.create(ProjectsWorkspace.prototype);
    Object.assign(w, {openLinked, account: {signedIn}, api: {available: true, listProjects: async () => [{id: 7}, {id: 9}], listPresets: async () => []},
      storage: {getItem: () => '9'}, report() {}, render() {}, setProject() {}, open: async (id) => opened.push(id)});
    w.dispatchEvent = () => true;
    return w;
  };
  await make(false, true).load();
  assert.deepEqual(opened, []);
  const guest = make(true, false);
  await guest.load();
  assert.equal(guest.openLinked, true, 'the link waits for sign-in');
  guest.account.signedIn = true;
  await guest.load();
  assert.deepEqual(opened, [9]);
  assert.equal(guest.openLinked, false);
});

test('Studio has no breadcrumb, and the canvas holds the project list', async () => {
  const html = await readFile(new URL('../../examples/wam/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /studio-breadcrumb|studioCrumbHome/);
  assert.match(html, /<section class="studio-home" id="studioHome" aria-label="Projects" hidden>/);
  assert.doesNotMatch(html, /id="projectSelect"|id="trackInspector"|id="inspectorPreset"/);
  const workspace = await readFile(new URL('../../examples/wam/projects/ProjectsWorkspace.js', import.meta.url), 'utf8');
  assert.match(workspace, /this\.\$\('projectNew'\)\.hidden = Boolean\(this\.project\)/, 'New project only on Home');
});

test('Delete on Home never deletes a shared project', async () => {
  const deleted = [], reports = [];
  const w = Object.create(ProjectsWorkspace.prototype);
  Object.assign(w, {saving: false, projects: [{id: 1, name: 'Mine', owned: true, trackCount: 2}, {id: 2, name: 'Theirs', owned: false, trackCount: 1}],
    api: {deleteProject: async (id) => deleted.push(id)}, report: (text) => reports.push(text), render() {}});
  await w.deleteProject(w.projects[1]);
  assert.deepEqual(deleted, []);
});
