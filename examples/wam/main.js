import initializeWamHost from '../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js';
import NamPlugin from '../../src/nam-wam/index.js';
import CabinetPlugin from '../../src/cabinet-wam/index.js';
import SourceManager from './SourceManager.js';
import OutputDeviceManager from './OutputDeviceManager.js';
import {cabinetRoutingDecision} from './CabinetRouting.js';
const TONE3000_CALLBACK_CHANNEL = 'nam-a2-wam.tone3000.callback';
const TONE3000_CALLBACK_STORAGE_KEY = 'nam-a2-wam.tone3000.callback';

const $ = (selector) => document.querySelector(selector);
const context = new AudioContext({latencyHint: 'interactive'});
let plugin;
let node;
let cabinetPlugin;
let cabinetNode;
let sourceManager;
let savedState;
let savedCabinetState;
let selectedDeviceId = '';
let outputDeviceManager;
let currentNamMetadata=null;
let cabinetGuiElement;

async function applyCabinetRouting(mode=cabinetGuiElement?.getRoutingMode?.()||'auto'){const decision=cabinetRoutingDecision(mode,currentNamMetadata);await cabinetNode.setParameterValues({bypass:{id:'bypass',value:decision.bypass?1:0,normalized:false}});cabinetGuiElement?.setRoutingStatus?.(mode,decision.text);return decision;}

function message(text, error = false) {
  $('#hostStatus').textContent = text;
  $('#hostStatus').classList.toggle('error', error);
}

async function discoverFiles() {
  let files=[];
  try { const response = await fetch('/api/test-audio-files', {cache: 'no-store'}); if (response.ok) files=await response.json(); }
  catch { /* Optional development-host audio catalog; Factory catalogs are plugin manifests. */ }
  const selector = $('#audioSource');
  selector.replaceChildren(new Option('Live input', 'live'));
  for (const filename of files) selector.add(new Option(filename, `file:${filename}`));
  $('#discovery').textContent = files.length ? `${files.length} dry guitar audio file(s) discovered dynamically` : 'Optional audio catalog unavailable; use Live input or plugin Factory browsers';
  return files;
}

async function refreshDevices(requestPermission = false) {
  const previous = selectedDeviceId || $('#inputDevice').value;
  const inputs = await sourceManager.enumerateInputs({requestPermission});
  const selector = $('#inputDevice');
  selector.replaceChildren();
  inputs.forEach((device, index) => selector.add(new Option(device.label || `Audio input ${index + 1}`, device.deviceId)));
  if (inputs.some((device) => device.deviceId === previous)) selector.value = previous;
  else if (inputs.length) selector.value = inputs[0].deviceId;
  selectedDeviceId = selector.value;
  if (!inputs.length) message('No audio input device is available', true);
  return inputs;
}

async function refreshOutputs(options = {}) {
  const outputs = await outputDeviceManager.refresh(options);
  const selector = $('#outputDevice');
  selector.replaceChildren(new Option('System default', ''));
  outputs.forEach((device, index) => selector.add(new Option(device.label || `Audio output ${index + 1}`, device.deviceId)));
  selector.value = outputs.some((device) => device.deviceId === outputDeviceManager.selectedDeviceId) ? outputDeviceManager.selectedDeviceId : '';
  if (outputs.length && outputs.every((device) => !device.label)) {
    $('#outputSupport').textContent = 'Output names are hidden by the browser until output permission is granted. Click “Choose / authorize output”.';
  }
  return outputs;
}

function syncSourceTrim() {
  const value = sourceManager.activeTrimDb;
  $('#sourceTrim').value = value;
  $('#sourceTrimValue').textContent = `${value.toFixed(1)} dB`;
}

function setPlayerEnabled(enabled) {
  for (const control of document.querySelectorAll('.player-control')) control.disabled = !enabled;
  $('#inputDevice').disabled = enabled;
  $('#enableLive').disabled = enabled;
}

async function selectSource() {
  await context.resume();
  const value = $('#audioSource').value;
  if (value === 'live') {
    setPlayerEnabled(false);
    if (!selectedDeviceId) await refreshDevices(true);
    if (selectedDeviceId) await sourceManager.activateLive(selectedDeviceId);
    syncSourceTrim();
    message(`Live input active: ${$('#inputDevice').selectedOptions[0]?.textContent || selectedDeviceId}`);
  } else {
    setPlayerEnabled(true);
    const filename = value.slice(5);
    await sourceManager.activateFile(`./assets/audio/${encodeURIComponent(filename)}`);
    syncSourceTrim();
    message(`Dry guitar audio ready: ${filename}`);
  }
}

async function initialize() {
  NamPlugin.configureTone3000(window.NAM_A2_WAM_CONFIG?.tone3000 || {});
  const [groupId] = await initializeWamHost(context, 'nam-a2-phase3-host');
  plugin = await NamPlugin.createInstance(groupId, context, {});
  node = plugin.audioNode;
  cabinetPlugin = await CabinetPlugin.createInstance(groupId, context, {});
  cabinetNode = cabinetPlugin.audioNode;
  node.onprocessorerror = (event) => { window.phase3ProcessorError = 'AudioWorklet processor error'; message(window.phase3ProcessorError, true); };
  node.connect(cabinetNode).connect(context.destination);
  sourceManager = new SourceManager({audioContext: context, wamNode: node, player: $('#player')});
  outputDeviceManager = new OutputDeviceManager({audioContext: context});
  window.phase3Debug = {context, node, plugin, cabinetNode, cabinetPlugin, sourceManager, outputDeviceManager};
  $('#pluginGui').append(await plugin.createGui());
  cabinetGuiElement = await cabinetPlugin.createGui();
  $('#cabinetGui').append(cabinetGuiElement);
  cabinetGuiElement.addEventListener('cabinet-routing-mode',(event)=>{event.preventDefault();applyCabinetRouting(event.detail.mode).catch((error)=>message(error.message,true));});
  node.addModelListener((metadata)=>{currentNamMetadata=metadata;applyCabinetRouting().catch((error)=>message(error.message,true));});
  await applyCabinetRouting();
  await discoverFiles();
  await refreshDevices(false);
  if (outputDeviceManager.supported) {
    await refreshOutputs();
    $('#outputSupport').textContent = 'Output selection uses AudioContext.setSinkId().';
  } else {
    $('#outputDevice').disabled = true;
    $('#authorizeOutput').disabled = true;
    $('#outputSupport').textContent = 'This browser does not support AudioContext output-device selection; using system default.';
  }
  $('#authorizeOutput').hidden = !outputDeviceManager.authorizationSupported;
  setPlayerEnabled(false);
  navigator.mediaDevices?.addEventListener?.('devicechange', async () => {
    const wasLive = sourceManager.mode === 'live';
    const old = selectedDeviceId;
    const devices = await refreshDevices(false);
    if (outputDeviceManager.supported) await refreshOutputs({includeAuthorized: false});
    if (wasLive && !devices.some((device) => device.deviceId === old)) {
      if (selectedDeviceId) await sourceManager.activateLive(selectedDeviceId);
      else await sourceManager.disconnectCurrent();
      message(selectedDeviceId ? 'Selected device disappeared; switched to an available input' : 'Selected input device disappeared', !selectedDeviceId);
    }
  });
  $('#audioSource').onchange = () => selectSource().catch((error) => message(error.message, true));
  $('#sourceTrim').oninput = () => {
    const value = sourceManager.setTrimDb(Number($('#sourceTrim').value), $('#audioSource').value === 'live' ? 'live' : 'file');
    $('#sourceTrimValue').textContent = `${value.toFixed(1)} dB`;
  };
  $('#enableLive').onclick = async () => {
    try { await context.resume(); await refreshDevices(true); await selectSource(); }
    catch (error) { message(error.message, true); }
  };
  $('#inputDevice').onchange = async () => {
    selectedDeviceId = $('#inputDevice').value;
    if ($('#audioSource').value === 'live') await sourceManager.activateLive(selectedDeviceId);
  };
  $('#outputDevice').onchange = async () => {
    try { await outputDeviceManager.select($('#outputDevice').value); }
    catch (error) { message(`Cannot select audio output: ${error.message}`, true); await refreshOutputs(); }
  };
  $('#authorizeOutput').onclick = async () => {
    try { await context.resume(); await outputDeviceManager.authorize(); await refreshOutputs(); }
    catch (error) { message(`Audio output authorization failed: ${error.message}`, true); }
  };
  $('#play').onclick = async () => { await context.resume(); await $('#player').play(); };
  $('#pause').onclick = () => $('#player').pause();
  $('#stop').onclick = () => { $('#player').pause(); $('#player').currentTime = 0; };
  $('#loop').onchange = () => { $('#player').loop = $('#loop').checked; };
  $('#seek').oninput = () => { if (Number.isFinite($('#player').duration)) $('#player').currentTime = Number($('#seek').value) * $('#player').duration; };
  $('#player').ontimeupdate = () => { if (Number.isFinite($('#player').duration) && $('#player').duration) $('#seek').value = $('#player').currentTime / $('#player').duration; };
  $('#saveState').onclick = async () => {
    savedState = await node.getState();
    savedCabinetState = await cabinetNode.getState();
    $('#stateSize').textContent = `${new TextEncoder().encode(JSON.stringify(savedState)).byteLength.toLocaleString()} serialized bytes`;
  };
  $('#restoreState').onclick = async () => {
    if (!savedState) return message('Save state first', true);
    await node.setState(savedState);
    if (savedCabinetState) await cabinetNode.setState(savedCabinetState);
    message('WAM state restored');
  };
  message('NAM WAM instantiated. Select a model in the plugin GUI.');
  if (new URLSearchParams(location.search).has('auto')) await automatedValidation();
}

async function waitQuanta(count) {
  const seconds = count * 128 / context.sampleRate;
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 100));
}

async function compareConvolverReference(ir) {
  const signalLength = 512;
  const outputLength = ir.length + signalLength - 1;
  const offline = new OfflineAudioContext(1, outputLength, context.sampleRate);
  const signal = offline.createBuffer(1, signalLength, context.sampleRate);
  const input = signal.getChannelData(0);
  for (let i = 0; i < signalLength; ++i) input[i] = 0.04 * Math.sin(0.071 * i) + (i === 0 ? 0.5 : 0);
  const irBuffer = offline.createBuffer(1, ir.length, context.sampleRate);
  irBuffer.copyToChannel(ir, 0);
  const convolver = offline.createConvolver();
  convolver.normalize = false;
  convolver.buffer = irBuffer;
  const source = offline.createBufferSource(); source.buffer = signal; source.connect(convolver).connect(offline.destination); source.start();
  const actual = (await offline.startRendering()).getChannelData(0);
  const checked = Math.min(4096, outputLength);
  let maxError = 0, sumSquares = 0;
  for (let n = 0; n < checked; ++n) {
    let expected = 0;
    const first = Math.max(0, n - ir.length + 1), last = Math.min(signalLength - 1, n);
    for (let k = first; k <= last; ++k) expected += input[k] * ir[n - k];
    const error = actual[n] - expected;
    maxError = Math.max(maxError, Math.abs(error)); sumSquares += error * error;
  }
  return {normalize:false, checkedSamples:checked, maxError, rmsError:Math.sqrt(sumSquares / checked)};
}

async function automatedValidation() {
  await context.resume();
  const oscillator = new OscillatorNode(context, {frequency: 220});
  const gain = new GainNode(context, {gain: 0.05});
  oscillator.connect(gain).connect(node);
  oscillator.start();
  const container = await fetch('../../third_party/NeuralAmpModelerCore/example_models/A2.nam').then((r) => r.json());
  const full = JSON.stringify(container.config.submodels[1].model);
  const lite = JSON.stringify(container.config.submodels[0].model);
  const first = await node.loadModelText(full, 'A2-Full.nam');
  const irResponse = await fetch('../../src/cabinet-wam/IRs/TWIN%20REVERB%20__%20CLEAN.wav');
  const irBuffer = await context.decodeAudioData(await irResponse.arrayBuffer());
  const cabinetLoad = await cabinetNode.loadImpulseResponse(irBuffer.getChannelData(0), 'TWIN REVERB __ CLEAN.wav');
  const convolverReference = await compareConvolverReference(irBuffer.getChannelData(0));
  await node.setParameterValues({inputGain:{id:'inputGain',value:6,normalized:false}, outputGain:{id:'outputGain',value:-3,normalized:false}, bypass:{id:'bypass',value:0,normalized:false}});
  const state = await node.getState();
  await node.loadModelText(lite, 'A2-Lite.nam');
  await node.setState(state);
  const restored = await node.getState();
  await node.startDiagnostic();
  await cabinetNode.startDiagnostic();
  await waitQuanta(4000);
  const performance = await node.stopDiagnostic();
  const cabinetPerformance = await cabinetNode.stopDiagnostic();
  oscillator.stop(); gain.disconnect();
  let mismatchRejected = false;
  const mismatch = structuredClone(container.config.submodels[1].model);
  mismatch.sample_rate = context.sampleRate === 48000 ? 44100 : 48000;
  try { await node.loadModelText(JSON.stringify(mismatch), 'mismatch.nam'); }
  catch (error) { mismatchRejected = /sample-rate mismatch/.test(error.message); }
  const params = await node.getParameterValues(false);
  const status = await node.getNamStatus();
  window.phase3Result = {first, performance, cabinetLoad, convolverReference, cabinetPerformance, cabinetStatus:await cabinetNode.getCabinetStatus(), mismatchRejected, status,
    stateRestored: restored.model?.name === 'A2-Full.nam' && params.inputGain.value === 6 && params.outputGain.value === -3,
    discoveredFiles: [...$('#audioSource').options].slice(1).map((option) => option.textContent),
    cabinetUsesOneAudioWorkletNode:cabinetNode instanceof AudioWorkletNode, completedAt:new Date().toISOString()};
  $('#automatedResult').textContent = JSON.stringify(window.phase3Result, null, 2);
  document.documentElement.dataset.phase3 = 'complete';
}

// TONE3000 may deliberately use `noopener` on the hosted picker link.  In
// that case the callback tab has no opener, but it is still on this same
// origin and can relay through BroadcastChannel.
const tone3000PopupCallback = /[?&](?:code|error|canceled)=/u.test(window.location.search);
const tone3000HasOpener = Boolean(window.opener && window.opener !== window);
const tone3000PopupMode = sessionStorage.getItem('nam-a2-wam.tone3000.popup') === '1';
const tone3000SameTabCallback = tone3000PopupCallback && !tone3000HasOpener &&
  !tone3000PopupMode &&
  Boolean(sessionStorage.getItem('nam-a2-wam.tone3000.state'));
if (tone3000PopupCallback && (tone3000HasOpener || tone3000PopupMode || !tone3000SameTabCallback)) {
  const callback = {type:TONE3000_CALLBACK_CHANNEL, href:window.location.href};
  try {
    localStorage.setItem(TONE3000_CALLBACK_STORAGE_KEY, JSON.stringify({...callback, nonce: `${Date.now()}-${Math.random()}`}));
    window.setTimeout(() => localStorage.removeItem(TONE3000_CALLBACK_STORAGE_KEY), 2000);
  } catch { /* Continue with the channel/opener relays if storage is unavailable. */ }
  if (typeof BroadcastChannel === 'function') {
    const channel = new BroadcastChannel(TONE3000_CALLBACK_CHANNEL);
    // The host may need one event-loop turn to receive the callback after the
    // redirect. Repeat briefly so a slow tab activation does not lose it.
    [0, 150, 500, 1000].forEach((delay) => window.setTimeout(() => channel.postMessage(callback), delay));
    window.setTimeout(() => channel.close(), 1500);
  }
  if (window.opener && !window.opener.closed) window.opener.postMessage(callback, window.location.origin);
  document.body.innerHTML = '<p style="font:16px system-ui;padding:2rem">Returning to NAM A2 WAM…</p>';
  window.setTimeout(() => window.close(), 1600);
} else {
  // Some embedded browsers collapse window.open() into the current tab. In
  // that case sessionStorage survives and initialize() lets the plugin GUI
  // consume the callback directly from window.location.
  initialize().catch((error) => { window.phase3Error = String(error.stack || error); message(window.phase3Error, true); document.documentElement.dataset.phase3 = 'error'; });
}
