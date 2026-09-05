import {buildAssetTree, addExternalAsset, factoryAssetUrl} from '../shared/assetBrowser.js';
import Tone3000Client from './tone3000/Tone3000Client.js';
import Tone3000Downloads from './tone3000/Tone3000Downloads.js';
import ModelFavorites from './ModelFavorites.js';
import {createFactoryBundle, createZip, downloadBlob} from './tone3000/FactoryBundle.js';
import {TONE3000_CALLBACK_CHANNEL, TONE3000_CALLBACK_STORAGE_KEY} from './tone3000/Tone3000Auth.js';
const manifestUrl = new URL('./models-manifest.json', import.meta.url);
const tone3000Origin = 'https://www.tone3000.com';
const tone3000LogoUrl = new URL('./tone3000/TONE3000-logo.svg', import.meta.url).href;
const maintainerStorageKey = 'nam-a2-wam.tone3000.maintainer-kind';
const modelVariantStorageKey = 'nam-a2-wam.model-variant';
const autoLevelStorageKey = 'nam-a2-wam.auto-level';
const measuredLevelsStorageKey = 'nam-a2-wam.measured-levels.v1';
const EQ_BANDS = [
  {index:1, name:'Low', type:'Low shelf', frequency:100, q:.71}, {index:2, name:'Mud', type:'Bell', frequency:250, q:1},
  {index:3, name:'Box', type:'Bell', frequency:650, q:1}, {index:4, name:'Presence', type:'Bell', frequency:1600, q:1},
  {index:5, name:'Bite', type:'Bell', frequency:3500, q:1.4}, {index:6, name:'High', type:'High shelf', frequency:8000, q:.71},
];
const EQ_BAND_COLORS = ['#ff596f','#ff9f43','#f7d154','#42d392','#55b8ff','#b786ff'];
const knobMarkup = (id, label, min, max, step, value, unit = '', size = 'normal') => `
  <label class="knob-control ${size}" data-knob-for="${id}"><span class="knob-label">${label}</span>
    <span class="knob-shell"><span class="knob-face"><span class="knob-pointer"></span></span><input class="${id} knob-input" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-default="${value}" aria-label="${label}"></span>
    <output class="${id}Value" data-unit="${unit}">${value}${unit}</output>
  </label>`;

const neuralWampLogoMarkup = `
  <svg class="module-logo" viewBox="0 0 126 40" role="img" aria-label="NeuralWAMp">
    <rect class="logo-badge" x="1" y="2" width="36" height="36" rx="10"/>
    <path class="logo-wave" d="M6 23h4c2.8 0 2.8-11 5.6-11s2.8 17 5.7 17c2.8 0 2.8-13 5.6-13s2.8 7 5.6 7H36"/>
    <g class="logo-nodes"><circle cx="10" cy="23" r="2.1"/><circle cx="15.6" cy="12" r="2.1"/><circle cx="21.3" cy="29" r="2.1"/><circle cx="26.9" cy="16" r="2.1"/><circle cx="32.5" cy="23" r="2.1"/></g>
    <g class="logo-word"><path d="M44 10l5 20 6-13 6 13 5-20"/><path d="M69 30l8-20 8 20M72.5 22h9"/><path d="M90 30V10l9 14 9-14v20"/></g>
    <path class="logo-p" d="M114 31V17h5.3c3.8 0 5.7 2.1 5.7 5.1s-2 5.1-5.7 5.1H114m4.4-6.9h.8c1.3 0 1.9.6 1.9 1.8s-.6 1.8-1.9 1.8h-.8"/>
  </svg>`;

const getToneImageUrl = (tone) => {
  const candidate = Array.isArray(tone?.images) ? tone.images.find((image) => typeof image === 'string' && image.trim()) : '';
  if (!candidate) return '';
  try {
    const url = new URL(candidate, tone3000Origin);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
};

const factoryImageUrl = (asset) => asset?.imagePath ? factoryAssetUrl(manifestUrl,'models',asset.imagePath).href : '';
const factoryProvenance = (asset) => ({
  ...(asset.provenance || {}), identity: asset.id, source: 'Factory',
  provider: asset.provenance?.provider || 'Local', title: asset.provenance?.title || asset.metadata?.name || asset.displayName,
  creator: asset.provenance?.creator || asset.metadata?.modeled_by,
  gear: asset.provenance?.gear || asset.metadata?.gear_type,
  imageUrl: factoryImageUrl(asset), metadata: asset.metadata || {},
});

const metadataDate = (value) => {
  if (!value || typeof value !== 'object' || !value.year) return '';
  const month = String(value.month || 1).padStart(2, '0');
  const day = String(value.day || 1).padStart(2, '0');
  return `${value.year}-${month}-${day}`;
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
        nam-a2-gui .nam-module { overflow:hidden; background:linear-gradient(145deg,#25232b,#17171c 55%,#121217); border:1px solid #403b49; border-radius:15px; box-shadow:0 18px 44px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.04);transition:background .18s,border-color .18s,filter .18s }
        nam-a2-gui .nam-module.is-bypassed { background:linear-gradient(145deg,#352126,#21171a 55%,#171114);border-color:#b45160;filter:saturate(.72) } nam-a2-gui .nam-module.is-bypassed .module-head { background:#351b21;border-bottom-color:#723743 } nam-a2-gui .nam-module.is-bypassed .module-logo { filter:hue-rotate(72deg) saturate(1.45);opacity:.9 } nam-a2-gui .nam-module.is-bypassed .bypass-label { color:#ffb2bc;font-weight:850 }
        nam-a2-gui .module-head { display:grid;grid-template-columns:94px minmax(0,1fr) 94px;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #393540;background:rgba(9,9,12,.28) }
        nam-a2-gui .module-logo { display:block;width:94px;height:31px;overflow:visible;justify-self:start;filter:drop-shadow(0 0 7px rgba(166,136,255,.2));transition:filter .18s,opacity .18s } nam-a2-gui .logo-badge { fill:#17131d;stroke:#6f58aa } nam-a2-gui .logo-wave { fill:none;stroke:#a688ff;stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round } nam-a2-gui .logo-nodes { fill:#e8e0ff;stroke:#6f58aa;stroke-width:1 } nam-a2-gui .logo-word { fill:none;stroke:#eee9ff;stroke-width:5.2;stroke-linecap:round;stroke-linejoin:round } nam-a2-gui .logo-p { fill:none;stroke:#a688ff;stroke-width:2.7;stroke-linecap:round;stroke-linejoin:round }
        nam-a2-gui .module-identity { min-width:0;text-align:center } nam-a2-gui .module-name-row { display:flex;align-items:baseline;justify-content:center;min-width:0 } nam-a2-gui h2 { margin:0;font-size:16px;letter-spacing:.02em } nam-a2-gui .module-author { display:block;margin-top:2px;color:#a99bc0;font-size:9px;font-weight:700;text-decoration:none;white-space:nowrap } nam-a2-gui .module-author:hover { color:#d9ccf0;text-decoration:underline } nam-a2-gui .module-subtitle { display:block;color:#898391;font-size:9px;letter-spacing:.15em;text-transform:uppercase }
        nam-a2-gui .bypass-label { display:flex;align-items:center;justify-self:end;gap:7px;color:#aaa3b4;font-size:10px;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .bypass { accent-color:var(--nam-accent) }
        nam-a2-gui .signal-flow { display:flex;align-items:center;justify-content:center;gap:4px;overflow-x:auto;padding:8px 10px;border-bottom:1px solid #34303b;background:#111016;scrollbar-width:thin }
        nam-a2-gui .flow-stage { display:flex;align-items:center;gap:5px;min-width:max-content;padding:4px 6px;color:#ded7e8;background:#24202b;border:1px solid #4c435b;border-radius:999px;font-size:8px;font-weight:850;letter-spacing:.07em;text-transform:uppercase;transition:opacity .15s,border-color .15s,background .15s }
        nam-a2-gui .flow-stage::before { content:'';width:5px;height:5px;background:#8fdc9d;border-radius:50%;box-shadow:0 0 6px rgba(103,227,154,.45) } nam-a2-gui .flow-stage.amp { color:#eee6ff;background:#302544;border-color:#70579a } nam-a2-gui .flow-stage.eq { color:#ffd28c;background:#332716;border-color:#806130 } nam-a2-gui .flow-stage.tone { color:#bbf0cf;background:#182a20;border-color:#3b684c }
        nam-a2-gui .flow-stage.off { color:#756f7c;background:#16151a;border-color:#302d35;text-decoration:line-through;opacity:.62 } nam-a2-gui .flow-stage.off::before { background:#716a77;box-shadow:none } nam-a2-gui .flow-stage small { color:inherit;font-size:7px;opacity:.72 } nam-a2-gui .flow-arrow { color:#655d6d;font-size:10px }
        nam-a2-gui .signal-strip { display:grid;grid-template-columns:44px minmax(96px,.65fr) minmax(180px,1.45fr) minmax(96px,.65fr) 44px;gap:12px;align-items:center;padding:18px 16px }
        nam-a2-gui .meter { display:grid;grid-template-rows:auto 96px auto;justify-items:center;gap:5px;min-width:0 } nam-a2-gui .meter-label { color:#9a94a1;font-size:9px;font-weight:800;letter-spacing:.14em }
        nam-a2-gui .meter-track { position:relative;width:10px;height:96px;overflow:hidden;background:#08090a;border:1px solid #45404a;border-radius:7px }
        nam-a2-gui .meter-fill { position:absolute;inset:auto 0 0;height:0;background:linear-gradient(0deg,#58c66a 0 68%,#e1bb4c 84%,#e45b66 100%);transition:height 80ms linear }
        nam-a2-gui .clip { color:#68636f;font-size:8px;font-weight:800 } nam-a2-gui .clip.active { color:#ff6472 }
        nam-a2-gui .meter-values { position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0) }
        nam-a2-gui .knob-control { display:grid;justify-items:center;gap:5px;min-width:0;color:#9e98a7;font-size:9px;font-weight:750;text-align:center;text-transform:uppercase;letter-spacing:.08em;user-select:none } nam-a2-gui .knob-shell { position:relative;display:block;width:62px;height:62px } nam-a2-gui .knob-face { position:absolute;inset:3px;border:1px solid #5a5364;border-radius:50%;background:radial-gradient(circle at 38% 30%,#4b4653 0 7%,#292630 35%,#111116 72%);box-shadow:inset 0 0 0 4px #18171c,0 5px 12px rgba(0,0,0,.38) } nam-a2-gui .knob-face::before { content:'';position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 225deg,var(--nam-accent) var(--knob-sweep,135deg),#3c3744 0 270deg,transparent 0);mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0) } nam-a2-gui .knob-pointer { position:absolute;left:50%;top:7px;width:2px;height:18px;background:#eee9f6;border-radius:2px;transform:translateX(-50%) rotate(var(--knob-angle,0deg));transform-origin:50% 21px;box-shadow:0 0 4px rgba(255,255,255,.4) } nam-a2-gui .knob-input { position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ns-resize;touch-action:none } nam-a2-gui .knob-control:focus-within .knob-face { outline:2px solid var(--nam-accent);outline-offset:3px } nam-a2-gui .knob-control output { color:#f2edf8;font-size:11px;font-weight:750;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums }
        nam-a2-gui .tone-strip { display:grid;grid-template-columns:auto repeat(4,minmax(62px,1fr)) auto;gap:12px;align-items:center;padding:14px 16px;border-top:1px solid #393540;background:rgba(9,9,12,.24) } nam-a2-gui .section-switch { display:grid;justify-items:center;gap:5px;color:#aaa3b4;font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase } nam-a2-gui .section-switch input { accent-color:var(--nam-accent) } nam-a2-gui .eqButton[aria-expanded=true] { color:#18131f;background:var(--nam-accent);border-color:var(--nam-accent);font-weight:850 }
        nam-a2-gui .eq-panel { padding:14px 16px;border-top:1px solid #484052;background:#100f14 } nam-a2-gui .eq-toolbar { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px } nam-a2-gui .eq-toolbar-group { display:flex;align-items:center;gap:9px;flex-wrap:wrap;color:#aaa3b4;font-size:10px } nam-a2-gui .eq-toolbar input { accent-color:var(--nam-accent) } nam-a2-gui .eqPosition { min-height:32px;padding:0 8px } nam-a2-gui .eq-spectrum-legend { display:flex;align-items:center;gap:8px;color:#8d8693;font-size:9px } nam-a2-gui .eq-spectrum-legend span::before { content:'';display:inline-block;width:14px;margin-right:4px;border-top:2px solid;vertical-align:middle } nam-a2-gui .eq-spectrum-legend .input::before { border-color:#93a1b7;border-top-style:dashed } nam-a2-gui .eq-spectrum-legend .filtered::before { border-color:#ffb04a } nam-a2-gui .eq-spectrum-legend .final::before { border-color:#67e39a } nam-a2-gui .eq-graph-wrap { overflow:hidden;background:#09090c;border:1px solid #393541;border-radius:11px } nam-a2-gui .eqGraph { display:block;width:100%;height:250px;cursor:crosshair;touch-action:none;transition:opacity .15s } nam-a2-gui .eqGraph.disabled { opacity:.62 } nam-a2-gui .eq-spectrum-input-fill { fill:url(#namSpectrumInputFill);pointer-events:none } nam-a2-gui .eq-spectrum { fill:url(#namSpectrumFill);pointer-events:none;transition:opacity .12s linear } nam-a2-gui .eq-spectrum-input-line,nam-a2-gui .eq-spectrum-filtered-line,nam-a2-gui .eq-spectrum-final-line { fill:none;vector-effect:non-scaling-stroke;pointer-events:none } nam-a2-gui .eq-spectrum-input-line { stroke:#aab7ca;stroke-width:1.4;stroke-dasharray:5 4;stroke-opacity:.78 } nam-a2-gui .eq-spectrum-filtered-line { stroke:#ffb04a;stroke-width:1.7;stroke-opacity:.94 } nam-a2-gui .eq-spectrum-final-line { stroke:#67e39a;stroke-width:1.8;stroke-opacity:.92 } nam-a2-gui .eq-grid-line { stroke:#302d35;stroke-width:1 } nam-a2-gui .eq-zero-line { stroke:#77717d;stroke-width:1.4 } nam-a2-gui .eq-grid-label,nam-a2-gui .eq-axis-label { fill:#817a88;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none } nam-a2-gui .eq-axis-label.spectrum { fill:#686273;font-size:9px } nam-a2-gui .eq-band-curve { fill:none;stroke-width:1.45;stroke-opacity:.5;vector-effect:non-scaling-stroke;pointer-events:none } nam-a2-gui .eq-band-curve.selected { stroke-width:2.4;stroke-opacity:.92 } nam-a2-gui .eq-curve-fill { fill:url(#namEqFill) } nam-a2-gui .eq-curve { fill:none;stroke:#f3eef8;stroke-width:2.2;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 3px rgba(255,255,255,.18)) } nam-a2-gui .eq-node { stroke:#09090c;stroke-width:3;cursor:grab;vector-effect:non-scaling-stroke } nam-a2-gui .eq-node:hover,nam-a2-gui .eq-node.selected { fill:#fff;stroke-width:4 } nam-a2-gui .eq-node:focus { outline:none;stroke:#fff } nam-a2-gui .eq-node.dragging { cursor:grabbing } nam-a2-gui .eq-readout { display:flex;align-items:end;gap:8px;flex-wrap:wrap;padding:10px;background:#17151c;border-top:1px solid #34303b } nam-a2-gui .eq-band-name { min-width:118px;color:#eee9f4;font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.08em } nam-a2-gui .eq-band-name small { display:block;margin-top:2px;color:#9c94a4;font-size:8px;letter-spacing:.12em } nam-a2-gui .eq-value { display:grid;gap:3px;color:#827b8a;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .eq-value input { width:86px;height:31px;padding:0 7px;color:#fff;background:#22202a;border:1px solid #403b49;border-radius:6px;font:11px ui-monospace,SFMono-Regular,Menlo,monospace } nam-a2-gui .eq-hint { margin:0 0 0 auto;color:#746d7b;font-size:9px }
        nam-a2-gui .current-model { min-width:0;padding:15px 16px;text-align:center;background:rgba(8,8,11,.48);border:1px solid #36323d;border-radius:12px }
        nam-a2-gui .currentModelArtwork { position:relative;width:86px;height:68px;margin:0 auto 9px;overflow:hidden;background:#0d0d11;border:1px solid #443d4d;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.3) }
        nam-a2-gui .currentToneImage { display:block;width:100%;height:100%;object-fit:contain }
        nam-a2-gui .currentModelFallback { display:grid;width:100%;height:100%;place-content:center;padding:7px;background:radial-gradient(circle at 75% 20%,#4b3a69,#18141f 64%);text-align:center } nam-a2-gui .currentModelFallback strong { color:#e9ddff;font-size:11px;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .currentModelFallback small { overflow:hidden;max-width:70px;color:#a99cba;font-size:8px;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .eyebrow { margin:0 0 7px;color:#797381;font-size:9px;font-weight:800;letter-spacing:.15em;text-transform:uppercase }
        nam-a2-gui .currentModel { display:block;overflow:hidden;color:#fff;font-size:16px;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .model-chips { display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin-top:9px } nam-a2-gui .chip { padding:3px 7px;color:#bbb4c5;background:#24212a;border:1px solid #3a3543;border-radius:999px;font-size:9px;letter-spacing:.06em;text-transform:uppercase }
        nam-a2-gui .chip.source { color:#c7b8fb;border-color:#5d4f7e } nam-a2-gui .chip.modelLevel { color:#8ee6a0;background:#142419;border-color:#376b43;font-variant-numeric:tabular-nums } nam-a2-gui .chip.modelLevel.inactive { color:#ff9da9;background:#2a171b;border-color:#6e3941 } nam-a2-gui .drawer { border-top:1px solid #37333d;background:rgba(9,9,12,.36) }
        nam-a2-gui .level-actions { display:flex;justify-content:center;gap:6px;margin-top:9px } nam-a2-gui .level-actions button { min-height:27px;padding:0 9px;font-size:9px } nam-a2-gui .calibrateLevel { color:#dcccff;border-color:#655481 } nam-a2-gui .calibrateLevel:disabled { color:#6d6873;cursor:default;border-color:#35313b }
        nam-a2-gui .drawer>summary { padding:11px 16px;color:#aaa3b4;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;list-style-position:inside }
        nam-a2-gui .drawer[open]>summary { color:#ddd6e8;border-bottom:1px solid #332f39 } nam-a2-gui .drawer-body { padding:13px 16px 16px }
        nam-a2-gui .source-tabs { display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px } nam-a2-gui .sourceTab[aria-pressed=true] { color:#19151f;background:var(--nam-accent);border-color:var(--nam-accent);font-weight:800 }
        nam-a2-gui .factoryCategories { display:flex;gap:5px;overflow-x:auto;margin:-2px 0 10px;padding:2px 0;scrollbar-width:thin } nam-a2-gui .factoryCategory { min-height:28px;padding:0 9px;border-radius:999px;color:#9f98a9;font-size:9px;white-space:nowrap } nam-a2-gui .factoryCategory[aria-pressed=true] { color:#17131d;background:#c9b7ff;border-color:#c9b7ff;font-weight:850 }
        nam-a2-gui .browser-tools { display:flex;gap:8px;margin-bottom:10px } nam-a2-gui .modelSearch { min-width:0;flex:1;height:36px;padding:0 10px }
        nam-a2-gui .file-action { display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;color:#d8cfdf;background:#101014;border:1px solid #3a3642;border-radius:8px;cursor:pointer;white-space:nowrap } nam-a2-gui .model { position:absolute;width:1px;height:1px;opacity:0;pointer-events:none }
        nam-a2-gui .modelBrowser { max-height:235px;overflow:auto;padding:7px;background:#0d0d11;border:1px solid #332f39;border-radius:9px;scrollbar-width:thin }
        nam-a2-gui .modelBrowser:empty::after { content:'No models in this source';display:block;padding:14px;color:#6f6976;text-align:center }
        nam-a2-gui .asset-entry { display:block;width:100%;min-height:29px;margin:2px 0;padding:4px 8px;overflow:hidden;color:#bbb5c3;background:transparent;border-color:transparent;text-align:left;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .asset-entry:hover { background:#211e27 } nam-a2-gui .asset-entry.selected { color:#fff;background:#493b66;border-color:#75619c }
        nam-a2-gui .factoryAsset { display:grid;grid-template-columns:48px minmax(0,1fr);gap:9px;align-items:center;min-height:68px;padding:6px;white-space:normal } nam-a2-gui .factoryAsset img,nam-a2-gui .factoryAssetVisual { width:48px;height:46px;object-fit:contain;background:#0b0a0e;border-radius:6px } nam-a2-gui .factoryAssetVisual { display:grid;place-items:center;padding:4px;color:#d8c8ff;background:radial-gradient(circle at 70% 20%,#4b3a69,#18141f 65%);font-size:8px;font-weight:850;text-align:center;text-transform:uppercase } nam-a2-gui .factoryAssetText { min-width:0 } nam-a2-gui .factoryAssetText strong,nam-a2-gui .factoryAssetText small { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryAssetText strong { color:#e6e0eb;font-size:10px } nam-a2-gui .factoryAssetText small { color:#8e8797;font-size:9px } nam-a2-gui .factoryAssetText .factoryAssetFilename { color:#b8aec4;font-family:ui-monospace,SFMono-Regular,Menlo,monospace }
        nam-a2-gui .factoryToneCard { display:grid;grid-template-columns:82px minmax(0,1fr);gap:10px;margin:3px;padding:8px;background:#15131a;border:1px solid #393342;border-radius:9px } nam-a2-gui .factoryToneArtwork,nam-a2-gui .factoryToneVisual { width:82px;height:68px;object-fit:contain;background:#0a090d;border-radius:7px } nam-a2-gui .factoryToneVisual { display:grid;place-items:center;color:#d8c8ff;background:radial-gradient(circle at 70% 20%,#4b3a69,#18141f 65%);font-size:9px;font-weight:850 } nam-a2-gui .factoryToneBody { min-width:0 } nam-a2-gui .factoryToneTitle { display:block;overflow:hidden;color:#f1ecf7;font-size:11px;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryToneMeta { display:block;overflow:hidden;margin:2px 0 5px;color:#8e8797;font-size:9px;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryCaptureList { display:grid;gap:2px;max-height:104px;overflow:auto;padding-right:3px;scrollbar-width:thin } nam-a2-gui .factoryCaptureRow,nam-a2-gui .assetRow { display:grid;grid-template-columns:minmax(0,1fr) 27px;gap:3px;align-items:center } nam-a2-gui .assetRow .asset-entry { min-width:0 } nam-a2-gui .factoryCapture { width:100%;min-width:0;min-height:25px;margin:0;padding:3px 7px;overflow:hidden;color:#c7becf;background:#0d0c11;border-color:#29252f;border-radius:5px;text-align:left;text-overflow:ellipsis;white-space:nowrap;font:9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace } nam-a2-gui .factoryCapture:hover { background:#211e27 } nam-a2-gui .factoryCapture.selected { color:#fff;background:#493b66;border-color:#856eb0 } nam-a2-gui .favoriteToggle { width:27px;min-width:27px;min-height:25px;padding:0;color:#8d8498;background:transparent;border-color:transparent;font-size:16px;line-height:1 } nam-a2-gui .favoriteToggle:hover,nam-a2-gui .favoriteToggle.active { color:#ffd45f;background:#292313;border-color:#69592b }
        nam-a2-gui .preferencesBody { display:grid;gap:12px } nam-a2-gui .preferenceRow { display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.55fr);gap:12px;align-items:center } nam-a2-gui .preferenceRow strong,nam-a2-gui .preferenceRow small { display:block } nam-a2-gui .preferenceRow small { margin-top:3px;color:#8e8797;font-size:10px } nam-a2-gui .a2Variant { min-height:36px;padding:0 8px } nam-a2-gui .autoLevel { justify-self:end;width:18px;height:18px;accent-color:var(--nam-accent) }
        nam-a2-gui .modelBrowser details { margin-left:7px } nam-a2-gui .modelBrowser summary { padding:4px;color:#958e9e;cursor:pointer;font-size:11px }
        nam-a2-gui .tone3000-panel { display:grid;gap:9px;margin-top:10px;padding:11px;background:#15131a;border:1px solid #3b3544;border-radius:9px } nam-a2-gui .tone3000-head { display:flex;justify-content:space-between;align-items:center;gap:8px }
        nam-a2-gui .tone3000Auth { display:grid;justify-items:center;gap:12px;padding:15px 10px;text-align:center } nam-a2-gui .tone3000Logo { display:block;width:min(210px,80%);height:auto;margin:2px auto 3px } nam-a2-gui .tone3000AuthTitle { margin:0;color:#f3f0f7;font-size:14px;font-weight:750 } nam-a2-gui .tone3000AuthCopy { max-width:360px;margin:0;color:#aaa3b1;font-size:11px;line-height:1.5 }
        nam-a2-gui .tone3000Status,nam-a2-gui .tone3000Tone { margin:0;color:#9992a1;font-size:10px;white-space:pre-line } nam-a2-gui .tone3000Selection { display:grid;gap:8px } nam-a2-gui .tone3000Image { display:block;width:auto;max-width:100%;height:auto;max-height:320px;margin:0 auto;object-fit:contain;background:#0d0d11;border:1px solid #443d4d;border-radius:9px } nam-a2-gui .tone3000Selection select { width:100%;min-height:34px;padding:0 8px }
        nam-a2-gui .tone3000Catalog { display:grid;gap:9px } nam-a2-gui .tone3000CatalogTools { display:flex;gap:6px;flex-wrap:wrap } nam-a2-gui .tone3000CatalogTools button[aria-pressed=true] { color:#19151f;background:var(--nam-accent);border-color:var(--nam-accent);font-weight:800 } nam-a2-gui .tone3000Gear { display:flex;gap:5px;overflow:auto;padding-bottom:2px } nam-a2-gui .tone3000Gear button { min-height:27px;padding:0 9px;border-radius:999px;font-size:10px;white-space:nowrap } nam-a2-gui .tone3000Cards { display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px;max-height:330px;overflow:auto;padding:2px } nam-a2-gui .toneCard { display:grid;gap:6px;min-width:0;padding:7px;color:#eee;background:#0d0d11;border:1px solid #332f39;border-radius:9px;text-align:left } nam-a2-gui .toneCard:hover { border-color:#776b91;background:#191620 } nam-a2-gui .toneCard img { display:block;width:100%;height:92px;object-fit:contain;background:#08080b;border-radius:6px } nam-a2-gui .toneCard strong { overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .toneCard small { overflow:hidden;color:#928b9d;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .tone3000Pager { display:flex;justify-content:space-between;align-items:center;gap:8px;color:#8f8898;font-size:10px }
        nam-a2-gui .tone3000Downloads { display:grid;gap:8px;margin-top:2px;padding-top:9px;border-top:1px solid #332f39 } nam-a2-gui .tone3000DownloadsHead { display:flex;align-items:center;justify-content:space-between;gap:8px } nam-a2-gui .tone3000DownloadsHead strong { font-size:10px;letter-spacing:.09em;text-transform:uppercase } nam-a2-gui .tone3000Clear { min-height:27px;color:#ffabb4;font-size:10px } nam-a2-gui .tone3000DownloadedList { display:grid;gap:6px;max-height:230px;overflow:auto } nam-a2-gui .tone3000DownloadedList:empty::after { content:'No model downloaded on this device';padding:9px;color:#756e7c;text-align:center;font-size:10px } nam-a2-gui .downloadedTone { display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px;background:#0d0d11;border:1px solid #332f39;border-radius:8px } nam-a2-gui .downloadedTone img,nam-a2-gui .downloadedToneVisual { width:52px;height:42px;object-fit:contain;background:#09090c;border-radius:5px } nam-a2-gui .downloadedToneVisual { display:grid;place-items:center;color:#d8c8ff;font-size:9px;font-weight:850 } nam-a2-gui .downloadedToneMeta { min-width:0 } nam-a2-gui .downloadedToneMeta strong,nam-a2-gui .downloadedToneMeta small { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .downloadedToneMeta strong { font-size:10px } nam-a2-gui .downloadedToneMeta small { color:#8f8898;font-size:9px } nam-a2-gui .downloadedToneActions { display:flex;gap:5px } nam-a2-gui .downloadedToneActions button { min-height:28px;padding:0 8px;font-size:9px } nam-a2-gui .downloadedToneDelete { color:#ffabb4 }
        nam-a2-gui .factoryMaintainer { display:grid;gap:9px;margin-top:2px;padding:10px;background:#111018;border:1px dashed #8067a8;border-radius:8px } nam-a2-gui .factoryMaintainer h3 { margin:0;color:#decfff;font-size:11px;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .factoryMaintainer p { margin:0;color:#9f96aa;font-size:10px } nam-a2-gui .factoryMaintainerActions { display:flex;gap:6px;flex-wrap:wrap } nam-a2-gui .factoryMaintainerModels { display:grid;gap:5px;max-height:190px;overflow:auto } nam-a2-gui .factoryMaintainerModel { display:flex;align-items:flex-start;gap:7px;padding:6px;background:#0c0b10;border-radius:6px;color:#c8c0ce;font-size:10px } nam-a2-gui .factoryMaintainerModel input { margin-top:2px;accent-color:var(--nam-accent) } nam-a2-gui .factoryMaintainerExport { color:#1b1521;background:var(--nam-accent);border-color:var(--nam-accent);font-weight:800 } nam-a2-gui .factoryMaintainerStatus { color:#b7adbf!important;white-space:pre-line }
        nam-a2-gui .powered { color:#6f6877;font-size:9px } nam-a2-gui .status { min-height:50px;margin:0;padding:10px;color:#aaa3b1;background:#0d0d11;border-radius:8px;white-space:pre-line;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace }
        nam-a2-gui .error { color:#ff9da9 }
        @media(max-width:720px){nam-a2-gui .tone-strip{grid-template-columns:repeat(3,1fr)}nam-a2-gui .eqGraph{height:210px}nam-a2-gui .eq-hint{width:100%;margin:0}nam-a2-gui .signal-flow{justify-content:flex-start}} @media(max-width:620px){nam-a2-gui .signal-strip{grid-template-columns:36px 1fr 36px;gap:9px}nam-a2-gui .current-model{grid-column:2}nam-a2-gui .input-control{grid-column:1/3;grid-row:2}nam-a2-gui .output-control{grid-column:2/4;grid-row:3}nam-a2-gui .meter[data-meter=output]{grid-column:3;grid-row:1}nam-a2-gui .browser-tools{flex-direction:column}}
      </style>
      <section class="nam-module">
        <header class="module-head">
          ${neuralWampLogoMarkup}<div class="module-identity"><div class="module-name-row"><h2>NeuralWAMp</h2></div><span class="module-subtitle">NAM A2 neural amplifier</span><a class="module-author" href="https://github.com/micbuffa" target="_blank" rel="noopener noreferrer">by @micbuffa</a></div>
          <label class="bypass-label"><input class="bypass" type="checkbox"> Bypass</label>
        </header>
        <div class="signal-flow" role="img" aria-label="Signal path"></div>
        <div class="signal-strip">
          <div class="meter" data-meter="input"><span class="meter-label">IN</span><div class="meter-track"><div class="meter-fill"></div></div><span class="clip">CLIP</span><div class="meter-values"><span class="peak">-∞ dBFS</span><span class="rms">RMS -∞</span></div></div>
          ${knobMarkup('inputGain','Input gain',-48,24,.1,0,' dB','input-control')}
          <section class="current-model" aria-live="polite"><p class="eyebrow">Current model</p><div class="currentModelArtwork"><img class="currentToneImage" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" hidden><div class="currentModelFallback"><strong>NAM</strong><small>Model capture</small></div></div><strong class="currentModel">No model loaded</strong><div class="model-chips"><span class="chip source modelSource">—</span><span class="chip modelMode">A2 —</span><span class="chip modelLevel inactive" title="Automatic model-level correction">LEVEL —</span></div><div class="level-actions"><button class="calibrateLevel" type="button" disabled>Calibrate level</button><button class="useMetadataLevel" type="button" hidden>Use metadata</button></div></section>
          ${knobMarkup('outputGain','Output gain',-24,12,.1,0,' dB','output-control')}
          <div class="meter" data-meter="output"><span class="meter-label">OUT</span><div class="meter-track"><div class="meter-fill"></div></div><span class="clip">CLIP</span><div class="meter-values"><span class="peak">-∞ dBFS</span><span class="rms">RMS -∞</span></div></div>
        </div>
        <section class="tone-strip" aria-label="Tone shaping">
          <label class="section-switch"><input class="noiseEnabled" type="checkbox" checked> Gate</label>
          ${knobMarkup('noise','Noise',-100,0,1,-80,' dB')}
          ${knobMarkup('bass','Bass',0,10,.1,5)}
          ${knobMarkup('middle','Middle',0,10,.1,5)}
          ${knobMarkup('treble','Treble',0,10,.1,5)}
          <div><label class="section-switch"><input class="toneEnabled" type="checkbox" checked> Tone</label><button class="eqButton" type="button" aria-expanded="false" aria-controls="namEqPanel">EQ</button></div>
        </section>
        <section class="eq-panel" id="namEqPanel" hidden>
          <div class="eq-toolbar"><div class="eq-toolbar-group"><label><input class="eqEnabled" type="checkbox"> EQ enabled</label><label>Position <select class="eqPosition"><option value="0">POST NAM</option><option value="1">PRE NAM</option></select></label><span class="eq-spectrum-legend" aria-label="Spectrum legend"><span class="input">Input</span><span class="filtered">Filtered</span><span class="final">Final output</span></span></div><button class="eqReset" type="button">Reset EQ</button></div>
          <div class="eq-graph-wrap"><svg class="eqGraph" viewBox="0 0 720 250" preserveAspectRatio="none" role="application" aria-label="Six-band parametric EQ comparing input, filtered, and final output spectra"><defs><linearGradient id="namSpectrumInputFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8094b3" stop-opacity=".18"/><stop offset="1" stop-color="#27364d" stop-opacity=".04"/></linearGradient><linearGradient id="namSpectrumFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff455f" stop-opacity=".5"/><stop offset=".34" stop-color="#ff9e3d" stop-opacity=".42"/><stop offset=".68" stop-color="#a8ad28" stop-opacity=".3"/><stop offset="1" stop-color="#323bce" stop-opacity=".2"/></linearGradient><linearGradient id="namEqFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8c8ff" stop-opacity=".12"/><stop offset="1" stop-color="#3b2d66" stop-opacity=".02"/></linearGradient></defs><path class="eq-spectrum-input-fill" d="M0,230 L720,230 Z"></path><path class="eq-spectrum" d="M0,230 L720,230 Z"></path><g class="eqGrid"></g><path class="eq-spectrum-input-line"></path><path class="eq-spectrum-filtered-line"></path><path class="eq-spectrum-final-line"></path><g class="eqBandCurves"></g><path class="eq-curve-fill"></path><path class="eq-curve"></path><g class="eqNodes"></g></svg><div class="eq-readout"><strong class="eq-band-name">Low<small>Band 1 · Low shelf</small></strong><label class="eq-value">Frequency<input class="eqSelectedFreq" type="number" min="20" max="20000" step="1"></label><label class="eq-value">Gain<input class="eqSelectedGain" type="number" min="-15" max="15" step="0.1"></label><label class="eq-value">Q<input class="eqSelectedQ" type="number" min="0.1" max="10" step="0.01"></label><p class="eq-hint">Drag a point · wheel changes Q · Shift = fine · double-click resets gain</p></div></div>
        </section>
        <details class="drawer modelDrawer">
          <summary>Models & sources</summary>
          <div class="drawer-body">
            <div class="source-tabs" role="group" aria-label="Model source">
              <button class="sourceTab" data-source="Factory" type="button" aria-pressed="true">Factory</button>
              <button class="sourceTab" data-source="Favorites" type="button" aria-pressed="false">★ Favorites</button>
              <button class="sourceTab" data-source="External" type="button" aria-pressed="false">External</button>
              <button class="sourceTab" data-source="TONE3000" type="button" aria-pressed="false">TONE3000</button>
            </div>
            <div class="factoryCategories" role="group" aria-label="Factory category"><button class="factoryCategory" data-category="all" type="button" aria-pressed="true">All</button><button class="factoryCategory" data-category="guitar" type="button" aria-pressed="false">Guitar</button><button class="factoryCategory" data-category="bass" type="button" aria-pressed="false">Bass</button><button class="factoryCategory" data-category="pedal" type="button" aria-pressed="false">Pedals</button></div>
            <div class="browser-tools"><input class="modelSearch" type="search" aria-label="Search models" placeholder="Search models…"><label class="file-action">Load .nam file…<input class="model" type="file" accept=".nam,application/json"></label></div>
            <div class="modelBrowser"></div>
            <section class="tone3000-panel" aria-label="TONE3000" hidden>
              <section class="tone3000Auth" aria-labelledby="tone3000AuthTitle" hidden><img class="tone3000Logo" src="${tone3000LogoUrl}" alt="TONE3000"><h3 class="tone3000AuthTitle" id="tone3000AuthTitle">Access TONE3000 tones</h3><p class="tone3000AuthCopy">NeuralWAMp has partnered with TONE3000 to give you access to a library of NAM captures created by a global community of musicians.</p><button class="tone3000Authenticate" type="button">Continue to TONE3000</button></section>
              <div class="tone3000Browser" hidden><div class="tone3000-head"><button class="tone3000Browse" type="button">Browse TONE3000</button><small class="powered">Powered by TONE3000</small></div>
                <p class="tone3000Status">TONE3000 integration not configured</p>
                <section class="tone3000Catalog" hidden><div class="tone3000CatalogTools" role="group" aria-label="TONE3000 collections"><button type="button" data-tone-feed="trending" aria-pressed="true">Trending</button><button type="button" data-tone-feed="latest" aria-pressed="false">Latest</button><button type="button" data-tone-feed="downloaded" aria-pressed="false">Downloaded</button><button type="button" data-tone-feed="favorited" aria-pressed="false">Favorites</button><button type="button" data-tone-feed="created" aria-pressed="false">Created</button></div><div class="tone3000Gear" role="group" aria-label="Gear filter"><button type="button" data-tone-gear="" aria-pressed="true">All gear</button><button type="button" data-tone-gear="amp" aria-pressed="false">Amp</button><button type="button" data-tone-gear="amp-cab" aria-pressed="false">Amp + Cab</button><button type="button" data-tone-gear="pedal" aria-pressed="false">Pedal</button></div><div class="tone3000Cards" aria-live="polite"></div><div class="tone3000Pager"><button class="tone3000Prev" type="button">Previous</button><span class="tone3000Page">Page 1</span><button class="tone3000Next" type="button">Next</button></div></section>
                <div class="tone3000Selection" hidden><img class="tone3000Image" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" hidden><p class="tone3000Tone"></p><label>Available A2 model <select class="tone3000Model"></select></label><button class="tone3000Load" type="button">Load selected model</button></div>
              </div>
              <section class="tone3000Downloads" aria-label="TONE3000 models downloaded on this device"><div class="tone3000DownloadsHead"><strong>Downloaded on this device</strong><button class="tone3000Clear" type="button" hidden>Delete all</button></div><div class="tone3000DownloadedList"></div></section>
              <section class="factoryMaintainer" aria-label="Factory library maintainer" hidden><h3>Factory library maintainer</h3><p>Explicitly select one TONE3000 tone, choose its files, then export a repository-ready ZIP bundle. Verify redistribution rights before committing it.</p><div class="factoryMaintainerActions"><button type="button" data-maintainer-kind="nam">Select NAM A2 tone</button><button type="button" data-maintainer-kind="ir">Select IR tone</button></div><p class="factoryMaintainerStatus">No tone selected for export.</p><div class="factoryMaintainerModels"></div><button class="factoryMaintainerExport" type="button" hidden>Export selected Factory bundle</button></section>
            </section>
          </div>
        </details>
        <details class="drawer detailsDrawer"><summary>Model details</summary><div class="drawer-body"><p class="status">No model loaded</p></div></details>
        <details class="drawer preferencesDrawer"><summary>Preferences</summary><div class="drawer-body preferencesBody"><label class="preferenceRow"><span><strong>Automatic model level</strong><small>Normalizes NAM loudness to −18 dB, limited to ±12 dB. Output gain remains independent.</small></span><input class="autoLevel" type="checkbox" checked></label><label class="preferenceRow"><span><strong>A2 rendering mode</strong><small>Used when a model contains both Lite and Full networks.</small></span><select class="a2Variant"><option value="full">Full — higher fidelity</option><option value="lite">Lite — lower CPU</option></select></label></div></details>
      </section>`;
    this.controls = {
      inputGain: this.querySelector('.inputGain'), outputGain: this.querySelector('.outputGain'),
      bypass: this.querySelector('.bypass'), model: this.querySelector('.model'), status: this.querySelector('.status'),
      noise: this.querySelector('.noise'), noiseEnabled: this.querySelector('.noiseEnabled'),
      bass: this.querySelector('.bass'), middle: this.querySelector('.middle'), treble: this.querySelector('.treble'), toneEnabled: this.querySelector('.toneEnabled'),
      eqEnabled: this.querySelector('.eqEnabled'), eqPosition: this.querySelector('.eqPosition'), eqButton: this.querySelector('.eqButton'), eqPanel: this.querySelector('.eq-panel'), eqReset: this.querySelector('.eqReset'),
      eqGraph:this.querySelector('.eqGraph'), eqGrid:this.querySelector('.eqGrid'), eqNodes:this.querySelector('.eqNodes'), eqBandCurves:this.querySelector('.eqBandCurves'), eqSpectrum:this.querySelector('.eq-spectrum'), eqSpectrumInputFill:this.querySelector('.eq-spectrum-input-fill'), eqSpectrumInputLine:this.querySelector('.eq-spectrum-input-line'), eqSpectrumFilteredLine:this.querySelector('.eq-spectrum-filtered-line'), eqSpectrumFinalLine:this.querySelector('.eq-spectrum-final-line'), eqCurve:this.querySelector('.eq-curve'), eqCurveFill:this.querySelector('.eq-curve-fill'),
      eqBandName:this.querySelector('.eq-band-name'), eqSelectedFreq:this.querySelector('.eqSelectedFreq'), eqSelectedGain:this.querySelector('.eqSelectedGain'), eqSelectedQ:this.querySelector('.eqSelectedQ'),
      search: this.querySelector('.modelSearch'), browser: this.querySelector('.modelBrowser'),
      toneBrowse: this.querySelector('.tone3000Browse'), toneStatus: this.querySelector('.tone3000Status'),
      toneSelection: this.querySelector('.tone3000Selection'), toneInfo: this.querySelector('.tone3000Tone'),
      toneModels: this.querySelector('.tone3000Model'), toneLoad: this.querySelector('.tone3000Load'),
      toneImage: this.querySelector('.tone3000Image'), currentToneImage: this.querySelector('.currentToneImage'),
      currentModelFallback: this.querySelector('.currentModelFallback'),
      toneAuth: this.querySelector('.tone3000Auth'), toneAuthenticate: this.querySelector('.tone3000Authenticate'), toneBrowser: this.querySelector('.tone3000Browser'),
      toneCatalog: this.querySelector('.tone3000Catalog'), toneCards: this.querySelector('.tone3000Cards'), tonePage: this.querySelector('.tone3000Page'), tonePrev: this.querySelector('.tone3000Prev'), toneNext: this.querySelector('.tone3000Next'),
      toneDownloadedList: this.querySelector('.tone3000DownloadedList'), toneClear: this.querySelector('.tone3000Clear'),
      maintainer: this.querySelector('.factoryMaintainer'), maintainerStatus: this.querySelector('.factoryMaintainerStatus'),
      maintainerModels: this.querySelector('.factoryMaintainerModels'), maintainerExport: this.querySelector('.factoryMaintainerExport'),
      currentModel: this.querySelector('.currentModel'), modelSource: this.querySelector('.modelSource'),
      modelMode: this.querySelector('.modelMode'), modelLevel: this.querySelector('.modelLevel'), modelDrawer: this.querySelector('.modelDrawer'),
      calibrateLevel: this.querySelector('.calibrateLevel'), useMetadataLevel: this.querySelector('.useMetadataLevel'),
      a2Variant: this.querySelector('.a2Variant'),
      autoLevel: this.querySelector('.autoLevel'),
      tonePanel: this.querySelector('.tone3000-panel'), sourceTabs: [...this.querySelectorAll('.sourceTab')], signalFlow: this.querySelector('.signal-flow'),
      factoryCategories:this.querySelector('.factoryCategories'),factoryCategoryButtons:[...this.querySelectorAll('.factoryCategory')],
    };
    const setParams = (entries) => this.node.setParameterValues(Object.fromEntries(entries.map(([id,value])=>[id,{id,value,normalized:false}])));
    const setParam = (id, value) => setParams([[id,value]]);
    const knobIds = ['inputGain','outputGain','noise','bass','middle','treble'];
    for (const id of knobIds) {
      const input=this.querySelector(`.${id}`);this.controls[id]=input;
      input.oninput=()=>{const value=Number(input.value);setParam(id,value);this.updateKnob(id,value);};
      input.ondblclick=(event)=>{event.preventDefault();input.value=input.dataset.default;input.dispatchEvent(new Event('input',{bubbles:true}));};
      this.bindVerticalKnob(input);
      this.updateKnob(id,Number(input.value));
    }
    for(const id of ['noiseEnabled','toneEnabled','eqEnabled'])this.controls[id].onchange=()=>{setParam(id,this.controls[id].checked?1:0);this.renderSignalFlow();};
    this.controls.eqPosition.onchange=()=>{setParam('eqPre',Number(this.controls.eqPosition.value));this.renderSignalFlow();};
    this.controls.eqButton.onclick=()=>{const open=this.controls.eqPanel.hidden;this.controls.eqPanel.hidden=!open;this.controls.eqButton.setAttribute('aria-expanded',String(open));this.node.setSpectrumEnabled(open).catch(()=>{});};
    this._eqBands=EQ_BANDS.map((band)=>({frequency:band.frequency,gain:0,q:band.q}));this._selectedEqBand=0;
    this.initializeEqGraph(setParam,setParams);
    this.renderSignalFlow();
    this.controls.eqReset.onclick=()=>{const entries=[];for(let i=0;i<EQ_BANDS.length;i++){const defaults=EQ_BANDS[i];this._eqBands[i]={frequency:defaults.frequency,gain:0,q:defaults.q};entries.push([`eq${i+1}Freq`,defaults.frequency],[`eq${i+1}Gain`,0],[`eq${i+1}Q`,defaults.q]);}setParams(entries);this.renderEqGraph();};
    this.controls.bypass.onchange = () => {const bypassed=this.controls.bypass.checked;setParam('bypass',bypassed?1:0);this.querySelector('.nam-module').classList.toggle('is-bypassed',bypassed);};
    this.controls.model.onchange = async () => {
      const file = this.controls.model.files[0];
      if (!file) return;
      this.controls.status.classList.remove('error');
      this.controls.status.textContent = `Loading ${file.name}…`;
      try { const text=await file.text(); await this.node.loadModelText(text, file.name); await this.addExternal(text,file.name); }
      catch (error) { this.setModelStatus({status: 'error', error: error.message}); }
    };
    this._assets=[]; this._selectedId=''; this._sourceFilter='Factory'; this._factoryCategory='all'; this._favoriteIds=new Set();
    this.tone3000Downloads = new Tone3000Downloads();
    this.modelFavorites = new ModelFavorites();
    let preferredVariant='full';try{preferredVariant=localStorage.getItem(modelVariantStorageKey)==='lite'?'lite':'full';}catch{/* Storage can be unavailable in privacy modes. */}this.controls.a2Variant.value=preferredVariant;await this.node.setModelVariant(preferredVariant);
    this.controls.a2Variant.onchange=async()=>{const variant=this.controls.a2Variant.value;try{localStorage.setItem(modelVariantStorageKey,variant);}catch{/* Keep the session preference even if persistence is unavailable. */}await this.node.setModelVariant(variant);await this.restoreMeasuredLevel();};
    let autoLevel=true;try{autoLevel=localStorage.getItem(autoLevelStorageKey)!=='off';}catch{/* Keep the default in privacy modes. */}this.controls.autoLevel.checked=autoLevel;await this.node.setAutoLevel(autoLevel);
    this.controls.autoLevel.onchange=async()=>{const enabled=this.controls.autoLevel.checked;try{localStorage.setItem(autoLevelStorageKey,enabled?'on':'off');}catch{/* Keep the session preference even if persistence is unavailable. */}await this.node.setAutoLevel(enabled);};
    this.controls.calibrateLevel.onclick=()=>this.calibrateCurrentModelLevel();
    this.controls.useMetadataLevel.onclick=async()=>{this.controls.useMetadataLevel.disabled=true;try{this.removeStoredMeasuredLevel();await this.node.useMetadataModelLevel();this.controls.autoLevel.checked=true;try{localStorage.setItem(autoLevelStorageKey,'on');}catch{/* Keep session state. */}}catch(error){this.controls.status.classList.add('error');this.controls.status.textContent=`Level reset failed: ${error.message}`;}finally{this.controls.useMetadataLevel.disabled=false;}};
    this.controls.search.oninput=()=>this.renderBrowser();
    this.controls.sourceTabs.forEach((button)=>button.onclick=()=>this.setSourceFilter(button.dataset.source));
    this.controls.factoryCategoryButtons.forEach((button)=>button.onclick=()=>this.setFactoryCategory(button.dataset.category));
    this._modelListener=async(metadata,model)=>{if(!model?.data)return;if(model.provenance?.source==='TONE3000'){const asset=this.upsertTone3000Asset({...model.provenance,name:model.name,text:model.data});this._selectedId=asset.id;this.controls.modelSource.textContent='TONE3000';await this.restoreMeasuredLevel();this.renderBrowser();this.renderTone3000Downloads();return;}if(model.provenance?.source==='Factory'){this._selectedId=model.provenance.identity;this.controls.modelSource.textContent='Factory';await this.restoreMeasuredLevel();this.renderBrowser();return;}const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(model.data));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');const factory=this._assets.find(a=>a.contentHash===hash);if(factory){this._selectedId=factory.id;this.controls.modelSource.textContent='Factory';}else {const asset=addExternalAsset(this._assets,{id:`external:${hash}`,filename:model.name,relativePath:model.name,groups:['External'],displayName:model.name.replace(/\.nam$/i,''),type:'nam',contentHash:hash,source:'External',data:model.data});asset.data=model.data;this._selectedId=asset.id;this.controls.modelSource.textContent='External';}await this.restoreMeasuredLevel();this.renderBrowser();};
    this.node.addModelListener(this._modelListener);
    await this.loadManifest();
    await this.loadTone3000Downloads();
    await this.loadFavorites();
    this._automation = (event) => this.syncParameter(event.detail.data);
    this._meterState = {inputPeak: 0, inputRms: 0, outputPeak: 0, outputRms: 0, inputClipUntil: 0, outputClipUntil: 0};
    this._meterListener = (data) => this.updateMeters(data);
    this.node.addMeterListener(this._meterListener);
    this._spectrumListener = (data) => this.updateSpectrum(data);
    this.node.addSpectrumListener(this._spectrumListener);
    this.node.addEventListener('wam-automation', this._automation);
    this.syncParameters(await this.node.getParameterValues(false));
    this.tone3000 = new Tone3000Client(plugin.constructor.tone3000Config || {});
    this._maintainerMode = new URL(window.location.href).searchParams.get('maintainer') === '1';
    this.controls.maintainer.hidden = !this._maintainerMode;
    this.querySelectorAll('[data-maintainer-kind]').forEach((button) => button.onclick = () => this.selectMaintainerTone(button.dataset.maintainerKind));
    this.controls.maintainerExport.onclick = () => this.exportMaintainerBundle();
    this._toneModels = [];
    this.controls.toneBrowse.onclick = () => this.browseTone3000();
    this.controls.toneAuthenticate.onclick = () => this.authenticateTone3000();
    this.controls.toneLoad.onclick = () => this.loadTone3000Model();
    this.controls.toneClear.onclick = () => this.clearTone3000Downloads();
    this._toneFeed = 'trending'; this._toneGear = ''; this._tonePage = 1;
    this.querySelectorAll('[data-tone-feed]').forEach((button) => button.onclick = () => { this._toneFeed = button.dataset.toneFeed; this._tonePage = 1; this.querySelectorAll('[data-tone-feed]').forEach((b) => b.setAttribute('aria-pressed', String(b === button))); this.loadTone3000Catalog(); });
    this.querySelectorAll('[data-tone-gear]').forEach((button) => button.onclick = () => { this._toneGear = button.dataset.toneGear; this._tonePage = 1; this.querySelectorAll('[data-tone-gear]').forEach((b) => b.setAttribute('aria-pressed', String(b === button))); this.loadTone3000Catalog(); });
    this.controls.tonePrev.onclick = () => { if (this._tonePage > 1) { this._tonePage--; this.loadTone3000Catalog(); } };
    this.controls.toneNext.onclick = () => { this._tonePage++; this.loadTone3000Catalog(); };
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

  measuredLevelKey() {
    if (!this._selectedId) return '';
    const variant = this.node._metadata?.activeVariant || 'fixed';
    return `${this._selectedId}::${variant}`;
  }

  readMeasuredLevels() {
    try { const value=JSON.parse(localStorage.getItem(measuredLevelsStorageKey)||'{}');return value&&typeof value==='object'?value:{}; }
    catch { return {}; }
  }

  storeMeasuredLevel(calibration) {
    const key=this.measuredLevelKey();if(!key)return;
    try { const levels=this.readMeasuredLevels();levels[key]=calibration;localStorage.setItem(measuredLevelsStorageKey,JSON.stringify(levels)); }
    catch { /* Calibration remains active for this session. */ }
  }

  removeStoredMeasuredLevel() {
    const key=this.measuredLevelKey();if(!key)return;
    try { const levels=this.readMeasuredLevels();delete levels[key];localStorage.setItem(measuredLevelsStorageKey,JSON.stringify(levels)); }
    catch { /* Keep the current session usable if storage is unavailable. */ }
  }

  async restoreMeasuredLevel() {
    if(!this.controls.autoLevel.checked)return false;
    const calibration=this.readMeasuredLevels()[this.measuredLevelKey()];
    if(!calibration||calibration.version!==1||!Number.isFinite(Number(calibration.compensationDb)))return false;
    await this.node.applyMeasuredModelLevel(calibration);return true;
  }

  renderSignalFlow() {
    if(!this.controls.signalFlow)return;
    const eqPre=this.controls.eqPosition.value==='1';
    const eq={label:'EQ',detail:eqPre?'PRE':'POST',kind:'eq',enabled:this.controls.eqEnabled.checked};
    const stages=[
      {label:'Input',kind:'gain',enabled:true},
      {label:'Gate',kind:'gate',enabled:this.controls.noiseEnabled.checked},
      ...(eqPre?[eq]:[]),
      {label:'Amp sim',detail:'NAM',kind:'amp',enabled:true},
      ...(!eqPre?[eq]:[]),
      {label:'Tone stack',kind:'tone',enabled:this.controls.toneEnabled.checked},
      {label:'Output',kind:'gain',enabled:true},
    ];
    this.controls.signalFlow.replaceChildren(...stages.flatMap((stage,index)=>{
      const item=document.createElement('span');item.className=`flow-stage ${stage.kind}${stage.enabled?'':' off'}`;item.dataset.stage=stage.kind;item.textContent=stage.label;if(stage.detail){const detail=document.createElement('small');detail.textContent=stage.detail;item.append(detail);}item.title=stage.enabled?`${stage.label} active`:`${stage.label} bypassed`;
      if(index===stages.length-1)return [item];const arrow=document.createElement('span');arrow.className='flow-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='→';return [item,arrow];
    }));
    this.controls.signalFlow.setAttribute('aria-label',`Signal path: ${stages.map(stage=>`${stage.label}${stage.detail?` ${stage.detail}`:''}${stage.enabled?'':' bypassed'}`).join(', then ')}`);
  }

  syncParameter(data,deferEqRender=false) {
    const {id, value} = data;
    if (id === 'bypass') {
      this.controls.bypass.checked = value >= 0.5;
      this.querySelector('.nam-module').classList.toggle('is-bypassed', value >= .5);
    } else if (id === 'noiseEnabled' || id === 'toneEnabled' || id === 'eqEnabled') this.controls[id].checked = value >= .5;
    else if (id === 'eqPre') this.controls.eqPosition.value = value >= .5 ? '1' : '0';
    else if (/^eq[1-6](Freq|Gain|Q)$/u.test(id)) {
      const match=id.match(/^eq([1-6])(Freq|Gain|Q)$/u);const band=this._eqBands?.[Number(match[1])-1];if(!band)return;
      band[match[2]==='Freq'?'frequency':match[2].toLowerCase()]=Number(value);if(!deferEqRender)this.renderEqGraph();
    }
    else if (this.controls[id]) this.updateKnob(id, value);
    if(id==='eqEnabled')this.controls.eqGraph?.classList.toggle('disabled',value<.5);
    if(['noiseEnabled','toneEnabled','eqEnabled','eqPre'].includes(id))this.renderSignalFlow();
  }

  syncParameters(values) { let hasEq=false;Object.values(values).forEach((data)=>{const isEq=/^eq[1-6](Freq|Gain|Q)$/u.test(data.id);hasEq=hasEq||isEq;this.syncParameter(data,isEq);});if(hasEq)this.renderEqGraph(); }

  bindVerticalKnob(input) {
    let drag=null;
    const finish=(event)=>{if(!drag)return;try{input.releasePointerCapture(event.pointerId);}catch{/* Pointer capture is best effort. */}drag=null;};
    input.onpointerdown=(event)=>{if(event.button!==0&&event.pointerType==='mouse')return;event.preventDefault();input.focus();drag={pointerId:event.pointerId,lastY:event.clientY};try{input.setPointerCapture(event.pointerId);}catch{/* Continue with element events. */}};
    input.onpointermove=(event)=>{if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();const min=Number(input.min),max=Number(input.max),step=Number(input.step)||.01;const fine=event.shiftKey?.125:1;const delta=(drag.lastY-event.clientY)*(max-min)/180*fine;drag.lastY=event.clientY;if(!delta)return;const value=Math.max(min,Math.min(max,min+Math.round((Number(input.value)+delta-min)/step)*step));input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));};
    input.onpointerup=finish;input.onpointercancel=finish;input.onclick=(event)=>event.preventDefault();
  }

  initializeEqGraph(setParam,setParams) {
    this._setEqParam=setParam;this._setEqParams=setParams;
    const svgNs='http://www.w3.org/2000/svg';
    for(const gain of [-15,-10,-5,0,5,10,15]){const y=this.eqGainToY(gain);const line=document.createElementNS(svgNs,'line');line.setAttribute('x1','0');line.setAttribute('x2','720');line.setAttribute('y1',String(y));line.setAttribute('y2',String(y));line.setAttribute('class',gain===0?'eq-zero-line':'eq-grid-line');const label=document.createElementNS(svgNs,'text');label.setAttribute('x','5');label.setAttribute('y',String(Math.max(11,Math.min(226,y-4))));label.setAttribute('class','eq-axis-label');label.textContent=`${gain>0?'+':''}${gain} dB`;this.controls.eqGrid.append(line,label);}
    for(const db of [0,-25,-50,-75,-100]){const y=230-(db+100)/100*210;const label=document.createElementNS(svgNs,'text');label.setAttribute('x','715');label.setAttribute('y',String(Math.max(11,Math.min(226,y-4))));label.setAttribute('text-anchor','end');label.setAttribute('class','eq-axis-label spectrum');label.textContent=`${db} dBFS`;this.controls.eqGrid.append(label);}
    for(const frequency of [50,100,200,500,1000,2000,5000,10000]){const x=this.eqFreqToX(frequency);const line=document.createElementNS(svgNs,'line');line.setAttribute('x1',String(x));line.setAttribute('x2',String(x));line.setAttribute('y1','0');line.setAttribute('y2','230');line.setAttribute('class','eq-grid-line');const label=document.createElementNS(svgNs,'text');label.setAttribute('x',String(x+4));label.setAttribute('y','244');label.setAttribute('class','eq-grid-label');label.textContent=frequency>=1000?`${frequency/1000}k`:String(frequency);this.controls.eqGrid.append(line,label);}
    for(let i=0;i<EQ_BANDS.length;i++){const curve=document.createElementNS(svgNs,'path');curve.setAttribute('class','eq-band-curve');curve.style.stroke=EQ_BAND_COLORS[i];this.controls.eqBandCurves.append(curve);const node=document.createElementNS(svgNs,'circle');node.setAttribute('r','8');node.setAttribute('class','eq-node');node.setAttribute('tabindex','0');node.setAttribute('role','slider');node.style.fill=EQ_BAND_COLORS[i];node.style.stroke=EQ_BAND_COLORS[i];node.dataset.bandIndex=String(i);node.onpointerdown=(event)=>this.startEqDrag(event,i);node.onpointermove=(event)=>this.moveEqDrag(event);node.onpointerup=(event)=>this.endEqDrag(event);node.onpointercancel=(event)=>this.endEqDrag(event);node.onclick=()=>{this._selectedEqBand=i;this.renderEqGraph();};node.ondblclick=(event)=>{event.preventDefault();this.updateEqBand(i,{gain:0});};node.onkeydown=(event)=>this.keyEqNode(event,i);this.controls.eqNodes.append(node);}
    this.controls.eqGraph.addEventListener('wheel',(event)=>{event.preventDefault();const band=this._eqBands[this._selectedEqBand];const fine=event.shiftKey?.125:1;this.updateEqBand(this._selectedEqBand,{q:Math.max(.1,Math.min(10,band.q*Math.exp(-event.deltaY*.003*fine)))});},{passive:false});
    const edit=(property,min,max)=>(event)=>{const value=Number(event.target.value);if(Number.isFinite(value))this.updateEqBand(this._selectedEqBand,{[property]:Math.max(min,Math.min(max,value))});};
    this.controls.eqSelectedFreq.oninput=edit('frequency',20,20000);this.controls.eqSelectedGain.oninput=edit('gain',-15,15);this.controls.eqSelectedQ.oninput=edit('q',.1,10);
    this.renderEqGraph();
  }

  eqFreqToX(frequency) { return Math.log(Math.max(20,Math.min(20000,frequency))/20)/Math.log(1000)*720; }
  eqXToFreq(x) { return 20*1000**Math.max(0,Math.min(1,x/720)); }
  eqGainToY(gain) { return 20+(15-Math.max(-15,Math.min(15,gain)))/30*210; }

  startEqDrag(event,index) { if(event.button!==0&&event.pointerType==='mouse')return;event.preventDefault();this._selectedEqBand=index;this._eqDrag={index,pointerId:event.pointerId,lastX:event.clientX,lastY:event.clientY};event.currentTarget.classList.add('dragging');try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Continue with SVG events. */}this.renderEqGraph(); }
  moveEqDrag(event) { const drag=this._eqDrag;if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();const rect=this.controls.eqGraph.getBoundingClientRect();const fine=event.shiftKey?.125:1;const dx=(event.clientX-drag.lastX)/rect.width*720*fine;const dy=(event.clientY-drag.lastY)/rect.height*250*fine;drag.lastX=event.clientX;drag.lastY=event.clientY;const band=this._eqBands[drag.index];const lower=drag.index?this._eqBands[drag.index-1].frequency*1.02:20;const upper=drag.index<5?this._eqBands[drag.index+1].frequency*.98:20000;const frequency=Math.max(lower,Math.min(upper,this.eqXToFreq(this.eqFreqToX(band.frequency)+dx)));const gain=Math.max(-15,Math.min(15,band.gain-dy/210*30));this.updateEqBand(drag.index,{frequency,gain}); }
  endEqDrag(event) { if(!this._eqDrag)return;event.currentTarget.classList.remove('dragging');try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* Capture may already be released. */}this._eqDrag=null; }
  keyEqNode(event,index) { const band=this._eqBands[index];let patch=null;if(event.key==='ArrowUp'||event.key==='ArrowDown')patch={gain:Math.max(-15,Math.min(15,band.gain+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?.1:1)))};else if(event.key==='ArrowLeft'||event.key==='ArrowRight')patch={frequency:Math.max(20,Math.min(20000,band.frequency*2**((event.key==='ArrowRight'?1:-1)*(event.shiftKey?.125:1)/12)))};if(patch){event.preventDefault();this._selectedEqBand=index;this.updateEqBand(index,patch);} }

  updateEqBand(index,patch) { const band=this._eqBands[index],entries=[];Object.assign(band,patch);if(Object.hasOwn(patch,'frequency'))entries.push([`eq${index+1}Freq`,band.frequency]);if(Object.hasOwn(patch,'gain'))entries.push([`eq${index+1}Gain`,band.gain]);if(Object.hasOwn(patch,'q'))entries.push([`eq${index+1}Q`,band.q]);if(entries.length)this._setEqParams(entries);this.renderEqGraph(); }

  eqCoefficients(band,index) { const frequency=Math.min(Math.max(band.frequency,20),(this.node.context?.sampleRate||48000)*.49,20000);const A=10**(band.gain/40),omega=2*Math.PI*frequency/(this.node.context?.sampleRate||48000),sn=Math.sin(omega),cs=Math.cos(omega),alpha=sn/(2*band.q),sqrtA=Math.sqrt(A);let b0=1,b1=0,b2=0,a0=1,a1=0,a2=0;if(index===0){b0=A*((A+1)-(A-1)*cs+2*sqrtA*alpha);b1=2*A*((A-1)-(A+1)*cs);b2=A*((A+1)-(A-1)*cs-2*sqrtA*alpha);a0=(A+1)+(A-1)*cs+2*sqrtA*alpha;a1=-2*((A-1)+(A+1)*cs);a2=(A+1)+(A-1)*cs-2*sqrtA*alpha;}else if(index===5){b0=A*((A+1)+(A-1)*cs+2*sqrtA*alpha);b1=-2*A*((A-1)+(A+1)*cs);b2=A*((A+1)+(A-1)*cs-2*sqrtA*alpha);a0=(A+1)-(A-1)*cs+2*sqrtA*alpha;a1=2*((A-1)-(A+1)*cs);a2=(A+1)-(A-1)*cs-2*sqrtA*alpha;}else{b0=1+alpha*A;b1=-2*cs;b2=1-alpha*A;a0=1+alpha/A;a1=-2*cs;a2=1-alpha/A;}return{b0:b0/a0,b1:b1/a0,b2:b2/a0,a1:a1/a0,a2:a2/a0}; }
  eqMagnitudeDb(coefficients,frequency) { const omega=2*Math.PI*frequency/(this.node.context?.sampleRate||48000),cosW=Math.cos(omega),cos2W=Math.cos(2*omega);const {b0,b1,b2,a1,a2}=coefficients;const numerator=b0*b0+b1*b1+b2*b2+2*(b0*b1+b1*b2)*cosW+2*b0*b2*cos2W;const denominator=1+a1*a1+a2*a2+2*(a1+a1*a2)*cosW+2*a2*cos2W;return 10*Math.log10(Math.max(numerator/Math.max(denominator,1e-24),1e-24)); }

  renderEqGraph() { if(!this._eqBands||!this.controls.eqGraph)return;const combined=[];const individual=this._eqBands.map(()=>[]);const coefficients=this._eqBands.map((band,index)=>this.eqCoefficients(band,index));for(let i=0;i<=360;i++){const x=i*2,frequency=this.eqXToFreq(x);let db=0;for(let bandIndex=0;bandIndex<this._eqBands.length;bandIndex++){const bandDb=Math.abs(this._eqBands[bandIndex].gain)<.05?0:this.eqMagnitudeDb(coefficients[bandIndex],frequency);db+=bandDb;const bandY=125-Math.max(-18,Math.min(18,bandDb))/36*210;individual[bandIndex].push(`${i?'L':'M'}${x.toFixed(1)},${bandY.toFixed(1)}`);}const y=125-Math.max(-18,Math.min(18,db))/36*210;combined.push(`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`);}const path=combined.join(' ');this.controls.eqCurve.setAttribute('d',path);this.controls.eqCurveFill.setAttribute('d',`${path} L720,125 L0,125 Z`);const bandCurves=[...this.controls.eqBandCurves.children];const nodes=[...this.controls.eqNodes.children];for(let i=0;i<nodes.length;i++){const band=this._eqBands[i],node=nodes[i];bandCurves[i].setAttribute('d',individual[i].join(' '));bandCurves[i].classList.toggle('selected',i===this._selectedEqBand);node.setAttribute('cx',String(this.eqFreqToX(band.frequency)));node.setAttribute('cy',String(this.eqGainToY(band.gain)));node.classList.toggle('selected',i===this._selectedEqBand);node.style.fill=i===this._selectedEqBand?'#fff':EQ_BAND_COLORS[i];node.style.stroke=EQ_BAND_COLORS[i];node.setAttribute('aria-label',`${EQ_BANDS[i].name} ${EQ_BANDS[i].type} EQ band`);node.setAttribute('aria-valuetext',`${Math.round(band.frequency)} Hz, ${band.gain.toFixed(1)} dB, Q ${band.q.toFixed(2)}`);}const definition=EQ_BANDS[this._selectedEqBand],selected=this._eqBands[this._selectedEqBand];this.controls.eqBandName.innerHTML=`${definition.name}<small>Band ${definition.index} · ${definition.type}</small>`;this.controls.eqBandName.style.color=EQ_BAND_COLORS[this._selectedEqBand];this.controls.eqSelectedFreq.value=String(Math.round(selected.frequency));this.controls.eqSelectedGain.value=selected.gain.toFixed(1);this.controls.eqSelectedQ.value=selected.q.toFixed(2); }

  spectrumPath(bins,minDb=-100) { const points=[];for(let i=0;i<bins.length;i++){const x=(i+.5)/bins.length*720,db=Math.max(minDb,Math.min(0,Number(bins[i])||minDb)),y=230-(db-minDb)/Math.abs(minDb)*210;points.push(`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`);}return points.join(' '); }

  updateSpectrum(data) { const input=data?.inputBins,filtered=data?.filteredBins,finalOutput=data?.finalBins;if(!input?.length||!filtered?.length||!finalOutput?.length||!this.controls.eqSpectrum)return;const inputPath=this.spectrumPath(input,data.minDb),filteredPath=this.spectrumPath(filtered,data.minDb),finalPath=this.spectrumPath(finalOutput,data.minDb);this.controls.eqSpectrumInputFill.setAttribute('d',`${inputPath} L720,230 L0,230 Z`);this.controls.eqSpectrum.setAttribute('d',`${filteredPath} L720,230 L0,230 Z`);this.controls.eqSpectrumInputLine.setAttribute('d',inputPath);this.controls.eqSpectrumFilteredLine.setAttribute('d',filteredPath);this.controls.eqSpectrumFinalLine.setAttribute('d',finalPath); }

  updateKnob(id, parameterValue) {
    const input=this.controls[id]||this.querySelector(`.${id}`);if(!input)return;
    const controlValue=Number(parameterValue);
    input.value=controlValue;const min=Number(input.min);const max=Number(input.max);const normalized=Math.max(0,Math.min(1,(controlValue-min)/(max-min)));
    const root=input.closest('.knob-control');root?.style.setProperty('--knob-sweep',`${normalized*270}deg`);root?.style.setProperty('--knob-angle',`${-135+normalized*270}deg`);
    const output=this.querySelector(`.${id}Value`);let text;
    if(id.endsWith('Gain')||id==='noise')text=`${Number(parameterValue).toFixed(1)} dB`;
    else text=Number(parameterValue).toFixed(id.endsWith('Q')?2:1);
    if(output)output.textContent=text;input.setAttribute('aria-valuetext',text);
  }

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

  setCurrentArtwork(metadata) {
    const image = this.controls.currentToneImage;
    const fallback = this.controls.currentModelFallback;
    const provenance = metadata.provenance || {};
    const raw = metadata.rawMetadata || provenance.metadata || {};
    const source = metadata.source || provenance.source || 'NAM';
    fallback.querySelector('strong').textContent = source === 'TONE3000' ? 'TONE3000' : (raw.gear_make || 'NAM');
    fallback.querySelector('small').textContent = raw.gear_model || raw.gear_type || 'Model capture';
    const showFallback = () => { image.hidden = true; image.removeAttribute('src'); fallback.hidden = false; };
    image.onerror = null;
    if (!provenance.imageUrl) { showFallback(); return; }
    fallback.hidden = true;
    image.hidden = false;
    image.alt = `${provenance.title || metadata.name} — ${source} model image`;
    image.onerror = () => { image.onerror = null; showFallback(); };
    image.src = provenance.imageUrl;
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
    const hasLoudness = Number.isFinite(m.loudness);
    const correction = Number(m.autoLevelCompensationDb);
    const measured = m.levelMode === 'measured' && m.measuredCalibration;
    const levelAvailable = m.autoLevelEnabled && Number.isFinite(correction) && (hasLoudness || measured);
    this.controls.modelLevel.textContent = !m.autoLevelEnabled ? 'LEVEL OFF' : levelAvailable
      ? `${measured ? 'MEASURED' : 'LEVEL'} ${correction >= 0 ? '+' : ''}${correction.toFixed(1)} dB` : 'LEVEL N/A';
    this.controls.modelLevel.classList.toggle('inactive', !levelAvailable);
    this.controls.modelLevel.title = !m.autoLevelEnabled ? 'Automatic model level is disabled' : levelAvailable
      ? measured
        ? `Measured NAM correction: ${correction >= 0 ? '+' : ''}${correction.toFixed(1)} dB · probe output ${measured.outputRmsDb.toFixed(1)} dBFS · target −18 dBFS`
        : `Applied NAM correction: ${correction >= 0 ? '+' : ''}${correction.toFixed(1)} dB · model loudness ${m.loudness.toFixed(1)} dB · target −18 dB`
      : 'No usable loudness metadata in this NAM file';
    this.controls.calibrateLevel.disabled = false;
    this.controls.calibrateLevel.textContent = measured ? 'Recalibrate level' : 'Calibrate level';
    this.controls.useMetadataLevel.hidden = !measured;
    if (m.source) this.controls.modelSource.textContent = m.source;
    this.setCurrentArtwork(m);
    const raw = m.rawMetadata || {};
    const details = [m.name, `Architecture: ${m.subtype}`, `Sample rate: ${m.expectedSampleRate} Hz`,
      `Modeled by: ${m.modeledBy==='Unknown'?(m.provenance?.creator||'Unknown'):m.modeledBy}`, `NAM format: ${m.version}`];
    if (m.availableVariants?.length) details.splice(2,0,'Available rendering modes: A2 Full, A2 Lite');
    if(Number.isFinite(m.loudness))details.push(`Model loudness: ${m.loudness.toFixed(1)} dB`);
    if(measured)details.push(`Measured level: ${correction>=0?'+':''}${correction.toFixed(1)} dB (probe ${measured.outputRmsDb.toFixed(1)} dBFS → target −18 dBFS${measured.clamped?', limited':''})`);
    else details.push(m.autoLevelEnabled?(Number.isFinite(m.loudness)?`Auto level: ${m.autoLevelCompensationDb>=0?'+':''}${m.autoLevelCompensationDb.toFixed(1)} dB (target −18 dB)`:'Auto level: unavailable — no loudness metadata'):'Auto level: off');
    if (m.source) details.push(`Source: ${m.source}`);
    if (raw.gear_make) details.push(`Gear make: ${raw.gear_make}`);
    if (raw.gear_model && raw.gear_model !== raw.gear_make) details.push(`Gear model: ${raw.gear_model}`);
    if (raw.gear_type) details.push(`Capture type: ${raw.gear_type}`);
    if (raw.tone_type) details.push(`Tone: ${String(raw.tone_type).replaceAll('_', ' ')}`);
    if (raw.trainer) details.push(`Trainer: ${raw.trainer}`);
    const date = metadataDate(raw.date); if (date) details.push(`Captured: ${date}`);
    if (Number.isFinite(raw.input_level_dbu)) details.push(`Input level: ${raw.input_level_dbu} dBu`);
    if (Number.isFinite(raw.output_level_dbu)) details.push(`Output level: ${raw.output_level_dbu} dBu`);
    if (m.provenance?.license) details.push(`License: ${m.provenance.license}`);
    if (m.provenance?.provider && m.provenance.provider !== 'Local') details.push(`Provider: ${m.provenance.provider}`);
    if (m.provenance?.toneId) details.push(`Tone ID: ${m.provenance.toneId}`);
    this.controls.status.textContent = details.join('\n');
  }

  async calibrateCurrentModelLevel() {
    this.controls.calibrateLevel.disabled = true;
    this.controls.useMetadataLevel.disabled = true;
    const previousText = this.controls.calibrateLevel.textContent;
    this.controls.calibrateLevel.textContent = 'Measuring…';
    try {
      const result = await this.node.calibrateModelLevel();
      this.storeMeasuredLevel(result);
      this.controls.autoLevel.checked = true;
      try { localStorage.setItem(autoLevelStorageKey, 'on'); } catch { /* Keep session state. */ }
      if (result.clamped) this.controls.modelLevel.title += ' · correction limited for safety';
    } catch (error) {
      this.controls.status.classList.add('error');
      this.controls.status.textContent = `Level calibration failed: ${error.message}`;
      this.controls.calibrateLevel.textContent = previousText;
    } finally {
      this.controls.calibrateLevel.disabled = false;
      this.controls.useMetadataLevel.disabled = false;
    }
  }

  setToneStatus(text, error = false) { this.controls.toneStatus.textContent = text; this.controls.toneStatus.classList.toggle('error', error); }

  showToneAuthentication(show) {
    this.controls.toneAuth.hidden = !show;
    this.controls.toneBrowser.hidden = show;
    if (show) this.controls.toneSelection.hidden = true;
    this.controls.toneCatalog.hidden = show;
  }

  setSourceFilter(source) {
    this._sourceFilter = source;
    this.controls.sourceTabs.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.source === source)));
    this.controls.factoryCategories.hidden = source !== 'Factory';
    this.controls.tonePanel.hidden = source !== 'TONE3000';
        if (source === 'TONE3000') this.showToneAuthentication(!this.tone3000?.tokens?.access_token);
        if (source === 'TONE3000' && this.tone3000?.tokens?.access_token) this.loadTone3000Catalog();
    this.renderBrowser();
  }

  setFactoryCategory(category) {
    this._factoryCategory=['guitar','bass','pedal'].includes(category)?category:'all';
    this.controls.factoryCategoryButtons.forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.category===this._factoryCategory)));
    this.renderBrowser();
  }

  async browseTone3000() {
    if (!this.tone3000.configured) { this.setToneStatus('TONE3000 integration not configured', true); return; }
    sessionStorage.removeItem(maintainerStorageKey);
    await this.openTone3000Flow(() => this.tone3000.createAuthorizationUrl(), 'Waiting for TONE3000 selection…');
  }

  async selectMaintainerTone(kind) {
    if (!this.tone3000.configured) { this.controls.maintainerStatus.textContent='TONE3000 integration is not configured.';return; }
    this._maintainerKind=kind;sessionStorage.setItem(maintainerStorageKey,kind);
    const options=kind==='ir'?{format:'ir',architecture:null,menubar:'true'}:{format:'nam',architecture:'2',menubar:'true'};
    this.controls.maintainerStatus.textContent=`Select one ${kind==='ir'?'IR':'NAM A2'} tone on TONE3000…`;
    await this.openTone3000Flow(()=>this.tone3000.createAuthorizationUrl(options),'Waiting for the Factory maintainer selection…');
  }

  async authenticateTone3000() {
    if (!this.tone3000.configured) { this.setToneStatus('TONE3000 integration not configured', true); return; }
    await this.openTone3000Flow(() => this.tone3000.createLoginUrl(), 'Waiting for TONE3000 sign in…');
  }

  async openTone3000Flow(createUrl, waitingStatus) {
    this.setSourceFilter('TONE3000'); this.showToneAuthentication(false); this.controls.modelDrawer.open = true;
    this.setToneStatus('Opening TONE3000…'); this._toneCallbackHref = '';
    sessionStorage.setItem('nam-a2-wam.tone3000.popup', '1');
    const popup = window.open('about:blank', 'tone3000-oauth', 'popup,width=1180,height=820');
    sessionStorage.removeItem('nam-a2-wam.tone3000.popup');
    if (!popup) { this.setToneStatus('TONE3000 window blocked — allow pop-ups for this site and try again.', true); return; }
    this._tonePopup = popup;
    try { popup.location.replace(await createUrl()); this.setToneStatus(waitingStatus); }
    catch (error) { popup.close(); this._tonePopup = null; this.setToneStatus(error.message, true); }
  }

  async completeTone3000Callback(location = window.location) {
    const hasCallback = /[?&](?:code|error|canceled)=/u.test(new URL(location.href).search);
    if (!hasCallback) { if (this.tone3000.configured) this.setToneStatus('Ready — click Browse TONE3000 to select a tone'); return; }
    if (!this.tone3000.configured) { this.setToneStatus('TONE3000 callback received, but integration is not configured', true); return; }
    this._sourceFilter = 'TONE3000';
    this.controls.sourceTabs.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.source === 'TONE3000')));
    this.controls.tonePanel.hidden = false;
    this.controls.modelDrawer.open = true;
    this.renderBrowser();
    this.setToneStatus('Completing TONE3000 authorization…');
    const result = await this.tone3000.completeAuthorization(location);
    if (location === window.location && window.history?.replaceState) window.history.replaceState({}, document.title, window.location.pathname);
    if (!result.ok) { this.setToneStatus(result.error, true); return; }
    if (!result.toneId) { this.showToneAuthentication(false); this.controls.toneCatalog.hidden = false; this.setToneStatus('Signed in — choose a tone from the TONE3000 catalog'); await this.loadTone3000Catalog(); return; }
    this.showToneAuthentication(false);
    const maintainerKind=this._maintainerKind||sessionStorage.getItem(maintainerStorageKey);
    if(maintainerKind){sessionStorage.removeItem(maintainerStorageKey);this._maintainerKind='';await this.prepareMaintainerTone(result.toneId,maintainerKind);return;}
    await this.loadTone3000Selection(result.toneId, {autoLoad: true});
  }

  async prepareMaintainerTone(toneId, kind) {
    if(!this._maintainerMode)return;
    try {
      this.controls.maintainerStatus.textContent='Loading selected tone metadata and files…';
      const architecture=kind==='nam'?'2':'';
      const [tone,models]=await Promise.all([this.tone3000.getTone(toneId,{architecture}),this.tone3000.listModels(toneId,{architecture})]);
      const compatible=kind==='nam'?models.filter((model)=>String(model.architecture_version??model.architecture??2)==='2'):models;
      this._maintainerTone=tone;this._maintainerModels=compatible;this._maintainerKind=kind;
      this.controls.maintainerModels.replaceChildren(...compatible.map((model)=>{const label=document.createElement('label');label.className='factoryMaintainerModel';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.value=String(model.id);const text=document.createElement('span');text.textContent=`${model.name||`Model ${model.id}`} · ${model.size||kind.toUpperCase()}`;label.append(checkbox,text);return label;}));
      this.controls.maintainerExport.hidden=!compatible.length;
      this.controls.maintainerStatus.textContent=compatible.length?`${tone.title||tone.name||`Tone ${toneId}`}\n${compatible.length} ${kind==='ir'?'IR':'NAM A2 model(s)'} available. Uncheck files you do not want to export.`:'No compatible files were returned for this tone.';
      this.setToneStatus('Maintainer tone ready for Factory bundle export');
    } catch(error){this.controls.maintainerStatus.textContent=`Could not prepare Factory export: ${error.message}`;this.controls.maintainerExport.hidden=true;}
  }

  async exportMaintainerBundle() {
    const selectedIds=new Set([...this.controls.maintainerModels.querySelectorAll('input:checked')].map((input)=>input.value));
    const models=(this._maintainerModels||[]).filter((model)=>selectedIds.has(String(model.id)));
    if(!models.length){this.controls.maintainerStatus.textContent='Select at least one file to export.';return;}
    this.controls.maintainerExport.disabled=true;
    try {
      const downloads=[];
      for(let index=0;index<models.length;index++){const model=models[index];this.controls.maintainerStatus.textContent=`Downloading ${index+1}/${models.length}: ${model.name||model.id}`;downloads.push({modelId:model.id,...await this.tone3000.downloadModelBytes(model)});}
      let image=null;const imageUrl=getToneImageUrl(this._maintainerTone);
      if(imageUrl){this.controls.maintainerStatus.textContent='Downloading tone image…';try{image=await this.tone3000.downloadPublicAsset(imageUrl);}catch{/* An image failure must not discard valid selected captures. */}}
      this.controls.maintainerStatus.textContent='Building Factory ZIP and tone.json…';
      const bundle=await createFactoryBundle({tone:this._maintainerTone,models,downloads,kind:this._maintainerKind,image});
      downloadBlob(createZip(bundle.entries),bundle.filename);
      this.controls.maintainerStatus.textContent=`Exported ${bundle.filename}\nUnzip its tone3000/ folder into ${this._maintainerKind==='ir'?'src/cabinet-wam/IRs':'src/nam-wam/models'}, then run npm run factory-assets.`;
    } catch(error){this.controls.maintainerStatus.textContent=`Factory export failed: ${error.message}`;}
    finally{this.controls.maintainerExport.disabled=false;}
  }

  async loadTone3000Catalog() {
    if (!this.tone3000?.tokens?.access_token) return;
    this.controls.toneCatalog.hidden = false; this.controls.toneSelection.hidden = true; this.setToneStatus('Loading TONE3000 catalog…');
    try {
      const options = {page: this._tonePage, pageSize: 12, gear: this._toneGear};
      const result = this._toneFeed === 'latest' ? await this.tone3000.listLatestTones() : this._toneFeed === 'trending' ? await this.tone3000.listTrendingTones(this._toneGear) : await this.tone3000[`list${this._toneFeed[0].toUpperCase()}${this._toneFeed.slice(1)}Tones`](options);
      const tones = Array.isArray(result) ? result : result.data || [];
      this.controls.toneCards.replaceChildren(...tones.map((tone) => { const button=document.createElement('button'); button.type='button'; button.className='toneCard'; const image=document.createElement('img'); image.crossOrigin='anonymous'; image.referrerPolicy='no-referrer'; image.alt=''; image.src=getToneImageUrl(tone); const title=document.createElement('strong'); title.textContent=tone.title || tone.name || `Tone ${tone.id}`; const creator=document.createElement('small'); creator.textContent=tone.creator?.name || tone.creator_name || tone.user?.username || 'TONE3000 creator'; button.append(image,title,creator); button.onclick=()=>this.loadTone3000Selection(tone.id); return button; }));
      this.controls.tonePage.textContent = `Page ${this._tonePage}`; this.controls.tonePrev.disabled = this._tonePage <= 1; this.controls.toneNext.disabled = tones.length < 12; this.setToneStatus(tones.length ? 'Choose a tone to see compatible A2 models' : 'No tones found for this filter.');
    } catch (error) { this.setToneStatus(error.message, true); }
  }

  async loadTone3000Selection(toneId, {autoLoad = false} = {}) {
    try {
      this.setToneStatus('Loading tone metadata…');
      const tone = await this.tone3000.getTone(toneId);
      this.setToneStatus('Loading compatible A2 models…');
      this._toneModels = await this.tone3000.getCompatibleModels(toneId);
      this._toneModels = this._toneModels.filter((model) => String(model.architecture ?? 2) === '2');
      this.controls.toneSelection.hidden = false;
      this.controls.toneCatalog.hidden = true;
      const imageUrl = getToneImageUrl(tone);
      const toneTitle = tone.title || tone.name || `Tone ${toneId}`;
      this.setToneImage(this.controls.toneImage, imageUrl, `${toneTitle} — TONE3000 tone image`);
      this.controls.toneInfo.textContent = `${toneTitle}\nCreator: ${tone.creator?.name || tone.creator_name || tone.created_by || 'Unknown'}\nGear: ${tone.gear_type || tone.gear || 'NAM'}${tone.license ? `\nLicense: ${tone.license}` : ''}`;
      this.controls.toneModels.replaceChildren(...this._toneModels.map((model) => new Option(model.name || `Model ${model.id}`, String(model.id))));
      if (!this._toneModels.length) { this.setToneStatus('No compatible NAM A2 model is available for this tone.', true); this.controls.toneLoad.disabled = true; return; }
      this.controls.toneLoad.disabled = false; this.setToneStatus('Tone selected — choose an A2 model and load it');
      this._tone = tone; this._toneId = toneId;
      if (autoLoad) await this.loadTone3000Model();
    } catch (error) { this.setToneStatus(error.message, true); }
  }

  async loadTone3000Model() {
    const model = this._toneModels[Number(this.controls.toneModels.selectedIndex)];
    if (!model || this.controls.toneLoad.disabled) return;
    const toneId = this._toneId ?? this._tone?.id ?? this._tone?.tone_id;
    const provenance = {identity: `tone3000:${toneId}:${model.id}`, toneId, modelId: model.id,
      title: this._tone?.title || this._tone?.name, creator: this._tone?.creator?.name || this._tone?.creator_name,
      gear: this._tone?.gear || this._tone?.gear_type, format: this._tone?.format,
      license: this._tone?.license, imageUrl: getToneImageUrl(this._tone), source: 'TONE3000'};
    this.controls.toneLoad.disabled = true;
    try { this.setToneStatus('Downloading model…'); const downloaded = await this.tone3000.downloadModel(model); this.setToneStatus('Loading NAM model…'); await this.node.loadModelText(downloaded.text, downloaded.name, provenance); const record={...provenance,name:downloaded.name,text:downloaded.text,downloadedAt:new Date().toISOString()};try{await this.tone3000Downloads.save(record);this.upsertTone3000Asset(record);this.renderTone3000Downloads();this.setToneStatus('TONE3000 model loaded and saved on this device');}catch(cacheError){this.setToneStatus(`Model loaded, but local storage failed: ${cacheError.message}`,true);} }
    catch (error) { this.setToneStatus(error.message, true); }
    finally { this.controls.toneLoad.disabled = false; }
  }

  upsertTone3000Asset(download) {
    const {text, name, downloadedAt, ...provenance} = download;
    let asset = this._assets.find((entry) => entry.id === download.identity);
    if (!asset) asset = addExternalAsset(this._assets, {id: download.identity, filename: name || `${download.modelId}.nam`, relativePath: name || `${download.modelId}.nam`, groups: ['Downloaded on this device'], displayName: (download.title || name || `Model ${download.modelId}`).replace(/\.nam$/i,''), type:'nam', source:'TONE3000'});
    Object.assign(asset, {data:text || asset.data, filename:name || asset.filename, provenance, downloadedAt:downloadedAt || asset.downloadedAt, source:'TONE3000'});
    return asset;
  }

  async loadTone3000Downloads() {
    try {
      for (const download of await this.tone3000Downloads.list()) this.upsertTone3000Asset(download);
      this.renderBrowser(); this.renderTone3000Downloads();
    } catch (error) {
      this.setToneStatus(`Local TONE3000 downloads are unavailable: ${error.message}`, true);
    }
  }

  favoriteSnapshot(asset) {
    return {id:asset.id,filename:asset.filename,relativePath:asset.relativePath,groups:[...(asset.groups||[])],
      displayName:asset.displayName,type:asset.type,source:asset.source,contentHash:asset.contentHash,
      metadata:asset.metadata,provenance:asset.provenance,data:asset.data,downloadedAt:asset.downloadedAt,
      imagePath:asset.imagePath,category:asset.category,architecture:asset.architecture,version:asset.version,sampleRate:asset.sampleRate};
  }

  async loadFavorites() {
    try {
      for(const record of await this.modelFavorites.list()){
        this._favoriteIds.add(record.identity);
        if(!this._assets.some((asset)=>asset.id===record.identity)&&record.asset?.data)this._assets.push(record.asset);
      }
      this.renderBrowser();
    } catch(error) { this.setModelStatus({status:'error',error:`Favorites are unavailable: ${error.message}`}); }
  }

  isFavorite(asset) { return this._favoriteIds.has(asset.id); }

  async toggleFavorite(asset) {
    try {
      if(this.isFavorite(asset)){await this.modelFavorites.delete(asset.id);this._favoriteIds.delete(asset.id);}
      else{await this.modelFavorites.save(this.favoriteSnapshot(asset));this._favoriteIds.add(asset.id);}
      this.renderBrowser();
    } catch(error) { this.setModelStatus({status:'error',error:`Could not update favorite: ${error.message}`}); }
  }

  renderTone3000Downloads() {
    const assets = this._assets.filter((asset) => asset.source === 'TONE3000' && asset.downloadedAt && asset.data);
    this.controls.toneClear.hidden = assets.length === 0;
    this.controls.toneDownloadedList.replaceChildren(...assets.map((asset) => {
      const row=document.createElement('article'); row.className='downloadedTone';
      const visual=document.createElement('div'); visual.className='downloadedToneVisual'; visual.textContent='T3K';
      if(asset.provenance?.imageUrl){const image=document.createElement('img');image.alt='';image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.src=asset.provenance.imageUrl;image.onerror=()=>image.replaceWith(visual);row.append(image);}else row.append(visual);
      const meta=document.createElement('div');meta.className='downloadedToneMeta';const title=document.createElement('strong');title.textContent=asset.provenance?.title||asset.displayName;const by=document.createElement('small');by.textContent=[asset.provenance?.creator,asset.provenance?.license].filter(Boolean).join(' · ')||'TONE3000';meta.append(title,by);
      const actions=document.createElement('div');actions.className='downloadedToneActions';const load=document.createElement('button');load.type='button';load.textContent='Load';load.onclick=async()=>{try{await this.node.loadModelText(asset.data,asset.filename,asset.provenance);this._selectedId=asset.id;this.setToneStatus('Downloaded TONE3000 model loaded');this.renderBrowser();}catch(error){this.setToneStatus(error.message,true);}};const remove=document.createElement('button');remove.type='button';remove.className='downloadedToneDelete';remove.textContent='Delete';remove.onclick=()=>this.deleteTone3000Download(asset);actions.append(load,remove);row.append(meta,actions);return row;
    }));
  }

  async deleteTone3000Download(asset) {
    try {
      await this.tone3000Downloads.delete(asset.id);
      if(this.isFavorite(asset))delete asset.downloadedAt;else this._assets = this._assets.filter((entry) => entry.id !== asset.id);
      if (this._selectedId === asset.id&&!this.isFavorite(asset)) this._selectedId = '';
      this.renderBrowser(); this.renderTone3000Downloads();
      this.setToneStatus('Downloaded model deleted from this device. The current audio model remains active until another model is loaded.');
    } catch (error) { this.setToneStatus(`Could not delete the downloaded model: ${error.message}`, true); }
  }

  async clearTone3000Downloads() {
    if (typeof window.confirm === 'function' && !window.confirm('Delete all downloaded TONE3000 models from this device?')) return;
    try {
      await this.tone3000Downloads.clear();
      this._assets = this._assets.filter((asset) => {if(asset.source!=='TONE3000'||!asset.downloadedAt)return true;if(this.isFavorite(asset)){delete asset.downloadedAt;return true;}return false;});
      if (!this._assets.some((asset) => asset.id === this._selectedId)) this._selectedId = '';
      this.renderBrowser(); this.renderTone3000Downloads();
      this.setToneStatus('All downloaded TONE3000 models were deleted from this device.');
    } catch (error) { this.setToneStatus(`Could not delete local downloads: ${error.message}`, true); }
  }

  async loadManifest(){try{const response=await fetch(manifestUrl);if(!response.ok)throw Error(`HTTP ${response.status}`);const manifest=await response.json();this._assets=manifest.assets||[];this.renderBrowser();const state=await this.node.getState();if(state.model)this._modelListener(null,state.model);}catch(error){this.setModelStatus({status:'error',error:`Factory library unavailable: ${error.message}`});}}
  createFactoryAssetEntry(asset) {
    const button=document.createElement('button');button.className='factoryAsset';
    const fallback=document.createElement('span');fallback.className='factoryAssetVisual';fallback.textContent=asset.metadata?.gear_make||asset.metadata?.gear_type||'NAM';
    const imageUrl=factoryImageUrl(asset);
    if(imageUrl){const image=document.createElement('img');image.alt='';image.src=imageUrl;image.onerror=()=>image.replaceWith(fallback);button.append(image);}else button.append(fallback);
    const text=document.createElement('span');text.className='factoryAssetText';const title=document.createElement('strong');title.textContent=asset.displayName||asset.metadata?.name;const filename=document.createElement('small');filename.className='factoryAssetFilename';filename.textContent=`File: ${asset.filename}`;const gear=document.createElement('small');gear.textContent=[asset.metadata?.gear_make,asset.metadata?.gear_model].filter((value,index,array)=>value&&array.indexOf(value)===index).join(' · ')||asset.provenance?.title||'NAM capture';const attribution=document.createElement('small');attribution.textContent=[asset.metadata?.gear_type||asset.provenance?.gear,asset.metadata?.tone_type?.replaceAll('_',' '),(asset.metadata?.modeled_by||asset.provenance?.creator)&&`by ${asset.metadata?.modeled_by||asset.provenance?.creator}`,asset.provenance?.license].filter(Boolean).join(' · ');text.append(title,filename,gear,attribution);button.append(text);return button;
  }

  createFactoryToneCard(name,assets,selectedId,onSelect) {
    if(!assets.length||!assets.every((asset)=>asset.id.startsWith('factory:')&&asset.provenance?.toneId!=null))return null;
    const tone=assets[0];const card=document.createElement('section');card.className='factoryToneCard';
    const fallback=document.createElement('span');fallback.className='factoryToneVisual';fallback.textContent='NAM';const imageUrl=factoryImageUrl(tone);
    if(imageUrl){const image=document.createElement('img');image.className='factoryToneArtwork';image.alt='';image.src=imageUrl;image.onerror=()=>image.replaceWith(fallback);card.append(image);}else card.append(fallback);
    const body=document.createElement('div');body.className='factoryToneBody';const title=document.createElement('strong');title.className='factoryToneTitle';title.textContent=tone.provenance?.title||name;const meta=document.createElement('small');meta.className='factoryToneMeta';meta.textContent=[tone.provenance?.creator&&`by ${tone.provenance.creator}`,tone.provenance?.license,`${assets.length} capture${assets.length===1?'':'s'}`].filter(Boolean).join(' · ');
    const list=document.createElement('div');list.className='factoryCaptureList';list.setAttribute('role','list');for(const asset of assets){const row=document.createElement('div');row.className='factoryCaptureRow';const button=document.createElement('button');button.type='button';button.className='factoryCapture';button.dataset.assetId=asset.id;button.textContent=asset.filename;button.title=asset.filename;if(asset.id===selectedId)button.classList.add('selected');button.onclick=()=>onSelect(asset);const star=document.createElement('button');star.type='button';star.className='favoriteToggle';const favorite=this.isFavorite(asset);star.classList.toggle('active',favorite);star.textContent=favorite?'★':'☆';star.title=favorite?'Remove from favorites':'Add to favorites';star.setAttribute('aria-label',`${favorite?'Remove from':'Add to'} favorites: ${asset.filename}`);star.onclick=(event)=>{event.stopPropagation();this.toggleFavorite(asset);};row.append(button,star);list.append(row);}body.append(title,meta,list);card.append(body);return card;
  }

  renderBrowser() {
    const factoryAssets=this._assets.filter((asset)=>asset.source!=='TONE3000'&&!asset.id.startsWith('external:'));
    const counts={all:factoryAssets.length,guitar:0,bass:0,pedal:0};for(const asset of factoryAssets)if(Object.hasOwn(counts,asset.category))counts[asset.category]++;
    const labels={all:'All',guitar:'Guitar',bass:'Bass',pedal:'Pedals'};this.controls.factoryCategoryButtons.forEach((button)=>{button.textContent=`${labels[button.dataset.category]} ${counts[button.dataset.category]}`;});
    const sourceAssets=this._sourceFilter==='Favorites'?this._assets.filter((asset)=>this.isFavorite(asset)):this._sourceFilter==='TONE3000'?this._assets.filter((asset)=>asset.source==='TONE3000'):this._sourceFilter==='External'?this._assets.filter((asset)=>asset.source==='External'||asset.id.startsWith('external:')):factoryAssets;
    const assets=this._sourceFilter==='Factory'&&this._factoryCategory!=='all'?sourceAssets.filter((asset)=>asset.category===this._factoryCategory):sourceAssets;
    buildAssetTree(this.controls.browser,assets,{search:this.controls.search.value,selectedId:this._selectedId,
      renderAsset:this._sourceFilter==='Factory'?(asset)=>this.createFactoryAssetEntry(asset):undefined,
      renderGroup:this._sourceFilter==='Factory'||this._sourceFilter==='Favorites'?({name,assets,selectedId,onSelect})=>this.createFactoryToneCard(name,assets,selectedId,onSelect):undefined,
      isFavorite:(asset)=>this.isFavorite(asset),toggleFavorite:(asset)=>this.toggleFavorite(asset),
      onSelect:async(asset)=>{try{
        if(asset.source==='TONE3000'){if(!asset.data)throw Error('This TONE3000 model is not stored on this device');await this.node.loadModelText(asset.data,asset.filename,asset.provenance);this._selectedId=asset.id;this.controls.modelSource.textContent='TONE3000';this.renderBrowser();return;}
        if(asset.source==='External'||asset.id.startsWith('external:')){if(!asset.data)throw Error('External model data is unavailable in this session');await this.node.loadModelText(asset.data,asset.filename);this._selectedId=asset.id;this.controls.modelSource.textContent='External';this.renderBrowser();return;}
        const response=await fetch(factoryAssetUrl(manifestUrl,'models',asset.relativePath));if(!response.ok)throw Error(`HTTP ${response.status} while loading ${asset.filename}`);await this.node.loadModelText(await response.text(),asset.filename,factoryProvenance(asset));this._selectedId=asset.id;this.controls.modelSource.textContent='Factory';this.renderBrowser();
      }catch(error){this.setModelStatus({status:'error',error:error.message});}}
    });
  }
  async addExternal(text,name){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');const asset=addExternalAsset(this._assets,{id:`external:${hash}`,filename:name,relativePath:name,groups:['External'],displayName:name.replace(/\.nam$/i,''),type:'nam',source:'External',data:text});asset.data=text;this._selectedId=asset.id;this.controls.modelSource.textContent='External';this.setSourceFilter('External');this.renderBrowser();}
  destroy() { this.node.setSpectrumEnabled(false).catch(()=>{});this.node.removeEventListener('wam-automation', this._automation); this.node.removeMeterListener(this._meterListener);this.node.removeSpectrumListener(this._spectrumListener); this.node.removeModelListener(this._modelListener); window.removeEventListener('message', this._toneMessage); window.removeEventListener('storage', this._toneStorageMessage); this.removeEventListener('keydown', this._escapeListener); this._toneChannel?.close(); this._tonePopup?.close(); this.tone3000Downloads?.close(); this.modelFavorites?.close(); this.node.gui = null; }
}

if (!customElements.get('nam-a2-gui')) customElements.define('nam-a2-gui', NamA2Gui);
export const createElement = async (plugin) => new NamA2Gui().initialize(plugin);
