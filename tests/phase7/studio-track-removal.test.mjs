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

test('a stopped unsaved take does not prevent deleting another track',async()=>{
  const w=workspace(),take={url:'blob:take'};w.recording={busy:false,pending:new Map([[1,take]])};
  let asked=0;await w.deleteTrack(2,{confirm:async()=>{asked++;return true;}});
  assert.equal(asked,1);assert.deepEqual(w.playingIds,[1]);assert.equal(w.recording.pending.get(1),take);
});

test('starting capture during the confirmation prevents a late deletion',async()=>{
  const w=workspace();w.recording={busy:false,pending:new Map()};let called=false;
  w.api.deleteTrack=async()=>{called=true;};
  await w.deleteTrack(1,{confirm:async()=>{w.recording.busy=true;return true;}});
  assert.equal(called,false);
});

import {StudioHistory} from '../../examples/wam/projects/StudioHistory.js';
import {RecordingHistory} from '../../examples/wam/projects/recording/RecordingHistory.js';
import {StudioRecording} from '../../examples/wam/projects/recording/StudioRecording.js';
function withTake(){
  const w=workspace(),r=w.recording={workspace:w,busy:false,armedId:1,pending:new Map(),releaseMeter(){this.released=true;}};
  w.project.tracks[0]={...w.project.tracks[0],origin:'personal',instrument:'guitar',audio:{url:'blob:take'},recording:{sessionId:'new'},presetSnapshot:{version:2},updatedAt:'old'};
  w.saved.tracks[0]={...w.saved.tracks[0],origin:'personal',instrument:'guitar',audio:{url:'/saved.wav',checksum:'saved'},updatedAt:'old'};
  const take={url:'blob:take',file:new Blob(['DI']),metadata:{sessionId:'new'},expectedUpdatedAt:'old',replaceChecksum:'saved'};
  r.pending.set(1,take);r.takeHistory=new RecordingHistory(r);r.takeHistory.resources.add(take);
  w.history=new StudioHistory({changed:()=>r.takeHistory.collect()});
  w.api.deleteTrack=async()=>({removedAt:'date',timelineVisible:false,updatedAt:'deleted'});
  w.api.restoreTrack=async()=>({removedAt:null,timelineVisible:true,updatedAt:'restored'});
  return{w,r,take};
}
test('deleting the recorded RAM track supports Undo/Redo without losing its take or uploading hidden audio',async()=>{
  const {w,r,take}=withTake();
  await w.deleteTrack(1,{confirm:async()=>true});
  assert.deepEqual(w.playingIds,[2]);assert.equal(r.pending.size,0);assert.equal(r.takeHistory.removed.get(1),take);
  assert.equal(r.armedId,null);assert.equal(r.released,true);assert.equal(w.history.entries[0].recordingTakes[0],take);
  let uploads=0;w.api.saveRecording=async()=>{uploads++;throw Error('must not upload a removed take');};
  await StudioRecording.prototype.save.call(r);assert.equal(uploads,0);
  await w.history.step(false);assert.deepEqual(w.playingIds,[1,2]);assert.equal(r.pending.get(1),take);
  assert.equal(take.expectedUpdatedAt,'restored');assert.equal(take.replaceChecksum,'saved');assert.equal(w.project.tracks[0].audio.url,'blob:take');
  await w.history.step(true);assert.equal(r.pending.size,0);assert.equal(take.file.size,2);
  await w.restoreTrack(1);assert.equal(r.pending.get(1),take);assert.equal(w.project.tracks[0].recording.sessionId,'new');
});
test('failed soft deletion keeps the unsaved take queued and the track unchanged',async()=>{
  const {w,r,take}=withTake();w.api.deleteTrack=async()=>{throw Error('offline');};
  await w.deleteTrack(1,{confirm:async()=>true});assert.equal(r.pending.get(1),take);
  assert.equal(r.takeHistory.removed.size,0);assert.equal(w.history.entries.length,0);assert.equal(w.project.tracks[0].removedAt,undefined);
});
test('bounded deletion history frees its RAM take and Options restores the saved audio after expiry',async()=>{
  const {w,r,take}=withTake();await w.deleteTrack(1,{confirm:async()=>true});
  w.history.record({label:'Audio change 1',audio:true});w.history.record({label:'Audio change 2',audio:true});
  assert.equal(r.takeHistory.removed.size,0);assert.equal(take.file,null);assert.equal(r.takeHistory.resources.size,0);
  await w.restoreTrack(1);assert.equal(r.pending.size,0);assert.equal(w.project.tracks[0].audio.url,'/saved.wav');
});
