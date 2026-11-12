import test from 'node:test';
import assert from 'node:assert/strict';
import {StudioBackingLibrary} from '../../examples/wam/projects/StudioBackingLibrary.js';
import {BackingTrackEngine} from '../../examples/wam/backing-track-player/BackingTrackEngine.js';

const saved = (calls) => ({signedIn: true, api: {async createBackingTrack(name, file, duration) {
  calls.push([name, file.name, duration]);
  return {id: 'upload-3', title: name, origin: 'upload', editable: true, url: '/api/backing_tracks/3/audio?v=abc'};
}}});

test('signed in, a file from this device is saved to My tracks, before the bundled catalogue', async () => {
  const calls = [], library = new StudioBackingLibrary({account: saved(calls), url: 'https://app.test/rack/tracks.json'});
  library.bundled = [{id: 'bt-public'}]; library.temporary = [{id: 'studio-preview-1', ephemeral: true}];
  library.tracks = [...library.temporary, ...library.bundled];
  assert.equal(library.canSave, true);
  const entry = await library.save({name: 'My jam.final.mp3'}, {duration: 12.5});
  assert.deepEqual(calls, [['My jam.final', 'My jam.final.mp3', 12.5]]);
  assert.equal(entry.url, 'https://app.test/api/backing_tracks/3/audio?v=abc');
  assert.deepEqual(library.tracks.map((track) => track.id), ['studio-preview-1', 'upload-3', 'bt-public']);
  assert.equal(library.resolve('upload-3'), entry);
  await library.save({name: 'x.wav'}, {duration: Number.NaN});
  assert.equal(calls[1][2], null);
});

test('guests cannot save, and a save finishing after sign-out stays out of the library', async () => {
  assert.equal(new StudioBackingLibrary().canSave, false);
  let resolve; const account = {signedIn: true, api: {createBackingTrack: () => new Promise((r) => resolve = r)}};
  const library = new StudioBackingLibrary({account}); library.bundled = [{id: 'bt-public'}]; library.tracks = [...library.bundled];
  const saving = library.save({name: 'late.mp3'});
  library.clearAccount(); account.signedIn = false;
  resolve({id: 'upload-9', title: 'late', url: '/api/backing_tracks/9/audio'});
  await saving;
  assert.deepEqual(library.tracks.map((track) => track.id), ['bt-public']);
});

test('the playing local file takes its saved identity without reloading, and is remembered as such', () => {
  const engine = Object.create(BackingTrackEngine.prototype), events = [];
  Object.assign(engine, {track: {id: 'local:jam.mp3:1:2', title: 'jam.mp3', local: true}, loading: false, emit: (type, detail) => events.push([type, detail]), changed() { events.push(['transport-change']); }});
  assert.equal(engine.adopt('local:other', {id: 'upload-3', title: 'jam'}), false);
  assert.equal(engine.adopt('local:jam.mp3:1:2', {id: 'upload-3', title: 'jam'}), true);
  assert.deepEqual(engine.track, {id: 'upload-3', title: 'jam', local: false});
  assert.deepEqual(events.map(([type]) => type), ['track-change', 'transport-change']);
});

test('the creator renames or deletes a saved backing track in the library', async () => {
  const calls = [], account = {signedIn: true, api: {
    async renameBackingTrack(id, title) { calls.push(['rename', id, title]); return {id, title: title.trim()}; },
    async deleteBackingTrack(id) { calls.push(['delete', id]); return null; }}};
  const library = new StudioBackingLibrary({account});
  library.tracks = [{id: 'upload-3', title: 'Old', editable: true}, {id: 'bt-public', title: 'Factory'}];
  assert.equal(await library.rename('upload-3', ' Solo practice '), 'Solo practice');
  assert.equal(library.resolve('upload-3').title, 'Solo practice');
  await library.remove('upload-3');
  assert.deepEqual(library.tracks.map((track) => track.id), ['bt-public']);
  assert.deepEqual(calls, [['rename', 'upload-3', ' Solo practice '], ['delete', 'upload-3']]);
});

test('a failed delete keeps the track in the library', async () => {
  const library = new StudioBackingLibrary({account: {signedIn: true, api: {deleteBackingTrack: async () => { throw Error('Not found'); }}}});
  library.tracks = [{id: 'upload-3', editable: true}];
  await assert.rejects(library.remove('upload-3'), /Not found/);
  assert.equal(library.tracks.length, 1);
});
