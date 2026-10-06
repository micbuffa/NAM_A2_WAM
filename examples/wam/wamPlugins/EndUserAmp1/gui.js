import './utils/webaudio-controls.js';

/**
 * @typedef {import('./sdk-parammgr').ParamMgrNode} ParamMgrNode
 * @typedef {import('./sdk').WebAudioModule} WebAudioModule
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 */

const template = document.createElement('template');
template.innerHTML = `
<style>
	:host {
		display: block;
		container-type: inline-size;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}
	.amp-container {
		background: #111; /* dark tolex */
		border: 8px solid #222;
		border-radius: 10px;
		padding: 20px;
		color: #e0e0e0;
		width: 850px;
		max-width: 100%;
		box-shadow: 0 10px 20px rgba(0,0,0,0.5);
		box-sizing: border-box;
	}
	.amp-panel {
		background: linear-gradient(to bottom, #d4af37, #997a00); /* gold panel */
		border: 2px solid #555;
		border-radius: 5px;
		padding: 15px;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}
	.amp-title {
		font-size: 24px;
		font-weight: bold;
		text-align: center;
		color: #111;
		text-transform: uppercase;
		letter-spacing: 2px;
		margin-bottom: 5px;
		text-shadow: 1px 1px 0px rgba(255,255,255,0.3);
	}
	.knobs-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 20px;
	}
	.knobs-row {
		display: flex;
		justify-content: space-around;
		align-items: center;
		flex: 1;
		background: rgba(0,0,0,0.1);
		padding: 15px;
		border-radius: 5px;
		border-top: 1px solid rgba(255,255,255,0.2);
		border-bottom: 1px solid rgba(0,0,0,0.2);
		margin: 0 20px;
	}
	.knob-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: #111;
		font-weight: bold;
		font-size: 11px;
		text-shadow: 1px 1px 0px rgba(255,255,255,0.2);
	}
	.meter {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: #111;
		font-size: 10px;
		font-weight: bold;
		text-shadow: 1px 1px 0px rgba(255,255,255,0.2);
	}
	.meter-bar {
		width: 16px;
		height: 80px;
		background: #222;
		border: 2px solid #111;
		border-radius: 3px;
		position: relative;
		overflow: hidden;
		margin-bottom: 5px;
		box-shadow: inset 0 2px 5px rgba(0,0,0,0.8);
	}
	.meter-fill {
		position: absolute;
		bottom: 0;
		width: 100%;
		height: 0%;
		background: linear-gradient(to top, #0f0, #ff0, #f00);
		transition: height 0.05s linear;
	}
	.dropdowns-row {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 15px;
		padding: 15px 20px;
		background: rgba(0,0,0,0.2);
		border-radius: 5px;
		border: 1px inset rgba(255,255,255,0.1);
	}
	.dropdown-group {
		display: flex;
		flex-direction: column;
		font-size: 11px;
		color: #fff;
		font-weight: bold;
		text-transform: uppercase;
		gap: 5px;
	}
	select {
		background: #222;
		color: #e0e0e0;
		border: 1px solid #555;
		padding: 5px;
		border-radius: 3px;
		font-family: inherit;
		font-size: 11px;
		outline: none;
	}
	.gui-toggle {
		position: absolute;
		top: 15px;
		right: 20px;
		display: flex;
		background: rgba(0,0,0,0.3);
		padding: 3px;
		border-radius: 20px;
		border: 1px solid rgba(255,255,255,0.1);
		cursor: pointer;
		user-select: none;
	}
	.gui-toggle-item {
		padding: 4px 12px;
		border-radius: 15px;
		font-size: 9px;
		font-weight: bold;
		color: #555;
		transition: all 0.2s;
	}
	.gui-toggle-item.active {
		background: #111;
		color: #d4af37;
		box-shadow: 0 2px 4px rgba(0,0,0,0.5);
	}
	.sliders-row {
		display: none; /* hidden by default */
		justify-content: space-around;
		align-items: flex-end;
		flex: 1;
		background: rgba(0,0,0,0.15);
		padding: 20px 15px;
		border-radius: 5px;
		border-top: 1px solid rgba(255,255,255,0.1);
		border-bottom: 1px solid rgba(0,0,0,0.3);
		margin: 0 20px;
		min-height: 120px;
	}
	.slider-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: #111;
		font-weight: bold;
		font-size: 10px;
		gap: 8px;
		text-shadow: 1px 1px 0px rgba(255,255,255,0.2);
	}
	:host([gui-mode="sliders"]) .knobs-row {
		display: none;
	}
	:host([gui-mode="sliders"]) .sliders-row {
		display: flex;
	}
@container (max-width: 740px) {
  .amp-container { padding:12px; }
  .amp-panel { padding:10px; }
  .knobs-container { padding:0; }
  .knobs-row,.sliders-row { flex-wrap:wrap;gap:12px;min-width:0;margin:0 8px;padding:10px; }
  .knob-group,.slider-group { flex:0 0 55px; }
  .gui-toggle { position:static;width:max-content;margin:8px auto; }
  .dropdowns-row { padding:10px;gap:12px; }
}
.amp-title{font-size:22px}.amp-subtitle{text-align:center;font-size:10px;letter-spacing:.06em;margin:-6px 0 6px;opacity:.8}
.factory-preset{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:10px 0 14px;font:12px sans-serif;color:inherit}.factory-preset select{max-width:100%;padding:5px 8px;background:#191d20;color:#fff;border:1px solid currentColor;border-radius:4px}.factory-preset-status{font-size:11px;min-width:55px}
</style>
<div class="amp-container">
	<div class="amp-panel" style="position: relative;">
		<div id="gui-toggle" class="gui-toggle">
			<div class="gui-toggle-item active" data-mode="knobs">KNOBS</div>
			<div class="gui-toggle-item" data-mode="sliders">SLIDERS</div>
		</div>
		<div class="amp-title">WAM•FAUST TubeLab</div><div class="amp-subtitle">Preamp · Tone stack · Power amp · Cabinet · Reverb</div>
        <div class="factory-preset"><label for="factory-preset">Factory preset</label><select id="factory-preset"><option value="" disabled>Current settings</option></select><span class="factory-preset-status" role="status"></span></div>
		
		<div class="knobs-container">
			<div class="meter">
				<div class="meter-bar"><div class="meter-fill" id="meter-in"></div></div>
				<div>INPUT</div>
			</div>
			
			<div class="knobs-row">
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-input" diameter="60" min="0" max="10" step="0.1" value="3.68" tooltip="Input: %d"></ifc-webaudio-knob>
					<div>INPUT</div>
				</div>
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-gain" diameter="60" min="0" max="10" step="0.1" value="3.68" tooltip="Gain: %d"></ifc-webaudio-knob>
					<div>GAIN</div>
				</div>
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-bass" diameter="60" min="0" max="10" step="0.1" value="5" tooltip="Bass: %.1f"></ifc-webaudio-knob>
					<div>BASS</div>
				</div>
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-middle" diameter="60" min="0" max="10" step="0.1" value="3" tooltip="Middle: %.1f"></ifc-webaudio-knob>
					<div>MIDDLE</div>
				</div>
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-treble" diameter="60" min="0" max="10" step="0.1" value="7.5" tooltip="Treble: %.1f"></ifc-webaudio-knob>
					<div>TREBLE</div>
				</div>
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-reverb" diameter="60" min="0" max="10" step="0.1" value="5.97" tooltip="Reverb: %.1f"></ifc-webaudio-knob>
					<div>REVERB</div>
				</div>
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-master" diameter="60" min="0" max="10" step="0.1" value="2.3" tooltip="Master: %.1f"></ifc-webaudio-knob>
					<div>MASTER</div>
				</div>
				<div class="knob-group">
					<ifc-webaudio-knob id="knob-presence" diameter="60" min="0" max="10" step="0.1" value="6" tooltip="Presence: %.1f"></ifc-webaudio-knob>
					<div>PRESENCE</div>
				</div>
			</div>

			<div class="sliders-row">
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-input" width="24" height="100" min="0" max="10" step="0.1" value="3.68" tooltip="Input: %.1f"></ifc-webaudio-slider>
					<div>INPUT</div>
				</div>
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-gain" width="24" height="100" min="0" max="10" step="0.1" value="3.68" tooltip="Gain: %.1f"></ifc-webaudio-slider>
					<div>GAIN</div>
				</div>
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-bass" width="24" height="100" min="0" max="10" step="0.1" value="5" tooltip="Bass: %.1f"></ifc-webaudio-slider>
					<div>BASS</div>
				</div>
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-middle" width="24" height="100" min="0" max="10" step="0.1" value="3" tooltip="Middle: %.1f"></ifc-webaudio-slider>
					<div>MIDDLE</div>
				</div>
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-treble" width="24" height="100" min="0" max="10" step="0.1" value="7.5" tooltip="Treble: %.1f"></ifc-webaudio-slider>
					<div>TREBLE</div>
				</div>
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-reverb" width="24" height="100" min="0" max="10" step="0.1" value="5.97" tooltip="Reverb: %.1f"></ifc-webaudio-slider>
					<div>REVERB</div>
				</div>
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-master" width="24" height="100" min="0" max="10" step="0.1" value="2.3" tooltip="Master: %.1f"></ifc-webaudio-slider>
					<div>MASTER</div>
				</div>
				<div class="slider-group">
					<ifc-webaudio-slider id="slider-presence" width="24" height="100" min="0" max="10" step="0.1" value="6" tooltip="Presence: %.1f"></ifc-webaudio-slider>
					<div>PRESENCE</div>
				</div>
			</div>
			
			<div class="meter">
				<div class="meter-bar"><div class="meter-fill" id="meter-out"></div></div>
				<div>OUTPUT</div>
			</div>
		</div>

		<div class="dropdowns-row">
			<div class="dropdown-group">
				<label>Stages</label>
				<select id="sel-stages">
					<option value="0">1</option>
					<option value="1">2</option>
					<option value="2" selected>3</option>
					<option value="3">4</option>
					<option value="4">5</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 1</label>
				<select id="sel-tube1">
					<option value="0" selected>12AX7</option><option value="1">12AU7</option>
					<option value="2">6V6</option><option value="3">6L6</option>
					<option value="4">EL34</option><option value="5">EL84</option><option value="6">KT88</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 2</label>
				<select id="sel-tube2">
					<option value="0" selected>12AX7</option><option value="1">12AU7</option>
					<option value="2">6V6</option><option value="3">6L6</option>
					<option value="4">EL34</option><option value="5">EL84</option><option value="6">KT88</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 3</label>
				<select id="sel-tube3">
					<option value="0" selected>12AX7</option><option value="1">12AU7</option>
					<option value="2">6V6</option><option value="3">6L6</option>
					<option value="4">EL34</option><option value="5">EL84</option><option value="6">KT88</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 4</label>
				<select id="sel-tube4">
					<option value="0" selected>12AX7</option><option value="1">12AU7</option>
					<option value="2">6V6</option><option value="3">6L6</option>
					<option value="4">EL34</option><option value="5">EL84</option><option value="6">KT88</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 5</label>
				<select id="sel-tube5">
					<option value="0" selected>12AX7</option><option value="1">12AU7</option>
					<option value="2">6V6</option><option value="3">6L6</option>
					<option value="4">EL34</option><option value="5">EL84</option><option value="6">KT88</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tonestack</label>
				<select id="sel-tonestack">
					<option value="0">Mesa Boogie</option>
					<option value="1">JCM800</option>
					<option value="2">AC30</option>
					<option value="3" selected>Fender Hot Rod</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>HP Model</label>
				<select id="sel-hp">
					<option value="0" selected>fenderDeluxeJensen1x12</option>
					<option value="1">Mesa-OS-Rectifier-3</option>
					<option value="2">EV MIX D</option>
				</select>
			</div>
		</div>
	</div>
</div>
`;

class EndUserAmpGui extends HTMLElement {
	/**
	 * @param {ParamMgrNode} wamNode
	 * @param {FaustAudioWorkletNode} faustNode
	 */
	constructor(wamNode, faustNode) {
		super();
		this.wamNode = wamNode;
		this.faustNode = faustNode;
		this.root = this.attachShadow({ mode: 'open' });
		this.root.appendChild(template.content.cloneNode(true));
        this.presetSelect = this.root.querySelector('#factory-preset');
        this.presetStatus = this.root.querySelector('.factory-preset-status');
        for (const preset of wamNode.getFactoryPresets()) this.presetSelect.add(new Option(preset.name, preset.id));
        this.presetSelect.addEventListener('change', async () => {
            this.presetSelect.disabled = true;
            this._presetLoading = true;
            try {
                await wamNode.loadFactoryPreset(this.presetSelect.value);
                this._lastUserChange = {};
                this.syncFactoryPreset();
            } catch (error) {
                this.presetStatus.textContent = 'Load failed';
                this.dispatchEvent(new CustomEvent('editor-error', {detail: error}));
            } finally { this._presetLoading = false; this.presetSelect.disabled = false; }
        });
        this.syncFactoryPreset();
		
		// Map param addresses
		this.paramMap = {
			'#knob-input': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Input_Volume',
			'#slider-input': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Input_Volume',
			'#knob-gain': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Interstage_gain',
			'#slider-gain': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Interstage_gain',
			'#knob-bass': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass',
			'#slider-bass': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass',
			'#knob-middle': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle',
			'#slider-middle': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle',
			'#knob-treble': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble',
			'#slider-treble': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble',
			'#knob-reverb': '/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix',
			'#slider-reverb': '/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix',
			'#knob-master': '/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume',
			'#slider-master': '/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume',
			'#knob-presence': '/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence',
			'#slider-presence': '/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence',
			'#sel-stages': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Nb_Stages',
			'#sel-tube1': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Stage_1_Tube',
			'#sel-tube2': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Stage_2_Tube',
			'#sel-tube3': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Stage_3_Tube',
			'#sel-tube4': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Stage_4_Tube',
			'#sel-tube5': '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix/Stage_5_Tube',
			'#sel-tonestack': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/tonestack_type/Model',
			'#sel-hp': '/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Cabinet_Select'
		};

		// Track last user change to avoid feedback loops
		this._lastUserChange = {};

		this.setupEventListeners();
		this._editorVisible = true;
		this._generation = 0;
	}

	setupEventListeners() {
		for (const [selector, address] of Object.entries(this.paramMap)) {
			const el = this.root.querySelector(selector);
			if (!el) continue;

			const updateWam = (e) => {
				let value = parseFloat(e.target.value);
				
				// Scale display values back to internal DSP ranges
				// Robust matching using the element selector (ID)
				const isEqOrReverb = selector.includes('bass') || selector.includes('middle') || selector.includes('treble') || selector.includes('reverb');
				const isPresence = selector.includes('presence');
				const isMaster = selector.includes('master');

				if (isEqOrReverb) {
					value = value / 10;
				} else if (isPresence) {
					// UI 0-10 -> DSP -15 to +10
					value = (value * 2.5) - 15;
					console.log(`[GUI] Presence UI -> DSP: ${e.target.value} -> ${value}`);
				} else if (isMaster) {
					// UI 0-10 -> DSP 0-4
					value = value * 0.4;
				}

				if (selector.includes('reverb')) {
					// console.log(`[GUI] Reverb UI -> DSP: ${e.target.value} -> ${value} (${address})`);
				}

				this._lastUserChange[address] = performance.now();
				this.wamNode.setParamValue(address, value);
			};

			if (el.tagName === 'IFC-WEBAUDIO-KNOB' || el.tagName === 'IFC-WEBAUDIO-SLIDER') {
				el.addEventListener('input', updateWam);
			} else if (el.tagName === 'SELECT') {
				el.addEventListener('change', updateWam);
			}
		}

		// GUI Mode Toggle
		const guiToggle = this.root.querySelector('#gui-toggle');
		const toggleItems = guiToggle.querySelectorAll('.gui-toggle-item');
		
		guiToggle.addEventListener('click', (e) => {
			const item = e.target.closest('.gui-toggle-item');
			if (!item) return;
			
			const mode = item.dataset.mode;
			this.setAttribute('gui-mode', mode);
			
			toggleItems.forEach(i => i.classList.remove('active'));
			item.classList.add('active');
		});
	}

	setupDspListeners() {
		// Meter addresses
		const METER_IN = '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix_Input';
		const METER_OUT = '/guitar_tube_amp_sim_100%_FAUST/Preamp_Guitarix/Preamp_Guitarix_Output';
		
		const meterInEl = this.root.querySelector('#meter-in');
		const meterOutEl = this.root.querySelector('#meter-out');

		this.faustNode.setOutputParamHandler((path, value) => {
			if (this._destroyed || !this.isConnected || !this._editorVisible) return;
			if (path === METER_IN) {
				// value is in dB: -60 to 10
				const percent = Math.max(0, Math.min(100, (value + 60) / 70 * 100));
				meterInEl.style.height = `${percent}%`;
			} else if (path === METER_OUT) {
				const percent = Math.max(0, Math.min(100, (value + 60) / 70 * 100));
				meterOutEl.style.height = `${percent}%`;
			} else {
				this.updateUiFromDsp(path, value);
			}
		});
	}

	updateUiFromDsp(path, value) {
		const GRACE_MS = 800;
		const now = performance.now();
		const lastChange = this._lastUserChange[path] || 0;
		if (now - lastChange < GRACE_MS) return;

		// Find the element for this path
		const selector = Object.keys(this.paramMap).find(k => this.paramMap[k] === path);
		if (!selector) return;

		const el = this.root.querySelector(selector);
		if (!el) return;

		if (el.tagName === 'IFC-WEBAUDIO-KNOB' || el.tagName === 'IFC-WEBAUDIO-SLIDER') {
			let displayValue = value;
			
			// Scale internal DSP values back to display ranges (0-10)
			// Robust matching using the selector from our paramMap
			const isEqOrReverb = selector.includes('bass') || selector.includes('middle') || selector.includes('treble') || selector.includes('reverb');
			const isPresence = selector.includes('presence');
			const isMaster = selector.includes('master');

			if (isEqOrReverb) {
				displayValue = value * 10;
			} else if (isPresence) {
				// DSP -15 to +10 -> UI 0-10
				displayValue = (value + 15) / 2.5;
			} else if (isMaster) {
				// DSP 0-4 -> UI 0-10
				displayValue = value / 0.4;
			}
			
			el.value = displayValue;
		} else if (el.tagName === 'SELECT') {
			el.value = Math.round(value).toString();
		}
	}

    syncFactoryPreset(values) {
        const status = this.wamNode.getFactoryPresetStatus(values);
        this.presetSelect.value = status.id || '';
        this.presetStatus.textContent = status.modified ? 'Modified' : '';
    }

	connectedCallback() { this.startUpdates(); }
	disconnectedCallback() { this.stopUpdates(); }
	setEditorVisible(visible) { this._editorVisible = visible; visible ? this.startUpdates() : this.stopUpdates(); }
	startUpdates() {
		if (this._destroyed || !this.isConnected || !this._editorVisible || this._running) return;
		this._running = true;this.setupDspListeners();
		const generation = ++this._generation;
		const tick = async () => {
			if (generation !== this._generation) return;
			try {
				const values = await this.wamNode.getParameterValues();
				if (generation !== this._generation) return;
				for (const [path, {value}] of Object.entries(values)) this.updateUiFromDsp(path, value);
                if (!this._presetLoading) this.syncFactoryPreset(values);
			} catch (error) {
				if (generation === this._generation) { this.stopUpdates(); this.dispatchEvent(new CustomEvent('editor-error', {detail:error})); }
				return;
			}
			this._frame = requestAnimationFrame(tick);
		};
		this._frame = requestAnimationFrame(tick);
	}
	stopUpdates() {
		this._running = false;++this._generation;cancelAnimationFrame(this._frame);
		this.faustNode.setOutputParamHandler(null);
	}
	destroy() { if (this._destroyed) return; this._destroyed = true; this.stopUpdates(); }

}

/**
 * @param {WebAudioModule} plugin
 * @returns {Promise<Node>}
 */
const createElement = async (plugin) => {
	const elementId = `${plugin.moduleId.toLowerCase().replace(/\W/g, "")}-ui`;
	if (!customElements.get(elementId)) customElements.define(elementId, EndUserAmpGui);
	/** @type {ParamMgrNode} */
	const wamNode = plugin.audioNode;
	/** @type {FaustAudioWorkletNode} */
	const faustNode = wamNode._output;
	
	return new (customElements.get(elementId))(wamNode, faustNode);
};
export default createElement;
