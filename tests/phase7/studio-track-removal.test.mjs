import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';
import {timelineTracks, trackChanges} from '../../examples/wam/projects/ProjectsModel.js';
import {StudioSeparation, separationSources} from '../../examples/wam/projects/StudioSeparation.js';

function workspace() {
  const w = Object.create(ProjectsWorkspace.prototype);
  w.project = {id: 1, owned: true, tracks: [
    {id: 1, name: 'Guitar', origin: 'stem', timelineVisible: true, volume: 75, inputMonitoring: false},
    {id: 2, name: 'Bass', origin: 'stem', timelineVisible: true, volume: 60, inputMonitoring: false}]};
  w.saved = structuredClone(w.project);
  w.project.tracks[1].volume = 34;
  w.selectedId = 1;
  w.accountLoadEpoch = 4;
  w.report = () => {};
  w.replaceSummary = () => {};
  w.render = () => { w.playingIds = timelineTracks(w.project).map(t => t.id); };
  w.separation = {savedTracks: [...w.project.tracks], restore(project) { this.savedTracks = timelineTracks(project); }};
  w.api = {
    deleteTrack: async () => ({removedAt: '2026-10-27T00:00:00Z', timelineVisible: false}),
    restoreTrack: async () => ({removedAt: null, timelineVisible: true}),
  };
  return w;
}

test('delete requires confirmation; cancellation leaves the project and playback intact', async () => {
  const w = workspace(); let calls = 0;
  w.api.deleteTrack = async () => { calls++; };
  await w.deleteTrack(1, {confirm: async () => false});
  assert.equal(calls, 0); assert.equal(timelineTracks(w.project).length, 2);
});

test('confirmed removal and restoration preserve audio identity, history and unsaved mixer edits', async () => {
  const w = workspace();
  await w.deleteTrack(1, {confirm: async () => true});
  assert.deepEqual(w.playingIds, [2]); assert.equal(w.selectedId, 2);
  assert.deepEqual(w.separation.savedTracks.map(t => t.id), [2]);
  assert.equal(w.project.tracks.length, 2);
  assert.equal(w.project.tracks[1].volume, 34); assert.equal(w.saved.tracks[1].volume, 60);
  assert.equal(trackChanges(w.saved.tracks, w.project.tracks).length, 1);
  await w.restoreTrack(1);
  assert.deepEqual(w.playingIds, [1, 2]); assert.equal(w.project.tracks[0].removedAt, null);
  assert.equal(w.project.tracks[1].volume, 34); assert.equal(w.saving, false);
});

test('a failed request retains the current tracks, and a stale confirmation never deletes another project', async () => {
  const w = workspace(); w.api.deleteTrack = async () => { throw Error('offline'); };
  await w.deleteTrack(1, {confirm: async () => true});
  assert.deepEqual(w.playingIds, [1, 2]); assert.equal(w.saving, false);
  let calls = 0; w.api.deleteTrack = async () => { calls++; };
  await w.deleteTrack(1, {confirm: async () => { w.project = {...w.project, id: 2}; return true; }});
  assert.equal(calls, 0);
});

test('removed originals and instruments cannot leak back through legacy payloads or source selection', () => {
  const removed = {id: 1, origin: 'original', removedAt: 'date', timelineVisible: true, audio: {url: '/audio'}};
  assert.deepEqual(timelineTracks({tracks: [removed]}), []);
  assert.deepEqual(timelineTracks({tracks: [{...removed, timelineVisible: undefined}]}), []);
  assert.deepEqual(separationSources([removed]), []);
});

test('a late server response cannot alter a new project or account', async () => {
  const w = workspace(); let resolve;
  w.api.deleteTrack = () => new Promise(done => { resolve = done; });
  const pending = w.deleteTrack(1, {confirm: async () => true});
  await Promise.resolve(); await Promise.resolve();
  const next = {id: 2, owned: true, tracks: [{id: 3, name: 'New'}]};
  w.project = next; w.accountLoadEpoch++;
  resolve({removedAt: 'date', timelineVisible: false}); await pending;
  assert.deepEqual(w.project, next); assert.equal(w.project.tracks[0].removedAt, undefined);
});

test('removing the last track and restoring it works with an empty saved deck', async () => {
  const w = workspace(); w.project.tracks.pop(); w.saved = structuredClone(w.project);
  const c = Object.create(StudioSeparation.prototype);
  c.setStatus = value => { c.status = value; };
  c.restore(w.project); w.separation = c;
  await w.deleteTrack(1, {confirm: async () => true});
  assert.deepEqual(w.displayTracks, []); assert.equal(w.selectedId, null);
  await w.restoreTrack(1);
  assert.deepEqual(w.displayTracks.map(t => t.id), [1]); assert.equal(w.selectedId, 1);
});
