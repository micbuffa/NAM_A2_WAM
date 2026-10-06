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
		background: linear-gradient(to bottom, #285666, #14343f); /* gold panel */
		border: 2px solid #b87850;
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
		color: #f1dfc8;
		text-transform: uppercase;
		letter-spacing: 2px;
		margin-bottom: 5px;
		text-shadow: 1px 1px 0px rgba(0,0,0,0.3);
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
		color: #f1dfc8;
		font-weight: bold;
		font-size: 11px;
		text-shadow: 1px 1px 0px rgba(0,0,0,0.2);
	}
	.meter {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: #f1dfc8;
		font-size: 10px;
		font-weight: bold;
		text-shadow: 1px 1px 0px rgba(0,0,0,0.2);
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
		color: #cfb69f;
		transition: all 0.2s;
	}
	.gui-toggle-item.active {
		background: #111;
		color: #e4af83;
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
		color: #f1dfc8;
		font-weight: bold;
		font-size: 10px;
		gap: 8px;
		text-shadow: 1px 1px 0px rgba(0,0,0,0.2);
	}
	:host([gui-mode="sliders"]) .knobs-row {
		display: none;
	}
	:host([gui-mode="sliders"]) .sliders-row {
		display: flex;
	}
	.advanced-toggle {
		background: #222; color: #e4af83; border: 1px solid #555; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 11px; font-weight: bold; margin: 10px 20px; text-transform: uppercase;
	}
	.advanced-toggle:hover { background: #333; }
	#advanced-panel { display: none; }
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
		<div class="amp-title">WAM•FAUST ShredLab</div><div class="amp-subtitle">Preamp · Tone stack · Power amp · Cabinet · Reverb</div>
        <div class="factory-preset"><label for="factory-preset">Factory preset</label><select id="factory-preset"><option value="" disabled>Current settings</option></select><span class="factory-preset-status" role="status"></span></div>
		
		<div class="knobs-container">
			<div class="meter">
				<div class="meter-bar"><div class="meter-fill" id="meter-in"></div></div>
				<div>INPUT</div>
			</div>
			
			<div class="knobs-row">
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-input" diameter="60" min="0" max="10" step="0.1" value="3.68" tooltip="Input: %d"></ifc2-webaudio-knob>
					<div>INPUT</div>
				</div>
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-gain" diameter="60" min="0" max="10" step="0.1" value="3.68" tooltip="Gain: %d"></ifc2-webaudio-knob>
					<div>GAIN</div>
				</div>
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-bass" diameter="60" min="0" max="10" step="0.1" value="5" tooltip="Bass: %.1f"></ifc2-webaudio-knob>
					<div>BASS</div>
				</div>
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-middle" diameter="60" min="0" max="10" step="0.1" value="3" tooltip="Middle: %.1f"></ifc2-webaudio-knob>
					<div>MIDDLE</div>
				</div>
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-treble" diameter="60" min="0" max="10" step="0.1" value="7.5" tooltip="Treble: %.1f"></ifc2-webaudio-knob>
					<div>TREBLE</div>
				</div>
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-reverb" diameter="60" min="0" max="10" step="0.1" value="5.97" tooltip="Reverb: %.1f"></ifc2-webaudio-knob>
					<div>REVERB</div>
				</div>
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-master" diameter="60" min="0" max="10" step="0.1" value="2.3" tooltip="Master: %.1f"></ifc2-webaudio-knob>
					<div>MASTER</div>
				</div>
				<div class="knob-group">
					<ifc2-webaudio-knob id="knob-presence" diameter="60" min="0" max="10" step="0.1" value="6" tooltip="Presence: %.1f"></ifc2-webaudio-knob>
					<div>PRESENCE</div>
				</div>
			</div>

			<div class="sliders-row">
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-input" width="24" height="100" min="0" max="10" step="0.1" value="3.68" tooltip="Input: %.1f"></ifc2-webaudio-slider>
					<div>INPUT</div>
				</div>
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-gain" width="24" height="100" min="0" max="10" step="0.1" value="3.68" tooltip="Gain: %.1f"></ifc2-webaudio-slider>
					<div>GAIN</div>
				</div>
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-bass" width="24" height="100" min="0" max="10" step="0.1" value="5" tooltip="Bass: %.1f"></ifc2-webaudio-slider>
					<div>BASS</div>
				</div>
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-middle" width="24" height="100" min="0" max="10" step="0.1" value="3" tooltip="Middle: %.1f"></ifc2-webaudio-slider>
					<div>MIDDLE</div>
				</div>
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-treble" width="24" height="100" min="0" max="10" step="0.1" value="7.5" tooltip="Treble: %.1f"></ifc2-webaudio-slider>
					<div>TREBLE</div>
				</div>
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-reverb" width="24" height="100" min="0" max="10" step="0.1" value="5.97" tooltip="Reverb: %.1f"></ifc2-webaudio-slider>
					<div>REVERB</div>
				</div>
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-master" width="24" height="100" min="0" max="10" step="0.1" value="2.3" tooltip="Master: %.1f"></ifc2-webaudio-slider>
					<div>MASTER</div>
				</div>
				<div class="slider-group">
					<ifc2-webaudio-slider id="slider-presence" width="24" height="100" min="0" max="10" step="0.1" value="6" tooltip="Presence: %.1f"></ifc2-webaudio-slider>
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
						<ifc2-webaudio-knob id="knob-inter-trim" diameter="40" min="-18" max="12" step="0.1" value="0"></ifc2-webaudio-knob>
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
						<ifc2-webaudio-knob id="knob-tightness-hp" diameter="40" min="20" max="320" step="1" value="120"></ifc2-webaudio-knob>
						<div>TIGHT HP</div>
					</div>
					<div class="knob-group">
						<ifc2-webaudio-knob id="knob-brightness-lp" diameter="40" min="2500" max="14000" step="10" value="8000"></ifc2-webaudio-knob>
						<div>BRIGHT LP</div>
					</div>
				</div>
			</div>
			
			<div class="amp-panel" style="margin: 0 20px 20px 20px;">
				<div class="amp-title" style="font-size: 16px;">Dynamics</div>
				<div class="knobs-row" style="margin: 0;">
					<div class="knob-group">
						<ifc2-webaudio-switch id="btn-cathode-sag" value="0" type="toggle"></ifc2-webaudio-switch>
						<div>CATHODE SAG</div>
					</div>
					<div class="knob-group">
						<ifc2-webaudio-knob id="knob-sag-time" diameter="40" min="5" max="200" step="1" value="30"></ifc2-webaudio-knob>
						<div>SAG TIME(ms)</div>
					</div>
					<div class="knob-group">
						<ifc2-webaudio-knob id="knob-sag-amount" diameter="40" min="0" max="0.5" step="0.01" value="0.15"></ifc2-webaudio-knob>
						<div>SAG AMOUNT</div>
					</div>
					<div class="knob-group">
						<ifc2-webaudio-switch id="btn-bias-offset" value="0" type="toggle"></ifc2-webaudio-switch>
						<div>BIAS OFFSET</div>
					</div>
					<div class="knob-group">
						<ifc2-webaudio-knob id="knob-bias-amount" diameter="40" min="-0.3" max="0.1" step="0.001" value="-0.08"></ifc2-webaudio-knob>
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

		this.setupEventListeners();
		this._editorVisible = true;
		this._generation = 0;
		// DSP state is authoritative. Opening the editor must never apply a profile.

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
				} else if (isMaster) {
					// UI 0-10 -> DSP 0-4
					value = value * 0.4;
				} else if (isInput) {
					// UI 0-10 -> DSP -18 to +18
					value = (value * 3.6) - 18;
				}

				if (selector.includes('reverb')) {
				}
				
				// Optional: if user manually changes a preamp parameter, switch Amp Model to "Lab (Manual)"
				// so the changes take effect.
				const isPreampParam = selector.includes('stages') || selector.includes('tube') || selector.includes('trim') || selector.includes('tightness') || selector.includes('brightness') || selector.includes('gain-placement') || selector.includes('sag') || selector.includes('cathode') || selector.includes('bias');
				if (isPreampParam && selector !== '#sel-amp-model') {
					const selAmpModel = this.root.querySelector('#sel-amp-model');
					// Always force Amp to 0 (Lab) in the DSP, regardless of UI state
					this.wamNode.setParamValue(this.paramMap['#sel-amp-model'], 0);
		this._lastUserChange[this.paramMap['#sel-amp-model']] = performance.now();
					if (selAmpModel && selAmpModel.value != 0) {
						selAmpModel.value = 0; // Lab Manual
					}
				}

				this._lastUserChange[address] = performance.now();
				this.wamNode.setParamValue(address, value);
			};

			if (el.tagName === 'IFC2-WEBAUDIO-KNOB' || el.tagName === 'IFC2-WEBAUDIO-SLIDER' || el.tagName === 'IFC2-WEBAUDIO-SWITCH') {
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
		this._lastUserChange[this.paramMap['#sel-amp-model']] = performance.now();
		
		if (profileId > 0 && AMP_PROFILES[profileId]) {
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
		if (performance.now() - (this._lastUserChange[path] || -Infinity) < 250) return;
		for (const selector of Object.keys(this.paramMap).filter(key => this.paramMap[key] === path)) {
			const el = this.root.querySelector(selector);if (!el || selector === '#sel-amp-model') continue;
			let displayValue = value;
			if (selector.includes('bass') || selector.includes('middle') || selector.includes('treble') || selector.includes('reverb')) displayValue *= 10;
			else if (selector.includes('presence')) displayValue = (value + 15) / 2.5;
			else if (selector.includes('master')) displayValue /= .4;
			else if (selector.includes('input')) displayValue = (value + 18) / 3.6;
			el.value = el.tagName === 'SELECT' ? String(Math.round(displayValue)) : displayValue;
		}
	}
	syncProfileLabel(values) {
		const amp = this.paramMap['#sel-amp-model'];
		if (performance.now() - (this._lastUserChange[amp] || -Infinity) < 250) return;
		let selected = Math.round(values[amp]?.value || 0);
		if (!selected) {
			const match = Object.entries(AMP_PROFILES).find(([,profile]) =>
				Object.entries(profile).every(([selector,value]) => Math.abs((values[this.paramMap[selector]]?.value ?? Infinity) - value) < .001)
				&& [1,2,3,4,5].every(i => values[this.paramMap['#sel-tube'+i]]?.value === 0));
			selected = match ? Number(match[0]) : 0;
		}
		this.root.querySelector('#sel-amp-model').value = String(selected);
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
				this.syncProfileLabel(values);
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
