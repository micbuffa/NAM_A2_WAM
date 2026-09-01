import {buildAssetTree} from '../shared/assetBrowser.js';

const manifestUrl = new URL('./irs-manifest.json', import.meta.url);

class CabinetGui extends HTMLElement {
  async initialize(plugin) {
    this.node = plugin.audioNode;
    this.node.gui = this;
    this.innerHTML = `
      <style>
        nam-cabinet-gui { --cab-accent:#62c8aa; display:block;min-width:0;color:#f0f4f2;font:13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif }
        nam-cabinet-gui * { box-sizing:border-box } nam-cabinet-gui button,nam-cabinet-gui input,nam-cabinet-gui select { font:inherit }
        nam-cabinet-gui button,nam-cabinet-gui select,nam-cabinet-gui input[type=search] { color:#eef4f1;background:#0e1211;border:1px solid #35423e;border-radius:8px }
        nam-cabinet-gui button { min-height:34px;padding:0 12px;cursor:pointer } nam-cabinet-gui button:hover { border-color:#527c70;background:#17211e }
        nam-cabinet-gui button:focus-visible,nam-cabinet-gui input:focus-visible,nam-cabinet-gui select:focus-visible,nam-cabinet-gui summary:focus-visible { outline:2px solid var(--cab-accent);outline-offset:2px }
        nam-cabinet-gui .cab-module { overflow:hidden;background:linear-gradient(145deg,#222a27,#171d1b 58%,#111514);border:1px solid #394b45;border-radius:15px;box-shadow:0 18px 44px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.035) }
        nam-cabinet-gui .module-head { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-bottom:1px solid #34413d;background:rgba(6,10,9,.3) }
        nam-cabinet-gui .module-title { display:flex;align-items:center;gap:10px } nam-cabinet-gui .module-mark { display:grid;place-items:center;width:31px;height:31px;color:#101815;background:var(--cab-accent);border-radius:8px;font-weight:900;box-shadow:0 0 18px rgba(98,200,170,.18) }
        nam-cabinet-gui h2 { margin:0;font-size:16px;letter-spacing:.02em } nam-cabinet-gui .module-subtitle { display:block;color:#7e928c;font-size:9px;letter-spacing:.15em;text-transform:uppercase }
        nam-cabinet-gui .bypass-label { display:flex;align-items:center;gap:7px;color:#9dafaa;font-size:10px;letter-spacing:.08em;text-transform:uppercase } nam-cabinet-gui input[type=checkbox] { accent-color:var(--cab-accent) }
        nam-cabinet-gui .cab-main { padding:18px 16px } nam-cabinet-gui .current-ir { padding:15px 16px;background:rgba(5,9,8,.46);border:1px solid #30403b;border-radius:12px;text-align:center }
        nam-cabinet-gui .eyebrow { margin:0 0 7px;color:#71847e;font-size:9px;font-weight:800;letter-spacing:.15em;text-transform:uppercase }
        nam-cabinet-gui .currentIr { display:block;overflow:hidden;color:#fff;font-size:16px;text-overflow:ellipsis;white-space:nowrap } nam-cabinet-gui .ir-chips { display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin-top:9px }
        nam-cabinet-gui .chip { padding:3px 7px;color:#adc0ba;background:#1d2724;border:1px solid #33443f;border-radius:999px;font-size:9px;letter-spacing:.06em;text-transform:uppercase } nam-cabinet-gui .chip.source { color:#9ce4cf;border-color:#477467 }
        nam-cabinet-gui .routing-row { display:grid;grid-template-columns:108px 1fr;gap:10px;align-items:center;margin-top:12px } nam-cabinet-gui .routing-row label { display:grid;gap:5px;color:#81948e;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase }
        nam-cabinet-gui .routingMode { min-height:38px;padding:0 8px;font-weight:800 } nam-cabinet-gui .routingStatus { margin:0;padding:9px 10px;color:#b9cbc5;background:#111815;border:1px solid #2f3e39;border-radius:8px;font-size:10px;line-height:1.35 }
        nam-cabinet-gui .control-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px } nam-cabinet-gui .control { display:grid;gap:7px;min-width:0;padding:10px;background:rgba(7,11,10,.35);border:1px solid #2e3c38;border-radius:10px;color:#849791;font-size:9px;font-weight:800;letter-spacing:.1em;text-align:center;text-transform:uppercase }
        nam-cabinet-gui .control output { color:#f0f5f3;font-size:13px;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums } nam-cabinet-gui .control input[type=range] { width:100%;accent-color:var(--cab-accent) }
        nam-cabinet-gui .level-control { align-content:center } nam-cabinet-gui .level-toggle { display:flex;justify-content:center;align-items:center;gap:6px;color:#dce8e4;font-size:11px;letter-spacing:0;text-transform:none }
        nam-cabinet-gui .reset { min-height:27px;padding:0 7px;color:#9aaca6;font-size:9px }
        nam-cabinet-gui .drawer { border-top:1px solid #33403c;background:rgba(6,9,8,.35) } nam-cabinet-gui .drawer>summary { padding:11px 16px;color:#98aaa4;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;list-style-position:inside }
        nam-cabinet-gui .drawer[open]>summary { color:#dbe8e4;border-bottom:1px solid #303b38 } nam-cabinet-gui .drawer-body { padding:13px 16px 16px }
        nam-cabinet-gui .source-tabs { display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px } nam-cabinet-gui .sourceTab[aria-pressed=true] { color:#10201b;background:var(--cab-accent);border-color:var(--cab-accent);font-weight:800 }
        nam-cabinet-gui .browser-tools { display:flex;gap:8px;margin-bottom:10px } nam-cabinet-gui .search { min-width:0;flex:1;height:36px;padding:0 10px } nam-cabinet-gui .file-action { display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;color:#d8e3df;background:#0e1211;border:1px solid #35423e;border-radius:8px;cursor:pointer;white-space:nowrap } nam-cabinet-gui .file { position:absolute;width:1px;height:1px;opacity:0;pointer-events:none }
        nam-cabinet-gui .browser { max-height:235px;overflow:auto;padding:7px;background:#0b100e;border:1px solid #2d3a36;border-radius:9px;scrollbar-width:thin } nam-cabinet-gui .browser:empty::after { content:'No IRs in this source';display:block;padding:14px;color:#64736e;text-align:center }
        nam-cabinet-gui .asset-entry { display:block;width:100%;min-height:29px;margin:2px 0;padding:4px 8px;overflow:hidden;color:#b1c0bb;background:transparent;border-color:transparent;text-align:left;text-overflow:ellipsis;white-space:nowrap } nam-cabinet-gui .asset-entry:hover { background:#19231f } nam-cabinet-gui .asset-entry.selected { color:#fff;background:#28594b;border-color:#4c8a78 }
        nam-cabinet-gui .browser details { margin-left:7px } nam-cabinet-gui .browser summary { padding:4px;color:#899b95;cursor:pointer;font-size:11px }
        nam-cabinet-gui .status { min-height:50px;margin:0;padding:10px;color:#a6b8b2;background:#0b100e;border-radius:8px;white-space:pre-line;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace }
        @media(max-width:520px){nam-cabinet-gui .routing-row{grid-template-columns:1fr}nam-cabinet-gui .control-grid{grid-template-columns:1fr}nam-cabinet-gui .browser-tools{flex-direction:column}}
      </style>
      <section class="cab-module">
        <header class="module-head">
          <div class="module-title"><span class="module-mark">C</span><div><h2>Cabinet</h2><span class="module-subtitle">Impulse response</span></div></div>
          <label class="bypass-label"><input class="bypass" type="checkbox"> Bypass</label>
        </header>
        <div class="cab-main">
          <section class="current-ir" aria-live="polite"><p class="eyebrow">Current IR</p><strong class="currentIr">No IR loaded</strong><div class="ir-chips"><span class="chip source irSource">—</span><span class="chip irFormat">48 kHz ready</span></div></section>
          <div class="routing-row"><label>Routing mode<select class="routingMode"><option value="auto">AUTO</option><option value="on">ON</option><option value="bypass">BYPASS</option></select></label><p class="routingStatus">AUTO · Cabinet active · no model loaded</p></div>
          <div class="control-grid">
            <div class="control level-control">Level match<label class="level-toggle"><input class="levelMatch" type="checkbox" checked> Enabled</label><output class="compensation">0.0 dB</output></div>
            <label class="control">IR trim <output class="trimValue">0.0 dB</output><input class="trim" type="range" min="-12" max="12" step="0.1" value="0"><button class="reset" type="button">Reset</button></label>
            <label class="control">Output gain <output class="outputGainValue">0.0 dB</output><input class="outputGain" type="range" min="-24" max="12" step="0.1" value="0"></label>
          </div>
        </div>
        <details class="drawer irDrawer"><summary>IRs & sources</summary><div class="drawer-body">
          <div class="source-tabs" role="group" aria-label="IR source"><button class="sourceTab" data-source="Factory" type="button" aria-pressed="true">Factory</button><button class="sourceTab" data-source="External" type="button" aria-pressed="false">External</button></div>
          <div class="browser-tools"><input class="search" type="search" aria-label="Search impulse responses" placeholder="Search IRs…"><label class="file-action">Load .wav file…<input class="file" type="file" accept=".wav,audio/wav"></label></div><div class="browser"></div>
        </div></details>
        <details class="drawer detailsDrawer"><summary>IR details</summary><div class="drawer-body"><p class="status">No IR loaded</p></div></details>
      </section>`;

    this.c = {
      search:this.querySelector('.search'), browser:this.querySelector('.browser'), file:this.querySelector('.file'),
      levelMatch:this.querySelector('.levelMatch'), compensation:this.querySelector('.compensation'),
      trim:this.querySelector('.trim'), trimValue:this.querySelector('.trimValue'), outputGain:this.querySelector('.outputGain'),
      outputGainValue:this.querySelector('.outputGainValue'), bypass:this.querySelector('.bypass'),
      currentIr:this.querySelector('.currentIr'), irSource:this.querySelector('.irSource'), irFormat:this.querySelector('.irFormat'),
      routingMode:this.querySelector('.routingMode'), routingStatus:this.querySelector('.routingStatus'),
      sourceTabs:[...this.querySelectorAll('.sourceTab')],
    };
    this.assets = []; this.selectedId = ''; this.sourceFilter = 'Factory';
    this.c.search.oninput = () => this.render();
    this.c.sourceTabs.forEach((button) => button.onclick = () => this.setSourceFilter(button.dataset.source));
    this.c.file.onchange = async (event) => { const file = event.target.files[0]; if (!file) return; try { const bytes=await file.arrayBuffer(); await this.loadBytes(bytes,file.name,`external:${await this.hash(bytes)}`); this.setSourceFilter('External'); } catch (error) { this.setStatus(`Error: ${error.message}`); } };
    this.c.levelMatch.onchange = (event) => this.set('levelMatch', event.target.checked ? 1 : 0);
    this.c.trim.oninput = async (event) => this.syncTrim(await this.node.setIrTrimDb(Number(event.target.value)));
    this.querySelector('.reset').onclick = async () => this.syncTrim(await this.node.setIrTrimDb(0));
    this.c.outputGain.oninput = (event) => this.set('outputGain', Number(event.target.value));
    this.c.bypass.onchange = (event) => this.set('bypass', event.target.checked ? 1 : 0);
    this.c.routingMode.onchange = async () => { const mode=this.c.routingMode.value; const event=new CustomEvent('cabinet-routing-mode',{bubbles:true,cancelable:true,detail:{mode}}); const handled=!this.dispatchEvent(event); if(!handled&&mode!=='auto')await this.set('bypass',mode==='bypass'?1:0); };
    this._escapeListener = (event) => { if (event.key === 'Escape') this.querySelectorAll('.drawer[open]').forEach((details) => { details.open=false; }); };
    this.addEventListener('keydown', this._escapeListener);
    this._automation = (event) => this.syncParameter(event.detail.data);
    this.node.addEventListener('wam-automation', this._automation);
    this.syncParameters(await this.node.getParameterValues(false));
    this.loadManifest();
    return this;
  }

  set(id,value) { return this.node.setParameterValues({[id]:{id,value,normalized:false}}); }
  getRoutingMode() { return this.c.routingMode.value; }
  setRoutingStatus(mode,text) { this.c.routingMode.value=mode; this.c.routingStatus.textContent=text.replace(/^Cabinet (AUTO|ON|BYPASS): (active|bypassed)/u,'$1 · Cabinet $2'); }
  setSourceFilter(source) { this.sourceFilter=source; this.c.sourceTabs.forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.source===source))); this.render(); }
  async hash(buffer) { const digest=await crypto.subtle.digest('SHA-256',buffer); return [...new Uint8Array(digest)].map((value)=>value.toString(16).padStart(2,'0')).join(''); }
  async loadBytes(bytes,name,id) { const retained=id.startsWith('external:')?bytes.slice(0):null;const buffer=await this.node.context.decodeAudioData(bytes); await this.node.loadImpulseResponse(buffer.getChannelData(0),name,id); if(id.startsWith('external:')){let asset=this.assets.find((entry)=>entry.id===id);if(!asset){asset={id,filename:name,relativePath:name,groups:['External'],displayName:name.replace(/\.wav$/iu,''),type:'ir',source:'External',bytes:retained};this.assets.push(asset);}asset.bytes=retained;}this.selectedId=id;this.render(); }
  async loadManifest() { try { const response=await fetch(manifestUrl);if(!response.ok)throw Error(`HTTP ${response.status}`);this.assets=(await response.json()).assets||[];const state=await this.node.getState();if(state.ir&&!this.assets.some((asset)=>asset.id===state.ir.id)){this.assets.push({id:state.ir.id||`external:${state.ir.name}`,filename:state.ir.name,relativePath:state.ir.name,groups:['External'],displayName:state.ir.name.replace(/\.wav$/iu,''),type:'ir',source:'External'});this.selectedId=state.ir.id;}this.render(); } catch(error) { this.setStatus(`Factory library unavailable: ${error.message}`); } }
  async select(asset) { try { if(asset.source==='External'||asset.id.startsWith('external:')){if(!asset.bytes)throw Error('External IR data is unavailable in this session');await this.loadBytes(asset.bytes,asset.filename,asset.id);return;}const response=await fetch(new URL(`IRs/${asset.relativePath}`,manifestUrl));if(!response.ok)throw Error(`HTTP ${response.status}`);await this.loadBytes(await response.arrayBuffer(),asset.filename,asset.id); } catch(error) { this.setStatus(`Error: ${error.message}`); } }
  render() { const assets=this.assets.filter((asset)=>this.sourceFilter==='External'?asset.source==='External'||asset.id.startsWith('external:'):asset.source!=='External'&&!asset.id.startsWith('external:'));buildAssetTree(this.c.browser,assets,{search:this.c.search.value,selectedId:this.selectedId,onSelect:(asset)=>this.select(asset)}); }
  syncTrim(value) { this.c.trim.value=value;this.c.trimValue.textContent=`${Number(value).toFixed(1)} dB`; }
  syncParameter({id,value}) { if(id==='levelMatch'||id==='bypass')this.c[id].checked=value>=.5;else if(id==='irTrim')this.syncTrim(value);else if(id==='outputGain'){this.c.outputGain.value=value;this.c.outputGainValue.textContent=`${Number(value).toFixed(1)} dB`;} }
  syncParameters(values) { Object.values(values).forEach((value)=>this.syncParameter(value)); }
  setStatus(status) { this.querySelector('.status').textContent=status; }
  setIrStatus(name,result,analysis,trim=0) { this.selectedId=this.node._ir?.id||this.selectedId;const asset=this.assets.find((entry)=>entry.id===this.selectedId);this.c.currentIr.textContent=name.replace(/\.wav$/iu,'');this.c.irSource.textContent=asset?.source==='External'||this.selectedId.startsWith('external:')?'External':'Factory';this.c.irFormat.textContent=`${result.sampleRate/1000} kHz`;this.c.compensation.textContent=`${analysis.compensationDb.toFixed(1)} dB${analysis.clamped?' (clamped)':''}`;this.syncTrim(trim);this.setStatus(`${name}\n${result.length.toLocaleString()} samples @ ${result.sampleRate} Hz`);this.render(); }
  destroy() { this.node.removeEventListener('wam-automation',this._automation);this.removeEventListener('keydown',this._escapeListener);this.node.gui=null; }
}

if (!customElements.get('nam-cabinet-gui')) customElements.define('nam-cabinet-gui', CabinetGui);
export const createElement = async (plugin) => new CabinetGui().initialize(plugin);
