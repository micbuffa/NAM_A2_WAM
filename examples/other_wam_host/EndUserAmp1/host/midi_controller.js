/**
 * midi_controller.js
 * MIDI Learning and Mapping for WAM Host
 */

import { getAmpInstance, loadPreset, FACTORY_PRESETS, _allPresetNames, _pluginRegistry, setPluginBypass } from './index.js';
import { FACTORY_MIDI_MAPPINGS } from './midi_controllers_factory_mappings.js';

const MIDI_STORAGE_KEY = 'wam-host-midi-mappings';

let midiAccess = null;
let currentInput = null;
let allMappings = {}; // { deviceId: { name, mappings: { targetId: { type, number, channel } } } }
let learningTargetId = null; // ID of the control currently being "learned"

// DOM Refs
const btnMidiConfig = document.getElementById('btn-midi-config');
const midiPanel = document.getElementById('midi-panel');
const btnCloseMidi = document.getElementById('btn-close-midi');
const midiDeviceSelect = document.getElementById('midi-device-select');
const ampControlsContainer = document.getElementById('midi-amp-controls');
const pluginControlsContainer = document.getElementById('midi-plugin-controls');
const presetControlsContainer = document.getElementById('midi-preset-controls');

const sidebarMidiPanel = document.getElementById('sidebar-midi-panel');
const sidebarMidiSelect = document.getElementById('sidebar-midi-device-select');

// ── 1. Init ───────────────────────────────────────────────────

export async function requestMIDIAccess() {
    if (midiAccess) return true; // Already granted

    if (!navigator.requestMIDIAccess) {
        console.warn('[MIDI] Web MIDI API not supported');
        return false;
    }

    try {
        midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        midiAccess.onstatechange = updateMIDIDevices;
        updateMIDIDevices();
        return true;
    } catch (err) {
        console.error('[MIDI] Access denied:', err);
        return false;
    }
}

function updateMIDIDevices() {
    if (!midiAccess) return;
    const inputs = Array.from(midiAccess.inputs.values());
    
    // Clear both selectors
    midiDeviceSelect.innerHTML = '<option value="">— select MIDI device —</option>';
    sidebarMidiSelect.innerHTML = '<option value="">— select device —</option>';
    
    let devicesFound = 0;

    inputs.forEach(input => {
        const hasMap = hasMappingForDevice(input);
        const label = hasMap ? `✅ ${input.name}` : input.name;
        
        const opt1 = new Option(label, input.id);
        const opt2 = new Option(label, input.id);
        
        midiDeviceSelect.add(opt1);
        sidebarMidiSelect.add(opt2);
        devicesFound++;
    });

    // Show sidebar panel if we have inputs
    if (devicesFound > 0) {
        sidebarMidiPanel.classList.remove('hidden');
    } else {
        sidebarMidiPanel.classList.add('hidden');
    }

    // Auto-select if only one device has a mapping
    const mappedInputs = inputs.filter(i => hasMappingForDevice(i));
    if (mappedInputs.length === 1 && !currentInput) {
        const id = mappedInputs[0].id;
        midiDeviceSelect.value = id;
        sidebarMidiSelect.value = id;
        selectMIDIDevice(id);
    }
}

function hasMappingForDevice(input) {
    // User mapping?
    if (allMappings[input.id]) return true;
    
    // Factory mapping?
    for (const key in FACTORY_MIDI_MAPPINGS) {
        if (input.name.toLowerCase().includes(key.toLowerCase()) || input.id === key) return true;
    }
    return false;
}

function selectMIDIDevice(id) {
    if (currentInput) {
        currentInput.onmidimessage = null;
    }
    
    currentInput = midiAccess.inputs.get(id);
    if (currentInput) {
        currentInput.onmidimessage = onMIDIMessage;
        console.log(`[MIDI] Listening to: ${currentInput.name}`);
        
        // Sync the selectors
        midiDeviceSelect.value = id;
        sidebarMidiSelect.value = id;
        
        refreshUI(); // Update UI with this device's mappings
    }
}

// ── 2. Mappings ────────────────────────────────────────────────

function loadMappings() {
    const saved = localStorage.getItem(MIDI_STORAGE_KEY);
    if (saved) {
        try {
            allMappings = JSON.parse(saved);
        } catch (e) {
            allMappings = {};
        }
    }
}

function saveMappings() {
    localStorage.setItem(MIDI_STORAGE_KEY, JSON.stringify(allMappings));
}

function getActiveDeviceMappings() {
    if (!currentInput) return {};
    const id = currentInput.id;
    const name = currentInput.name;
    
    // 1. Get user mappings for this specific device ID
    const entry = allMappings[id] || {};
    const userMap = entry.mappings || entry || {};
    
    // 2. Find factory mappings
    let factoryMap = {};
    for (const [key, map] of Object.entries(FACTORY_MIDI_MAPPINGS)) {
        if (name.toLowerCase().includes(key.toLowerCase()) || id === key) {
            factoryMap = map;
            break;
        }
    }
    
    // 3. Merge: user mappings override factory
    const merged = { ...factoryMap };
    for (const [targetId, map] of Object.entries(userMap)) {
        if (map === null) {
            delete merged[targetId];
        } else {
            merged[targetId] = map;
        }
    }

    // Final pass: remove any nulls that might have come from factoryMap itself
    for (const targetId in merged) {
        if (merged[targetId] === null) delete merged[targetId];
    }

    return merged;
}

// ── 3. MIDI Handling ───────────────────────────────────────────

async function onMIDIMessage(event) {
    const [status, data1, data2] = event.data;
    const type = status & 0xf0; // message type
    const channel = (status & 0x0f) + 1; // 1-16
    
    // Debug log for Firefox troubleshooting
    console.log(`[MIDI] In: 0x${status.toString(16)} ${data1} ${data2} (Ch:${channel})`);

    // We care about Note On (0x90), Note Off (0x80) and CC (0xB0)
    if (type !== 0x90 && type !== 0x80 && type !== 0xB0) return;

    const isNote = (type === 0x90 || type === 0x80);
    const msgType = isNote ? 'note' : 'cc';
    const number = data1; // note number or CC number
    const value = data2; // velocity or CC value

    // ── Learning Mode ──
    if (learningTargetId && currentInput) {
        const deviceId = currentInput.id;
        const deviceName = currentInput.name;
        
        if (!allMappings[deviceId]) {
            allMappings[deviceId] = { name: deviceName, mappings: {} };
        } else if (!allMappings[deviceId].mappings) {
            allMappings[deviceId] = { name: deviceName, mappings: allMappings[deviceId] };
        }
        
        allMappings[deviceId].mappings[learningTargetId] = { type: msgType, number, channel };
        saveMappings();
        
        learningTargetId = null;
        refreshUI();
        return;
    }

    // ── Normal Mode (Triggering) ──
    const activeMappings = getActiveDeviceMappings();
    let matchCount = 0;
    for (const [targetId, map] of Object.entries(activeMappings)) {
        if (map && map.type === msgType && map.number === number) {
            console.log(`[MIDI] Match found for ${targetId}! Triggering...`);
            handleMappingTrigger(targetId, value, msgType, type);
            matchCount++;
        }
    }
    if (matchCount === 0) {
        // console.log(`[MIDI] No match for ${msgType} ${number} among ${Object.keys(activeMappings).length} active mappings`);
    }
}

async function handleMappingTrigger(targetId, value, msgType, statusType) {
    // Amp Parameters
    if (targetId.startsWith('amp:')) {
        const paramId = targetId.replace('amp:', '');
        const amp = getAmpInstance();
        if (!amp) return;
        
        try {
            const info = await amp.audioNode.getParameterInfo();
            const p = info[paramId];
            if (!p) return;
            const normalized = value / 127;
            const scaled = p.minValue + (p.maxValue - p.minValue) * normalized;
            await amp.audioNode.setParameterValues({
                [paramId]: { id: paramId, value: scaled, normalized: false }
            });
        } catch (e) {
            console.error('[MIDI] SetParam failed:', e);
        }
    }
    
    // Plugin Bypass
    else if (targetId.startsWith('plugin:')) {
        const parts = targetId.split(':');
        const pluginKey = parts[1];
        const paramPath = parts.slice(2).join(':');
        const plugin = _pluginRegistry.get(pluginKey);
        
        if (plugin) {
            if (msgType === 'note') {
                // Toggle only on Note On (0x90) with velocity > 0
                if (statusType === 0x90 && value > 0) {
                    try {
                        const vals = await plugin.audioNode.getParameterValues();
                        const current = vals[paramPath]?.value;
                        console.log(`[MIDI] Toggle ${pluginKey} current bypass val:`, current);
                        // If it's 1 or undefined (maybe path mismatch?), we try to toggle
                        // Faust usually uses 1 for bypass.
                        const isCurrentlyBypassed = current > 0; 
                        await setPluginBypass(plugin, !isCurrentlyBypassed);
                    } catch (e) {
                        console.error('[MIDI] Toggle bypass failed:', e);
                    }
                }
            } else {
                // CC: 127 = Bypassed, 0 = Active
                const shouldBypass = value > 64;
                await setPluginBypass(plugin, shouldBypass);
            }
        }
    }
    
    // Preset Selection
    else if (targetId.startsWith('preset:') && value > 0) {
        const presetKey = targetId.replace('preset:', '');
        const isFactory = presetKey.startsWith('f:');
        const name = presetKey.slice(2);
        console.log(`[MIDI] Triggering preset load: ${name} (factory: ${isFactory})`);
        loadPreset(name, isFactory);
    }
}

// ── 4. UI Rendering ───────────────────────────────────────────

function refreshUI() {
    populateAmpControls();
    populatePluginControls();
    populatePresetControls();
    updateMIDIDevices();
}

async function populateAmpControls() {
    const amp = getAmpInstance();
    if (!amp) {
        ampControlsContainer.innerHTML = '<p class="text-dim">Waiting for amplifier to load...</p>';
        return;
    }

    const ALLOWED_PARAMS = [
        { id: '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Input_Volume', label: 'INPUT' },
        { id: '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Interstage_gain', label: 'GAIN' },
        { id: '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass', label: 'BASS' },
        { id: '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle', label: 'MIDDLE' },
        { id: '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble', label: 'TREBLE' },
        { id: '/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix', label: 'REVERB' },
        { id: '/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume', label: 'MASTER' },
        { id: '/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence', label: 'PRESENCE' }
    ];

    ampControlsContainer.innerHTML = '';
    ALLOWED_PARAMS.forEach(p => {
        createMIDIRow(ampControlsContainer, `amp:${p.id}`, p.label);
    });
}

async function populatePluginControls() {
    const plugins = [
        { key: 'autoWah', label: 'Auto Wah', path: '/AUtoWahMB/bypass' },
        { key: 'ts9', label: 'TS9 Overdrive', path: '/TS9_OverdriveFaustGenerated/bypass' },
        { key: 'stonePhaser', label: 'Stone Phaser', path: '/StonePhaserStereo/Bypass' },
        { key: 'chorus', label: 'Chorus', path: '/Chorus/bypass' },
        { key: 'pingpong', label: 'Delay', path: '/PingPongDelayFaust/bypass' },
        { key: 'greyhole', label: 'Greyhole', path: '/greyhole/bypass' }
    ];

    pluginControlsContainer.innerHTML = '';
    plugins.forEach(p => {
        if (_pluginRegistry.has(p.key)) {
            createMIDIRow(pluginControlsContainer, `plugin:${p.key}:${p.path}`, p.label);
        }
    });
}

function populatePresetControls() {
    presetControlsContainer.innerHTML = '';
    FACTORY_PRESETS.forEach(p => createMIDIRow(presetControlsContainer, `preset:f:${p.name}`, `🏭 ${p.name}`));
    const userNames = _allPresetNames();
    userNames.forEach(n => createMIDIRow(presetControlsContainer, `preset:u:${n}`, `👤 ${n}`));
}

function createMIDIRow(container, targetId, label) {
    const row = document.createElement('div');
    row.className = 'midi-row';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'midi-label';
    labelSpan.textContent = label;
    
    const mappingDiv = document.createElement('div');
    mappingDiv.className = 'midi-mapping';
    
    const activeMappings = getActiveDeviceMappings();
    const map = activeMappings[targetId];
    const valueSpan = document.createElement('span');
    valueSpan.className = 'mapping-value';
    
    const deviceId = currentInput?.id;
    const entry = deviceId ? allMappings[deviceId] : null;
    const isUserMapping = entry && entry.mappings && entry.mappings[targetId];
    
    valueSpan.textContent = map ? `${map.type.toUpperCase()} ${map.number}` : '—';
    if (map && !isUserMapping) valueSpan.style.color = '#94a3b8';

    const btn = document.createElement('button');
    btn.className = 'btn-learn';
    btn.textContent = learningTargetId === targetId ? 'LISTENING...' : 'Learn';
    if (learningTargetId === targetId) btn.classList.add('active');
    btn.onclick = () => {
        learningTargetId = (learningTargetId === targetId) ? null : targetId;
        refreshUI();
    };

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-clear';
    clearBtn.innerHTML = '&times;';
    clearBtn.title = 'Clear mapping';
    clearBtn.onclick = () => {
        if (currentInput) {
            const devId = currentInput.id;
            if (!allMappings[devId]) allMappings[devId] = { name: currentInput.name, mappings: {} };
            allMappings[devId].mappings[targetId] = null;
            saveMappings();
            refreshUI();
        }
    };

    mappingDiv.appendChild(valueSpan);
    mappingDiv.appendChild(btn);
    mappingDiv.appendChild(clearBtn);
    row.appendChild(labelSpan);
    row.appendChild(mappingDiv);
    container.appendChild(row);
}

// ── 5. Events ─────────────────────────────────────────────────

btnMidiConfig.onclick = async () => {
    midiPanel.classList.add('open');
    document.body.classList.add('midi-open');
    const granted = await requestMIDIAccess();
    if (!granted) {
        midiDeviceSelect.innerHTML = '<option value="">⚠️ MIDI Access Denied</option>';
        ampControlsContainer.innerHTML = '<p class="text-dim">Please allow MIDI access.</p>';
    }
    refreshUI();
};

btnCloseMidi.onclick = () => {
    midiPanel.classList.remove('open');
    document.body.classList.remove('midi-open');
    learningTargetId = null;
};

sidebarMidiSelect.onchange = () => {
    selectMIDIDevice(sidebarMidiSelect.value);
};

loadMappings();
requestMIDIAccess().then(granted => {
    if (granted) console.log('[MIDI] Auto-detected devices on load');
});
