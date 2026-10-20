import test from 'node:test';
import assert from 'node:assert/strict';
import {ModelCatalog} from '../../examples/wam/source-separation/ModelCatalog.js';
import {MultitrackSession} from '../../examples/wam/source-separation/MultitrackSession.js';
import {demoWaveform} from '../../examples/wam/source-separation/DemoWaveform.js';

test('catalogue filters by backend and recommends a guitar model', () => {
  const catalog = new ModelCatalog([
    {id: 'guitar', label: 'Guitar', description: 'Four stems', roles: ['guitar'], backends: ['wasm'], recommendation: 'guitar'},
    {id: 'voice', label: 'Voice', description: 'Vocals', roles: ['vocals'], backends: ['webgpu'], recommendation: 'vocals'},
  ]);
  assert.deepEqual(catalog.list({backend: 'wasm'}).map(model => model.id), ['guitar']);
  assert.equal(catalog.recommend({useCase: 'guitar', backend: 'wasm'}).id, 'guitar');
  assert.equal(catalog.recommend({useCase: 'guitar', backend: 'webgpu'}), null);
});

test('multitrack session clamps controls and applies solo precedence', () => {
  const session = new MultitrackSession([{id: 'a', role: 'guitar'}, {id: 'b', role: 'bass'}]);
  session.updateTrack('a', {volume: 2, pan: -2, solo: true});
  session.updateTrack('b', {volume: -.5});
  assert.equal(session.tracks[0].volume, 1.5);
  assert.equal(session.tracks[0].pan, -1);
  assert.equal(session.tracks[1].volume, 0);
  assert.equal(session.isAudible(session.tracks[0]), true);
  assert.equal(session.isAudible(session.tracks[1]), false);
});

test('zoom, loop and state remain normalized', () => {
  const session = new MultitrackSession([{id: 'a'}]);
  session.setZoom(100); session.setLoop({start: .8, end: .2, enabled: false});
  assert.equal(session.zoom, 16);
  assert.deepEqual(session.loop, {enabled: false, start: .2, end: .8});
  session.resetZoom();
  assert.equal(session.getState().zoom, 1);
  assert.throws(() => session.updateTrack('missing', {muted: true}), /Unknown track/);
});

test('prototype route declares the required controls and modules', async () => {
  const {readFile} = await import('node:fs/promises');
  const html = await readFile(new URL('../../examples/wam/source-separation/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="modelSelect"/);
  assert.match(html, /id="backendSelect"/);
  assert.match(html, /id="zoomReset"/);
  assert.match(html, /source-separation\.css/);
});

test('zoom doubles the timeline geometry, preserves peaks and resets the visible time range', () => {
  const session = new MultitrackSession();
  const initial = demoWaveform(0, session.zoom);
  session.setZoom(2);
  const enlarged = demoWaveform(0, session.zoom);
  assert.equal(enlarged.widthPercent, initial.widthPercent * 2);
  assert.equal(enlarged.peaks, initial.peaks);
  const viewport = 500;
  const tickPosition = drawing => drawing.ticks[4].x / 960 * viewport * drawing.widthPercent / 100;
  assert.equal(tickPosition(enlarged), tickPosition(initial) * 2);
  session.resetZoom();
  assert.deepEqual(demoWaveform(0, session.zoom), initial);
  assert.notEqual(demoWaveform(1).peaks, initial.peaks);
});
