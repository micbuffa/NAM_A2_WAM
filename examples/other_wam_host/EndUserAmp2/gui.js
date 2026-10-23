import './utils/webaudio-controls.js';

/**
 * @typedef {import('./sdk-parammgr').ParamMgrNode} ParamMgrNode
 * @typedef {import('./sdk').WebAudioModule} WebAudioModule
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 */

import { AMP_PROFILES } from './ampProfiles.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
	:host {
		display: block;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}
	.amp-container {
		background: #111; /* dark tolex */
		border: 8px solid #222;
		border-radius: 10px;
		padding: 20px;
		color: #e0e0e0;
		width: 750px;
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
	.advanced-toggle {
		background: #222; color: #d4af37; border: 1px solid #555; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 11px; font-weight: bold; margin: 10px 20px; text-transform: uppercase;
	}
	.advanced-toggle:hover { background: #333; }
	#advanced-panel { display: none; }
</style>
<div class="amp-container">
	<div class="amp-panel" style="position: relative;">
		<div id="gui-toggle" class="gui-toggle">
			<div class="gui-toggle-item active" data-mode="knobs">KNOBS</div>
			<div class="gui-toggle-item" data-mode="sliders">SLIDERS</div>
		</div>
		<div class="amp-title">IFC Amp 2</div>
		
		<div class="knobs-container">
			<div class="meter">
				<div class="meter-bar"><div class="meter-fill" id="meter-in"></div></div>
				<div>INPUT</div>
			</div>
			
			<div class="knobs-row">
				<div class="knob-group">
					<webaudio-knob id="knob-input" diameter="60" min="0" max="10" step="0.1" value="3.68" tooltip="Input: %d"></webaudio-knob>
					<div>INPUT</div>
				</div>
				<div class="knob-group">
					<webaudio-knob id="knob-gain" diameter="60" min="0" max="10" step="0.1" value="3.68" tooltip="Gain: %d"></webaudio-knob>
					<div>GAIN</div>
				</div>
				<div class="knob-group">
					<webaudio-knob id="knob-bass" diameter="60" min="0" max="10" step="0.1" value="5" tooltip="Bass: %.1f"></webaudio-knob>
					<div>BASS</div>
				</div>
				<div class="knob-group">
					<webaudio-knob id="knob-middle" diameter="60" min="0" max="10" step="0.1" value="3" tooltip="Middle: %.1f"></webaudio-knob>
					<div>MIDDLE</div>
				</div>
				<div class="knob-group">
					<webaudio-knob id="knob-treble" diameter="60" min="0" max="10" step="0.1" value="7.5" tooltip="Treble: %.1f"></webaudio-knob>
					<div>TREBLE</div>
				</div>
				<div class="knob-group">
					<webaudio-knob id="knob-reverb" diameter="60" min="0" max="10" step="0.1" value="5.97" tooltip="Reverb: %.1f"></webaudio-knob>
					<div>REVERB</div>
				</div>
				<div class="knob-group">
					<webaudio-knob id="knob-master" diameter="60" min="0" max="10" step="0.1" value="2.3" tooltip="Master: %.1f"></webaudio-knob>
					<div>MASTER</div>
				</div>
				<div class="knob-group">
					<webaudio-knob id="knob-presence" diameter="60" min="0" max="10" step="0.1" value="6" tooltip="Presence: %.1f"></webaudio-knob>
					<div>PRESENCE</div>
				</div>
			</div>

			<div class="sliders-row">
				<div class="slider-group">
					<webaudio-slider id="slider-input" width="24" height="100" min="0" max="10" step="0.1" value="3.68" tooltip="Input: %.1f"></webaudio-slider>
					<div>INPUT</div>
				</div>
				<div class="slider-group">
					<webaudio-slider id="slider-gain" width="24" height="100" min="0" max="10" step="0.1" value="3.68" tooltip="Gain: %.1f"></webaudio-slider>
					<div>GAIN</div>
				</div>
				<div class="slider-group">
					<webaudio-slider id="slider-bass" width="24" height="100" min="0" max="10" step="0.1" value="5" tooltip="Bass: %.1f"></webaudio-slider>
					<div>BASS</div>
				</div>
				<div class="slider-group">
					<webaudio-slider id="slider-middle" width="24" height="100" min="0" max="10" step="0.1" value="3" tooltip="Middle: %.1f"></webaudio-slider>
					<div>MIDDLE</div>
				</div>
				<div class="slider-group">
					<webaudio-slider id="slider-treble" width="24" height="100" min="0" max="10" step="0.1" value="7.5" tooltip="Treble: %.1f"></webaudio-slider>
					<div>TREBLE</div>
				</div>
				<div class="slider-group">
					<webaudio-slider id="slider-reverb" width="24" height="100" min="0" max="10" step="0.1" value="5.97" tooltip="Reverb: %.1f"></webaudio-slider>
					<div>REVERB</div>
				</div>
				<div class="slider-group">
					<webaudio-slider id="slider-master" width="24" height="100" min="0" max="10" step="0.1" value="2.3" tooltip="Master: %.1f"></webaudio-slider>
					<div>MASTER</div>
				</div>
				<div class="slider-group">
					<webaudio-slider id="slider-presence" width="24" height="100" min="0" max="10" step="0.1" value="6" tooltip="Presence: %.1f"></webaudio-slider>
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
				<label>Amp Model</label>
				<select id="sel-amp-model">
					<option value="0">Lab (Manual)</option>
					<option value="1" selected>Mesa Rectifier</option>
					<option value="2">Fender Deluxe</option>
					<option value="3">Marshall JCM 800</option>
					<option value="4">Soldano SLO-100</option>
					<option value="5">Vox AC30</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Stages</label>
				<select id="sel-stages">
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3" selected>3</option>
					<option value="4">4</option>
					<option value="5">5</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 1</label>
				<select id="sel-tube1">
					<option value="0" selected>12AX7</option><option value="1">12AT7</option>
					<option value="2">12AU7</option><option value="3">6V6</option>
					<option value="4">6DJ8</option><option value="5">6C16</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 2</label>
				<select id="sel-tube2">
					<option value="0" selected>12AX7</option><option value="1">12AT7</option>
					<option value="2">12AU7</option><option value="3">6V6</option>
					<option value="4">6DJ8</option><option value="5">6C16</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 3</label>
				<select id="sel-tube3">
					<option value="0" selected>12AX7</option><option value="1">12AT7</option>
					<option value="2">12AU7</option><option value="3">6V6</option>
					<option value="4">6DJ8</option><option value="5">6C16</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 4</label>
				<select id="sel-tube4">
					<option value="0" selected>12AX7</option><option value="1">12AT7</option>
					<option value="2">12AU7</option><option value="3">6V6</option>
					<option value="4">6DJ8</option><option value="5">6C16</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tube 5</label>
				<select id="sel-tube5">
					<option value="0" selected>12AX7</option><option value="1">12AT7</option>
					<option value="2">12AU7</option><option value="3">6V6</option>
					<option value="4">6DJ8</option><option value="5">6C16</option>
				</select>
			</div>
			<div class="dropdown-group">
				<label>Tonestack</label>
				<select id="sel-tonestack">
					<option value="0">Mesa Mark</option>
					<option value="1">Mesa Rectifier</option>
					<option value="2">JCM800</option>
					<option value="3">AC30</option>
					<option value="4" selected>Fender Hot Rod</option>
					<option value="5">Soldano</option>
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
		
		<button id="btn-toggle-advanced" class="advanced-toggle">Show Preamp Advanced Settings ▼</button>
		
		<div id="advanced-panel">
			<div class="amp-panel" style="margin: 0 20px 20px 20px;">
				<div class="amp-title" style="font-size: 16px;">Preamp Advanced</div>
				<div class="knobs-row" style="margin: 0;">
					<div class="knob-group">
						<webaudio-knob id="knob-inter-trim" diameter="40" min="-18" max="12" step="0.1" value="0"></webaudio-knob>
						<div>TRIM (dB)</div>
					</div>
					<div class="dropdown-group" style="align-items: center; justify-content: center;">
						<label>Gain Placement</label>
						<select id="sel-gain-placement">
							<option value="1">Between 1-2</option>
							<option value="2">Between 2-3</option>
							<option value="3">Between 3-4</option>
							<option value="4">All stages (mild)</option>
						</select>
					</div>
					<div class="knob-group">
						<webaudio-knob id="knob-tightness-hp" diameter="40" min="20" max="320" step="1" value="120"></webaudio-knob>
						<div>TIGHT HP</div>
					</div>
					<div class="knob-group">
						<webaudio-knob id="knob-brightness-lp" diameter="40" min="2500" max="14000" step="10" value="8000"></webaudio-knob>
						<div>BRIGHT LP</div>
					</div>
				</div>
			</div>
			
			<div class="amp-panel" style="margin: 0 20px 20px 20px;">
				<div class="amp-title" style="font-size: 16px;">Dynamics</div>
				<div class="knobs-row" style="margin: 0;">
					<div class="knob-group">
						<webaudio-switch id="btn-cathode-sag" value="0" type="toggle"></webaudio-switch>
						<div>CATHODE SAG</div>
					</div>
					<div class="knob-group">
						<webaudio-knob id="knob-sag-time" diameter="40" min="5" max="200" step="1" value="30"></webaudio-knob>
						<div>SAG TIME(ms)</div>
					</div>
					<div class="knob-group">
						<webaudio-knob id="knob-sag-amount" diameter="40" min="0" max="0.5" step="0.01" value="0.15"></webaudio-knob>
						<div>SAG AMOUNT</div>
					</div>
					<div class="knob-group">
						<webaudio-switch id="btn-bias-offset" value="0" type="toggle"></webaudio-switch>
						<div>BIAS OFFSET</div>
					</div>
					<div class="knob-group">
						<webaudio-knob id="knob-bias-amount" diameter="40" min="-0.3" max="0.1" step="0.001" value="-0.08"></webaudio-knob>
						<div>BIAS AMOUNT</div>
					</div>
				</div>
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
		
		// Map param addresses
		this.paramMap = {
			'#knob-input': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim',
			'#slider-input': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim',
			'#knob-gain': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain',
			'#slider-gain': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain',
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
			'#sel-stages': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/NbStages',
			'#sel-amp-model': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Amp_Model/Amp',
			'#sel-tube1': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_1_Tube',
			'#sel-tube2': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_2_Tube',
			'#sel-tube3': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_3_Tube',
			'#sel-tube4': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_4_Tube',
			'#sel-tube5': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_5_Tube',
			'#sel-tonestack': '/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/tonestack_type/Model',
			'#sel-hp': '/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Cabinet_Select',
			'#knob-inter-trim': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Interstage_Trim',
			'#sel-gain-placement': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/GainPlacement',
			'#knob-tightness-hp': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Tightness_HP',
			'#knob-brightness-lp': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Tightness_HP', // Wait, brightness is Brightness_LP! Will fix in next step if necessary, actually fixing here
			'#btn-cathode-sag': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Cathode_Sag',
			'#knob-sag-time': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Time__ms_',
			'#knob-sag-amount': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Amount',
			'#btn-bias-offset': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Offset__H2_',
			'#knob-bias-amount': '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Amount'
		};

		// Fix the typo in mapping I just noticed
		this.paramMap['#knob-brightness-lp'] = '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Brightness_LP';

		// Track last user change to avoid feedback loops
		this._lastUserChange = {};

		this._isInitializing = true;
		this.setupEventListeners();
		this.setupDspListeners();

		// Apply the initial profile from the HTML selection on load, and push all UI knobs to DSP
		setTimeout(() => {
			const selAmpModel = this.root.querySelector('#sel-amp-model');
			if (selAmpModel) {
				const initialProfileId = parseInt(selAmpModel.value);
				this.loadAmpProfile(initialProfileId);
			}

			// Push all OTHER parameters from UI to DSP to ensure 100% sync on load
			for (const [selector, address] of Object.entries(this.paramMap)) {
				if (selector === '#sel-amp-model') continue;
				const el = this.root.querySelector(selector);
				if (el) {
					let value = parseFloat(el.value);
					const isEqOrReverb = selector.includes('bass') || selector.includes('middle') || selector.includes('treble') || selector.includes('reverb');
					const isPresence = selector.includes('presence');
					const isMaster = selector.includes('master');
					const isInput = selector.includes('input');

					if (isEqOrReverb) {
						value = value / 10;
					} else if (isPresence) {
						value = (value * 2.5) - 15;
					} else if (isMaster) {
						value = value * 0.4;
					} else if (isInput) {
						value = (value * 3.6) - 18;
					}

					this.wamNode.setParamValue(address, value);
					this._lastUserChange[address] = performance.now();
				}
			}

			setTimeout(() => { this._isInitializing = false; }, 200);
		}, 100);

		window.requestAnimationFrame(this.handleAnimationFrame);
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
				const isInput = selector.includes('input');

				if (isEqOrReverb) {
					value = value / 10;
				} else if (isPresence) {
					// UI 0-10 -> DSP -15 to +10
					value = (value * 2.5) - 15;
					console.log(`[GUI] Presence UI -> DSP: ${e.target.value} -> ${value}`);
				} else if (isMaster) {
					// UI 0-10 -> DSP 0-4
					value = value * 0.4;
				} else if (isInput) {
					// UI 0-10 -> DSP -18 to +18
					value = (value * 3.6) - 18;
				}

				if (selector.includes('reverb')) {
					// console.log(`[GUI] Reverb UI -> DSP: ${e.target.value} -> ${value} (${address})`);
				}
				
				// Optional: if user manually changes a preamp parameter, switch Amp Model to "Lab (Manual)"
				// so the changes take effect.
				const isPreampParam = selector.includes('stages') || selector.includes('tube') || selector.includes('trim') || selector.includes('tightness') || selector.includes('brightness') || selector.includes('gain-placement') || selector.includes('sag') || selector.includes('cathode') || selector.includes('bias');
				if (isPreampParam && selector !== '#sel-amp-model') {
					const selAmpModel = this.root.querySelector('#sel-amp-model');
					console.log(`[GUI-ADV] Preamp param changed: ${selector} -> ${value} (address: ${address})`);
					console.log(`[GUI-ADV] Current Amp Model UI: ${selAmpModel?.value}, forcing DSP Amp=0`);
					// Always force Amp to 0 (Lab) in the DSP, regardless of UI state
					this.wamNode.setParamValue(this.paramMap['#sel-amp-model'], 0);
					if (selAmpModel && selAmpModel.value != 0) {
						selAmpModel.value = 0; // Lab Manual
					}
				}

				this._lastUserChange[address] = performance.now();
				console.log(`[GUI] setParamValue(${address}, ${value})`);
				this.wamNode.setParamValue(address, value);
			};

			if (el.tagName === 'WEBAUDIO-KNOB' || el.tagName === 'WEBAUDIO-SLIDER' || el.tagName === 'WEBAUDIO-SWITCH') {
				el.addEventListener('input', updateWam);
				el.addEventListener('change', updateWam); // Switches use change sometimes
			} else if (el.tagName === 'SELECT') {
				el.addEventListener('change', async (e) => {
					if (selector === '#sel-amp-model') {
						const profileId = parseInt(e.target.value);
						this.loadAmpProfile(profileId);
					} else {
						updateWam(e);
					}
				});
			}
		}

		// Advanced UI Toggle
		const btnAdvanced = this.root.querySelector('#btn-toggle-advanced');
		const advancedPanel = this.root.querySelector('#advanced-panel');
		if (btnAdvanced && advancedPanel) {
			btnAdvanced.addEventListener('click', () => {
				if (advancedPanel.style.display === 'none') {
					advancedPanel.style.display = 'block';
					btnAdvanced.textContent = 'Hide Preamp Advanced Settings ▲';
				} else {
					advancedPanel.style.display = 'none';
					btnAdvanced.textContent = 'Show Preamp Advanced Settings ▼';
				}
				// Notify host that amp GUI height changed so it can re-fit
				this.dispatchEvent(new CustomEvent('gui-resize'));
			});
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

	loadAmpProfile(profileId) {
		// Always force Faust DSP to "Lab (Manual)" (0) so it listens to our parameters!
		this.wamNode.setParamValue(this.paramMap['#sel-amp-model'], 0);
		
		if (profileId > 0 && AMP_PROFILES[profileId]) {
			console.log("[GUI] Loading JS Profile:", profileId);
			const profile = AMP_PROFILES[profileId];
			
			for (const [uiSelector, val] of Object.entries(profile)) {
				const path = this.paramMap[uiSelector];
				if (path) {
					// Update DSP
					this.wamNode.setParamValue(path, val);
					// Update UI visual
					this._lastUserChange[path] = performance.now();
					this.updateUiFromDsp(path, val);
				}
			}
			
			// Also reset tubes to 12AX7 (0) as per default standard guitar amp preamp
			const tubes = ['#sel-tube1', '#sel-tube2', '#sel-tube3', '#sel-tube4', '#sel-tube5'];
			for (const t of tubes) {
				const path = this.paramMap[t];
				this.wamNode.setParamValue(path, 0);
				this.updateUiFromDsp(path, 0);
			}
		}
	}

	setupDspListeners() {
		// Meter addresses
		const METER_IN = '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Meters__Input';
		const METER_OUT = '/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Meters__Output';
		
		const meterInEl = this.root.querySelector('#meter-in');
		const meterOutEl = this.root.querySelector('#meter-out');

		this.faustNode.setOutputParamHandler((path, value) => {
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

		if (el.tagName === 'WEBAUDIO-KNOB' || el.tagName === 'WEBAUDIO-SLIDER') {
			let displayValue = value;
			
			// Scale internal DSP values back to display ranges (0-10)
			// Robust matching using the selector from our paramMap
			const isEqOrReverb = selector.includes('bass') || selector.includes('middle') || selector.includes('treble') || selector.includes('reverb');
			const isPresence = selector.includes('presence');
			const isMaster = selector.includes('master');
			const isInput = selector.includes('input');

			if (isEqOrReverb) {
				displayValue = value * 10;
			} else if (isPresence) {
				// DSP -15 to +10 -> UI 0-10
				displayValue = (value + 15) / 2.5;
			} else if (isMaster) {
				// DSP 0-4 -> UI 0-10
				displayValue = value / 0.4;
			} else if (isInput) {
				// DSP -18 to +18 -> UI 0-10
				displayValue = (value + 18) / 3.6;
			}
			
			// For new parameters, if they are WEBAUDIO-KNOB but not scaled, we just set the exact value!
			if (!isEqOrReverb && !isPresence && !isMaster && !isInput) {
				displayValue = value; 
			}
			
			const isDifferent = Math.abs(parseFloat(el.value) - displayValue) > 0.001;
			
			if (isDifferent) {
				el.value = displayValue;
				
				// If a preamp parameter changes externally (preset load), switch Amp Model to Lab (0)
				const isPreampParam = selector.includes('stages') || selector.includes('tube') || selector.includes('trim') || selector.includes('tightness') || selector.includes('brightness') || selector.includes('gain-placement') || selector.includes('sag') || selector.includes('bias');
				if (isPreampParam && !this._isInitializing) {
					const selAmpModel = this.root.querySelector('#sel-amp-model');
					if (selAmpModel && selAmpModel.value != 0) {
						selAmpModel.value = 0;
					}
				}
			}
		} else if (el.tagName === 'SELECT') {
			// For Amp Model, we keep the selected index visually correct even if DSP is 0
			if (selector === '#sel-amp-model') {
				// don't update #sel-amp-model from DSP since we force DSP to 0 but we want UI to show "Mesa Rectifier"
			} else {
				const displayValue = Math.round(value).toString();
				const isDifferent = el.value !== displayValue;
				
				if (isDifferent) {
					el.value = displayValue;
					const isPreampParam = selector.includes('stages') || selector.includes('tube') || selector.includes('tonestack');
					if (isPreampParam && !this._isInitializing) {
						const selAmpModel = this.root.querySelector('#sel-amp-model');
						if (selAmpModel && selAmpModel.value != 0) {
							selAmpModel.value = 0;
						}
					}
				}
			}
		} else if (el.tagName === 'WEBAUDIO-SWITCH') {
			const displayValue = value > 0.5 ? 1 : 0;
			const isDifferent = el.value != displayValue;
			if (isDifferent) {
				el.value = displayValue;
				const isPreampParam = selector.includes('sag') || selector.includes('bias');
				if (isPreampParam && !this._isInitializing) {
					const selAmpModel = this.root.querySelector('#sel-amp-model');
					if (selAmpModel && selAmpModel.value != 0) {
						selAmpModel.value = 0;
					}
				}
			}
		}
	}

	handleAnimationFrame = async () => {
		const values = await this.wamNode.getParameterValues();
		for (const key in values) {
			const { value } = values[key];
			this.updateUiFromDsp(key, value);
		}
		window.requestAnimationFrame(this.handleAnimationFrame);
	}
}

/**
 * @param {WebAudioModule} plugin
 * @returns {Promise<Node>}
 */
const createElement = async (plugin) => {
	const elementId = `${plugin.moduleId.toLowerCase().replace(/\W/g, "")}-ui`;
	try {
		customElements.define(elementId, EndUserAmpGui);
	} catch (e) {
		console.warn(e);
	}
	/** @type {ParamMgrNode} */
	const wamNode = plugin.audioNode;
	/** @type {FaustAudioWorkletNode} */
	const faustNode = wamNode._output;
	
	return new EndUserAmpGui(wamNode, faustNode);
};
export default createElement;
