import initializeWamHost from '../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js';
import NamPlugin from '../../src/nam-wam/index.js';
import CabinetPlugin from '../../src/cabinet-wam/index.js';
import SourceManager from './SourceManager.js';
import OutputDeviceManager from './OutputDeviceManager.js';
import {readAudioDevicePreferences, saveAudioDevicePreferences, resolveInputPreference} from './AudioDevicePreferences.js';
import {FxChain} from './FxChain.js';
import {FxChainView} from './FxChainView.js';
import {WamPluginRegistry} from './WamPluginRegistry.js';
const TONE3000_CALLBACK_CHANNEL = 'nam-a2-wam.tone3000.callback';
const TONE3000_CALLBACK_STORAGE_KEY = 'nam-a2-wam.tone3000.callback';

const $ = (selector) => document.querySelector(selector);
// Factory and TONE3000 NAM A2 captures are published at 48 kHz. Request the
// same rate so the WASM core does not reject otherwise valid models.
const context = new AudioContext({latencyHint: 'interactive', sampleRate: 48000});
let plugin;
let node;
let cabinetPlugin;
let cabinetNode;
let sourceManager;
let savedState;
const audioPreferences = readAudioDevicePreferences();
let selectedDeviceId = audioPreferences.inputDeviceId;
let selectedInputChannel = audioPreferences.inputChannel;
let liveInputEnabled = false;
let outputDeviceManager;
let chain, chainView;


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
  const choice = resolveInputPreference(inputs, previous, selectedInputChannel);
  selector.value = choice.deviceId;
  selectedInputChannel = choice.channel;
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

function refreshInputChannels(channelCount=1,deviceLabel='') {
  const count=Math.max(1,Math.trunc(Number(channelCount)||1)),selector=$('#inputChannel'),scarlett2i2=/scarlett\s*2i2/iu.test(deviceLabel)&&count>=4;
  selector.replaceChildren(...Array.from({length:count},(_,index)=>new Option(scarlett2i2?(index<2?`Physical input ${index+1}`:`Loopback ${index-1} — do not use`):`Input ${index+1}`,String(index))));
  selectedInputChannel=Math.min(selectedInputChannel,count-1);
  selector.value=String(selectedInputChannel);
  $('#inputChannelRow').hidden=count<=1;
  $('#inputChannelStatus').textContent=count===1?'The browser opened a mono stream (1 channel). Check the interface and macOS audio configuration if you expect two inputs.':`${count} capture channels available. Only the selected channel is processed.`;
}

async function detectSelectedInputChannels() {
  if (liveInputEnabled || $('#audioSource').value !== 'live' || !$('#inputDevice').options.length) return;
  const probingDevice = selectedDeviceId;
  $('#inputChannel').replaceChildren(new Option('Detecting channels…', ''));
  $('#inputChannel').disabled = true;
  $('#inputChannelRow').hidden = false;
  $('#inputChannelStatus').textContent='Detecting input channels (monitoring off)…';
  try {
    const input = await sourceManager.activateLive(probingDevice, 0, {monitor:false});
    if (input && selectedDeviceId === probingDevice && !liveInputEnabled && $('#audioSource').value === 'live') {
      refreshInputChannels(input.channelCount,input.label);
      $('#inputChannel').disabled = false;
    }
  } catch(error) {
    if (selectedDeviceId === probingDevice && !liveInputEnabled && $('#audioSource').value === 'live') {
      $('#inputChannel').replaceChildren(new Option('Channels unavailable', ''));
      $('#inputChannelStatus').textContent=`Cannot detect channels: ${error.message}`;
    }
  }
}

function syncSourceTrim() {
  const value = sourceManager.activeTrimDb;
  $('#sourceTrim').value = value;
  $('#sourceTrimValue').textContent = `${value.toFixed(1)} dB`;
}

function setPlayerEnabled(enabled) {
  for (const control of document.querySelectorAll('.player-control')) control.disabled = !enabled;
  $('#playerPanel').hidden = !enabled;
  $('#inputDevice').disabled = enabled;
  $('#inputChannel').disabled = enabled;
  $('#enableLive').disabled = enabled;
}

function syncLiveInputButton() {
  const button = $('#enableLive');
  button.textContent = liveInputEnabled ? 'Disable live input' : 'Enable live input';
  button.setAttribute('aria-pressed', String(liveInputEnabled));
  button.classList.toggle('live-active', liveInputEnabled);
}

async function activateSelectedLiveInput() {
  if (!selectedDeviceId) await refreshDevices(true);
  if (!selectedDeviceId) throw new Error('No audio input device is available');
  const stream = await sourceManager.activateLive(selectedDeviceId, selectedInputChannel);
  if (!stream) return false;
  const activeInput = sourceManager.liveInput;
  refreshInputChannels(activeInput?.channelCount, activeInput?.label);
  $('#inputChannel').disabled = false;
  if (activeInput?.channelCount === 1) {
    const detail = sourceManager.captureDiagnostics;
    $('#inputChannelStatus').textContent = `${activeInput.label || 'Selected input'}: requested ${detail.requestedChannels} channels, browser supplied 1. ${detail.channelNegotiationError || 'The browser did not provide a stereo stream.'}`;
  }
  liveInputEnabled = true;
  syncLiveInputButton();
  syncSourceTrim();
  message(`Live input active: ${activeInput?.label || $('#inputDevice').selectedOptions[0]?.textContent || selectedDeviceId} · input ${Number(activeInput?.channelIndex || 0) + 1}/${activeInput?.channelCount || 1}`);
  return true;
}

async function disableLiveInput(status = 'Live input disabled') {
  await sourceManager.disconnectCurrent();
  liveInputEnabled = false;
  syncLiveInputButton();
  message(status);
}

async function selectSource() {
  const value = $('#audioSource').value;
  if (value === 'live') {
    setPlayerEnabled(false);
    await disableLiveInput('Live input ready. Click Enable live input to start monitoring.');
  } else {
    liveInputEnabled = false;
    syncLiveInputButton();
    setPlayerEnabled(true);
    const filename = value.slice(5);
    await sourceManager.activateFile(`./assets/audio/${encodeURIComponent(filename)}`);
    syncSourceTrim();
    message(`Dry guitar audio ready: ${filename}`);
  }
}

async function initialize() {
  if (context.sampleRate !== 48000) {
    message(`Audio context is ${context.sampleRate} Hz; NAM A2 models require 48000 Hz. Reload with a browser/device that supports a 48 kHz AudioContext.`);
  }
  NamPlugin.configureTone3000(window.NAM_A2_WAM_CONFIG?.tone3000 || {});
  CabinetPlugin.configureTone3000(window.NAM_A2_WAM_CONFIG?.tone3000 || {});
  const [groupId] = await initializeWamHost(context, 'nam-a2-phase3-host');
  plugin = await NamPlugin.createInstance(groupId, context, {});
  node = plugin.audioNode;
  cabinetPlugin = await CabinetPlugin.createInstance(groupId, context, {});
  cabinetNode = cabinetPlugin.audioNode;
  node.onprocessorerror = (event) => { window.phase3ProcessorError = 'AudioWorklet processor error'; message(window.phase3ProcessorError, true); };
  const registry=new WamPluginRegistry();
  try{await registry.load(new URL('./wamPlugins/plugins.json',import.meta.url));}catch(error){message(error.message,true);}
  chain=new FxChain({context,registry,groupId});
  await chain.initialize(plugin,cabinetPlugin);
  plugin.toneSession.identity='nam';cabinetPlugin.toneSession.identity='cabinet';
  await Promise.all([plugin.toneSession.complete(),cabinetPlugin.toneSession.complete()]);
  chain.output.connect(context.destination);
  sourceManager = new SourceManager({audioContext: context, wamNode: chain.input, player: $('#player')});
  outputDeviceManager = new OutputDeviceManager({audioContext: context});
  window.phase3Debug = {context, node, plugin, cabinetNode, cabinetPlugin, sourceManager, outputDeviceManager, chain};
  chainView=new FxChainView(chain,$('#fxChain'),message);
  await discoverFiles();
  await refreshDevices(false);
  if (outputDeviceManager.supported) {
    const outputs = await refreshOutputs({includeAuthorized:false});
    if (audioPreferences.outputDeviceId && outputs.some(device => device.deviceId === audioPreferences.outputDeviceId)) {
      try { await outputDeviceManager.select(audioPreferences.outputDeviceId); }
      catch { await outputDeviceManager.select(''); }
      await refreshOutputs();
    }
    $('#outputSupport').textContent = 'Output selection uses AudioContext.setSinkId().';
  } else {
    $('#outputDevice').disabled = true;
    $('#authorizeOutput').disabled = true;
    $('#outputSupport').textContent = 'This browser does not support AudioContext output-device selection; using system default.';
  }
  $('#authorizeOutput').hidden = !outputDeviceManager.authorizationSupported;
  setPlayerEnabled(false);
  syncLiveInputButton();
  let deviceRefresh = Promise.resolve();
  let wasRunning = context.state === 'running';
  let recovery = null;
  const recoverAudio = () => {
    if (recovery) return recovery;
    $('#recoverAudio').hidden = false;
    $('#recoverAudio').disabled = true;
    recovery = (async () => {
      // A broken renderer may leave a browser promise pending indefinitely.
      let timer;
      try {
        await Promise.race([outputDeviceManager.recover(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Audio recovery timed out. Reconnect the output and reload the page if recovery still fails.')), 4000);
        })]);
        $('#outputDevice').value = '';
        $('#recoverAudio').hidden = true;
        message('Audio recovered using the system default output.');
      } catch (error) { message(error.message, true); }
      finally { clearTimeout(timer); $('#recoverAudio').disabled = false; recovery = null; }
    })();
    return recovery;
  };
  $('#recoverAudio').onclick = recoverAudio;
  context.addEventListener('statechange', () => {
    if (context.state === 'running') { wasRunning = true; return; }
    if (wasRunning && (liveInputEnabled || !$('#player').paused)) {
      message(`Audio engine ${context.state}. Attempting recovery…`, true);
      recoverAudio();
    }
  });
  navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    deviceRefresh = deviceRefresh.catch(() => {}).then(async () => {
    const wasLive = liveInputEnabled;
    const old = selectedDeviceId;
    const devices = await refreshDevices(false);
    if (wasLive && !devices.some((device) => device.deviceId === old)) {
      await disableLiveInput('Selected input disconnected. Select an input and enable live input again.');
      refreshInputChannels();
    }
    if (outputDeviceManager.supported) await refreshOutputs({includeAuthorized: false});
    if (wasRunning && context.state !== 'running') await recoverAudio();
    }).catch(async (error) => { message(`Audio device change failed: ${error.message}`, true); await recoverAudio(); });
  });
  $('#audioSource').onchange = () => selectSource().catch((error) => message(error.message, true));
  $('#sourceTrim').oninput = () => {
    const value = sourceManager.setTrimDb(Number($('#sourceTrim').value), $('#audioSource').value === 'live' ? 'live' : 'file');
    $('#sourceTrimValue').textContent = `${value.toFixed(1)} dB`;
  };
  $('#enableLive').onclick = async () => {
    try {
      if (liveInputEnabled) {
        await disableLiveInput();
        return;
      }
      await context.resume();
      if (!$('#inputDevice').value) await refreshDevices(true);
      else selectedDeviceId=$('#inputDevice').value;
      await activateSelectedLiveInput();
    }
    catch (error) { liveInputEnabled=false; syncLiveInputButton(); message(error.message, true); }
  };
  $('#inputDevice').onchange = async () => {
    selectedDeviceId = $('#inputDevice').value;
    selectedInputChannel=0;
    saveAudioDevicePreferences({inputDeviceId:selectedDeviceId,inputChannel:0});
    refreshInputChannels();
    $('#inputChannelStatus').textContent='Enable live input to detect the channels of this device.';
    if ($('#audioSource').value !== 'live') return;
    if (!liveInputEnabled) {
      await detectSelectedInputChannels();
      return;
    }
    try {
      await context.resume();
      await activateSelectedLiveInput();
    } catch(error) { await disableLiveInput(); message(`Cannot select audio input: ${error.message}`,true); }
  };
  $('#inputChannel').onchange=async()=>{
    selectedInputChannel=Math.max(0,Number($('#inputChannel').value)||0);
    saveAudioDevicePreferences({inputDeviceId:selectedDeviceId,inputChannel:selectedInputChannel});
    if($('#audioSource').value!=='live'||!selectedDeviceId||!liveInputEnabled)return;
    try{await activateSelectedLiveInput();}
    catch(error){await disableLiveInput();message(`Cannot select input channel: ${error.message}`,true);}
  };
  $('#outputDevice').onchange = async () => {
    try { await outputDeviceManager.select($('#outputDevice').value); saveAudioDevicePreferences({outputDeviceId:outputDeviceManager.selectedDeviceId}); }
    catch (error) { message(`Cannot select audio output: ${error.message}`, true); await refreshOutputs(); }
  };
  $('#authorizeOutput').onclick = async () => {
    try { await context.resume(); await outputDeviceManager.authorize(); await refreshOutputs(); saveAudioDevicePreferences({outputDeviceId:outputDeviceManager.selectedDeviceId}); }
    catch (error) { message(`Audio output authorization failed: ${error.message}`, true); }
  };
  $('#play').onclick = async () => { await context.resume(); await $('#player').play(); };
  $('#pause').onclick = () => $('#player').pause();
  $('#stop').onclick = () => { $('#player').pause(); $('#player').currentTime = 0; };
  $('#loop').onchange = () => { $('#player').loop = $('#loop').checked; };
  $('#seek').oninput = () => { if (Number.isFinite($('#player').duration)) $('#player').currentTime = Number($('#seek').value) * $('#player').duration; };
  $('#player').ontimeupdate = () => { if (Number.isFinite($('#player').duration) && $('#player').duration) $('#seek').value = $('#player').currentTime / $('#player').duration; };
  $('#saveState').onclick = async () => {
    savedState = await chain.getState();
    $('#stateSize').textContent = `${new TextEncoder().encode(JSON.stringify(savedState)).byteLength.toLocaleString()} serialized bytes`;
  };
  $('#restoreState').onclick = async () => {
    if (!savedState) return message('Save state first', true);
    chainView.close();
    await chain.setState(savedState);
    message('WAM state restored');
  };
  message('Chain ready. Click a photo to edit, or + to insert an effect.');
  // Programmatic selection during refreshDevices does not fire onchange.
  // Probe the initially displayed device too, after all controls are ready.
  if (!new URLSearchParams(location.search).has('auto')) void detectSelectedInputChannels();
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
  const stateValues = {inputGain:6,outputGain:-3,bypass:0,noise:-42,noiseEnabled:0,bass:7.2,middle:3.4,treble:8.1,
    toneEnabled:0,eqEnabled:1,eqPre:1,eq1Freq:85,eq1Gain:2.5,eq1Q:.8,eq2Freq:230,eq2Gain:-3,eq2Q:1.2,
    eq3Freq:710,eq3Gain:1.5,eq3Q:1.6,eq4Freq:1750,eq4Gain:4,eq4Q:.9,eq5Freq:4100,eq5Gain:-2,eq5Q:2.1,
    eq6Freq:9200,eq6Gain:3.5,eq6Q:.65};
  const wamValues = (values) => Object.fromEntries(Object.entries(values).map(([id,value])=>[id,{id,value,normalized:false}]));
  await node.setParameterValues(wamValues(stateValues));
  const state = await node.getState();
  await node.loadModelText(lite, 'A2-Lite.nam');
  await node.setParameterValues(wamValues(Object.fromEntries(Object.keys(stateValues).map((id)=>[id,0]))));
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
  const stateParametersRestored = Object.entries(stateValues).every(([id,value])=>Math.abs(params[id].value-value)<1e-5);
  window.phase3Result = {first, performance, cabinetLoad, convolverReference, cabinetPerformance, cabinetStatus:await cabinetNode.getCabinetStatus(), mismatchRejected, status,
    stateRestored: restored.model?.name === 'A2-Full.nam' && stateParametersRestored,
    stateParametersRestored,
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
