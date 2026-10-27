import test from 'node:test';
import assert from 'node:assert/strict';
import {StudioHistory, editState, editPatch, editCommand, historyShortcut} from '../../examples/wam/projects/StudioHistory.js';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';
import {timelineTracks} from '../../examples/wam/projects/ProjectsModel.js';

const project = () => ({id: 7, owned: true, name: 'Jam', bpm: 120, tracks: [
  {id: 1, name: 'Guitar', origin: 'personal', instrument: 'guitar', volume: 80, pan: 0, mute: false, solo: false, inputMonitoring: false, timelineVisible: true},
  {id: 2, name: 'Bass', origin: 'stem', instrument: 'bass', volume: 70, pan: 0, mute: false, solo: false, timelineVisible: true},
]});
function workspace() {
  const w = Object.create(ProjectsWorkspace.prototype);
  w.project = project(); w.saved = structuredClone(w.project); w.accountLoadEpoch = 1;
  w.history = new StudioHistory(); w.render = w.renderHeader = w.renderInspector = w.replaceSummary = w.report = () => {};
  w.syncPlayer = () => {}; w.timeline = {order() {}, update() {}};
  w.dispatchEvent = () => {};
  return w;
}
const command = (id, actions, audio = false) => ({label: String(id), audio, undo: () => actions.push(-id), redo: () => actions.push(id)});

test('bounded commands move the cursor only on success and discard redo after a new edit', async () => {
  const h = new StudioHistory({limit: 3}), actions = [];
  for (let i = 1; i <= 4; i++) h.record(command(i, actions));
  assert.deepEqual(h.entries.map(e => e.label), ['2','3','4']);
  await h.step(); await h.step(true); assert.deepEqual(actions, [-4,4]);
  await h.step(); h.record(command(5, actions)); assert.equal(h.redoLabel, '');
  h.record({label: 'failed', undo: () => { throw Error('offline'); }});
  const cursor = h.cursor; await assert.rejects(h.step(), /offline/);
  assert.equal(h.cursor, cursor); assert.equal(h.busy, false);
});

test('audio cap includes redo, evicts a prefix, and never copies audio into a command', async () => {
  const h = new StudioHistory(), actions = [];
  h.record(command(1, actions, true)); h.record(command(2, actions)); h.record(command(3, actions, true));
  await h.step(); await h.step(true); h.record(command(4, actions)); h.record(command(5, actions, true));
  assert.deepEqual(h.entries.map(e => e.label), ['2','3','4','5']);
  await h.step(); await h.step(); await h.step(); await h.step();
  assert.equal(h.undoLabel, ''); assert.equal(h.entries.filter(e => e.audio).length, 2);
  const state = editState({...project(), tracks: [{...project().tracks[0], audio: {buffer: new Float32Array(10000)}}]});
  assert.equal('audio' in state.tracks[0], false);
});

test('async replay is serialized and cannot advance a history cleared by account/project change', async () => {
  const h = new StudioHistory(); let done;
  h.record({label:'pending', undo: () => new Promise(resolve => { done = resolve; })});
  const pending = h.step(); assert.equal(h.busy, true); assert.equal(await h.step(), false);
  h.clear(); done(); assert.equal(await pending, false); assert.equal(h.cursor, 0);
});

test('one slider gesture merges every live update; returning to its initial value is a no-op', async () => {
  const h = new StudioHistory(), initial = editState(project()), group = {}, calls = [];
  for (const volume of [79,60,42]) {
    const next = structuredClone(initial); next.tracks[0].volume = volume;
    const before = h.entries.at(-1)?.after ?? initial;
    h.record(editCommand(before, next, {label:'Volume Guitar', group, apply:(patch,side) => calls.push(patch.tracks[0].fields.volume[side])}));
  }
  assert.equal(h.entries.length, 1); await h.step(); await h.step(true); assert.deepEqual(calls, [80,42]);
  const last = structuredClone(initial);
  h.record(editCommand(h.entries[0].after, last, {label:'Volume Guitar', group, apply(){}}));
  assert.equal(h.entries.length, 0);
});

test('patches restore only changed fields, order, project metadata and loop, never input monitoring', () => {
  const before = editState(project(), {enabled:true,start:1,end:4});
  const after = structuredClone(before); after.name = 'Renamed'; after.bpm = 140; after.tracks.reverse();
  after.tracks[1].pan = -20; after.loop.end = 8;
  const patch = editPatch(before,after);
  assert.deepEqual(patch.order, [[1,2],[2,1]]); assert.deepEqual(patch.tracks, [{id:1,fields:{pan:[0,-20]}}]);
  assert.deepEqual(patch.project.bpm,[120,140]); assert.equal(editPatch(before,structuredClone(before)),null);
});

test('Studio volume undo/redo works across Save and preserves unrelated live monitoring', async () => {
  const w = workspace();
  w.updateTrack(1,{volume:41}); assert.equal(w.project.tracks[0].volume,41);
  w.api = {updateTrack: async (projectId, id, fields) => ({...w.project.tracks.find(t => t.id === id), ...fields})};
  await w.save();
  assert.equal(w.history.entries.length, 1);
  w.project.tracks[1].inputMonitoring = true;
  assert.equal(await w.runHistory(false), true); assert.equal(w.project.tracks[0].volume,80); assert.equal(w.dirty,true);
  assert.equal(w.project.tracks[1].inputMonitoring,true);
  await w.runHistory(true); assert.equal(w.project.tracks[0].volume,41); assert.equal(w.dirty,true); // monitoring is a separate unsaved change
});

test('delete undo/redo reuses the same saved track and preserves unsaved edits on other tracks', async () => {
  const w = workspace(); const calls = [];
  w.project.tracks[1].volume = 33;
  w.api = {deleteTrack: async (p,id) => {calls.push(['delete',id]);return{removedAt:'date',timelineVisible:false};},
    restoreTrack: async(p,id) => {calls.push(['restore',id]);return{removedAt:null,timelineVisible:true};}};
  await w.deleteTrack(1,{confirm:async()=>true}); assert.deepEqual(timelineTracks(w.project).map(t=>t.id),[2]);
  await w.runHistory(false); assert.deepEqual(timelineTracks(w.project).map(t=>t.id),[1,2]);
  await w.runHistory(true); assert.deepEqual(calls,[['delete',1],['restore',1],['delete',1]]);
  assert.equal(w.project.tracks[1].volume,33); assert.equal(w.saved.tracks[1].volume,70);
  assert.equal(w.project.tracks[0].inputMonitoring,false);
});

test('a published four-stem group replays as one atomic visibility command, without inference', async () => {
  const w = workspace(); w.project.tracks[0].origin='original';
  const before = w.layoutState(); w.project.activeSeparationId=10; w.project.tracks[0].timelineVisible=false;
  for(let id=3;id<=6;id++) w.project.tracks.push({id,origin:'stem',timelineVisible:true});
  w.saved=structuredClone(w.project); const calls=[];
  w.api={setTrackVisibility:async(id,command)=>{calls.push(command);return{activeSeparationId:command.afterSeparationId,
    tracks:command.changes.map(c=>({id:c.id,timelineVisible:c.after.visible,removedAt:c.after.removed?'date':null}))};}};
  w.rememberLayout(before,'Separate instruments'); assert.equal(w.history.entries.length,1);
  await w.runHistory(false); assert.deepEqual(timelineTracks(w.project).map(t=>t.id),[1,2]);
  await w.runHistory(true); assert.deepEqual(timelineTracks(w.project).map(t=>t.id),[2,3,4,5,6]);
  assert.equal(calls[0].changes.length,5); assert.equal(w.project.activeSeparationId,10);
});

const event = (key, values = {}) => ({key,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,repeat:false,target:{},...values});
test('standard Mac, Windows and Linux shortcuts respect native fields, modifiers and workspace scope', () => {
  const win={visible:true}, mac={visible:true,mac:true};
  assert.equal(historyShortcut(event('z',{metaKey:true}),mac),'undo');
  assert.equal(historyShortcut(event('Z',{metaKey:true,shiftKey:true}),mac),'redo');
  assert.equal(historyShortcut(event('y',{ctrlKey:true}),win),'redo');
  assert.equal(historyShortcut(event('z',{ctrlKey:true,shiftKey:true}),win),'redo');
  for(const values of [{repeat:true},{altKey:true},{metaKey:true},{defaultPrevented:true},{target:{matches:()=>true}},
    {composedPath:()=>[{tagName:'PLUGIN-GUI'}]}]) assert.equal(historyShortcut(event('z',{ctrlKey:true,...values}),win),null);
  assert.equal(historyShortcut(event('z',{ctrlKey:true}),{visible:false}),null);
  assert.equal(historyShortcut(event('z',{ctrlKey:true}),{visible:true,blocked:true}),null);
  assert.equal(historyShortcut(event('y',{metaKey:true}),mac),null);
});

test('tempo and loop, rename, preset selection and reorder are reversible without changing the saved baseline', async () => {
  const w = workspace(); const loop = {enabled:true,start:2,end:6};
  w.player = {loop: {...loop},setLoop(value) { this.loop = {...this.loop,...value}; }};
  w.storage = {getItem:()=>null,setItem(){}};
  w.edit({name:'New jam',bpm:180});
  assert.equal(w.project.name,'New jam'); assert.equal(w.project.bpm,180);
  await w.runHistory(false); assert.equal(w.project.name,'Jam'); assert.equal(w.project.bpm,120);
  assert.deepEqual(w.player.loop,loop);
  await w.runHistory(true); assert.equal(w.project.bpm,180);
  w.updateTrack(1,{presetId:42,factoryPreset:null});
  await w.runHistory(false); assert.equal(w.project.tracks[0].presetId,undefined);
  w.setTracks([...w.project.tracks].reverse(),{label:'Reorder track'});
  await w.runHistory(false); assert.deepEqual(w.project.tracks.map(t=>t.id),[1,2]);
  await w.runHistory(true); assert.deepEqual(w.project.tracks.map(t=>t.id),[2,1]);
  assert.deepEqual(w.saved.tracks.map(t=>t.id),[1,2]);
  w.setLoop({enabled:true,start:1,end:4});
  await w.runHistory(false); assert.notEqual(w.player.loop.start,1);
  await w.runHistory(true); assert.deepEqual(w.player.loop,{enabled:true,start:1,end:4});
});

test('empty track creation is undone by removal, never by irreversible destruction', async () => {
  const w=workspace(); const calls=[];
  w.api={createTrack:async()=>({id:3,name:'New guitar',origin:'personal',timelineVisible:true}),
    deleteTrack:async()=>{calls.push('remove');return{removedAt:'date',timelineVisible:false};},
    restoreTrack:async()=>{calls.push('restore');return{removedAt:null,timelineVisible:true};}};
  await w.addTrack({name:'New guitar',instrument:'guitar'});
  assert.equal(w.history.entries[0].audio,false);
  await w.runHistory(false);assert.equal(timelineTracks(w.project).length,2);
  await w.runHistory(true);assert.equal(timelineTracks(w.project).length,3);
  assert.deepEqual(calls,['remove','restore']);assert.equal(w.project.tracks[2].id,3);
});

test('undoing a fader preserves the selected track and separation settings', async () => {
  const w = workspace(); w.selectedId = 2;
  w.separation = {savedTracks: [...w.project.tracks], modelId:'chosen-model', updateTrack:()=>false,
    restore(){ throw Error('A local fader must not reset the separation or selection'); }};
  w.updateTrack(2,{volume:30}); await w.runHistory(false);
  assert.equal(w.project.tracks[1].volume,70); assert.equal(w.selectedId,2);
  assert.equal(w.separation.modelId,'chosen-model');
  assert.equal(w.separation.savedTracks[1].volume,70);
});
