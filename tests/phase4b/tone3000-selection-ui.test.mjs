import test from 'node:test';
import assert from 'node:assert/strict';

let Gui;
globalThis.HTMLElement = class {};
globalThis.customElements = {get: () => Gui, define: (_name, constructor) => { Gui = constructor; }};
await import('../../src/nam-wam/gui.js');

const control = () => {
  const classes = new Set();
  return {
    disabled: false, offsetTop: 0, offsetHeight: 25, textContent: '', title: '',
    classList: {toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name), contains: (name) => classes.has(name)},
    setAttribute(name, value) { this[name] = value; },
  };
};

test('TONE3000 capture list and arrows load the selected model directly', async () => {
  const gui = new Gui();
  const captured = [];
  gui._toneModels = [{id: 101, name: 'Clean.nam'}, {id: 102, name: 'Lead.nam'}];
  gui._toneModelIndex = 0;
  gui._toneModelLoading = false;
  gui._toneSelectionSerial = 1;
  gui._toneId = 19;
  gui._tone = {title: 'Test amp', gear_type: 'amp'};
  gui._selectedId = '';
  gui._assets = [];
  gui.controls = {
    toneCapturePrevious: control(), toneCaptureNext: control(), toneCapturePick: control(),
    toneFilename: control(), toneCounter: control(), toneCaptureList: {children: [control(), control()], clientHeight: 100, scrollTop: 0},
  };
  gui.controls.toneCaptureList.children[1].offsetTop = 25;
  gui.tone3000 = {downloadModel: async (model) => ({text: '{}', name: model.name})};
  gui.node = {loadModelText: async (_text, name, provenance) => {captured.push({name, provenance}); gui._selectedId = provenance.identity;}};
  gui.tone3000Downloads = {save: async () => {}};
  gui.upsertTone3000Asset = () => {};
  gui.renderTone3000Downloads = () => {};
  gui.setToneStatus = () => {};

  gui.renderTone3000Selection();
  assert.equal(gui.controls.toneCapturePrevious.disabled, true);
  assert.equal(gui.controls.toneCaptureNext.disabled, false);
  await gui.loadTone3000Model(1);
  assert.deepEqual(captured.map(({name}) => name), ['Lead.nam']);
  assert.equal(captured[0].provenance.identity, 'tone3000:19:102');
  assert.equal(gui.controls.toneCaptureNext.disabled, true);
  assert.equal(gui.controls.toneCapturePrevious.disabled, false);
  assert.equal(gui.controls.toneCaptureList.children[1].classList.contains('loaded'), true);
  assert.equal(gui.controls.toneCounter.textContent, '2 / 2 · loaded');
});

test('output border glow responds to level and decays toward idle', () => {
  const gui = new Gui();
  const strip = {style: {}};
  gui._meterState = {outputGlow: 0};
  gui.querySelector = () => strip;
  gui.updateOutputGlow(-4, -12);
  assert.match(strip.style.borderColor, /hsla\(3,/u);
  assert.match(strip.style.boxShadow, /0 0/u);
  const active = gui._meterState.outputGlow;
  gui.updateOutputGlow(-Infinity, -Infinity);
  assert.ok(gui._meterState.outputGlow < active);
  for (let index = 0; index < 100; index++) gui.updateOutputGlow(-Infinity, -Infinity);
  assert.equal(strip.style.borderColor, '#393541');
  assert.equal(strip.style.boxShadow, 'none');
});

test('Noise gate threshold is inactive when unchecked and EQ bypass is visible', () => {
  const gui = new Gui();
  const noiseSide = control();
  gui.controls = {
    noiseEnabled: {checked: false}, noise: control(),
    eqEnabled: {checked: false}, eqGraph: control(), eqPanel: control(),
  };
  gui.querySelector = () => noiseSide;
  gui.syncNoiseGateVisual();
  gui.syncEqEnabledVisual();
  assert.equal(gui.controls.noise.disabled, true);
  assert.equal(noiseSide.classList.contains('is-disabled'), true);
  assert.equal(gui.controls.eqGraph.classList.contains('disabled'), true);
  assert.equal(gui.controls.eqPanel.classList.contains('is-off'), true);
  gui.controls.noiseEnabled.checked = true;
  gui.controls.eqEnabled.checked = true;
  gui.syncNoiseGateVisual();
  gui.syncEqEnabledVisual();
  assert.equal(gui.controls.noise.disabled, false);
  assert.equal(gui.controls.eqGraph.classList.contains('disabled'), false);
});

test('TONE3000 back button restores the existing catalog without refetching or resetting its page', () => {
  const gui = new Gui();
  let fetched = 0;
  gui._toneSelectionSerial = 4;
  gui._toneModelLoading = true;
  gui._tonePage = 3;
  gui._toneFeed = 'trending';
  gui.controls = {
    toneSelection: {hidden: false}, toneCatalog: {hidden: true}, toneBack: {hidden: false},
    toneCards: {childElementCount: 12},
  };
  gui.setToneStatus = () => {};
  gui.loadTone3000Catalog = () => { fetched++; };
  gui.backToTone3000MainView();
  assert.equal(gui.controls.toneSelection.hidden, true);
  assert.equal(gui.controls.toneCatalog.hidden, false);
  assert.equal(gui.controls.toneBack.hidden, true);
  assert.equal(gui._tonePage, 3);
  assert.equal(gui._toneFeed, 'trending');
  assert.equal(gui._toneSelectionSerial, 5);
  assert.equal(fetched, 0);
});

test('model hover details normalize Factory metadata for the delayed photo tooltip', () => {
  const gui = new Gui();
  const info = gui.modelHoverInfo({
    filename: 'Lead.nam', architecture: 'SlimmableContainer', sampleRate: 48000, source: 'Factory',
    metadata: {name: 'Test Amp', gear_make: 'Example', gear_model: 'Mark I', gear_type: 'amp', modeled_by: 'Alice', loudness: -19},
    provenance: {license: 't3k', toneId: 42},
  });
  assert.equal(info.title, 'Test Amp');
  assert.match(info.details, /File: Lead\.nam/u);
  assert.match(info.details, /Architecture: SlimmableContainer/u);
  assert.match(info.details, /Sample rate: 48000 Hz/u);
  assert.match(info.details, /Modeled by: Alice/u);
  assert.match(info.details, /Tone ID: 42/u);
});
