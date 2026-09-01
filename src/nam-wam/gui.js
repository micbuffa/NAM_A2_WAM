import {buildAssetTree, addExternalAsset} from '../shared/assetBrowser.js';
import Tone3000Client from './tone3000/Tone3000Client.js';
import {TONE3000_CALLBACK_CHANNEL, TONE3000_CALLBACK_STORAGE_KEY} from './tone3000/Tone3000Auth.js';
const manifestUrl = new URL('./models-manifest.json', import.meta.url);
const tone3000Origin = 'https://www.tone3000.com';
const tone3000LogoUrl = new URL('./tone3000/TONE3000-logo.svg', import.meta.url).href;

const getToneImageUrl = (tone) => {
  const candidate = Array.isArray(tone?.images) ? tone.images.find((image) => typeof image === 'string' && image.trim()) : '';
  if (!candidate) return '';
  try {
    const url = new URL(candidate, tone3000Origin);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
};

class NamA2Gui extends HTMLElement {
  async initialize(plugin) {
    this.plugin = plugin;
    this.node = plugin.audioNode;
    this.node.gui = this;
    this.innerHTML = `
      <style>
        nam-a2-gui { --nam-accent:#a688ff; --nam-panel:#17171d; display:block; min-width:0; color:#f3f0f7; font:13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif }
        nam-a2-gui * { box-sizing:border-box } nam-a2-gui [hidden] { display:none!important } nam-a2-gui button,nam-a2-gui input,nam-a2-gui select { font:inherit }
        nam-a2-gui button,nam-a2-gui select,nam-a2-gui input[type=search] { color:#f3f0f7; background:#101014; border:1px solid #3a3642; border-radius:8px }
        nam-a2-gui button { min-height:34px; padding:0 12px; cursor:pointer } nam-a2-gui button:hover { border-color:#776b91;background:#1d1a24 }
        nam-a2-gui button:focus-visible,nam-a2-gui input:focus-visible,nam-a2-gui select:focus-visible,nam-a2-gui summary:focus-visible { outline:2px solid var(--nam-accent);outline-offset:2px }
        nam-a2-gui .nam-module { overflow:hidden; background:linear-gradient(145deg,#25232b,#17171c 55%,#121217); border:1px solid #403b49; border-radius:15px; box-shadow:0 18px 44px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.04) }
        nam-a2-gui .module-head { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-bottom:1px solid #393540;background:rgba(9,9,12,.28) }
        nam-a2-gui .module-title { display:flex;align-items:center;gap:10px } nam-a2-gui .module-mark { display:grid;place-items:center;width:31px;height:31px;color:#17131d;background:var(--nam-accent);border-radius:8px;font-weight:900;box-shadow:0 0 18px rgba(166,136,255,.22) }
        nam-a2-gui h2 { margin:0;font-size:16px;letter-spacing:.02em } nam-a2-gui .module-subtitle { display:block;color:#898391;font-size:9px;letter-spacing:.15em;text-transform:uppercase }
        nam-a2-gui .bypass-label { display:flex;align-items:center;gap:7px;color:#aaa3b4;font-size:10px;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .bypass { accent-color:var(--nam-accent) }
        nam-a2-gui .signal-strip { display:grid;grid-template-columns:44px minmax(96px,.65fr) minmax(180px,1.45fr) minmax(96px,.65fr) 44px;gap:12px;align-items:center;padding:18px 16px }
        nam-a2-gui .meter { display:grid;grid-template-rows:auto 96px auto;justify-items:center;gap:5px;min-width:0 } nam-a2-gui .meter-label { color:#9a94a1;font-size:9px;font-weight:800;letter-spacing:.14em }
        nam-a2-gui .meter-track { position:relative;width:10px;height:96px;overflow:hidden;background:#08090a;border:1px solid #45404a;border-radius:7px }
        nam-a2-gui .meter-fill { position:absolute;inset:auto 0 0;height:0;background:linear-gradient(0deg,#58c66a 0 68%,#e1bb4c 84%,#e45b66 100%);transition:height 80ms linear }
        nam-a2-gui .clip { color:#68636f;font-size:8px;font-weight:800 } nam-a2-gui .clip.active { color:#ff6472 }
        nam-a2-gui .meter-values { position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0) }
        nam-a2-gui .gain-control { display:grid;gap:8px;min-width:0;color:#9e98a7;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:.09em }
        nam-a2-gui .gain-control output { color:#f2edf8;font-size:14px;font-weight:750;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums }
        nam-a2-gui .gain-control input { width:100%;accent-color:var(--nam-accent) }
        nam-a2-gui .current-model { min-width:0;padding:15px 16px;text-align:center;background:rgba(8,8,11,.48);border:1px solid #36323d;border-radius:12px }
        nam-a2-gui .currentToneImage { display:block;width:68px;height:68px;margin:0 auto 9px;object-fit:contain;background:#0d0d11;border:1px solid #443d4d;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.3) }
        nam-a2-gui .eyebrow { margin:0 0 7px;color:#797381;font-size:9px;font-weight:800;letter-spacing:.15em;text-transform:uppercase }
        nam-a2-gui .currentModel { display:block;overflow:hidden;color:#fff;font-size:16px;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .model-chips { display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin-top:9px } nam-a2-gui .chip { padding:3px 7px;color:#bbb4c5;background:#24212a;border:1px solid #3a3543;border-radius:999px;font-size:9px;letter-spacing:.06em;text-transform:uppercase }
        nam-a2-gui .chip.source { color:#c7b8fb;border-color:#5d4f7e } nam-a2-gui .drawer { border-top:1px solid #37333d;background:rgba(9,9,12,.36) }
        nam-a2-gui .drawer>summary { padding:11px 16px;color:#aaa3b4;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;list-style-position:inside }
        nam-a2-gui .drawer[open]>summary { color:#ddd6e8;border-bottom:1px solid #332f39 } nam-a2-gui .drawer-body { padding:13px 16px 16px }
        nam-a2-gui .source-tabs { display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px } nam-a2-gui .sourceTab[aria-pressed=true] { color:#19151f;background:var(--nam-accent);border-color:var(--nam-accent);font-weight:800 }
        nam-a2-gui .browser-tools { display:flex;gap:8px;margin-bottom:10px } nam-a2-gui .modelSearch { min-width:0;flex:1;height:36px;padding:0 10px }
        nam-a2-gui .file-action { display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;color:#d8cfdf;background:#101014;border:1px solid #3a3642;border-radius:8px;cursor:pointer;white-space:nowrap } nam-a2-gui .model { position:absolute;width:1px;height:1px;opacity:0;pointer-events:none }
        nam-a2-gui .modelBrowser { max-height:235px;overflow:auto;padding:7px;background:#0d0d11;border:1px solid #332f39;border-radius:9px;scrollbar-width:thin }
        nam-a2-gui .modelBrowser:empty::after { content:'No models in this source';display:block;padding:14px;color:#6f6976;text-align:center }
        nam-a2-gui .asset-entry { display:block;width:100%;min-height:29px;margin:2px 0;padding:4px 8px;overflow:hidden;color:#bbb5c3;background:transparent;border-color:transparent;text-align:left;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .asset-entry:hover { background:#211e27 } nam-a2-gui .asset-entry.selected { color:#fff;background:#493b66;border-color:#75619c }
        nam-a2-gui .modelBrowser details { margin-left:7px } nam-a2-gui .modelBrowser summary { padding:4px;color:#958e9e;cursor:pointer;font-size:11px }
        nam-a2-gui .tone3000-panel { display:grid;gap:9px;margin-top:10px;padding:11px;background:#15131a;border:1px solid #3b3544;border-radius:9px } nam-a2-gui .tone3000-head { display:flex;justify-content:space-between;align-items:center;gap:8px }
        nam-a2-gui .tone3000Auth { display:grid;justify-items:center;gap:12px;padding:15px 10px;text-align:center } nam-a2-gui .tone3000Logo { display:block;width:min(210px,80%);height:auto;margin:2px auto 3px } nam-a2-gui .tone3000AuthTitle { margin:0;color:#f3f0f7;font-size:14px;font-weight:750 } nam-a2-gui .tone3000AuthCopy { max-width:360px;margin:0;color:#aaa3b1;font-size:11px;line-height:1.5 }
        nam-a2-gui .tone3000Status,nam-a2-gui .tone3000Tone { margin:0;color:#9992a1;font-size:10px;white-space:pre-line } nam-a2-gui .tone3000Selection { display:grid;gap:8px } nam-a2-gui .tone3000Image { display:block;width:auto;max-width:100%;height:auto;max-height:320px;margin:0 auto;object-fit:contain;background:#0d0d11;border:1px solid #443d4d;border-radius:9px } nam-a2-gui .tone3000Selection select { width:100%;min-height:34px;padding:0 8px }
        nam-a2-gui .powered { color:#6f6877;font-size:9px } nam-a2-gui .status { min-height:50px;margin:0;padding:10px;color:#aaa3b1;background:#0d0d11;border-radius:8px;white-space:pre-line;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace }
        nam-a2-gui .error { color:#ff9da9 }
        @media(max-width:620px){nam-a2-gui .signal-strip{grid-template-columns:36px 1fr 36px;gap:9px}nam-a2-gui .current-model{grid-column:2}nam-a2-gui .gain-control.input-control{grid-column:1/3;grid-row:2}nam-a2-gui .gain-control.output-control{grid-column:2/4;grid-row:3}nam-a2-gui .meter[data-meter=output]{grid-column:3;grid-row:1}nam-a2-gui .browser-tools{flex-direction:column}}
      </style>
      <section class="nam-module">
        <header class="module-head">
          <div class="module-title"><span class="module-mark">N</span><div><h2>NAM A2</h2><span class="module-subtitle">Neural amplifier</span></div></div>
          <label class="bypass-label"><input class="bypass" type="checkbox"> Bypass</label>
        </header>
        <div class="signal-strip">
          <div class="meter" data-meter="input"><span class="meter-label">IN</span><div class="meter-track"><div class="meter-fill"></div></div><span class="clip">CLIP</span><div class="meter-values"><span class="peak">-∞ dBFS</span><span class="rms">RMS -∞</span></div></div>
          <label class="gain-control input-control">Input gain <output class="inputGainValue">0.0 dB</output><input class="inputGain" type="range" min="-48" max="24" step="0.1" value="0"></label>
          <section class="current-model" aria-live="polite"><p class="eyebrow">Current model</p><img class="currentToneImage" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" hidden><strong class="currentModel">No model loaded</strong><div class="model-chips"><span class="chip source modelSource">—</span><span class="chip modelMode">A2 —</span></div></section>
          <label class="gain-control output-control">Output gain <output class="outputGainValue">0.0 dB</output><input class="outputGain" type="range" min="-24" max="12" step="0.1" value="0"></label>
          <div class="meter" data-meter="output"><span class="meter-label">OUT</span><div class="meter-track"><div class="meter-fill"></div></div><span class="clip">CLIP</span><div class="meter-values"><span class="peak">-∞ dBFS</span><span class="rms">RMS -∞</span></div></div>
        </div>
        <details class="drawer modelDrawer">
          <summary>Models & sources</summary>
          <div class="drawer-body">
            <div class="source-tabs" role="group" aria-label="Model source">
              <button class="sourceTab" data-source="Factory" type="button" aria-pressed="true">Factory</button>
              <button class="sourceTab" data-source="External" type="button" aria-pressed="false">External</button>
              <button class="sourceTab" data-source="TONE3000" type="button" aria-pressed="false">TONE3000</button>
            </div>
            <div class="browser-tools"><input class="modelSearch" type="search" aria-label="Search models" placeholder="Search models…"><label class="file-action">Load .nam file…<input class="model" type="file" accept=".nam,application/json"></label></div>
            <div class="modelBrowser"></div>
            <section class="tone3000-panel" aria-label="TONE3000" hidden>
              <section class="tone3000Auth" aria-labelledby="tone3000AuthTitle" hidden><img class="tone3000Logo" src="${tone3000LogoUrl}" alt="TONE3000"><h3 class="tone3000AuthTitle" id="tone3000AuthTitle">Access TONE3000 tones</h3><p class="tone3000AuthCopy">NAM A2 WAM has partnered with TONE3000 to give you access to a library of NAM captures created by a global community of musicians.</p><button class="tone3000Authenticate" type="button">Continue to TONE3000</button></section>
              <div class="tone3000Browser" hidden><div class="tone3000-head"><button class="tone3000Browse" type="button">Browse TONE3000</button><small class="powered">Powered by TONE3000</small></div>
                <p class="tone3000Status">TONE3000 integration not configured</p>
                <div class="tone3000Selection" hidden><img class="tone3000Image" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" hidden><p class="tone3000Tone"></p><label>Available A2 model <select class="tone3000Model"></select></label><button class="tone3000Load" type="button">Load selected model</button></div>
              </div>
            </section>
          </div>
        </details>
        <details class="drawer detailsDrawer"><summary>Model details</summary><div class="drawer-body"><p class="status">No model loaded</p></div></details>
      </section>`;
    this.controls = {
      inputGain: this.querySelector('.inputGain'), outputGain: this.querySelector('.outputGain'),
      bypass: this.querySelector('.bypass'), model: this.querySelector('.model'), status: this.querySelector('.status'),
      search: this.querySelector('.modelSearch'), browser: this.querySelector('.modelBrowser'),
      toneBrowse: this.querySelector('.tone3000Browse'), toneStatus: this.querySelector('.tone3000Status'),
      toneSelection: this.querySelector('.tone3000Selection'), toneInfo: this.querySelector('.tone3000Tone'),
      toneModels: this.querySelector('.tone3000Model'), toneLoad: this.querySelector('.tone3000Load'),
      toneImage: this.querySelector('.tone3000Image'), currentToneImage: this.querySelector('.currentToneImage'),
      toneAuth: this.querySelector('.tone3000Auth'), toneAuthenticate: this.querySelector('.tone3000Authenticate'), toneBrowser: this.querySelector('.tone3000Browser'),
      currentModel: this.querySelector('.currentModel'), modelSource: this.querySelector('.modelSource'),
      modelMode: this.querySelector('.modelMode'), modelDrawer: this.querySelector('.modelDrawer'),
      tonePanel: this.querySelector('.tone3000-panel'), sourceTabs: [...this.querySelectorAll('.sourceTab')],
    };
    const setParam = (id, value) => this.node.setParameterValues({[id]: {id, value, normalized: false}});
    this.controls.inputGain.oninput = () => setParam('inputGain', Number(this.controls.inputGain.value));
    this.controls.outputGain.oninput = () => setParam('outputGain', Number(this.controls.outputGain.value));
    this.controls.bypass.onchange = () => setParam('bypass', this.controls.bypass.checked ? 1 : 0);
    this.controls.model.onchange = async () => {
      const file = this.controls.model.files[0];
      if (!file) return;
      this.controls.status.classList.remove('error');
      this.controls.status.textContent = `Loading ${file.name}…`;
      try { const text=await file.text(); await this.node.loadModelText(text, file.name); await this.addExternal(text,file.name); }
      catch (error) { this.setModelStatus({status: 'error', error: error.message}); }
    };
    this._assets=[]; this._selectedId=''; this._sourceFilter='Factory';
    this.controls.search.oninput=()=>this.renderBrowser();
    this.controls.sourceTabs.forEach((button)=>button.onclick=()=>this.setSourceFilter(button.dataset.source));
    this._modelListener=async(metadata,model)=>{if(!model?.data)return;if(model.provenance){const id=model.provenance.identity;let asset=this._assets.find((entry)=>entry.id===id);if(!asset)asset=addExternalAsset(this._assets,{id,filename:model.name,relativePath:model.name,groups:['TONE3000'],displayName:model.name.replace(/\.nam$/i,''),type:'nam',source:'TONE3000',provenance:model.provenance});this._selectedId=asset.id;this.controls.modelSource.textContent='TONE3000';this.renderBrowser();return;}const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(model.data));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');const factory=this._assets.find(a=>a.contentHash===hash);if(factory){this._selectedId=factory.id;this.controls.modelSource.textContent='Factory';}else {const asset=addExternalAsset(this._assets,{id:`external:${hash}`,filename:model.name,relativePath:model.name,groups:['External'],displayName:model.name.replace(/\.nam$/i,''),type:'nam',contentHash:hash,source:'External',data:model.data});asset.data=model.data;this._selectedId=asset.id;this.controls.modelSource.textContent='External';}this.renderBrowser();};
    this.node.addModelListener(this._modelListener);
    this.loadManifest();
    this._automation = (event) => this.syncParameter(event.detail.data);
    this._meterState = {inputPeak: 0, inputRms: 0, outputPeak: 0, outputRms: 0, inputClipUntil: 0, outputClipUntil: 0};
    this._meterListener = (data) => this.updateMeters(data);
    this.node.addMeterListener(this._meterListener);
    this.node.addEventListener('wam-automation', this._automation);
    this.syncParameters(await this.node.getParameterValues(false));
    this.tone3000 = new Tone3000Client(plugin.constructor.tone3000Config || {});
    this._toneModels = [];
    this.controls.toneBrowse.onclick = () => this.browseTone3000();
    this.controls.toneAuthenticate.onclick = () => this.browseTone3000();
    this.controls.toneLoad.onclick = () => this.loadTone3000Model();
    this._tonePopup = null;
    this._toneCallbackHref = '';
    this._receiveTone3000Callback = (data) => {
      if (!data?.href || data.href === this._toneCallbackHref) return;
      this._toneCallbackHref = data.href;
      this._tonePopup?.close(); this._tonePopup = null;
      this.completeTone3000Callback({href: data.href});
    };
    this._toneMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== this._tonePopup || event.data?.type !== TONE3000_CALLBACK_CHANNEL) return;
      this._receiveTone3000Callback(event.data);
    };
    this._toneStorageMessage = (event) => {
      if (event.key !== TONE3000_CALLBACK_STORAGE_KEY || !event.newValue) return;
      try { this._receiveTone3000Callback(JSON.parse(event.newValue)); } catch { /* Ignore malformed relay data. */ }
    };
    window.addEventListener('message', this._toneMessage);
    window.addEventListener('storage', this._toneStorageMessage);
    this._toneChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(TONE3000_CALLBACK_CHANNEL) : null;
    if (this._toneChannel) this._toneChannel.onmessage = (event) => {
      if (event.data?.type !== TONE3000_CALLBACK_CHANNEL) return;
      this._receiveTone3000Callback(event.data);
    };
    this._escapeListener = (event) => { if (event.key === 'Escape') this.querySelectorAll('.drawer[open]').forEach((details) => { details.open = false; }); };
    this.addEventListener('keydown', this._escapeListener);
    await this.completeTone3000Callback();
    return this;
  }

  syncParameter(data) {
    const {id, value} = data;
    if (id === 'bypass') this.controls.bypass.checked = value >= 0.5;
    else if (this.controls[id]) this.controls[id].value = value;
    if (id === 'inputGain' || id === 'outputGain') this.querySelector(`.${id}Value`).textContent = `${Number(value).toFixed(1)} dB`;
  }

  syncParameters(values) { Object.values(values).forEach((data) => this.syncParameter(data)); }

  updateMeters(data) {
    const now = performance.now();
    for (const id of ['input', 'output']) {
      const peakKey = `${id}Peak`;
      const rmsKey = `${id}Rms`;
      const clipKey = `${id}ClipUntil`;
      this._meterState[peakKey] = Math.max(data[peakKey], this._meterState[peakKey] * 0.86);
      this._meterState[rmsKey] = 0.72 * this._meterState[rmsKey] + 0.28 * data[rmsKey];
      if (data[`${id}Clip`]) this._meterState[clipKey] = now + 1500;
      const peakDb = this.amplitudeToDb(this._meterState[peakKey]);
      const rmsDb = this.amplitudeToDb(this._meterState[rmsKey]);
      const element = this.querySelector(`[data-meter="${id}"]`);
      element.querySelector('.meter-fill').style.height = `${Math.max(0, Math.min(100, (peakDb + 72) / 72 * 100))}%`;
      element.querySelector('.peak').textContent = `${Number.isFinite(peakDb) ? peakDb.toFixed(1) : '-∞'} dBFS`;
      element.querySelector('.rms').textContent = `RMS ${Number.isFinite(rmsDb) ? rmsDb.toFixed(1) : '-∞'}`;
      element.querySelector('.clip').classList.toggle('active', now < this._meterState[clipKey]);
    }
  }

  amplitudeToDb(amplitude) { return amplitude > 0 ? Math.max(-72, 20 * Math.log10(amplitude)) : -Infinity; }

  setToneImage(element, imageUrl, alt) {
    element.onerror = null;
    if (!imageUrl) {
      element.hidden = true;
      element.removeAttribute('src');
      element.alt = '';
      return;
    }
    element.hidden = false;
    element.alt = alt;
    element.onerror = () => {
      element.onerror = null;
      element.hidden = true;
      element.removeAttribute('src');
    };
    element.src = imageUrl;
  }

  setModelStatus(info) {
    if (info.status === 'error') {
      this.controls.status.classList.add('error');
      this.controls.status.textContent = `Error: ${info.error}`;
      return;
    }
    const m = info.metadata;
    this.controls.status.classList.remove('error');
    this.controls.currentModel.textContent = m.rawMetadata?.name || m.name.replace(/\.nam$/iu, '');
    this.controls.modelMode.textContent = m.subtype || 'A2';
    if (m.source) this.controls.modelSource.textContent = m.source;
    this.setToneImage(this.controls.currentToneImage, m.provenance?.imageUrl || '', m.provenance?.title ? `${m.provenance.title} — TONE3000 tone image` : 'TONE3000 tone image');
    this.controls.status.textContent = `${m.name}\nArchitecture: ${m.subtype}\nSample rate: ${m.expectedSampleRate} Hz\nModeled by: ${m.modeledBy}\nNAM format: ${m.version}${m.source ? `\nSource: ${m.source}` : ''}`;
  }

  setToneStatus(text, error = false) { this.controls.toneStatus.textContent = text; this.controls.toneStatus.classList.toggle('error', error); }

  showToneAuthentication(show) {
    this.controls.toneAuth.hidden = !show;
    this.controls.toneBrowser.hidden = show;
    if (show) this.controls.toneSelection.hidden = true;
  }

  setSourceFilter(source) {
    this._sourceFilter = source;
    this.controls.sourceTabs.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.source === source)));
    this.controls.tonePanel.hidden = source !== 'TONE3000';
    if (source === 'TONE3000') this.showToneAuthentication(!this.tone3000?.tokens?.access_token);
    this.renderBrowser();
  }

  async browseTone3000() {
    if (!this.tone3000.configured) { this.setToneStatus('TONE3000 integration not configured', true); return; }
    try {
      this.setSourceFilter('TONE3000'); this.showToneAuthentication(false); this.controls.modelDrawer.open = true;
      this.setToneStatus('Opening TONE3000…');
      this._toneCallbackHref = '';
      sessionStorage.setItem('nam-a2-wam.tone3000.popup', '1');
      const popup = window.open('about:blank', '_blank');
      sessionStorage.removeItem('nam-a2-wam.tone3000.popup');
      if (!popup) { this.setToneStatus('New tab blocked — allow new tabs to keep the host page open', true); return; }
      this._tonePopup = popup;
      popup.location.href = await this.tone3000.createAuthorizationUrl();
      this.setToneStatus('Waiting for TONE3000 selection…');
    }
    catch (error) { this.setToneStatus(error.message, true); }
  }

  async completeTone3000Callback(location = window.location) {
    const hasCallback = /[?&](?:code|error|canceled)=/u.test(new URL(location.href).search);
    if (!hasCallback) { if (this.tone3000.configured) this.setToneStatus('Ready — click Browse TONE3000 to select a tone'); return; }
    if (!this.tone3000.configured) { this.setToneStatus('TONE3000 callback received, but integration is not configured', true); return; }
    this.setToneStatus('Completing TONE3000 authorization…');
    const result = await this.tone3000.completeAuthorization(location);
    if (location === window.location && window.history?.replaceState) window.history.replaceState({}, document.title, window.location.pathname);
    if (!result.ok) { this.setToneStatus(result.error, true); return; }
    if (!result.toneId) { this.setToneStatus('TONE3000 did not return a selected tone', true); return; }
    this.showToneAuthentication(false);
    await this.loadTone3000Selection(result.toneId);
  }

  async loadTone3000Selection(toneId) {
    try {
      this.setToneStatus('Loading tone metadata…');
      const tone = await this.tone3000.getTone(toneId);
      this.setToneStatus('Loading compatible A2 models…');
      this._toneModels = await this.tone3000.getCompatibleModels(toneId);
      this._toneModels = this._toneModels.filter((model) => String(model.architecture ?? 2) === '2');
      this.controls.toneSelection.hidden = false;
      const imageUrl = getToneImageUrl(tone);
      const toneTitle = tone.title || tone.name || `Tone ${toneId}`;
      this.setToneImage(this.controls.toneImage, imageUrl, `${toneTitle} — TONE3000 tone image`);
      this.controls.toneInfo.textContent = `${toneTitle}\nCreator: ${tone.creator?.name || tone.creator_name || tone.created_by || 'Unknown'}\nGear: ${tone.gear_type || tone.gear || 'NAM'}${tone.license ? `\nLicense: ${tone.license}` : ''}`;
      this.controls.toneModels.replaceChildren(...this._toneModels.map((model) => new Option(model.name || `Model ${model.id}`, String(model.id))));
      if (!this._toneModels.length) { this.setToneStatus('No compatible NAM A2 model is available for this tone.', true); this.controls.toneLoad.disabled = true; return; }
      this.controls.toneLoad.disabled = false; this.setToneStatus('Tone selected — choose an A2 model and load it');
      this._tone = tone; this._toneId = toneId;
    } catch (error) { this.setToneStatus(error.message, true); }
  }

  async loadTone3000Model() {
    const model = this._toneModels[Number(this.controls.toneModels.selectedIndex)];
    if (!model || this.controls.toneLoad.disabled) return;
    const toneId = this._toneId ?? this._tone?.id ?? this._tone?.tone_id;
    const provenance = {identity: `tone3000:${toneId}:${model.id}`, toneId, modelId: model.id,
      title: this._tone?.title || this._tone?.name, creator: this._tone?.creator?.name || this._tone?.creator_name,
      license: this._tone?.license, imageUrl: getToneImageUrl(this._tone), source: 'TONE3000'};
    this.controls.toneLoad.disabled = true;
    try { this.setToneStatus('Downloading model…'); const downloaded = await this.tone3000.downloadModel(model); this.setToneStatus('Loading NAM model…'); await this.node.loadModelText(downloaded.text, downloaded.name, provenance); this.setToneStatus('TONE3000 model loaded'); }
    catch (error) { this.setToneStatus(error.message, true); }
    finally { this.controls.toneLoad.disabled = false; }
  }

  async loadManifest(){try{const response=await fetch(manifestUrl);if(!response.ok)throw Error(`HTTP ${response.status}`);const manifest=await response.json();this._assets=manifest.assets||[];this.renderBrowser();const state=await this.node.getState();if(state.model)this._modelListener(null,state.model);}catch(error){this.setModelStatus({status:'error',error:`Factory library unavailable: ${error.message}`});}}
  renderBrowser(){const assets=this._assets.filter((asset)=>this._sourceFilter==='TONE3000'?asset.source==='TONE3000':this._sourceFilter==='External'?asset.source==='External'||asset.id.startsWith('external:'):asset.source!=='TONE3000'&&!asset.id.startsWith('external:'));buildAssetTree(this.controls.browser,assets,{search:this.controls.search.value,selectedId:this._selectedId,onSelect:async(asset)=>{try{if(asset.source==='TONE3000'){this.setToneStatus('Use Browse TONE3000 to authorize this model again if needed.');return;}if(asset.source==='External'||asset.id.startsWith('external:')){if(!asset.data)throw Error('External model data is unavailable in this session');await this.node.loadModelText(asset.data,asset.filename);this._selectedId=asset.id;this.controls.modelSource.textContent='External';this.renderBrowser();return;}const response=await fetch(new URL(`models/${asset.relativePath}`,manifestUrl));if(!response.ok)throw Error(`HTTP ${response.status}`);await this.node.loadModelText(await response.text(),asset.filename);this._selectedId=asset.id;this.controls.modelSource.textContent='Factory';this.renderBrowser();}catch(error){this.setModelStatus({status:'error',error:error.message});}}});}
  async addExternal(text,name){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');const asset=addExternalAsset(this._assets,{id:`external:${hash}`,filename:name,relativePath:name,groups:['External'],displayName:name.replace(/\.nam$/i,''),type:'nam',source:'External',data:text});asset.data=text;this._selectedId=asset.id;this.controls.modelSource.textContent='External';this.setSourceFilter('External');this.renderBrowser();}
  destroy() { this.node.removeEventListener('wam-automation', this._automation); this.node.removeMeterListener(this._meterListener); this.node.removeModelListener(this._modelListener); window.removeEventListener('message', this._toneMessage); window.removeEventListener('storage', this._toneStorageMessage); this.removeEventListener('keydown', this._escapeListener); this._toneChannel?.close(); this._tonePopup?.close(); this.node.gui = null; }
}

if (!customElements.get('nam-a2-gui')) customElements.define('nam-a2-gui', NamA2Gui);
export const createElement = async (plugin) => new NamA2Gui().initialize(plugin);
