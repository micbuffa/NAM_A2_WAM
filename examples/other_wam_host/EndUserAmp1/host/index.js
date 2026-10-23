// ────────────────────────────────────────────────────────────
//  WAM Host – index.js
//  Audio source switching, device menus, gain + VU meters
// ────────────────────────────────────────────────────────────
import { FACTORY_PRESETS } from './presets.js';
export { FACTORY_PRESETS };

/* ── DOM refs ───────────────────────────────────────────── */
const sourceSelect = document.getElementById('source-select');
const inputDeviceSelect = document.getElementById('input-device-select');
const outputDeviceSelect = document.getElementById('output-device-select');
const player = document.getElementById('player');
const mount = document.getElementById('mount');
const liveStatus = document.getElementById('live-status');
const statusText = document.getElementById('status-text');
const srDisplay = document.getElementById('sr-display');
const firefoxWarning =
    document.getElementById('firefox-warning');

// Gain controls
const inputGainPanel = document.getElementById('input-gain-panel');
const inputGainSlider = document.getElementById('input-gain');
const inputGainValue = document.getElementById('input-gain-value');
const outputGainSlider = document.getElementById('output-gain');
const outputGainValue = document.getElementById('output-gain-value');

// VU meter elements
const inputVuFill = document.getElementById('input-vu-fill');
const inputVuPeak = document.getElementById('input-vu-peak');
const outputVuFill = document.getElementById('output-vu-fill');
const outputVuPeak = document.getElementById('output-vu-peak');

/* ── Preset DOM refs ────────────────────────────────────── */
const presetSelect = document.getElementById('preset-select');
const btnSavePreset = document.getElementById('btn-save-preset');
const presetUpdateRow = document.getElementById('preset-update-row');
const btnUpdatePreset = document.getElementById('btn-update-preset');
const btnSaveasPreset = document.getElementById('btn-saveas-preset');
const btnDeletePreset = document.getElementById('btn-delete-preset');
const activePresetBadge = document.getElementById('active-preset-badge');
const activePresetName = document.getElementById('active-preset-name');

/* ── State ──────────────────────────────────────────────── */
let audioContext = null;
let currentSource = null;
let liveStream = null;
let wamInstance = null;
let firstPluginInstance = null;
let mediaElSource = null;

// Audio graph nodes
let inputGainNode = null;
let outputGainNode = null;
let pluginPannerNode = null;
let inputAnalyser = null;
let outputAnalyser = null;

// Plugin instances (populated after init)
let tunerInst = null, deathgateInst = null, autoWahInst = null,
    ts9Inst = null, stonePhaserStereoInst = null, chorusInst = null,
    ampInst = null, pingpongInst = null, greyholeInst = null;

// Firefox helpers
const isFirefox =
    navigator.userAgent.toLowerCase().includes('firefox');

if (isFirefox && firefoxWarning) {

    firefoxWarning.textContent =
        '(live output routing unsupported)';

    console.warn(
        '[Host] Firefox detected: AudioContext.setSinkId unsupported'
    );
}

let sourceSwitchToken = 0;

// VU meter state
let inputPeakLevel = 0;
let outputPeakLevel = 0;
let vuAnimFrame = null;

/* ── Helpers ────────────────────────────────────────────── */
function setStatus(msg) {
    statusText.textContent = msg;
}

function gainToDb(gain) {
    if (gain < 0.0001) return '-∞';
    return (20 * Math.log10(gain)).toFixed(1);
}

function resumeAudio() {
    if (audioContext) {
        console.log(
            `[Host] Resuming audio context (current state: ${audioContext.state})`
        );

        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() =>
                console.log('[Host] Context resumed successfully')
            );
        }
    }
}

/* ── VU Meter engine ────────────────────────────────────── */
function getRmsLevel(analyser, dataArray) {
    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
    }

    return Math.sqrt(sum / dataArray.length);
}

function updateVuMeter(fillEl, peakEl, rms, peakState) {

    const dbFS = rms > 0.0001
        ? 20 * Math.log10(rms)
        : -100;

    const pct = Math.max(
        0,
        Math.min(100, ((dbFS + 60) / 60) * 100)
    );

    fillEl.style.width = `${pct}%`;

    if (pct > peakState.value) {
        peakState.value = pct;
        peakState.holdFrames = 30;
        peakEl.style.opacity = '0.9';

    } else if (peakState.holdFrames > 0) {

        peakState.holdFrames--;

    } else {

        peakState.value = Math.max(
            0,
            peakState.value - 0.8
        );

        if (peakState.value < 1) {
            peakEl.style.opacity = '0';
        }
    }

    peakEl.style.left = `${peakState.value}%`;
}

const inputPeak = { value: 0, holdFrames: 0 };
const outputPeak = { value: 0, holdFrames: 0 };

let inputDataArray = null;
let outputDataArray = null;

function vuLoop() {

    if (
        inputAnalyser &&
        inputDataArray &&
        !inputGainPanel.classList.contains('hidden')
    ) {

        const rms = getRmsLevel(
            inputAnalyser,
            inputDataArray
        );

        updateVuMeter(
            inputVuFill,
            inputVuPeak,
            rms,
            inputPeak
        );
    }

    if (outputAnalyser && outputDataArray) {

        const rms = getRmsLevel(
            outputAnalyser,
            outputDataArray
        );

        updateVuMeter(
            outputVuFill,
            outputVuPeak,
            rms,
            outputPeak
        );

        if (
            !window._lastVuLog ||
            Date.now() - window._lastVuLog > 3000
        ) {
            window._lastVuLog = Date.now();
            console.log(`[Host] VU Meter Sync: Input RMS = ${inputVuFill.style.width}, Output RMS = ${outputVuFill.style.width}`);
        }
    }

    vuAnimFrame = requestAnimationFrame(vuLoop);
}

/* ── 1. Populate audio file list from manifest ──────────── */
async function loadAudioFileList() {

    try {

        const resp = await fetch(
            '../assets/audio/audioFiles.json'
        );

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const files = await resp.json();

        files.forEach(name => {

            const opt = document.createElement('option');

            opt.value = `../assets/audio/${name}`;
            opt.textContent = `🎵 ${name}`;

            sourceSelect.appendChild(opt);
        });

        if (files.length) {
            setStatus(`${files.length} audio file(s) available`);
        }

    } catch (err) {

        console.warn(
            'Could not load audioFiles.json',
            err
        );

        setStatus('No audio files found');
    }
}

/* ── 2. Device enumeration ─────────────────────────────── */

/**
 * Sur Firefox, enumerateDevices() ne retourne les labels que si la
 * permission microphone a déjà été accordée. On fait un getUserMedia
 * minimal, on libère le stream, puis on énumère.
 */
async function requestMicPermissionThenEnumerate() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // Libérer immédiatement — on voulait juste débloquer les labels
        stream.getTracks().forEach(t => t.stop());
    } catch (err) {
        // L'utilisateur a refusé ou pas de micro : on énumère quand même
        console.warn('[Host] Permission mic refusée ou indisponible:', err.message);
    }
    await enumerateDevices();
}

async function enumerateDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const savedInput = inputDeviceSelect.value;

        inputDeviceSelect.innerHTML = '';

        const inputs = devices.filter(
            d => d.kind === 'audioinput'
        );

        if (!inputs.length) {
            inputDeviceSelect.add(
                new Option('— no input devices —', '')
            );
        }

        inputs.forEach((d, i) => {

            inputDeviceSelect.add(
                new Option(
                    d.label || `Input ${i + 1}`,
                    d.deviceId
                )
            );
        });

        if (
            [...inputDeviceSelect.options]
                .some(o => o.value === savedInput)
        ) {
            inputDeviceSelect.value = savedInput;
        }

        const savedOutput = outputDeviceSelect.value;

        outputDeviceSelect.innerHTML = '';

        const outputs = devices.filter(
            d => d.kind === 'audiooutput'
        );

        if (!outputs.length) {
            outputDeviceSelect.add(
                new Option('— no output devices —', '')
            );
        }

        outputs.forEach((d, i) => {

            outputDeviceSelect.add(
                new Option(
                    d.label || `Output ${i + 1}`,
                    d.deviceId
                )
            );
        });

        if (
            [...outputDeviceSelect.options]
                .some(o => o.value === savedOutput)
        ) {
            outputDeviceSelect.value = savedOutput;
        }

    } catch (err) {

        console.error(
            'Device enumeration error:',
            err
        );
    }
}

navigator.mediaDevices.addEventListener(
    'devicechange',
    () => {
        enumerateDevices();
        setStatus('Audio devices changed — lists refreshed');
    }
);

/* ── 3. Preset Manager ─────────────────────────────────── */
export const PRESET_PREFIX = 'wam-host-preset:';
let _activePreset = null;          // name of the active preset
let _activePresetIsFactory = false; // true = factory preset (read-only)

/**
 * Dynamic plugin registry: key (string) → WAM instance.
 * Populated after all plugins are instantiated.
 * Adaptive: adding/removing plugins only requires updating this map.
 */
export const _pluginRegistry = new Map();

export function _allPresetNames() {
    const names = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PRESET_PREFIX)) names.push(k.slice(PRESET_PREFIX.length));
    }
    return names.sort();
}

function _saveToStorage(name, state) {
    localStorage.setItem(PRESET_PREFIX + name, JSON.stringify(state));
}

function _loadFromStorage(name) {
    const raw = localStorage.getItem(PRESET_PREFIX + name);
    return raw ? JSON.parse(raw) : null;
}

function _deleteFromStorage(name) {
    localStorage.removeItem(PRESET_PREFIX + name);
}

/**
 * Collect state from every registered plugin.
 * New plugins (not yet in saved presets) are simply included.
 */
async function _collectState() {
    const state = {};
    for (const [key, inst] of _pluginRegistry) {
        try {
            state[key] = inst ? await inst.audioNode.getState() : null;
        } catch (e) {
            state[key] = null;
            console.warn(`[Preset] getState failed for "${key}":`, e);
        }
    }
    return state;
}

/**
 * Apply saved state to registered plugins.
 * - Plugin in registry but NOT in saved state → skipped (new plugin, keeps defaults).
 * - Key in saved state but NOT in registry → silently ignored (removed plugin).
 */
async function _applyState(state) {
    for (const [key, inst] of _pluginRegistry) {
        if (!(key in state) || state[key] == null) {
            console.log(`[Preset] No saved state for "${key}" — keeping defaults`);
            continue;
        }
        try {
            await inst.audioNode.setState(state[key]);
        } catch (e) {
            console.warn(`[Preset] setState failed for "${key}":`, e);
        }
    }
}


function _setActivePreset(name, isFactory = false) {
    _activePreset = name;
    _activePresetIsFactory = isFactory;

    if (name) {
        activePresetBadge.style.display = 'block';
        activePresetName.textContent = name;
        btnSavePreset.classList.add('hidden');
        presetUpdateRow.classList.remove('hidden');

        if (isFactory) {
            // Factory preset: cannot update or delete
            btnUpdatePreset.classList.add('hidden');
            btnSaveasPreset.textContent = '+ Save as User Preset';
            btnDeletePreset.classList.add('hidden');
        } else {
            // User preset: all actions available
            btnUpdatePreset.classList.remove('hidden');
            btnSaveasPreset.textContent = '+ New';
            btnDeletePreset.classList.remove('hidden');
        }
    } else {
        activePresetBadge.style.display = 'none';
        activePresetName.textContent = '';
        btnSavePreset.classList.remove('hidden');
        presetUpdateRow.classList.add('hidden');
        btnDeletePreset.classList.add('hidden');
    }
}

export async function loadPreset(name, isFactory) {
    let state;
    if (isFactory) {
        const found = FACTORY_PRESETS.find(p => p.name === name);
        state = found ? found.state : null;
    } else {
        state = _loadFromStorage(name);
    }

    if (!state) {
        setStatus(`\u26A0\uFE0F Preset "${name}" not found`);
        return false;
    }

    setStatus(`Loading preset "${name}"\u2026`);
    await _applyState(state);
    _setActivePreset(name, isFactory);
    refreshPresetMenu();
    setStatus(`\u2705 Preset "${name}" loaded`);
    return true;
}

export function refreshPresetMenu() {
    presetSelect.innerHTML = '';
    presetSelect.add(new Option('\u2014 choose a preset \u2014', ''));

    // ── Factory Presets group ──
    const factoryGroup = document.createElement('optgroup');
    factoryGroup.label = '\uD83C\uDFED Factory Presets';
    FACTORY_PRESETS.forEach(p => {
        factoryGroup.appendChild(new Option(p.name, 'factory:' + p.name));
    });
    presetSelect.appendChild(factoryGroup);

    // ── User Presets group ──
    const userNames = _allPresetNames();
    if (userNames.length > 0) {
        const userGroup = document.createElement('optgroup');
        userGroup.label = '\uD83D\uDC64 My Presets';
        userNames.forEach(n => userGroup.appendChild(new Option(n, 'user:' + n)));
        presetSelect.appendChild(userGroup);
    }

    // Restore active selection
    if (_activePreset) {
        presetSelect.value = (_activePresetIsFactory ? 'factory:' : 'user:') + _activePreset;
    }
}


/** Call once plugins are ready to unlock the preset UI */
function enablePresetUI() {
    refreshPresetMenu();
    presetSelect.disabled = false;
    btnSavePreset.disabled = false;
    btnUpdatePreset.disabled = false;
    btnSaveasPreset.disabled = false;
    btnDeletePreset.disabled = false;
}

// ── Preset event handlers ─────────────────────────────────

btnSavePreset.addEventListener('click', async () => {
    const name = prompt('Preset name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const state = await _collectState();
    _saveToStorage(trimmed, state);
    _setActivePreset(trimmed, false);
    refreshPresetMenu();
    setStatus(`\u2705 Preset "${trimmed}" saved`);
});

btnUpdatePreset.addEventListener('click', async () => {
    if (!_activePreset || _activePresetIsFactory) return;
    const state = await _collectState();
    _saveToStorage(_activePreset, state);
    setStatus(`\u2705 Preset "${_activePreset}" updated`);
});

btnSaveasPreset.addEventListener('click', async () => {
    // Factory preset: suggest "Name (custom)"; user preset: suggest "Name copy"
    const suggestion = _activePresetIsFactory
        ? `${_activePreset} (custom)`
        : (_activePreset ? `${_activePreset} copy` : '');
    const name = prompt('New preset name:', suggestion);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const state = await _collectState();
    _saveToStorage(trimmed, state);
    _setActivePreset(trimmed, false); // always a user preset
    refreshPresetMenu();
    setStatus(`\u2705 Preset "${trimmed}" saved`);
});

btnDeletePreset.addEventListener('click', () => {
    if (!_activePreset || _activePresetIsFactory) return;
    if (!confirm(`Delete preset "${_activePreset}"?`)) return;
    _deleteFromStorage(_activePreset);
    _setActivePreset(null);
    refreshPresetMenu();
    setStatus('\uD83D\uDDD1 Preset deleted');
});

presetSelect.addEventListener('change', async () => {
    const val = presetSelect.value;
    if (!val) { _setActivePreset(null); return; }

    const isFactory = val.startsWith('factory:');
    const name = val.slice(isFactory ? 8 : 5); // 'factory:'.length=8, 'user:'.length=5

    await loadPreset(name, isFactory);
});


/* ── 3. Source switching ───────────────────────────────── */
// Firefox workaround: hidden muted audio element to keep stream active
const dummyAudio = document.createElement('audio');
dummyAudio.muted = true;
dummyAudio.style.display = 'none';
document.body.appendChild(dummyAudio);

// Firefox workaround: ScriptProcessor to force real-time pulling
let keepAliveNode = null;

function startKeepAlive() {
    if (keepAliveNode) return;
    try {
        // ScriptProcessor is deprecated but very effective at forcing Firefox to keep the clock running
        keepAliveNode = audioContext.createScriptProcessor(1024, 1, 1);
        keepAliveNode.onaudioprocess = () => {
            // Aggressive resume if context is suspended
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        };
        keepAliveNode.connect(audioContext.destination);
        console.log('[Host] Keep-alive ScriptProcessor started');
    } catch (e) {
        console.warn('[Host] Could not start ScriptProcessor keep-alive', e);
    }
}

async function disconnectCurrentSource() {
    if (currentSource) {
        try {
            currentSource.disconnect();
        } catch (_) { }

        currentSource = null;
    }

    if (liveStream) {
        liveStream.getTracks().forEach(t => t.stop());
        liveStream = null;

        // Clear dummy audio
        dummyAudio.srcObject = null;

        // Firefox/macOS CoreAudio workaround
        if (isFirefox) {
            await new Promise(r => setTimeout(r, 250));
        }
    }

    player.pause();
    player.style.display = '';
    liveStatus.style.display = 'none';
}

async function switchSource() {

    if (!audioContext || !firstPluginInstance) {
        return;
    }

    const token = ++sourceSwitchToken;

    await disconnectCurrentSource();

    if (token !== sourceSwitchToken) {
        return;
    }

    const val = sourceSelect.value;
    const isLive = val === '__live__';

    inputGainPanel.classList.toggle(
        'hidden',
        !isLive
    );

    if (isLive) {
        const deviceId = inputDeviceSelect.value;

        const constraints = {
            audio: {
                deviceId: deviceId ? deviceId : undefined,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        };

        try {
            console.log('[Host] getUserMedia constraints:', constraints);

            liveStream = await navigator.mediaDevices.getUserMedia(constraints);

            if (token !== sourceSwitchToken) {
                liveStream.getTracks().forEach(t => t.stop());
                return;
            }

            // Firefox workaround: route to audio element (muted)
            dummyAudio.srcObject = liveStream;
            dummyAudio.muted = true;
            dummyAudio.play().catch(() => { });

            currentSource = audioContext.createMediaStreamSource(liveStream);

            // Fix for Firefox: keep context clock alive
            startKeepAlive();

            if (isFirefox) {
                await audioContext.resume();
            }

            // Route through full chain (connected at init)
            currentSource.connect(inputAnalyser);
            // And Amp -> Output Gain (already done in init)

            player.style.display = 'none';
            liveStatus.style.display = 'flex';
            setStatus('🎤 Live input active');
            console.log('[Host] Live input connected');

        } catch (err) {
            console.error('getUserMedia error:', err);
            setStatus(`Mic error: ${err.message}`);
        }

    } else {

        player.src = val;

        if (!mediaElSource) {
            mediaElSource =
                audioContext
                    .createMediaElementSource(player);
        }

        currentSource = mediaElSource;

        // Unify routing: MP3 also goes through inputGainNode and inputAnalyser
        currentSource.connect(inputGainNode);

        player.style.display = '';
        liveStatus.style.display = 'none';

        setStatus(`Playing: ${val.split('/').pop()}`);

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    }
}

inputDeviceSelect.addEventListener(
    'change',
    () => {

        resumeAudio();

        if (sourceSelect.value === '__live__') {
            switchSource();
        }
    }
);

sourceSelect.addEventListener(
    'change',
    () => {

        resumeAudio();
        switchSource();
    }
);

/* ── 4. Gain slider handlers ───────────────────────────── */
inputGainSlider.addEventListener(
    'input',
    () => {

        resumeAudio();

        const g =
            parseFloat(inputGainSlider.value);

        if (inputGainNode) {
            inputGainNode.gain.value = g;
        }

        inputGainValue.textContent =
            `${gainToDb(g)} dB`;
    }
);

outputGainSlider.addEventListener(
    'input',
    () => {

        resumeAudio();

        const g =
            parseFloat(outputGainSlider.value);

        if (outputGainNode) {

            outputGainNode.gain.value = g;

            console.log(
                `[Host] Output gain changed to: ${g}`
            );
        }

        outputGainValue.textContent =
            `${gainToDb(g)} dB`;
    }
);

/* ── 5. Output device switching ────────────────────────── */
outputDeviceSelect.addEventListener(
    'change',
    async () => {

        const deviceId =
            outputDeviceSelect.value;

        console.log(
            `[Host] Output switch request: ${deviceId}`
        );

        try {

            // Chrome / Edge
            if (
                audioContext &&
                typeof audioContext.setSinkId === 'function'
            ) {

                await audioContext.setSinkId(
                    deviceId || ""
                );

                setStatus(
                    `Output → ${outputDeviceSelect
                        .selectedOptions[0]?.text
                    || 'Default'
                    }`
                );

                return;
            }

            // Firefox fallback
            if (
                player &&
                typeof player.setSinkId === 'function'
            ) {

                await player.setSinkId(
                    deviceId || ""
                );

                setStatus(
                    'Firefox: output changed for file playback only'
                );

                return;
            }

            setStatus(
                'Firefox does not support WebAudio output switching'
            );

        } catch (err) {

            console.error(
                '[Host] Output switch error:',
                err
            );

            setStatus(
                `Output error: ${err.message}`
            );
        }
    }
);

/* ── 6. Main init ──────────────────────────────────────── */
(async () => {

    setStatus('Loading audio file list…');

    await loadAudioFileList();

    setStatus('Listing devices…');
    await requestMicPermissionThenEnumerate(); // Permission mic d'abord (Firefox)

    setStatus('Initialising WAM host…');

    audioContext = new AudioContext();

    srDisplay.textContent =
        `${audioContext.sampleRate} Hz`;

    // Input chain
    inputGainNode =
        audioContext.createGain();

    inputAnalyser =
        audioContext.createAnalyser();

    inputAnalyser.fftSize = 2048;

    inputDataArray =
        new Uint8Array(inputAnalyser.fftSize);

    inputGainNode.connect(inputAnalyser);

    // Output chain
    outputGainNode =
        audioContext.createGain();
    window.outputGainNode = outputGainNode;

    // Stereo panner for plugin chain (before mix)
    pluginPannerNode = audioContext.createStereoPanner();
    pluginPannerNode.pan.value = 0; // Center by default
    window.pluginPannerNode = pluginPannerNode;

    outputAnalyser =
        audioContext.createAnalyser();

    outputAnalyser.fftSize = 2048;

    outputDataArray =
        new Uint8Array(outputAnalyser.fftSize);

    outputGainNode.connect(outputAnalyser);
    outputAnalyser.connect(audioContext.destination);

    // Init WamEnv
    const { initializeWamHost } =
        await import('../sdk/index.js');

    const [hostGroupId] =
        await initializeWamHost(audioContext);

    // plugins...
    // Load all plugins dynamically
    const [
        { default: TunerMachine },
        { default: Deathgate },
        { default: AutoWah },
        { default: TS9Overdrive },
        { default: StonePhaserStereo },
        { default: WAMChorus },
        { default: WAM },
        { default: PingPongDelay },
        { default: GreyHole }
    ] = await Promise.all([
        import('./plugins/tuner_machine/src/index.js'),
        import('./plugins/deathgate/index.js'),
        import('./plugins/AutoWahMB/index.js'),
        import('./plugins/TS9_OverdriveFaustGenerated/index.js'),
        import('./plugins/StonePhaserStereo/index.js'),
        import('./plugins/WAMChorusMB/index.js'),
        import('../index.js'),
        //import('https://mainline.i3s.unice.fr/wam2/packages/faustPingPongDelay/plugin/index.js'),
        import('./plugins/faustPingPongDelay/plugin/index.js'),
        import('./plugins/greyhole/index.js')
    ]);

    // Instantiate all plugins (assigned to module-level vars)
    [
        tunerInst,
        deathgateInst,
        autoWahInst,
        ts9Inst,
        stonePhaserStereoInst,
        chorusInst,
        ampInst,
        pingpongInst,
        greyholeInst,
    ] = await Promise.all([
        TunerMachine.createInstance(hostGroupId, audioContext),
        Deathgate.createInstance(hostGroupId, audioContext),
        AutoWah.createInstance(hostGroupId, audioContext),
        TS9Overdrive.createInstance(hostGroupId, audioContext),
        StonePhaserStereo.createInstance(hostGroupId, audioContext),
        WAMChorus.createInstance(hostGroupId, audioContext),
        WAM.createInstance(hostGroupId, audioContext),
        PingPongDelay.createInstance(hostGroupId, audioContext),
        GreyHole.createInstance(hostGroupId, audioContext)
    ]);

    // Connect audio graph - FULL CHAIN
    inputAnalyser.connect(tunerInst.audioNode);
    tunerInst.audioNode.connect(deathgateInst.audioNode);
    deathgateInst.audioNode.connect(autoWahInst.audioNode);
    autoWahInst.audioNode.connect(ts9Inst.audioNode);
    ts9Inst.audioNode.connect(stonePhaserStereoInst.audioNode);
    stonePhaserStereoInst.audioNode.connect(chorusInst.audioNode);
    chorusInst.audioNode.connect(ampInst.audioNode);
    ampInst.audioNode.connect(pingpongInst.audioNode);
    pingpongInst.audioNode.connect(greyholeInst.audioNode);

    // Final output: plugins → panner → gain → destination
    greyholeInst.audioNode.connect(pluginPannerNode);
    pluginPannerNode.connect(outputGainNode);

    firstPluginInstance = tunerInst;
    wamInstance = ampInst;

    // ... (rest of registry)
    _pluginRegistry.set('tuner', tunerInst);
    _pluginRegistry.set('deathgate', deathgateInst);
    _pluginRegistry.set('autoWah', autoWahInst);
    _pluginRegistry.set('ts9', ts9Inst);
    _pluginRegistry.set('stonePhaser', stonePhaserStereoInst);
    _pluginRegistry.set('chorus', chorusInst);
    _pluginRegistry.set('amp', ampInst);
    _pluginRegistry.set('pingpong', pingpongInst);
    _pluginRegistry.set('greyhole', greyholeInst);

    // Create and mount GUIs
    const guis = await Promise.all([
        tunerInst.createGui(),
        deathgateInst.createGui(),
        autoWahInst.createGui(),
        ts9Inst.createGui(),
        stonePhaserStereoInst.createGui(),
        chorusInst.createGui(),
        ampInst.createGui(),
        pingpongInst.createGui(),
        greyholeInst.createGui()
    ]);

    mount.innerHTML = '';

    const mainCol = document.createElement('div');
    mainCol.className = 'main-column';

    const ampRow = document.createElement('div');
    ampRow.className = 'amp-row';

    const tunerWrap = document.createElement('div');
    tunerWrap.className = 'pedal-wrapper';
    tunerWrap.appendChild(guis[0]);
    ampRow.appendChild(tunerWrap);
    ampRow.appendChild(guis[6]);
    mainCol.appendChild(ampRow);

    const effectsRow = document.createElement('div');
    effectsRow.className = 'effects-row';
    const pedalIndices = [1, 2, 3, 4, 5, 7, 8];
    pedalIndices.forEach(i => {
        const wrap = document.createElement('div');
        wrap.className = 'pedal-wrapper';
        wrap.appendChild(guis[i]);
        effectsRow.appendChild(wrap);
    });
    mainCol.appendChild(effectsRow);
    mount.appendChild(mainCol);

    // Harmonisation des hauteurs
    function scalePlugin(gui, targetHeight) {
        setTimeout(() => {
            const h = gui.getBoundingClientRect().height || gui.offsetHeight || 300;
            if (h > 0) {
                gui.style.zoom = targetHeight / h;
                const parent = gui.parentElement;
                if (parent && parent.classList.contains('pedal-wrapper')) {
                    parent.style.flex = '0 0 auto';
                    parent.style.width = 'auto';
                    parent.style.height = 'auto';
                }
            }
        }, 100);
    }

    // Initialise Backing Track Player
    if (window.BackingTrackPlayer) {
        window.btPlayer = new window.BackingTrackPlayer(audioContext, audioContext.destination);
    }

    requestAnimationFrame(() => {
        const ampHeight = guis[6].getBoundingClientRect().height || 450;
        scalePlugin(guis[0], ampHeight);
        pedalIndices.forEach(i => scalePlugin(guis[i], 180));
    });

    setTimeout(async () => {
        console.log('[Host] Initializing plugin states...');
        await setPluginBypass(tunerInst, true);
        await setPluginBypass(deathgateInst, false);
        await setPluginBypass(autoWahInst, true);
        await setPluginBypass(ts9Inst, true);
        await setPluginBypass(stonePhaserStereoInst, true);
        await setPluginBypass(chorusInst, true);
        await setPluginBypass(pingpongInst, true);
        await setPluginBypass(greyholeInst, true);
    }, 1000);

    vuLoop();
    enablePresetUI();
    setStatus('Ready — choose an audio source');
    document.addEventListener('click', () => { resumeAudio(); }, { once: false });
    document.addEventListener('keydown', () => { resumeAudio(); }, { once: false });
    player.onplay = () => { audioContext.resume(); };

    await enumerateDevices();
    if (sourceSelect.options.length > 1) {
        sourceSelect.selectedIndex = 1;
        await switchSource();
    }
})();

// MIDI Controller access
export function getAmpInstance() { return ampInst; }


// ── Robust bypass helper using WAM-standard methods with retry logic ──
export async function setPluginBypass(inst, bypassed) {
    if (!inst || !inst.audioNode) return;

    let info = null;
    for (let i = 0; i < 5; i++) {
        try {
            info = await inst.audioNode.getParameterInfo();
            if (info && Object.keys(info).length > 0) break;
        } catch (e) { }
        await new Promise(r => setTimeout(r, 200));
    }

    if (!info) {
        console.warn(`[Host] Could not get parameters for ${inst.descriptor?.name}. Skipping bypass.`);
        return;
    }

    const pIds = Object.keys(info);
    const bypassParam = pIds.find(p =>
        p.toLowerCase().endsWith('/bypass') ||
        p.toLowerCase() === 'enabled' ||
        p.toLowerCase() === 'bypass' ||
        p.toLowerCase() === 'active'
    );

    if (bypassParam) {
        const isEnabledStyle = bypassParam.toLowerCase().includes('enabled') || bypassParam.toLowerCase() === 'active';
        const val = isEnabledStyle ? (bypassed ? 0 : 1) : (bypassed ? 1 : 0);

        try {
            await inst.audioNode.setParameterValues({
                [bypassParam]: { id: bypassParam, value: val, normalized: false }
            });
            console.log(`[Host] ${inst.descriptor?.name || 'Plugin'}: set ${bypassParam} to ${val} (${bypassed ? 'Bypassed' : 'Active'})`);
        } catch (e) {
            console.error(`[Host] Error setting ${bypassParam}`, e);
        }
    }
}
