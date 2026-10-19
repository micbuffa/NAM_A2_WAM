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
const captureCountLabel = (count) => `${count} capture${count===1?'':'s'} disponible${count===1?'':'s'}`;
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
    this.toneSession=plugin.toneSession;
    this.node.gui = this;
    this.innerHTML = `
      <style>
        nam-a2-gui { --nam-accent:var(--tl-accent,#a688ff); --nam-panel:#17171d; display:block; min-width:0; color:var(--tl-text,#f3f0f7); font:13px/1.35 var(--tl-font-ui,Inter,ui-sans-serif,system-ui,sans-serif) }
        nam-a2-gui * { box-sizing:border-box } nam-a2-gui [hidden] { display:none!important } nam-a2-gui button,nam-a2-gui input,nam-a2-gui select { font:inherit }
        nam-a2-gui button,nam-a2-gui select,nam-a2-gui input[type=search] { color:var(--tl-text,#f3f0f7); background:var(--tl-surface-1,#101014); border:1px solid var(--tl-border-strong,#3a3642); border-radius:8px }
        nam-a2-gui button { min-height:34px; padding:0 12px; cursor:pointer } nam-a2-gui button:hover { border-color:var(--tl-accent,#776b91);background:var(--tl-surface-4,#1d1a24) }
        nam-a2-gui button:focus-visible,nam-a2-gui input:focus-visible,nam-a2-gui select:focus-visible,nam-a2-gui summary:focus-visible { outline:2px solid var(--nam-accent);outline-offset:2px } nam-a2-gui input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;width:16px;height:16px;margin:0;border:1px solid var(--tl-border-strong,#4a4452);border-radius:4px;background:var(--tl-surface-2,#17141c) center/14px no-repeat;cursor:pointer;vertical-align:middle}nam-a2-gui input[type=checkbox]:hover{border-color:var(--tl-border-hover,#6a6275)}nam-a2-gui input[type=checkbox]:checked{border-color:var(--nam-accent);background-color:var(--nam-accent);background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='%2310150d' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")}nam-a2-gui input[type=checkbox]:disabled{opacity:.35;cursor:not-allowed}
        nam-a2-gui .nam-module { overflow:hidden; background:linear-gradient(145deg,var(--tl-surface-6,#25232b),var(--tl-surface-3,#17171c) 55%,var(--tl-surface-2,#121217)); border:1px solid var(--tl-border-strong,#403b49); border-radius:15px; box-shadow:0 18px 44px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.04);transition:background .18s,border-color .18s,filter .18s }
        nam-a2-gui .nam-module.is-bypassed { background:linear-gradient(145deg,var(--tl-surface-6,#352126),var(--tl-surface-3,#21171a) 55%,var(--tl-surface-1,#171114));border-color:var(--tl-danger,#b45160);filter:saturate(.72) } nam-a2-gui .nam-module.is-bypassed .module-head { background:var(--tl-danger-tint,#351b21);border-bottom-color:var(--tl-danger,#723743) } nam-a2-gui .nam-module.is-bypassed .module-logo { filter:hue-rotate(72deg) saturate(1.45);opacity:.9 } nam-a2-gui .nam-module.is-bypassed .bypass-label { color:var(--tl-danger,#ffb2bc);font-weight:850 }
        nam-a2-gui .module-head { display:grid;grid-template-columns:80px minmax(0,1fr) 80px;align-items:center;gap:6px;padding:7px 12px;border-bottom:1px solid var(--tl-border,#393540);background:rgba(9,9,12,.28) }
        nam-a2-gui .module-logo { display:block;width:78px;height:25px;overflow:visible;justify-self:start;filter:drop-shadow(0 0 5px rgba(166,136,255,.2));transition:filter .18s,opacity .18s } nam-a2-gui .logo-badge { fill:var(--tl-on-accent,#17131d);stroke:var(--tl-accent,#6f58aa) } nam-a2-gui .logo-wave { fill:none;stroke:var(--tl-accent,#a688ff);stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round } nam-a2-gui .logo-nodes { fill:var(--tl-accent-hover,#e8e0ff);stroke:var(--tl-accent,#6f58aa);stroke-width:1 } nam-a2-gui .logo-word { fill:none;stroke:var(--tl-text,#eee9ff);stroke-width:5.2;stroke-linecap:round;stroke-linejoin:round } nam-a2-gui .logo-p { fill:none;stroke:var(--tl-accent,#a688ff);stroke-width:2.7;stroke-linecap:round;stroke-linejoin:round }
        nam-a2-gui .module-identity { min-width:0;text-align:center;line-height:1.15 } nam-a2-gui .module-name-row { display:flex;align-items:baseline;justify-content:center;min-width:0 } nam-a2-gui h2 { margin:0;font-size:14px;letter-spacing:.02em } nam-a2-gui .module-author { display:block;margin-top:1px;color:var(--tl-accent,#a99bc0);font-size:9px;font-weight:700;text-decoration:none;white-space:nowrap } nam-a2-gui .module-author:hover { color:var(--tl-accent-hover,#d9ccf0);text-decoration:underline } nam-a2-gui .module-subtitle { display:block;color:var(--tl-text-muted,#898391);font-size:10px;letter-spacing:.12em;text-transform:uppercase }
        nam-a2-gui .bypass-label { display:flex;align-items:center;justify-self:end;gap:5px;color:var(--tl-text-2,#aaa3b4);font-size:10px;letter-spacing:.07em;text-transform:uppercase } nam-a2-gui .bypass { width:13px;height:13px;margin:0;accent-color:var(--nam-accent) }
        nam-a2-gui .signal-flow { display:flex;align-items:center;justify-content:center;gap:3px;overflow-x:auto;padding:4px 8px;border-bottom:1px solid var(--tl-border,#34303b);background:var(--tl-surface-1,#111016);scrollbar-width:thin }
        nam-a2-gui .flow-stage { display:flex;align-items:center;gap:4px;min-width:max-content;padding:2px 5px;color:var(--tl-text,#ded7e8);background:var(--tl-surface-5,#24202b);border:1px solid var(--tl-accent-border,#4c435b);border-radius:999px;font-size:9px;font-weight:850;line-height:1.15;letter-spacing:.06em;text-transform:uppercase;transition:opacity .15s,border-color .15s,background .15s }
        nam-a2-gui .flow-stage::before { content:'';width:4px;height:4px;background:#8fdc9d;border-radius:50%;box-shadow:0 0 5px rgba(103,227,154,.45) } nam-a2-gui .flow-stage.amp { color:var(--tl-accent-hover,#eee6ff);background:var(--tl-accent-border,#302544);border-color:var(--tl-accent,#70579a) } nam-a2-gui .flow-stage.eq { color:var(--tl-warning,#ffd28c);background:#332716;border-color:var(--tl-warning,#806130) } nam-a2-gui .flow-stage.tone { color:#bbf0cf;background:var(--tl-surface-5,#182a20);border-color:#3b684c }
        nam-a2-gui .flow-stage.off { color:var(--tl-text-muted,#756f7c);background:var(--tl-surface-2,#16151a);border-color:var(--tl-border,#302d35);text-decoration:line-through;opacity:.62 } nam-a2-gui .flow-stage.off::before { background:var(--tl-text-muted,#716a77);box-shadow:none } nam-a2-gui .flow-stage small { color:inherit;font-size:9px;opacity:.72 } nam-a2-gui .flow-arrow { color:var(--tl-text-faint,#655d6d);font-size:9px }
        nam-a2-gui .signal-strip { display:grid;grid-template-columns:32px 58px minmax(0,1fr) 32px;gap:8px;align-items:center;margin:10px 12px 12px;padding:10px 8px;border:1px solid var(--tl-border-strong,#393541);border-radius:14px;background:rgba(8,8,11,.16);transition:border-color .16s ease-out,box-shadow .2s ease-out }
        nam-a2-gui .meter[data-meter=input] { grid-column:1;grid-row:1 } nam-a2-gui .noise-side { grid-column:2;grid-row:1 } nam-a2-gui .meter[data-meter=output] { grid-column:4;grid-row:1 }
        nam-a2-gui .noise-side { display:grid;justify-items:center;align-content:center;gap:10px;min-width:0 } nam-a2-gui .noise-side .knob-shell { width:28px;height:28px } nam-a2-gui .noise-side .knob-face { inset:2px } nam-a2-gui .noise-side .knob-pointer { top:3px;height:7px;transform-origin:50% 10px } nam-a2-gui .noise-side .knob-control { font-size:10px;transition:opacity .16s } nam-a2-gui .noise-side .knob-control output { font-size:9px } nam-a2-gui .noise-side.is-disabled .knob-control { opacity:.38 } nam-a2-gui .noise-side .knob-input:disabled { cursor:not-allowed }
        nam-a2-gui .meter { display:grid;grid-template-rows:auto 96px auto;justify-items:center;gap:5px;min-width:0 } nam-a2-gui .meter-label { color:var(--tl-text-2,#9a94a1);font-size:9px;font-weight:800;letter-spacing:.14em }
        nam-a2-gui .meter-track { position:relative;width:10px;height:96px;overflow:hidden;background:var(--tl-surface-0,#08090a);border:1px solid var(--tl-border-strong,#45404a);border-radius:7px }
        nam-a2-gui .meter-fill { position:absolute;inset:auto 0 0;height:0;background:linear-gradient(0deg,#58c66a 0 68%,var(--tl-warning,#e1bb4c) 84%,var(--tl-danger,#e45b66) 100%);transition:height 80ms linear }
        nam-a2-gui .clip { color:var(--tl-text-muted,#68636f);font-size:9px;font-weight:800 } nam-a2-gui .clip.active { color:var(--tl-danger,#ff6472) }
        nam-a2-gui .meter-values { position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0) }
        nam-a2-gui .knob-control { display:grid;justify-items:center;gap:5px;min-width:0;color:var(--tl-text-2,#9e98a7);font-size:10px;font-weight:750;text-align:center;text-transform:uppercase;letter-spacing:.08em;user-select:none } nam-a2-gui .knob-shell { position:relative;display:block;width:62px;height:62px } nam-a2-gui .knob-face { position:absolute;inset:3px;border:1px solid var(--tl-border-hover,#5a5364);border-radius:50%;background:radial-gradient(circle at 38% 30%,var(--tl-border-hover,#4b4653) 0 7%,var(--tl-surface-6,#292630) 35%,var(--tl-surface-1,#111116) 72%);box-shadow:inset 0 0 0 4px var(--tl-surface-3,#18171c),0 5px 12px rgba(0,0,0,.38) } nam-a2-gui .knob-face::before { content:'';position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 225deg,var(--nam-accent) var(--knob-sweep,135deg),var(--tl-border-strong,#3c3744) 0 270deg,transparent 0);mask:radial-gradient(farthest-side,transparent calc(100% - 3px),var(--tl-surface-sunken,#000) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),var(--tl-surface-sunken,#000) 0) } nam-a2-gui .knob-pointer { position:absolute;left:50%;top:7px;width:2px;height:18px;background:var(--tl-text,#eee9f6);border-radius:2px;transform:translateX(-50%) rotate(var(--knob-angle,0deg));transform-origin:50% 21px;box-shadow:0 0 4px rgba(255,255,255,.4) } nam-a2-gui .knob-input { position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ns-resize;touch-action:none } nam-a2-gui .knob-control:focus-within .knob-face { outline:2px solid var(--nam-accent);outline-offset:3px } nam-a2-gui .knob-control output { color:var(--tl-text,#f2edf8);font-size:11px;font-weight:750;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums }
        nam-a2-gui .amp-knobs { border-top:1px solid var(--tl-border,#393540);background:rgba(9,9,12,.24) } nam-a2-gui .amp-knobs>summary { padding:11px 16px;color:var(--tl-text-2,#aaa3b4);cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;list-style-position:inside } nam-a2-gui .amp-knobs[open]>summary { color:var(--tl-text,#ddd6e8);border-bottom:1px solid var(--tl-border,#332f39) } nam-a2-gui .tone-strip { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 8px;align-items:center;padding:16px } nam-a2-gui .amp-switches { display:flex;justify-content:center;align-items:center;gap:12px;grid-column:1/-1 } nam-a2-gui .section-switch { display:grid;justify-items:center;gap:5px;color:var(--tl-text-2,#aaa3b4);font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase } nam-a2-gui .section-switch input { accent-color:var(--nam-accent) } nam-a2-gui .noise-switch { justify-self:center;max-width:52px;text-align:center } nam-a2-gui .eqButton[aria-expanded=true] { color:var(--tl-on-accent,#18131f);background:var(--nam-accent);border-color:var(--nam-accent);font-weight:850 }
        nam-a2-gui .eq-panel { padding:14px 16px;border-top:1px solid var(--tl-border-strong,#484052);background:var(--tl-surface-1,#100f14) } nam-a2-gui .eq-toolbar { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px } nam-a2-gui .eq-toolbar-group { display:flex;align-items:center;gap:9px;flex-wrap:wrap;color:var(--tl-text-2,#aaa3b4);font-size:10px } nam-a2-gui .eq-toolbar input { accent-color:var(--nam-accent) } nam-a2-gui .eqPosition { min-height:32px;padding:0 8px } nam-a2-gui .eq-spectrum-legend { display:flex;align-items:center;gap:8px;color:var(--tl-text-2,#8d8693);font-size:9px } nam-a2-gui .eq-spectrum-legend span::before { content:'';display:inline-block;width:14px;margin-right:4px;border-top:2px solid;vertical-align:middle } nam-a2-gui .eq-spectrum-legend .input::before { border-color:#93a1b7;border-top-style:dashed } nam-a2-gui .eq-spectrum-legend .filtered::before { border-color:var(--tl-warning,#ffb04a) } nam-a2-gui .eq-spectrum-legend .final::before { border-color:#67e39a } nam-a2-gui .eq-graph-wrap { overflow:hidden;background:var(--tl-surface-0,#09090c);border:1px solid var(--tl-border-strong,#393541);border-radius:11px } nam-a2-gui .eqGraph { display:block;width:100%;height:250px;cursor:crosshair;touch-action:none;transition:opacity .15s } nam-a2-gui .eqGraph.disabled { opacity:.62 } nam-a2-gui .eq-spectrum-input-fill { fill:url(#namSpectrumInputFill);pointer-events:none } nam-a2-gui .eq-spectrum { fill:url(#namSpectrumFill);pointer-events:none;transition:opacity .12s linear } nam-a2-gui .eq-spectrum-input-line,nam-a2-gui .eq-spectrum-filtered-line,nam-a2-gui .eq-spectrum-final-line { fill:none;vector-effect:non-scaling-stroke;pointer-events:none } nam-a2-gui .eq-spectrum-input-line { stroke:#aab7ca;stroke-width:1.4;stroke-dasharray:5 4;stroke-opacity:.78 } nam-a2-gui .eq-spectrum-filtered-line { stroke:var(--tl-warning,#ffb04a);stroke-width:1.7;stroke-opacity:.94 } nam-a2-gui .eq-spectrum-final-line { stroke:#67e39a;stroke-width:1.8;stroke-opacity:.92 } nam-a2-gui .eq-grid-line { stroke:var(--tl-text-faint,#302d35);stroke-width:1 } nam-a2-gui .eq-zero-line { stroke:var(--tl-text-muted,#77717d);stroke-width:1.4 } nam-a2-gui .eq-grid-label,nam-a2-gui .eq-axis-label { fill:var(--tl-text-muted,#817a88);font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none } nam-a2-gui .eq-axis-label.spectrum { fill:var(--tl-text-muted,#686273);font-size:9px } nam-a2-gui .eq-band-curve { fill:none;stroke-width:1.45;stroke-opacity:.5;vector-effect:non-scaling-stroke;pointer-events:none } nam-a2-gui .eq-band-curve.selected { stroke-width:2.4;stroke-opacity:.92 } nam-a2-gui .eq-curve-fill { fill:url(#namEqFill) } nam-a2-gui .eq-curve { fill:none;stroke:var(--tl-text,#f3eef8);stroke-width:2.2;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 3px rgba(255,255,255,.18)) } nam-a2-gui .eq-node { stroke:var(--tl-on-accent,#09090c);stroke-width:3;cursor:grab;vector-effect:non-scaling-stroke } nam-a2-gui .eq-node:hover,nam-a2-gui .eq-node.selected { fill:var(--tl-text,#fff);stroke-width:4 } nam-a2-gui .eq-node:focus { outline:none;stroke:var(--tl-text,#fff) } nam-a2-gui .eq-node.dragging { cursor:grabbing } nam-a2-gui .eq-readout { display:flex;align-items:end;gap:8px;flex-wrap:wrap;padding:10px;background:var(--tl-surface-3,#17151c);border-top:1px solid var(--tl-border,#34303b) } nam-a2-gui .eq-band-name { min-width:118px;color:var(--tl-text,#eee9f4);font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.08em } nam-a2-gui .eq-band-name small { display:block;margin-top:2px;color:var(--tl-text-2,#9c94a4);font-size:9px;letter-spacing:.12em } nam-a2-gui .eq-value { display:grid;gap:3px;color:var(--tl-text-muted,#827b8a);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .eq-value input { width:86px;height:31px;padding:0 7px;color:var(--tl-text,#fff);background:var(--tl-surface-5,#22202a);border:1px solid var(--tl-border-strong,#403b49);border-radius:6px;font:11px ui-monospace,SFMono-Regular,Menlo,monospace } nam-a2-gui .eq-hint { margin:0 0 0 auto;color:var(--tl-text-muted,#746d7b);font-size:9px }
        nam-a2-gui .current-model { display:grid;grid-column:3;grid-row:1;grid-template-columns:minmax(120px,1fr) minmax(0,1fr);gap:10px;align-items:center;min-width:0;padding:10px;text-align:left;background:rgba(8,8,11,.48);border:1px solid var(--tl-border,#36323d);border-radius:12px }
        nam-a2-gui .currentModelArtwork { position:relative;width:100%;height:213px;overflow:hidden;background:var(--tl-surface-0,#0d0d11);border:1px solid var(--tl-border-strong,#443d4d);border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.3) }
        nam-a2-gui .currentModelInfo { min-width:0 }
        nam-a2-gui .mainCaptureMedia { min-width:0 }
        nam-a2-gui .mainCaptureViewer { display:grid;grid-template-columns:22px minmax(0,1fr) 22px;gap:4px;align-items:center }
        nam-a2-gui .mainCaptureViewer button { padding:0;min-width:0;height:40px;font-size:24px }
        nam-a2-gui .mainCaptureName { display:block;min-width:0;margin:7px 0 0;font-size:10px;line-height:1.4;overflow-wrap:anywhere;color:var(--tl-text,#ddd3e8) }
        nam-a2-gui .currentModelInfo .level-actions { align-items:center;flex-wrap:wrap;gap:5px }
        nam-a2-gui .currentModelInfo .level-actions .modelLevel { font-size:9px;letter-spacing:.03em;padding:3px 6px;white-space:nowrap }
        nam-a2-gui .currentModelInfo .level-actions button { font-size:10px;min-height:23px;padding:0 6px;white-space:nowrap }
        nam-a2-gui .currentToneImage { display:block;width:100%;height:100%;object-fit:contain }
        nam-a2-gui .currentModelFallback { display:grid;width:100%;height:100%;place-content:center;padding:7px;background:radial-gradient(circle at 75% 20%,var(--tl-accent-border,#4b3a69),var(--tl-surface-3,#18141f) 64%);text-align:center } nam-a2-gui .currentModelFallback strong { color:var(--tl-accent-hover,#e9ddff);font-size:11px;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .currentModelFallback small { overflow:hidden;max-width:70px;color:var(--tl-accent,#a99cba);font-size:9px;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .eyebrow { margin:0 0 7px;color:var(--tl-text-muted,#797381);font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase }
        nam-a2-gui .currentModel { display:block;color:var(--tl-text,#fff);font-size:12px;line-height:1.35;overflow-wrap:anywhere }
        nam-a2-gui .model-chips { display:flex;justify-content:flex-start;flex-wrap:wrap;gap:6px;margin-top:9px } nam-a2-gui .chip { padding:3px 7px;color:var(--tl-text-2,#bbb4c5);background:var(--tl-surface-5,#24212a);border:1px solid var(--tl-border-strong,#3a3543);border-radius:999px;font-size:10px;letter-spacing:.06em;text-transform:uppercase }
        nam-a2-gui .chip.source { color:var(--tl-accent-hover,#c7b8fb);border-color:var(--tl-accent-border,#5d4f7e) } nam-a2-gui .chip.modelLevel { color:#8ee6a0;background:var(--tl-surface-3,#142419);border-color:#376b43;font-variant-numeric:tabular-nums } nam-a2-gui .chip.modelLevel.inactive { color:var(--tl-danger,#ff9da9);background:var(--tl-surface-5,#2a171b);border-color:var(--tl-danger,#6e3941) } nam-a2-gui .drawer { border-top:1px solid var(--tl-border,#37333d);background:rgba(9,9,12,.36) }
        nam-a2-gui .level-actions { display:flex;justify-content:flex-start;gap:6px;margin-top:9px } nam-a2-gui .level-actions button { min-height:27px;padding:0 9px;font-size:9px } nam-a2-gui .calibrateLevel { color:var(--tl-accent-hover,#dcccff);border-color:var(--tl-accent-border,#655481) } nam-a2-gui .calibrateLevel:disabled { color:var(--tl-text-muted,#6d6873);cursor:default;border-color:var(--tl-border,#35313b) }
        nam-a2-gui .drawer>summary { padding:11px 16px;color:var(--tl-text-2,#aaa3b4);cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;list-style-position:inside }
        nam-a2-gui .drawer[open]>summary { color:var(--tl-text,#ddd6e8);border-bottom:1px solid var(--tl-border,#332f39) } nam-a2-gui .drawer-body { padding:13px 16px 16px }
        nam-a2-gui .source-tabs { display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px } nam-a2-gui .sourceTab[aria-pressed=true] { color:var(--tl-on-accent,#19151f);background:var(--nam-accent);border-color:var(--nam-accent);font-weight:800 }
        nam-a2-gui .factoryCategories { display:flex;gap:5px;overflow-x:auto;margin:-2px 0 10px;padding:2px 0;scrollbar-width:thin } nam-a2-gui .factoryCategory { min-height:28px;padding:0 9px;border-radius:999px;color:var(--tl-text-2,#9f98a9);font-size:9px;white-space:nowrap } nam-a2-gui .factoryCategory[aria-pressed=true] { color:var(--tl-on-accent,#17131d);background:var(--tl-accent,#c9b7ff);border-color:var(--tl-accent,#c9b7ff);font-weight:850 }
        nam-a2-gui .browser-tools { display:flex;gap:8px;margin-bottom:10px } nam-a2-gui .modelSearch { min-width:0;flex:1;height:36px;padding:0 10px }
        nam-a2-gui .file-action { display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;color:var(--tl-text,#d8cfdf);background:var(--tl-surface-1,#101014);border:1px solid var(--tl-border-strong,#3a3642);border-radius:8px;cursor:pointer;white-space:nowrap } nam-a2-gui .model { position:absolute;width:1px;height:1px;opacity:0;pointer-events:none }
        nam-a2-gui .modelBrowser { max-height:390px;overflow:auto;padding:7px;background:var(--tl-surface-0,#0d0d11);border:1px solid var(--tl-border,#332f39);border-radius:9px;scrollbar-width:thin }
        nam-a2-gui .modelBrowser:empty::after { content:'No models in this source';display:block;padding:14px;color:var(--tl-text-muted,#6f6976);text-align:center }
        nam-a2-gui .asset-entry { display:block;width:100%;min-height:29px;margin:2px 0;padding:4px 8px;overflow:hidden;color:var(--tl-text-2,#bbb5c3);background:transparent;border-color:transparent;text-align:left;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .asset-entry:hover { background:var(--tl-surface-5,#211e27) } nam-a2-gui .asset-entry.selected { color:var(--tl-text,#fff);background:var(--tl-accent-border,#493b66);border-color:var(--tl-accent,#75619c) }
        nam-a2-gui .factoryAsset { display:grid;grid-template-columns:48px minmax(0,1fr);gap:9px;align-items:center;min-height:68px;padding:6px;white-space:normal } nam-a2-gui .factoryAsset img,nam-a2-gui .factoryAssetVisual { width:48px;height:46px;object-fit:contain;background:var(--tl-surface-0,#0b0a0e);border-radius:6px } nam-a2-gui .factoryAssetVisual { display:grid;place-items:center;padding:4px;color:var(--tl-accent-hover,#d8c8ff);background:radial-gradient(circle at 70% 20%,var(--tl-accent-border,#4b3a69),var(--tl-surface-3,#18141f) 65%);font-size:9px;font-weight:850;text-align:center;text-transform:uppercase } nam-a2-gui .factoryAssetText { min-width:0 } nam-a2-gui .factoryAssetText strong,nam-a2-gui .factoryAssetText small { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryAssetText strong { color:var(--tl-text,#e6e0eb);font-size:10px } nam-a2-gui .factoryAssetText small { color:var(--tl-text-2,#8e8797);font-size:9px } nam-a2-gui .factoryAssetText .factoryAssetFilename { color:var(--tl-text-2,#b8aec4);font-family:var(--tl-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace) }
        nam-a2-gui .factoryToneCard { display:grid;grid-template-columns:82px minmax(0,1fr);gap:10px;margin:3px;padding:8px;background:var(--tl-surface-2,#15131a);border:1px solid var(--tl-border,#393342);border-radius:9px } nam-a2-gui .factoryToneArtwork,nam-a2-gui .factoryToneVisual { width:82px;height:68px;object-fit:contain;background:var(--tl-surface-0,#0a090d);border-radius:7px } nam-a2-gui .factoryToneVisual { display:grid;place-items:center;color:var(--tl-accent-hover,#d8c8ff);background:radial-gradient(circle at 70% 20%,var(--tl-accent-border,#4b3a69),var(--tl-surface-3,#18141f) 65%);font-size:9px;font-weight:850 } nam-a2-gui .factoryToneBody { min-width:0 } nam-a2-gui .factoryToneTitle { display:block;overflow:hidden;color:var(--tl-text,#f1ecf7);font-size:11px;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryToneMeta { display:block;overflow:hidden;margin:2px 0 5px;color:var(--tl-text-2,#8e8797);font-size:9px;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryCaptureList { display:grid;gap:2px;max-height:104px;overflow:auto;padding-right:3px;scrollbar-width:thin } nam-a2-gui .factoryCaptureRow,nam-a2-gui .assetRow { display:grid;grid-template-columns:minmax(0,1fr) 27px;gap:3px;align-items:center } nam-a2-gui .assetRow .asset-entry { min-width:0 } nam-a2-gui .factoryCapture { width:100%;min-width:0;min-height:25px;margin:0;padding:3px 7px;overflow:hidden;color:var(--tl-text-2,#c7becf);background:var(--tl-surface-0,#0d0c11);border-color:var(--tl-border-subtle,#29252f);border-radius:5px;text-align:left;text-overflow:ellipsis;white-space:nowrap;font:9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace } nam-a2-gui .factoryCapture:hover { background:var(--tl-surface-5,#211e27) } nam-a2-gui .factoryCapture.selected { color:var(--tl-text,#fff);background:var(--tl-accent-border,#493b66);border-color:var(--tl-accent,#856eb0) } nam-a2-gui .favoriteToggle { width:27px;min-width:27px;min-height:25px;padding:0;color:var(--tl-text-2,#8d8498);background:transparent;border-color:transparent;font-size:16px;line-height:1 } nam-a2-gui .favoriteToggle:hover,nam-a2-gui .favoriteToggle.active { color:var(--tl-warning,#ffd45f);background:var(--tl-surface-4,#292313);border-color:#69592b }
        nam-a2-gui .factoryToneCard { display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px;padding:10px } nam-a2-gui .factoryToneMedia,nam-a2-gui .factoryToneDetails { display:grid;align-content:start;gap:6px;min-width:0 } nam-a2-gui .factoryToneTitle { white-space:normal } nam-a2-gui .factoryToneMeta { margin:0;white-space:normal } nam-a2-gui .factoryToneViewer { display:grid;grid-template-columns:26px minmax(0,1fr) 26px;align-items:center;gap:5px } nam-a2-gui .factoryToneNav { min-height:62px;padding:0;font-size:22px } nam-a2-gui .factoryToneNav:disabled { color:var(--tl-text-muted,#68616f);opacity:.45;cursor:default } nam-a2-gui .factoryTonePick { display:grid;place-items:center;width:100%;min-height:166px;padding:4px;background:var(--tl-surface-0,#0a090d);border-color:var(--tl-border,#302a39) } nam-a2-gui .factoryTonePick.selected { border-color:var(--tl-accent,#856eb0);background:var(--tl-surface-5,#211a2b) } nam-a2-gui .factoryToneArtwork,nam-a2-gui .factoryToneVisual { width:100%;height:156px;object-fit:contain } nam-a2-gui .factoryToneFilename { display:block;overflow:hidden;color:var(--tl-text,#d9d1e2);font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:left;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryToneFooter { display:flex;align-items:center;justify-content:space-between;gap:6px } nam-a2-gui .factoryToneCounter { color:var(--tl-text-2,#8e8797);font-size:9px;text-align:left } nam-a2-gui .factoryToneFavorite { justify-self:end } nam-a2-gui .factoryCaptureList { position:relative;max-height:168px;min-height:84px;overflow-y:auto;overscroll-behavior:contain } nam-a2-gui .factoryCapture.loaded { border-color:var(--tl-accent,#8c77b3) } nam-a2-gui .factoryCaptureLabel { color:var(--tl-text-muted,#888190);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase }
        nam-a2-gui .preferencesBody { display:grid;gap:12px } nam-a2-gui .preferenceRow { display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.55fr);gap:12px;align-items:center } nam-a2-gui .preferenceRow strong,nam-a2-gui .preferenceRow small { display:block } nam-a2-gui .preferenceRow small { margin-top:3px;color:var(--tl-text-2,#8e8797);font-size:10px } nam-a2-gui .a2Variant { min-height:36px;padding:0 8px } nam-a2-gui .autoLevel { justify-self:end;width:18px;height:18px;accent-color:var(--nam-accent) }
        nam-a2-gui .modelBrowser details { margin-left:7px } nam-a2-gui .modelBrowser summary { padding:4px;color:var(--tl-text-2,#958e9e);cursor:pointer;font-size:11px }
        nam-a2-gui .tone3000-panel { display:grid;gap:9px;margin-top:10px;padding:11px;background:var(--tl-surface-2,#15131a);border:1px solid var(--tl-border-strong,#3b3544);border-radius:9px } nam-a2-gui .tone3000-head { display:flex;justify-content:space-between;align-items:center;gap:8px }
        nam-a2-gui .tone3000Auth { display:grid;justify-items:center;gap:12px;padding:15px 10px;text-align:center } nam-a2-gui .tone3000Logo { display:block;width:min(210px,80%);height:auto;margin:2px auto 3px } nam-a2-gui .tone3000AuthTitle { margin:0;color:var(--tl-text,#f3f0f7);font-size:14px;font-weight:750 } nam-a2-gui .tone3000AuthCopy { max-width:360px;margin:0;color:var(--tl-text-2,#aaa3b1);font-size:11px;line-height:1.5 }
        nam-a2-gui .tone3000Status,nam-a2-gui .tone3000Tone { margin:0;color:var(--tl-text-2,#9992a1);font-size:10px;white-space:pre-line } nam-a2-gui .tone3000Selection { display:grid;gap:8px } nam-a2-gui .tone3000Image { display:block;width:auto;max-width:100%;height:auto;max-height:320px;margin:0 auto;object-fit:contain;background:var(--tl-surface-0,#0d0d11);border:1px solid var(--tl-border-strong,#443d4d);border-radius:9px } nam-a2-gui .tone3000Selection select { width:100%;min-height:34px;padding:0 8px }
        nam-a2-gui .tone3000Catalog { display:grid;gap:9px } nam-a2-gui .tone3000CatalogTools { display:flex;gap:6px;flex-wrap:wrap } nam-a2-gui .tone3000CatalogTools button[aria-pressed=true] { color:var(--tl-on-accent,#19151f);background:var(--nam-accent);border-color:var(--nam-accent);font-weight:800 } nam-a2-gui .tone3000Gear { display:flex;gap:5px;overflow:auto;padding-bottom:2px } nam-a2-gui .tone3000Gear button { min-height:27px;padding:0 9px;border-radius:999px;font-size:10px;white-space:nowrap } nam-a2-gui .tone3000Cards { display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px;max-height:330px;overflow:auto;padding:2px } nam-a2-gui .toneCard { display:grid;gap:6px;min-width:0;padding:7px;color:var(--tl-text,#eee);background:var(--tl-surface-0,#0d0d11);border:1px solid var(--tl-border,#332f39);border-radius:9px;text-align:left } nam-a2-gui .toneCard:hover { border-color:var(--tl-accent,#776b91);background:var(--tl-surface-3,#191620) } nam-a2-gui .toneCard img { display:block;width:100%;height:92px;object-fit:contain;background:var(--tl-surface-0,#08080b);border-radius:6px } nam-a2-gui .toneCard strong { overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .toneCard small { overflow:hidden;color:var(--tl-text-2,#928b9d);text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .tone3000Pager { display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--tl-text-2,#8f8898);font-size:10px }
        nam-a2-gui .tone3000Downloads:not([open]) > :not(summary){display:none} nam-a2-gui .tone3000DownloadsHead{cursor:pointer} nam-a2-gui .tone3000DownloadsHead::before{content:"▸"} nam-a2-gui .tone3000Downloads[open]>.tone3000DownloadsHead::before{content:"▾"} nam-a2-gui .tone3000Downloads { display:grid;gap:8px;margin-top:2px;padding-top:9px;border-top:1px solid var(--tl-border,#332f39) } nam-a2-gui .tone3000DownloadsHead { display:flex;align-items:center;justify-content:space-between;gap:8px } nam-a2-gui .tone3000DownloadsHead strong { font-size:10px;letter-spacing:.09em;text-transform:uppercase } nam-a2-gui .tone3000Clear { min-height:27px;color:var(--tl-danger,#ffabb4);font-size:10px } nam-a2-gui .tone3000DownloadedList { display:grid;gap:6px;max-height:230px;overflow:auto } nam-a2-gui .tone3000DownloadedList:empty::after { content:'No model downloaded on this device';padding:9px;color:var(--tl-text-muted,#756e7c);text-align:center;font-size:10px } nam-a2-gui .downloadedTone { display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px;background:var(--tl-surface-0,#0d0d11);border:1px solid var(--tl-border,#332f39);border-radius:8px } nam-a2-gui .downloadedTone img,nam-a2-gui .downloadedToneVisual { width:52px;height:42px;object-fit:contain;background:var(--tl-surface-0,#09090c);border-radius:5px } nam-a2-gui .downloadedToneVisual { display:grid;place-items:center;color:var(--tl-accent-hover,#d8c8ff);font-size:9px;font-weight:850 } nam-a2-gui .downloadedToneMeta { min-width:0 } nam-a2-gui .downloadedToneMeta strong,nam-a2-gui .downloadedToneMeta small { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .downloadedToneMeta strong { font-size:10px } nam-a2-gui .downloadedToneMeta small { color:var(--tl-text-2,#8f8898);font-size:9px } nam-a2-gui .downloadedToneActions { display:flex;gap:5px } nam-a2-gui .downloadedToneActions button { min-height:28px;padding:0 8px;font-size:9px } nam-a2-gui .downloadedToneDelete { color:var(--tl-danger,#ffabb4) }
        nam-a2-gui .downloadedTone { grid-template-columns:minmax(0,1fr) auto } nam-a2-gui .downloadedToneSelect { display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:8px;min-width:0;padding:0;border:0;background:transparent;text-align:left } nam-a2-gui .downloadedToneSelect:hover { background:var(--tl-surface-5,#211e27) }
        nam-a2-gui .factoryMaintainer { display:grid;gap:9px;margin-top:2px;padding:10px;background:var(--tl-surface-1,#111018);border:1px dashed var(--tl-accent,#8067a8);border-radius:8px } nam-a2-gui .factoryMaintainer h3 { margin:0;color:var(--tl-accent-hover,#decfff);font-size:11px;letter-spacing:.08em;text-transform:uppercase } nam-a2-gui .factoryMaintainer p { margin:0;color:var(--tl-text-2,#9f96aa);font-size:10px } nam-a2-gui .factoryMaintainerActions { display:flex;gap:6px;flex-wrap:wrap } nam-a2-gui .factoryMaintainerModels { display:grid;gap:5px;max-height:190px;overflow:auto } nam-a2-gui .factoryMaintainerModel { display:flex;align-items:flex-start;gap:7px;padding:6px;background:var(--tl-surface-0,#0c0b10);border-radius:6px;color:var(--tl-text,#c8c0ce);font-size:10px } nam-a2-gui .factoryMaintainerModel input { margin-top:2px;accent-color:var(--nam-accent) } nam-a2-gui .factoryMaintainerExport { color:var(--tl-on-accent,#1b1521);background:var(--nam-accent);border-color:var(--nam-accent);font-weight:800 } nam-a2-gui .factoryMaintainerStatus { color:var(--tl-text-2,#b7adbf)!important;white-space:pre-line }
        nam-a2-gui .powered { color:var(--tl-text-muted,#6f6877);font-size:9px } nam-a2-gui .status { min-height:50px;margin:0;padding:10px;color:var(--tl-text-2,#aaa3b1);background:var(--tl-surface-0,#0d0d11);border-radius:8px;white-space:pre-line;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace }
        nam-a2-gui .error { color:var(--tl-danger,#ff9da9) }
        @media(max-width:720px){nam-a2-gui .eqGraph{height:210px}nam-a2-gui .eq-hint{width:100%;margin:0}nam-a2-gui .signal-flow{justify-content:flex-start}} @media(max-width:620px){nam-a2-gui .signal-strip{grid-template-columns:25px 46px minmax(0,1fr) 25px;gap:6px;padding:12px 8px}nam-a2-gui .current-model{grid-template-columns:minmax(98px,.96fr) minmax(0,1.04fr);gap:8px;padding:8px}nam-a2-gui .currentModelArtwork{height:188px}nam-a2-gui .browser-tools{flex-direction:column}} @media(max-width:410px){nam-a2-gui .current-model{grid-template-columns:minmax(0,1fr);gap:5px}nam-a2-gui .currentModelArtwork{height:144px}nam-a2-gui .currentModel{font-size:10px}nam-a2-gui .factoryToneCard{grid-template-columns:minmax(0,1fr)}nam-a2-gui .factoryCaptureList{max-height:110px}}
        nam-a2-gui .eqButton.is-off { color:var(--tl-danger,#ff9da9);border-color:var(--tl-danger,#8b4952);background:var(--tl-surface-5,#2b1b20) } nam-a2-gui .eq-panel.is-off .eq-graph-wrap { position:relative;opacity:.58 } nam-a2-gui .eq-panel.is-off .eq-graph-wrap::after { content:'EQ BYPASSED';position:absolute;top:10px;right:10px;padding:3px 6px;color:var(--tl-danger,#ffb3bb);background:var(--tl-surface-5,#301b21);border:1px solid var(--tl-danger,#874651);border-radius:5px;font-size:9px;font-weight:850;letter-spacing:.08em;pointer-events:none }
        nam-a2-gui .factoryCaptureLabel { color:var(--tl-text,#ded5eb);font-size:10px;font-weight:800;letter-spacing:.04em } nam-a2-gui .tone3000Selection { margin:0 } nam-a2-gui .tone3000Image { display:block;width:100%;height:156px;object-fit:contain;background:var(--tl-surface-0,#0d0d11);border:0;border-radius:7px }
        @media(max-width:620px){nam-a2-gui .signal-strip{grid-template-columns:25px 52px minmax(0,1fr) 25px;gap:5px;margin:8px;padding:8px 5px}}
        nam-a2-gui .signal-strip { grid-template-columns:44px 56px minmax(0,1fr) 44px }
        nam-a2-gui .meter-side { display:grid;justify-items:center;align-content:center;gap:8px;min-width:0 } nam-a2-gui .input-meter-side { grid-column:1;grid-row:1 } nam-a2-gui .output-meter-side { grid-column:4;grid-row:1 } nam-a2-gui .meter-side .meter { grid-column:auto;grid-row:auto;grid-template-rows:auto 72px auto } nam-a2-gui .meter-side .meter-track { height:72px }
        nam-a2-gui .meter-side .knob-shell { width:28px;height:28px } nam-a2-gui .meter-side .knob-face { inset:2px } nam-a2-gui .meter-side .knob-pointer { top:3px;height:7px;transform-origin:50% 10px } nam-a2-gui .meter-side .knob-control { font-size:10px;letter-spacing:0 } nam-a2-gui .meter-side .knob-control output { font-size:9px }
        nam-a2-gui .noise-side .knob-input,nam-a2-gui .meter-side .knob-input { inset:-7px auto auto -7px;width:42px;height:42px }
        nam-a2-gui .amp-controls { padding:9px }
        nam-a2-gui .amp-controls .eq-panel { min-width:0;padding:9px;border:1px solid var(--tl-border-strong,#484052);border-radius:9px }
        nam-a2-gui .amp-controls .eq-toolbar { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px }
        nam-a2-gui .amp-controls .eq-toolbar-group { gap:8px }
        nam-a2-gui .amp-controls .eq-toolbar-group>label { display:flex;align-items:center;gap:5px;min-height:32px }
        nam-a2-gui .amp-controls .tone-strip { display:grid;grid-template-columns:repeat(4,43px);gap:2px;align-items:center;padding:0;background:none }
        nam-a2-gui .amp-controls .amp-switches { display:flex;grid-column:auto;align-items:center;justify-content:center;min-height:0 }
        nam-a2-gui .amp-controls .section-switch { display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;white-space:nowrap }
        nam-a2-gui .amp-controls .section-switch input { margin:0 }
        nam-a2-gui .tone-strip .knob-shell { width:28px;height:28px }
        nam-a2-gui .tone-strip .knob-face { inset:2px }
        nam-a2-gui .tone-strip .knob-pointer { top:3px;height:7px;transform-origin:50% 10px }
        nam-a2-gui .tone-strip .knob-input { inset:-7px auto auto -7px;width:42px;height:42px }
        nam-a2-gui .tone-strip .knob-control { gap:3px;font-size:10px;letter-spacing:0;transition:opacity .16s }
        nam-a2-gui .tone-strip .knob-control output { font-size:9px }
        nam-a2-gui .amp-controls .eq-subtoolbar { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:7px;margin-bottom:8px }
        nam-a2-gui .amp-controls .eq-subtoolbar .eqReset { min-height:27px;padding:0 8px;font-size:9px }
        nam-a2-gui .plugin-tabs { display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;background:var(--tl-surface-1,#111016);border-bottom:1px solid var(--tl-border,#34303b) }
        nam-a2-gui .plugin-tab { flex:0 0 auto;min-width:0;min-height:30px;padding:0 14px;overflow:hidden;color:var(--tl-text-2,#8f8997);background:transparent;border-color:transparent;border-radius:6px;font-size:9px;font-weight:800;letter-spacing:.04em;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .plugin-tab:hover { color:var(--tl-text,#ddd5e7);background:var(--tl-surface-4,#1d1a24) }
        nam-a2-gui .plugin-tab[aria-selected=true] { color:var(--tl-on-accent,#18131f);background:var(--nam-accent);border-color:var(--nam-accent) }
        nam-a2-gui .plugin-panel { min-width:0 }
        nam-a2-gui .plugin-panel[hidden] { display:none!important }
        nam-a2-gui .tab-content { padding:13px 16px 16px;background:rgba(9,9,12,.36) }
        nam-a2-gui .modelHoverCard { position:absolute;z-index:10000;width:320px;max-width:calc(100% - 20px);max-height:360px;overflow:auto;padding:11px 12px;color:var(--tl-text,#d8d2df);background:rgba(13,12,17,.97);border:1px solid var(--tl-accent,#76628f);border-radius:9px;box-shadow:0 14px 38px rgba(0,0,0,.58),0 0 18px rgba(166,136,255,.16);pointer-events:none }
        nam-a2-gui .modelHoverCard strong { display:block;margin-bottom:7px;color:var(--tl-text,#fff);font-size:12px;line-height:1.3 }
        nam-a2-gui .modelHoverDetails { margin:0;color:var(--tl-text-2,#aaa2b3);white-space:pre-wrap;font:9px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace }
        nam-a2-gui .aboutBody { display:grid;gap:11px;max-height:430px;overflow:auto }
        nam-a2-gui .aboutBody h3,nam-a2-gui .aboutBody h4,nam-a2-gui .aboutBody p { margin:0 }
        nam-a2-gui .aboutBody h3 { color:var(--tl-text,#f2edf8);font-size:15px }
        nam-a2-gui .aboutBody h4 { margin-bottom:3px;color:var(--tl-accent-hover,#d9ccff);font-size:10px;letter-spacing:.06em;text-transform:uppercase }
        nam-a2-gui .aboutBody p { color:var(--tl-text-2,#aaa3b1);font-size:10px;line-height:1.5 }
        nam-a2-gui .aboutBody a { color:var(--tl-accent-hover,#c9b7ff);text-underline-offset:2px } nam-a2-gui .aboutBody a:hover { color:var(--tl-accent-hover,#eee8ff) }
        nam-a2-gui .aboutFlow { padding:8px 10px;color:var(--tl-text,#e8e0f2);background:var(--tl-surface-2,#17131d);border:1px solid var(--tl-accent-border,#514361);border-radius:8px;font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center }
        nam-a2-gui .aboutSections { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px }
        nam-a2-gui .aboutSections article,nam-a2-gui .aboutNotes,nam-a2-gui .gettingStarted { padding:9px;background:var(--tl-surface-1,#111016);border:1px solid var(--tl-border,#34303b);border-radius:8px }
        nam-a2-gui .aboutNotes,nam-a2-gui .gettingStarted { display:grid;gap:5px }
        nam-a2-gui .gettingStarted ol { display:grid;gap:6px;margin:2px 0 0;padding-left:22px;color:var(--tl-text-2,#aaa3b1);font-size:10px;line-height:1.5 }
        nam-a2-gui .gettingStarted li::marker { color:var(--nam-accent);font-weight:850 }
        nam-a2-gui .mainPanel .signal-flow { border-top:1px solid var(--tl-border,#34303b);border-bottom:0 }
        nam-a2-gui .mainPanel .signal-strip { margin-top:10px;margin-bottom:8px }
        @media(max-width:620px){nam-a2-gui .plugin-tabs{justify-content:flex-start;overflow-x:auto}nam-a2-gui .plugin-tab{padding:0 10px}nam-a2-gui .aboutSections{grid-template-columns:minmax(0,1fr)}}
        nam-a2-gui .tone3000-head { justify-content:space-between } nam-a2-gui .tone3000-head-actions { display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap } nam-a2-gui .tone3000Back { min-height:34px;padding:0 8px;color:var(--tl-accent-hover,#d6c8ec);font-size:10px }
        @media(max-width:620px){nam-a2-gui .signal-strip{grid-template-columns:42px 52px minmax(0,1fr) 42px}}
        nam-a2-gui .mainPanel .signal-strip { grid-template-columns:52px minmax(0,1fr) 44px;align-items:start }
        nam-a2-gui .mainPanel .current-model { grid-column:2;grid-template-columns:minmax(120px,1.2fr) minmax(0,1fr) }
        nam-a2-gui .mainPanel .output-meter-side { grid-column:3 }
        nam-a2-gui .mainCaptureMedia .currentModelArtwork { display:flex;flex-direction:column }
        nam-a2-gui .mainCaptureMedia .currentToneImage,nam-a2-gui .mainCaptureMedia .currentModelFallback { flex:1 1 0;min-height:0;height:0 }
        nam-a2-gui .mainCaptureMedia .noise-side { display:flex;flex:0 0 auto;justify-content:center;align-items:center;flex-wrap:wrap;gap:8px;margin:0;padding:5px 3px;border-top:1px solid var(--tl-border,#302b37);background:var(--tl-surface-2,#141118) }
        nam-a2-gui .mainCaptureMedia .noise-switch { display:flex;align-items:center;gap:4px;max-width:none;margin:0;font-size:10px;letter-spacing:.02em;white-space:nowrap }
        nam-a2-gui .mainCaptureMedia .noise-switch input { width:11px;height:11px;margin:0 }
        nam-a2-gui .mainCaptureMedia .noise-side .knob-control { display:flex;align-items:center;gap:5px;margin:0 }
        nam-a2-gui .mainCaptureMedia .noise-side .knob-label { display:none }
        nam-a2-gui .mainCaptureMedia .noise-side .knob-shell { width:23px;height:23px }
        nam-a2-gui .mainCaptureMedia .noise-side .knob-pointer { top:3px;height:6px;transform-origin:50% 7.5px }
        nam-a2-gui .mainCaptureMedia .noise-side .knob-input { inset:-5px auto auto -5px;width:33px;height:33px }
        nam-a2-gui .mainCaptureMedia .noise-side output { font-size:9px }
        @media(max-width:410px){nam-a2-gui .mainPanel .current-model{grid-template-columns:minmax(0,1fr)}}
        @media(prefers-reduced-motion:reduce){nam-a2-gui .signal-strip{transition:none}}
        nam-a2-gui .editor-navigation { display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--tl-border,#34303b); }
        nam-a2-gui .editor-model-name { max-width:100%;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        nam-a2-gui .editor-navigation button { flex-shrink:0; }
        nam-a2-gui:not([data-editor-view="models"]) .plugin-tabs { display:none; }
        nam-a2-gui .editor-actions { display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap; }
        nam-a2-gui .editor-action[aria-pressed="true"] { border-color:var(--nam-accent);color:var(--nam-accent); }
        nam-a2-gui[data-editor-view="models"] .mainPanel .meter-side,nam-a2-gui[data-editor-view="models"] .mainPanel .signal-flow { display:none; }
        nam-a2-gui[data-editor-view="models"] .mainPanel .signal-strip { grid-template-columns:minmax(0,1fr); }
        nam-a2-gui[data-editor-view="models"] .mainPanel .current-model { grid-column:1; }
        nam-a2-gui .editor-navigation .change-model { min-height:42px;padding:0 24px;font-size:14px;font-weight:800;color:var(--tl-on-accent,#191322);background:var(--nam-accent);border-color:var(--nam-accent);box-shadow:0 3px 12px #0004; }
        nam-a2-gui .editor-navigation .change-model:hover { filter:brightness(1.12); }
        nam-a2-gui .amp-controls .noise-side { display:flex;align-items:center;gap:12px;padding:6px 12px;border:1px solid var(--tl-border-strong,#484052);border-radius:8px; }
        nam-a2-gui .amp-controls .noise-switch { order:-1;max-width:none;font-size:9px; }
        nam-a2-gui .amp-controls .noise-side .knob-shell { width:36px;height:36px; }
        nam-a2-gui .amp-controls .noise-side .knob-pointer { top:4px;height:10px;transform-origin:50% 12px; }
        nam-a2-gui .amp-controls .noise-side .knob-input { inset:-3px;width:42px;height:42px; }
        nam-a2-gui .editor-navigation [hidden] { display:none; }
        nam-a2-gui[host-tabs] .module-head,nam-a2-gui[host-tabs] .editor-action,nam-a2-gui[host-tabs] .back-to-amp { display:none!important; }
        nam-a2-gui .modelCalibration { margin:12px 16px;padding:12px;border:1px solid var(--tl-border-strong,#484052);border-radius:8px; }
        nam-a2-gui .calibrationActions { display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px; }
        nam-a2-gui .calibrationActions .level-actions { margin:0;flex-wrap:wrap; }
        nam-a2-gui .calibrationActions button { min-height:34px;font-size:11px; }
        nam-a2-gui .modelDetails { margin:0 16px 12px;border:1px solid var(--tl-border,#34303b);border-radius:8px;padding:10px; }
        nam-a2-gui .modelDetails .meter-side,nam-a2-gui .modelDetails .signal-flow { display:none; }
        nam-a2-gui .modelDetails .signal-strip { grid-template-columns:minmax(0,1fr); }
        nam-a2-gui .modelDetails .current-model { grid-column:1; }
        nam-a2-gui .factoryToneCard.current-model-card { border-color:var(--nam-accent);box-shadow:inset 3px 0 var(--nam-accent); }
        nam-a2-gui .factoryToneCard.current-model-card .factoryToneTitle::after { content:"Current model";display:inline-block;margin-left:8px;padding:3px 6px;border-radius:4px;background:var(--tl-accent-border,#493b64);color:var(--tl-accent-hover,#e7dcff);font-size:9px; }
        /* Amp settings, TONELAB editor layout: a plugin face card, then gain staging, model details and EQ cards. */
        nam-a2-gui[host-tabs] .nam-module { overflow:visible;background:none;border:0;border-radius:0;box-shadow:none }
        nam-a2-gui[host-tabs] .amp-knobs { border-top:0;background:none }
        nam-a2-gui[host-tabs] .ampPanel,nam-a2-gui[host-tabs] .editor-navigation+.plugin-panel { margin-top:12px }
        nam-a2-gui[host-tabs] .ampPanel { display:grid;gap:12px } nam-a2-gui[host-tabs] .ampPanel[hidden] { display:none }
        nam-a2-gui .editor-navigation { display:block;justify-items:stretch;padding:0;overflow:hidden;background:var(--tl-surface-3,#181b19);border:1px solid var(--tl-border-strong,#3a3642);border-radius:12px }
        nam-a2-gui[data-editor-view="preferences"] .editor-navigation,nam-a2-gui[data-editor-view="about"] .editor-navigation,nam-a2-gui[data-editor-view="details"] .editor-navigation { display:none }
        nam-a2-gui:not([host-tabs])[data-editor-view="preferences"] .editor-navigation,nam-a2-gui:not([host-tabs])[data-editor-view="about"] .editor-navigation,nam-a2-gui:not([host-tabs])[data-editor-view="details"] .editor-navigation { display:block }
        nam-a2-gui .plugin-face-head { display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--tl-border,#34303b) }
        nam-a2-gui .plugin-face-head>div { display:grid;gap:2px;flex:1;min-width:0 } nam-a2-gui .plugin-face-head strong { color:var(--tl-text,#f3f0f7);font-size:12px }
        nam-a2-gui .plugin-face-head small,nam-a2-gui .plugin-face-format,nam-a2-gui .plugin-face-eyebrow { color:var(--tl-text-muted,#898391);font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase }
        nam-a2-gui .plugin-face-format { font-family:var(--tl-font-mono,ui-monospace,monospace);letter-spacing:.06em }
        nam-a2-gui .plugin-face-icon { display:grid;place-items:center;flex:none;width:34px;height:34px;color:var(--nam-accent);background:var(--tl-accent-tint,#a688ff1a);border:1px solid var(--tl-accent-border,#4c435b);border-radius:8px }
        nam-a2-gui .plugin-face-icon svg { width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round }
        nam-a2-gui .plugin-face-model { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 20px 22px }
        nam-a2-gui .plugin-face-copy { display:grid;gap:6px;min-width:0;flex:1 1 240px }
        nam-a2-gui .editor-navigation .editor-model-name { max-width:100%;color:var(--tl-text,#f3f0f7);font-size:19px;line-height:1.25;white-space:normal;overflow-wrap:anywhere;font-weight:700;letter-spacing:-.01em }
        nam-a2-gui .editor-model-meta { min-height:13px;overflow:hidden;color:var(--tl-text-muted,#898391);font-size:10px;text-overflow:ellipsis;white-space:nowrap }
        nam-a2-gui .editor-navigation .editor-actions { justify-content:flex-end }
        nam-a2-gui .editor-navigation .change-model { min-height:36px;padding:0 14px;color:var(--nam-accent);background:var(--tl-accent-tint,#a688ff1a);border-color:var(--tl-accent-border,#4c435b);box-shadow:none;font-size:11px;font-weight:700 }
        nam-a2-gui .editor-navigation .change-model:hover { color:var(--tl-on-accent,#191322);background:var(--nam-accent);border-color:var(--nam-accent);filter:none }
        nam-a2-gui .editor-navigation .back-to-amp { margin:0 20px 14px }
        nam-a2-gui .modelCalibration,nam-a2-gui .modelDetails,nam-a2-gui .amp-controls .eq-panel { margin:0;background:var(--tl-surface-3,#181b19);border:1px solid var(--tl-border-strong,#3a3642);border-radius:12px }
        nam-a2-gui:not([host-tabs]) .modelCalibration,nam-a2-gui:not([host-tabs]) .modelDetails { margin:12px 16px }
        nam-a2-gui .modelCalibration { padding:18px 20px }
        nam-a2-gui .modelCalibration .preferenceRow { grid-template-columns:minmax(0,1fr) auto }
        nam-a2-gui .modelCalibration .preferenceRow>span { display:grid;gap:6px } nam-a2-gui .modelCalibration .preferenceRow strong { color:var(--tl-text,#f3f0f7);font-size:13px }
        nam-a2-gui .modelCalibration .preferenceRow small { max-width:640px;color:var(--tl-text-2,#aaa3b4);font-size:10px;line-height:1.5 }
        nam-a2-gui .modelCalibration .preferenceRow input[type=checkbox] { width:22px;height:22px;border-radius:6px;background-size:17px }
        nam-a2-gui .calibrationActions { margin-top:14px } nam-a2-gui .calibrationActions .chip.modelLevel { padding:6px 10px;border-radius:999px;font:600 9px var(--tl-font-mono,ui-monospace,monospace);letter-spacing:.06em }
        nam-a2-gui .calibrationActions button { min-height:30px;font-size:10px }
        nam-a2-gui[host-tabs] .amp-controls { padding:0 }
        nam-a2-gui .amp-controls .eq-panel { padding:0;overflow:hidden }
        nam-a2-gui .amp-controls .eq-toolbar { margin:0;padding:12px 16px;border-bottom:1px solid var(--tl-border,#34303b) }
        nam-a2-gui .amp-controls .eq-subtoolbar { margin:0;padding:12px 16px 8px }
        nam-a2-gui .amp-controls .eq-graph-wrap { margin:0 16px 16px }
        /* Amp models: a modal catalogue over the editor, tones as a grid of photo cards. */
        nam-a2-gui .nam-models-dialog { width:min(880px,calc(100% - 32px));max-width:none;height:min(820px,calc(100% - 48px));max-height:none;margin:auto;padding:0;overflow:hidden;color:var(--tl-text,#f3f0f7);background:var(--tl-surface-2,#141615);border:1px solid var(--tl-border-strong,#3a3642);border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.6) }
        nam-a2-gui .nam-models-dialog[open] { display:flex;flex-direction:column } nam-a2-gui .nam-models-dialog::backdrop { background:rgba(4,6,5,.62);backdrop-filter:blur(2px) }
        nam-a2-gui .nam-models-head { display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 22px 16px;border-bottom:1px solid var(--tl-border,#34303b) }
        nam-a2-gui .nam-models-head>div { display:grid;gap:5px;min-width:0 } nam-a2-gui .nam-models-head h3 { margin:0;color:var(--tl-text,#f3f0f7);font-size:19px;font-weight:600 } nam-a2-gui .nam-models-head p { margin:0;color:var(--tl-text-muted,#898391);font-size:10px }
        nam-a2-gui .nam-models-close { display:grid;place-items:center;flex:none;width:36px;height:36px;min-height:0;padding:0;color:var(--tl-text-2,#aaa3b4);background:none }
        nam-a2-gui .nam-models-close svg { width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round }
        nam-a2-gui .nam-models-dialog .modelsPanel { flex:1;min-height:0;overflow:auto;background:none;border:0 } nam-a2-gui .nam-models-dialog .modelsPanel>.tab-content { padding:16px 22px 22px;background:none }
        nam-a2-gui .modelBrowser { display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:12px;align-items:start;max-height:none;overflow:visible;padding:0;background:none;border:0 }
        nam-a2-gui .modelBrowser>:not(.factoryToneCard) { grid-column:1/-1 }
        nam-a2-gui .modelBrowser:empty { display:block }
        nam-a2-gui .modelBrowser details[open]:has(>.factoryToneCard) { display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:12px;align-items:start }
        nam-a2-gui .modelBrowser details>summary { grid-column:1/-1;padding:4px 2px;color:var(--tl-text-muted,#898391);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer }
        nam-a2-gui .modelBrowser .factoryToneCard { display:block;margin:0;padding:0;overflow:hidden;background:var(--tl-surface-3,#181b19);border:1px solid var(--tl-border-strong,#3a3642);border-radius:12px;box-shadow:none }
        nam-a2-gui .modelBrowser .factoryToneCard.current-model-card { border-color:var(--tl-accent-border,#5d6b3a);box-shadow:none }
        nam-a2-gui .modelBrowser .factoryToneCard.is-open { grid-column:1/-1 }
        nam-a2-gui .modelBrowser .factoryToneCard:not(.is-open)>.factoryToneMedia,nam-a2-gui .modelBrowser .factoryToneCard:not(.is-open)>.factoryToneDetails { display:none }
        nam-a2-gui .modelBrowser .factoryToneCard.is-open { display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px }
        nam-a2-gui .modelBrowser .factoryToneCard.is-open>.factoryToneSummary { order:-1;grid-column:1/-1;border-bottom:1px solid var(--tl-border,#34303b);border-radius:0 }
        nam-a2-gui .modelBrowser .factoryToneCard.is-open>.factoryToneMedia { padding:0 0 12px 12px } nam-a2-gui .modelBrowser .factoryToneCard.is-open>.factoryToneDetails { padding:0 12px 12px 0 }
        nam-a2-gui .modelBrowser .factoryToneCard>.factoryToneMedia>.factoryToneTitle,nam-a2-gui .modelBrowser .factoryToneCard>.factoryToneMedia>.factoryToneMeta { display:none }
        nam-a2-gui .factoryToneSummary { display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:16px;align-items:center;width:100%;min-height:0;padding:10px;color:inherit;text-align:left;background:none;border:0;border-radius:12px }
        nam-a2-gui .factoryToneSummary:hover { background:var(--tl-surface-4,#1d201e) }
        nam-a2-gui .factoryToneThumb { position:relative;display:block;height:106px;overflow:hidden;background:var(--tl-surface-0,#0a0b0a) linear-gradient(135deg,var(--tl-surface-4,#1d201e),var(--tl-surface-0,#0a0b0a));border-radius:8px }
        nam-a2-gui .factoryToneThumb img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover }
        nam-a2-gui .factoryToneThumb b { position:absolute;right:8px;bottom:7px;left:8px;overflow:hidden;color:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;text-overflow:ellipsis;text-shadow:0 1px 4px #000;text-transform:uppercase;white-space:nowrap }
        nam-a2-gui .factoryToneThumb::after { content:'';position:absolute;inset:50% 0 0;background:linear-gradient(transparent,rgba(0,0,0,.7)) } nam-a2-gui .factoryToneThumb b { z-index:1 }
        nam-a2-gui .factoryToneSummaryText { display:grid;gap:6px;min-width:0 } nam-a2-gui .factoryToneSummaryText strong { color:var(--tl-text,#f3f0f7);font-size:12px;line-height:1.3 }
        nam-a2-gui .factoryToneSummaryText small { overflow:hidden;color:var(--tl-text-muted,#898391);font-size:10px;text-overflow:ellipsis;white-space:nowrap } nam-a2-gui .factoryToneSummaryCount { font-family:var(--tl-font-mono,ui-monospace,monospace);font-size:9px!important }
        nam-a2-gui .factoryToneCheck { display:grid;place-items:center;align-self:start;width:20px;height:20px;color:var(--tl-on-accent,#10150d);background:var(--nam-accent);border-radius:50%;font-size:11px;font-style:normal;font-weight:800;visibility:hidden }
        nam-a2-gui .current-model-card .factoryToneCheck { visibility:visible }
        @media(max-width:520px){nam-a2-gui .nam-models-dialog{width:calc(100% - 16px);height:calc(100% - 16px)}nam-a2-gui .nam-models-head,nam-a2-gui .nam-models-dialog .modelsPanel>.tab-content{padding-left:14px;padding-right:14px}nam-a2-gui .factoryToneSummary{grid-template-columns:104px minmax(0,1fr) auto;gap:12px}nam-a2-gui .factoryToneThumb{height:78px}nam-a2-gui .modelBrowser .factoryToneCard.is-open{grid-template-columns:minmax(0,1fr)}nam-a2-gui .modelBrowser .factoryToneCard.is-open>.factoryToneMedia,nam-a2-gui .modelBrowser .factoryToneCard.is-open>.factoryToneDetails{padding:0 12px 12px}}
        /* Preferences and Help, TONELAB editor layout: an intro, then cards. */
        nam-a2-gui[host-tabs] .preferencesPanel>.tab-content,nam-a2-gui[host-tabs] .aboutPanel>.tab-content { padding:4px 0 0;background:none }
        nam-a2-gui .panel-intro { display:grid;gap:6px;margin-bottom:6px } nam-a2-gui .panel-intro h3 { margin:0;color:var(--tl-text,#f3f0f7);font-size:19px;font-weight:600 }
        nam-a2-gui .panel-intro p { margin:0;color:var(--tl-text-2,#aaa3b4);font-size:10px;line-height:1.5 }
        nam-a2-gui .preferencesBody { gap:10px }
        nam-a2-gui .preferencesBody>.preferenceRow { grid-template-columns:minmax(0,1fr) minmax(180px,auto);gap:16px;padding:16px 18px;background:var(--tl-surface-3,#181b19);border:1px solid var(--tl-border-strong,#3a3642);border-radius:12px }
        nam-a2-gui .preferencesBody>.preferenceRow strong { color:var(--tl-text,#f3f0f7);font-size:11px } nam-a2-gui .preferencesBody>.preferenceRow small { margin-top:5px;color:var(--tl-text-muted,#898391);font-size:10px }
        nam-a2-gui .preferencesBody .a2Variant { min-height:36px;padding:0 10px }
        nam-a2-gui[host-tabs] .aboutBody { gap:12px;max-height:none;overflow:visible }
        nam-a2-gui .aboutBody .panel-intro h3 { font-size:19px }
        nam-a2-gui .aboutBody .panel-intro p { max-width:720px }
        nam-a2-gui .aboutBody .gettingStarted,nam-a2-gui .aboutBody .aboutNotes,nam-a2-gui .aboutSections>article { padding:16px 18px;background:var(--tl-surface-3,#181b19);border:1px solid var(--tl-border-strong,#3a3642);border-radius:12px }
        nam-a2-gui .aboutBody h4 { margin-bottom:8px;color:var(--tl-text,#f3f0f7);font-size:11px;letter-spacing:0;text-transform:none }
        nam-a2-gui .gettingStarted ol { display:grid;gap:8px;margin:0;padding:0;list-style:none;counter-reset:step }
        nam-a2-gui .gettingStarted li { position:relative;padding-left:30px;color:var(--tl-text-2,#aaa3b4);font-size:10px;line-height:1.5;counter-increment:step }
        nam-a2-gui .gettingStarted li::before { content:counter(step);position:absolute;top:-1px;left:0;display:grid;place-items:center;width:20px;height:20px;color:var(--nam-accent);background:var(--tl-accent-tint,#a688ff1a);border:1px solid var(--tl-accent-border,#4c435b);border-radius:6px;font:600 9px var(--tl-font-mono,ui-monospace,monospace) }
        nam-a2-gui .aboutFlow { padding:10px 12px;color:var(--tl-text-2,#aaa3b4);background:var(--tl-surface-1,#101211);border-color:var(--tl-border,#34303b);border-radius:10px }
        nam-a2-gui .aboutSections { gap:10px;counter-reset:topic }
        nam-a2-gui .aboutSections>article { display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:14px;align-content:start;counter-increment:topic }
        nam-a2-gui .aboutSections>article::before { content:counter(topic,decimal-leading-zero);grid-row:span 2;color:var(--nam-accent);font:600 11px var(--tl-font-mono,ui-monospace,monospace) }
        @media(max-width:520px){nam-a2-gui .preferencesBody>.preferenceRow{grid-template-columns:minmax(0,1fr)}}
        /* Amp details: capture card, then metadata fact cards (same layout as the cabinet IR details). */
        nam-a2-gui[host-tabs] .detailsPanel>.tab-content { padding:4px 0 0;background:none }
        nam-a2-gui .detailsBody { display:grid;gap:12px } nam-a2-gui .detailsBody .panel-intro { margin-bottom:0 }
        nam-a2-gui .detailsBody .modelDetails { margin:0;padding:0;background:none;border:0 } nam-a2-gui .detailsBody .modelDetails>:not(summary) { margin-left:0;margin-right:0 }
        nam-a2-gui .detailsBody .signal-strip { margin:0;padding:12px;background:var(--tl-surface-3,#181b19);border-color:var(--tl-border-strong,#3a3642);border-radius:12px }
        nam-a2-gui .detailsBody .current-model { display:block;padding:0;background:none;border:0 } nam-a2-gui .detailsBody .mainCaptureMedia { display:none }
        nam-a2-gui .detailsBody .status:empty { display:none }
        nam-a2-gui .model-facts { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px }
        nam-a2-gui .model-facts article { display:grid;gap:6px;align-content:start;min-width:0;padding:14px 16px;background:var(--tl-surface-3,#181b19);border:1px solid var(--tl-border-strong,#3a3642);border-radius:12px }
        nam-a2-gui .model-facts article.wide { grid-column:1/-1 }
        nam-a2-gui .model-facts span { color:var(--tl-text-muted,#898391);font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase }
        nam-a2-gui .model-facts strong { overflow-wrap:anywhere;color:var(--tl-text,#f3f0f7);font:600 13px var(--tl-font-mono,ui-monospace,monospace) }
        nam-a2-gui .model-facts article.wide strong { font:500 11px/1.5 var(--tl-font-ui,Inter,system-ui,sans-serif) }
        @media(max-width:620px){nam-a2-gui .model-facts{grid-template-columns:minmax(0,1fr)}}
      </style>
      <section class="nam-module">
        <header class="module-head">
          ${neuralWampLogoMarkup}<div class="module-identity"><div class="module-name-row"><h2>NeuralWAMp</h2></div><span class="module-subtitle">NAM A2 neural amplifier</span><a class="module-author" href="https://github.com/micbuffa" target="_blank" rel="noopener noreferrer">by @micbuffa</a></div>
          <label class="bypass-label"><input class="bypass" type="checkbox"> Bypass</label>
        </header>
        <div class="editor-navigation"><header class="plugin-face-head"><span class="plugin-face-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg></span><div><strong>Neural Amp Modeler</strong><small>Web Audio Module</small></div><span class="plugin-face-format">NAM · <span class="editor-model-mode">A2</span></span></header><div class="plugin-face-model"><div class="plugin-face-copy"><span class="plugin-face-eyebrow">Loaded amp model</span><strong class="editor-model-name">Amp settings</strong><small class="editor-model-meta"></small></div><div class="editor-actions"><button class="change-model" type="button">Change amp model</button><button class="editor-action" id="namTabPreferences" type="button" aria-pressed="false" aria-controls="namPanelPreferences" data-editor-view="preferences">Preferences</button><button class="editor-action" id="namTabAbout" type="button" aria-pressed="false" aria-controls="namPanelAbout" data-editor-view="about">Help</button></div></div><button class="back-to-amp" type="button" hidden>Back to amp settings</button></div>
        <section class="plugin-panel amp-knobs ampPanel" id="namPanelAmp" role="region" aria-label="Amp settings" data-plugin-panel="amp" hidden><section class="modelCalibration" aria-label="Model level calibration"><label class="preferenceRow"><span><span class="plugin-face-eyebrow">Gain staging</span><strong>Automatic model level</strong><small>Normalizes the model at a reference level (−18 dB target, ±12 dB correction). Calibrate level measures a 12-second Funky-Guitar excerpt at −18 dB input trim, targeting −24 dBFS with peak protection. Other playing levels may still differ.</small></span><input class="autoLevel" type="checkbox" checked></label><div class="calibrationActions"><span class="chip modelLevel inactive" title="Automatic model-level correction">LEVEL —</span><div class="level-actions"><button class="calibrateLevel" type="button" disabled>Calibrate level</button><button class="useMetadataLevel" type="button" hidden>Use metadata</button></div></div><p class="calibrationStatus" role="status"></p></section>        <div class="amp-controls"><section class="eq-panel" id="namEqPanel">
          <div class="eq-toolbar"><div class="eq-toolbar-group"><label><input class="eqEnabled" type="checkbox" checked> EQ enabled</label><label>Position <select class="eqPosition"><option value="0">POST NAM</option><option value="1">PRE NAM</option></select></label></div><div class="noise-side">${knobMarkup('noise','Threshold',-100,0,1,-80,' dB')}<label class="section-switch noise-switch"><input class="noiseEnabled" type="checkbox"> Noise gate</label></div><section class="tone-strip" aria-label="Tone stack settings"><div class="amp-switches"><label class="section-switch"><input class="toneEnabled" type="checkbox" checked> Tone</label></div>${knobMarkup('bass','Bass',0,10,.1,5)}${knobMarkup('middle','Middle',0,10,.1,5)}${knobMarkup('treble','Treble',0,10,.1,5)}</section></div>
          <div class="eq-subtoolbar"><span class="eq-spectrum-legend" aria-label="Spectrum legend"><span class="input">Input</span><span class="filtered">Filtered</span><span class="final">Final output</span></span><button class="eqReset" type="button">Reset EQ</button></div>
          <div class="eq-graph-wrap"><svg class="eqGraph" viewBox="0 0 720 250" preserveAspectRatio="none" role="application" aria-label="Six-band parametric EQ comparing input, filtered, and final output spectra"><defs><linearGradient id="namSpectrumInputFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8094b3" stop-opacity=".18"/><stop offset="1" stop-color="#27364d" stop-opacity=".04"/></linearGradient><linearGradient id="namSpectrumFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff455f" stop-opacity=".5"/><stop offset=".34" stop-color="#ff9e3d" stop-opacity=".42"/><stop offset=".68" stop-color="#a8ad28" stop-opacity=".3"/><stop offset="1" stop-color="#323bce" stop-opacity=".2"/></linearGradient><linearGradient id="namEqFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8c8ff" stop-opacity=".12"/><stop offset="1" stop-color="#3b2d66" stop-opacity=".02"/></linearGradient></defs><path class="eq-spectrum-input-fill" d="M0,230 L720,230 Z"></path><path class="eq-spectrum" d="M0,230 L720,230 Z"></path><g class="eqGrid"></g><path class="eq-spectrum-input-line"></path><path class="eq-spectrum-filtered-line"></path><path class="eq-spectrum-final-line"></path><g class="eqBandCurves"></g><path class="eq-curve-fill"></path><path class="eq-curve"></path><g class="eqNodes"></g></svg><div class="eq-readout"><strong class="eq-band-name">Low<small>Band 1 · Low shelf</small></strong><label class="eq-value">Frequency<input class="eqSelectedFreq" type="number" min="20" max="20000" step="1"></label><label class="eq-value">Gain<input class="eqSelectedGain" type="number" min="-15" max="15" step="0.1"></label><label class="eq-value">Q<input class="eqSelectedQ" type="number" min="0.1" max="10" step="0.01"></label><p class="eq-hint">Drag a point · wheel changes Q · Shift = fine · double-click resets gain</p></div></div>
        </section></div></section>
        <dialog class="nam-models-dialog" aria-label="Amp models"><header class="nam-models-head"><div><span class="plugin-face-eyebrow">Neural Amp Modeler</span><h3>Amp models</h3><p>Choose the amplifier character for this module.</p></div><button class="nam-models-close" type="button" aria-label="Close amp models"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><section class="plugin-panel modelDrawer modelsPanel" id="namPanelModels" role="region" aria-label="Choose amp model" data-plugin-panel="models" hidden><div class="tab-content">
            <div class="source-tabs" role="group" aria-label="Model source">
              <button class="sourceTab" data-source="Factory" type="button" aria-pressed="true">Factory</button>
              <button class="sourceTab" data-source="Favorites" type="button" aria-pressed="false">★ Favorites</button>
              <button class="sourceTab" data-source="External" type="button" aria-pressed="false">External</button>
              <button class="sourceTab" data-source="TONE3000" type="button" aria-pressed="false">TONE3000</button>
            </div>
            <div class="factoryCategories" role="group" aria-label="Factory category"><button class="factoryCategory" data-category="all" type="button" aria-pressed="false">All</button><button class="factoryCategory" data-category="guitar" type="button" aria-pressed="true">Guitar</button><button class="factoryCategory" data-category="bass" type="button" aria-pressed="false">Bass</button><button class="factoryCategory" data-category="pedal" type="button" aria-pressed="false">Pedals</button></div>
            <div class="browser-tools"><input class="modelSearch" type="search" aria-label="Search models" placeholder="Search models…"><label class="file-action">Import .nam…<input class="model" type="file" accept=".nam,application/json"></label></div>
            <div class="modelBrowser"></div>
            <section class="tone3000-panel" aria-label="TONE3000" hidden>
              <section class="tone3000Auth" aria-labelledby="tone3000AuthTitle" hidden><img class="tone3000Logo" src="${tone3000LogoUrl}" alt="TONE3000"><h3 class="tone3000AuthTitle" id="tone3000AuthTitle">Access TONE3000 tones</h3><p class="tone3000AuthCopy">NeuralWAMp has partnered with TONE3000 to give you access to a library of NAM captures created by a global community of musicians.</p><button class="tone3000Authenticate" type="button">Continue to TONE3000</button></section>
              <div class="tone3000Browser" hidden><div class="tone3000-head"><div class="tone3000-head-actions"><button class="tone3000Browse" type="button">Browse TONE3000</button><button class="tone3000Back" type="button" hidden>Back to TONE3000 main view</button></div><small class="powered">Powered by TONE3000</small></div>
                <p class="tone3000Status">TONE3000 integration not configured</p>
                <section class="tone3000Catalog" hidden><div class="tone3000CatalogTools" role="group" aria-label="TONE3000 collections"><button type="button" data-tone-feed="trending" aria-pressed="true">Trending</button><button type="button" data-tone-feed="latest" aria-pressed="false">Latest</button><button type="button" data-tone-feed="downloaded" aria-pressed="false">Downloaded</button><button type="button" data-tone-feed="favorited" aria-pressed="false">Favorites</button><button type="button" data-tone-feed="created" aria-pressed="false">Created</button></div><div class="tone3000Gear" role="group" aria-label="Gear filter"><button type="button" data-tone-gear="" aria-pressed="true">All gear</button><button type="button" data-tone-gear="amp" aria-pressed="false">Amp</button><button type="button" data-tone-gear="amp-cab" aria-pressed="false">Amp + Cab</button><button type="button" data-tone-gear="pedal" aria-pressed="false">Pedal</button></div><div class="tone3000Cards" aria-live="polite"></div><div class="tone3000Pager"><button class="tone3000Prev" type="button">Previous</button><span class="tone3000Page">Page 1</span><button class="tone3000Next" type="button">Next</button></div></section>
                <section class="tone3000Selection factoryToneCard" hidden><div class="factoryToneMedia"><strong class="factoryToneTitle tone3000Title"></strong><p class="tone3000Tone"></p><div class="factoryToneViewer"><button class="factoryToneNav tone3000CapturePrevious" type="button" aria-label="Previous TONE3000 capture">‹</button><button class="factoryTonePick tone3000CapturePick" type="button" aria-label="Load selected TONE3000 capture"><img class="tone3000Image" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" hidden><span class="factoryToneVisual tone3000Visual">NAM</span></button><button class="factoryToneNav tone3000CaptureNext" type="button" aria-label="Next TONE3000 capture">›</button></div><span class="factoryToneFilename tone3000Filename"></span><small class="factoryToneCounter tone3000Counter"></small></div><div class="factoryToneDetails"><span class="factoryCaptureLabel tone3000CaptureLabel"></span><div class="factoryCaptureList tone3000CaptureList" role="group" aria-label="Available TONE3000 captures"></div></div></section>
              </div>
              <details class="tone3000Downloads" aria-label="TONE3000 models downloaded on this device" open><summary class="tone3000DownloadsHead"><strong>Downloaded on this device</strong></summary><button class="tone3000Clear" type="button" hidden>Delete all</button><div class="tone3000DownloadedList"></div></details>
              <section class="factoryMaintainer" aria-label="Factory library maintainer" hidden><h3>Factory library maintainer</h3><p>Explicitly select one TONE3000 tone, choose its files, then export a repository-ready ZIP bundle. Verify redistribution rights before committing it.</p><div class="factoryMaintainerActions"><button type="button" data-maintainer-kind="nam">Select NAM A2 tone</button><button type="button" data-maintainer-kind="ir">Select IR tone</button></div><p class="factoryMaintainerStatus">No tone selected for export.</p><div class="factoryMaintainerModels"></div><button class="factoryMaintainerExport" type="button" hidden>Export selected Factory bundle</button></section>
            </section>
          </div></section></dialog>
        <section class="plugin-panel detailsPanel" role="region" aria-label="Amp details" data-plugin-panel="details" hidden><div class="tab-content detailsBody"><header class="panel-intro"><span class="plugin-face-eyebrow">Neural Amp Modeler</span><h3>Amp details</h3><p>Captures and technical metadata of the loaded amp model.</p></header><div class="mainPanel modelDetails"><div class="signal-strip">

          <section class="current-model" aria-live="polite"><div class="currentModelArtwork"><img class="currentToneImage" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" hidden><div class="currentModelFallback"><strong>NAM</strong><small>Model capture</small></div></div><div class="currentModelInfo"><strong class="currentModel">No model loaded</strong><div class="model-chips"><span class="chip source modelSource">—</span><span class="chip modelMode">A2 —</span></div></div></section>

        </div><div class="signal-flow" role="img" aria-label="Signal path"></div><p class="status">No model loaded</p></div><div class="model-facts"></div></div></section>
        <section class="plugin-panel preferencesDrawer preferencesPanel" id="namPanelPreferences" role="region" aria-labelledby="namTabPreferences" data-plugin-panel="preferences" hidden><div class="tab-content preferencesBody"><header class="panel-intro"><span class="plugin-face-eyebrow">Processing</span><h3>Amplifier preferences</h3><p>Configure how this model is rendered in the signal chain.</p></header><label class="preferenceRow"><span><strong>A2 rendering mode</strong><small>Used when a model contains both Lite and Full networks.</small></span><select class="a2Variant"><option value="full">Full — higher fidelity</option><option value="lite">Lite — lower CPU</option></select></label></div></section>
        <section class="plugin-panel aboutPanel" id="namPanelAbout" role="region" aria-labelledby="namTabAbout" data-plugin-panel="about" hidden><div class="tab-content aboutBody"><header class="panel-intro"><span class="plugin-face-eyebrow">Neural Amp Modeler</span><h3>About NeuralWAMp</h3><p>NeuralWAMp is a Web Audio Module that runs Neural Amp Modeler A2 captures directly in an AudioWorklet. It is designed to behave like a reusable audio plugin while remaining entirely usable in a web browser.</p></header><article class="gettingStarted"><h4>Getting started with your guitar</h4><ol><li>Choose <strong>Live input</strong> from the Source menu in the host.</li><li>Select your audio input and output devices from the corresponding menus. For a multichannel interface, choose the physical input carrying the guitar (usually Input 1); do not choose a loopback channel. If your browser does not support output-device selection, audio uses the operating system's default output. After changing a system device, reload the page before continuing.</li><li>Click <strong>Enable live input</strong>. You should now hear your guitar through the processing chain. Click the red <strong>Disable live input</strong> button to stop the microphone stream and monitoring completely.</li><li>Click <strong>Change amp model</strong> to load a Factory capture or browse TONE3000. A capture selected from TONE3000 is downloaded, loaded, and kept locally in the browser so it remains available later.</li><li>Open <strong>Amp settings</strong> to adjust Bass, Middle, Treble, and the graphical EQ.</li><li>For high-gain amplifiers, enable the <strong>Noise gate</strong> in Amp settings and adjust its threshold as needed.</li></ol></article><div class="aboutFlow">Input → Noise gate → EQ PRE/POST → NAM A2 → Tone stack → Output</div><div class="aboutSections"><article><h4>Models</h4><p>Load Factory guitar, bass, and pedal captures; recall favorites; import local .nam files; or browse compatible TONE3000 captures. Selecting a capture loads it immediately.</p></article><article><h4>Amp settings</h4><p>Calibrate the model level or use its metadata, enable the noise gate and adjust its threshold, then shape the sound with Bass, Middle, and Treble plus a six-band graphical EQ. Place the EQ before or after NAM and compare input, filtered, and final spectra.</p></article><article><h4>Amp details</h4><p>Open Amp details to inspect the artwork, navigate captures, and read model metadata and licensing information.</p></article><article><h4>Preferences</h4><p>Choose A2 Full for maximum fidelity or A2 Lite for lower CPU use.</p></article><article><h4>Controls</h4><p>Drag knobs vertically. Double-click a knob to restore its default. Hover over model artwork for one second to display a compact metadata card.</p></article></div><article class="aboutNotes"><h4>State and storage</h4><p>Audio parameters and the loaded model participate in the standard WAM state round trip. Favorites and explicitly downloaded TONE3000 models are stored locally in the browser. NeuralWAMp contains the amplifier stage; the host may connect a separate Cabinet WAM for impulse-response processing.</p></article></div></section>
        <div hidden>          <div class="meter-side input-meter-side"><div class="meter" data-meter="input"><span class="meter-label">IN</span><div class="meter-track"><div class="meter-fill"></div></div><span class="clip">CLIP</span><div class="meter-values"><span class="peak">-∞ dBFS</span><span class="rms">RMS -∞</span></div></div>${knobMarkup('inputGain','Input gain',-48,24,.1,0,' dB','input-control')}
          </div>          <div class="meter-side output-meter-side"><div class="meter" data-meter="output"><span class="meter-label">OUT</span><div class="meter-track"><div class="meter-fill"></div></div><span class="clip">CLIP</span><div class="meter-values"><span class="peak">-∞ dBFS</span><span class="rms">RMS -∞</span></div></div>${knobMarkup('outputGain','Output gain',-24,12,.1,0,' dB','output-control')}</div></div>
      </section><aside class="modelHoverCard" role="tooltip" hidden><strong class="modelHoverTitle"></strong><pre class="modelHoverDetails"></pre></aside>`;
    this.querySelector('.aboutBody header').insertAdjacentHTML('beforeend', '<p><a href="https://github.com/micbuffa/NAM_A2_WAM" target="_blank" rel="noopener noreferrer">NeuralWAMp source code and project documentation on GitHub</a></p>');
    this.controls = {
      inputGain: this.querySelector('.inputGain'), outputGain: this.querySelector('.outputGain'),
      bypass: this.querySelector('.bypass'), model: this.querySelector('.model'), status: this.querySelector('.status'),
      noise: this.querySelector('.noise'), noiseEnabled: this.querySelector('.noiseEnabled'),
      bass: this.querySelector('.bass'), middle: this.querySelector('.middle'), treble: this.querySelector('.treble'), toneEnabled: this.querySelector('.toneEnabled'),
      eqEnabled: this.querySelector('.eqEnabled'), eqPosition: this.querySelector('.eqPosition'), eqPanel: this.querySelector('.eq-panel'), eqReset: this.querySelector('.eqReset'), ampKnobs: this.querySelector('.amp-knobs'),
      eqGraph:this.querySelector('.eqGraph'), eqGrid:this.querySelector('.eqGrid'), eqNodes:this.querySelector('.eqNodes'), eqBandCurves:this.querySelector('.eqBandCurves'), eqSpectrum:this.querySelector('.eq-spectrum'), eqSpectrumInputFill:this.querySelector('.eq-spectrum-input-fill'), eqSpectrumInputLine:this.querySelector('.eq-spectrum-input-line'), eqSpectrumFilteredLine:this.querySelector('.eq-spectrum-filtered-line'), eqSpectrumFinalLine:this.querySelector('.eq-spectrum-final-line'), eqCurve:this.querySelector('.eq-curve'), eqCurveFill:this.querySelector('.eq-curve-fill'),
      eqBandName:this.querySelector('.eq-band-name'), eqSelectedFreq:this.querySelector('.eqSelectedFreq'), eqSelectedGain:this.querySelector('.eqSelectedGain'), eqSelectedQ:this.querySelector('.eqSelectedQ'),
      search: this.querySelector('.modelSearch'), browser: this.querySelector('.modelBrowser'),
      toneBrowse: this.querySelector('.tone3000Browse'), toneBack: this.querySelector('.tone3000Back'), toneStatus: this.querySelector('.tone3000Status'),
      toneSelection: this.querySelector('.tone3000Selection'), toneInfo: this.querySelector('.tone3000Tone'), toneTitle: this.querySelector('.tone3000Title'),
      toneCaptureList: this.querySelector('.tone3000CaptureList'), toneCaptureLabel: this.querySelector('.tone3000CaptureLabel'), toneCapturePrevious: this.querySelector('.tone3000CapturePrevious'), toneCaptureNext: this.querySelector('.tone3000CaptureNext'), toneCapturePick: this.querySelector('.tone3000CapturePick'), toneFilename: this.querySelector('.tone3000Filename'), toneCounter: this.querySelector('.tone3000Counter'), toneVisual: this.querySelector('.tone3000Visual'),
      toneImage: this.querySelector('.tone3000Image'), currentToneImage: this.querySelector('.currentToneImage'),
      currentModelFallback: this.querySelector('.currentModelFallback'),
      toneAuth: this.querySelector('.tone3000Auth'), toneAuthenticate: this.querySelector('.tone3000Authenticate'), toneBrowser: this.querySelector('.tone3000Browser'),
      toneCatalog: this.querySelector('.tone3000Catalog'), toneCards: this.querySelector('.tone3000Cards'), tonePage: this.querySelector('.tone3000Page'), tonePrev: this.querySelector('.tone3000Prev'), toneNext: this.querySelector('.tone3000Next'),
      toneDownloadedList: this.querySelector('.tone3000DownloadedList'), toneClear: this.querySelector('.tone3000Clear'),
      maintainer: this.querySelector('.factoryMaintainer'), maintainerStatus: this.querySelector('.factoryMaintainerStatus'),
      maintainerModels: this.querySelector('.factoryMaintainerModels'), maintainerExport: this.querySelector('.factoryMaintainerExport'),
      currentModel: this.querySelector('.currentModel'), modelSource: this.querySelector('.modelSource'),
      modelMode: this.querySelector('.modelMode'), modelLevel: this.querySelector('.modelLevel'), modelDrawer: this.querySelector('.modelDrawer'),
      pluginPanels: [...this.querySelectorAll('.plugin-panel')], modelsDialog: this.querySelector('.nam-models-dialog'), modelsPanel: this.querySelector('.modelsPanel'),
      modelHoverCard: this.querySelector('.modelHoverCard'), modelHoverTitle: this.querySelector('.modelHoverTitle'), modelHoverDetails: this.querySelector('.modelHoverDetails'),
      calibrationStatus:this.querySelector('.calibrationStatus'), calibrateLevel: this.querySelector('.calibrateLevel'), useMetadataLevel: this.querySelector('.useMetadataLevel'),
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
    this.bindModelHover(this.controls.currentToneImage,()=>this.node._metadata);
    this.bindModelHover(this.controls.toneImage,()=>this.toneSelectionHoverData());
    for(const id of ['noiseEnabled','toneEnabled','eqEnabled'])this.controls[id].onchange=()=>{setParam(id,this.controls[id].checked?1:0);if(id==='noiseEnabled')this.syncNoiseGateVisual();if(id==='eqEnabled')this.syncEqEnabledVisual();this.renderSignalFlow();};
    this.controls.eqPosition.onchange=()=>{setParam('eqPre',Number(this.controls.eqPosition.value));this.renderSignalFlow();};
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
    this._assets=[]; this._selectedId=''; this._sourceFilter='Factory'; this._factoryCategory='guitar'; this._favoriteIds=new Set();
    this.initMainCaptureNavigation();
    this.tone3000Downloads = new Tone3000Downloads();
    // A host may swap in account-backed favorites/preferences (NamPlugin.configureAccount).
    this.account = this.plugin.constructor.account || {};
    this.modelFavorites = this.account.favorites || new ModelFavorites();
    this.controls.a2Variant.value=(await this.node.getState()).modelVariant||'full';
    this.controls.a2Variant.onchange=async()=>{const variant=this.controls.a2Variant.value;try{localStorage.setItem(modelVariantStorageKey,variant);}catch{/* Keep the session preference even if persistence is unavailable. */}this.account.preferences?.write('modelVariant',variant);await this.node.setModelVariant(variant);};
    this.controls.autoLevel.checked=(await this.node.getState()).autoLevel!==false;
    this.controls.autoLevel.onchange=async()=>{const enabled=this.controls.autoLevel.checked;try{localStorage.setItem(autoLevelStorageKey,enabled?'on':'off');}catch{/* Keep the session preference even if persistence is unavailable. */}this.account.preferences?.write('autoLevel',enabled);await this.node.setAutoLevel(enabled);};
    this.controls.calibrateLevel.onclick=()=>this.calibrateCurrentModelLevel();
    this.controls.useMetadataLevel.onclick=async()=>{this.controls.useMetadataLevel.disabled=true;try{await this.node.useMetadataModelLevel();this.controls.autoLevel.checked=true;try{localStorage.setItem(autoLevelStorageKey,'on');}catch{/* Keep session state. */}this.account.preferences?.write('autoLevel',true);}catch(error){this.controls.status.classList.add('error');this.controls.status.textContent=`Level reset failed: ${error.message}`;}finally{this.controls.useMetadataLevel.disabled=false;}};
    this.controls.search.oninput=()=>this.renderBrowser();
    this.controls.sourceTabs.forEach((button)=>button.onclick=()=>this.setSourceFilter(button.dataset.source));
    this.controls.factoryCategoryButtons.forEach((button)=>button.onclick=()=>this.setFactoryCategory(button.dataset.category));
    this._modelListener=async(metadata,model)=>{if(!model?.data)return;if(model.provenance?.source==='TONE3000'){const asset=this.upsertTone3000Asset({...model.provenance,name:model.name,text:model.data});this._selectedId=asset.id;this.controls.modelSource.textContent='TONE3000';this.renderBrowser();this.renderTone3000Downloads();return;}if(model.provenance?.source==='Factory'){this._selectedId=model.provenance.identity;this.controls.modelSource.textContent='Factory';this.renderBrowser();return;}const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(model.data));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');const factory=this._assets.find(a=>a.contentHash===hash);if(factory){this._selectedId=factory.id;this.controls.modelSource.textContent='Factory';}else {const asset=addExternalAsset(this._assets,{id:`external:${hash}`,filename:model.name,relativePath:model.name,groups:['External'],displayName:model.name.replace(/\.nam$/i,''),type:'nam',contentHash:hash,source:'External',data:model.data});asset.data=model.data;this._selectedId=asset.id;this.controls.modelSource.textContent='External';}this.renderBrowser();};
    this.node.addModelListener(this._modelListener);
    await this.loadManifest();
    await this.loadTone3000Downloads();
    await this.loadFavorites();
    this._automation = (event) => this.syncParameter(event.detail.data);
    this._meterState = {inputPeak: 0, inputRms: 0, outputPeak: 0, outputRms: 0, inputClipUntil: 0, outputClipUntil: 0, outputGlow: 0};
    this._meterListener = (data) => this.updateMeters(data);
    this.node.addMeterListener(this._meterListener);
    this._spectrumListener = (data) => this.updateSpectrum(data);
    this.node.addSpectrumListener(this._spectrumListener);
    this.node.addEventListener('wam-automation', this._automation);
    this.syncParameters(await this.node.getParameterValues(false));
    this.querySelectorAll('[data-editor-view]').forEach(button=>button.onclick=()=>this.setPluginTab(button.dataset.editorView));
    this.querySelector('.change-model').onclick=()=>this.setPluginTab('models');
    this.querySelector('.back-to-amp').onclick=()=>this.setPluginTab('amp');
    this.querySelector('.nam-models-close').onclick=()=>this.closeModels();
    this.controls.modelsDialog.addEventListener('close',()=>{this._modelsOpen=false;this.controls.modelsPanel.hidden=true;this.hideModelHover();this.querySelector('.change-model')?.focus();});
    this.setPluginTab(this.node._metadata?'amp':'models');
    this.tone3000 = new Tone3000Client(plugin.constructor.tone3000Config || {});
    this._maintainerMode = new URL(window.location.href).searchParams.get('maintainer') === '1';
    this.controls.maintainer.hidden = !this._maintainerMode;
    this.querySelectorAll('[data-maintainer-kind]').forEach((button) => button.onclick = () => this.selectMaintainerTone(button.dataset.maintainerKind));
    this.controls.maintainerExport.onclick = () => this.exportMaintainerBundle();
    this._toneModels = []; this._toneModelIndex = 0; this._toneModelLoading = false; this._toneSelectionSerial = 0;
    this.controls.toneBrowse.onclick = () => this.browseTone3000();
    this.controls.toneBack.onclick = () => this.backToTone3000MainView();
    this.controls.toneAuthenticate.onclick = () => this.authenticateTone3000();
    this.controls.toneCapturePrevious.onclick = () => this.loadTone3000Model(this._toneModelIndex-1);
    this.controls.toneCaptureNext.onclick = () => this.loadTone3000Model(this._toneModelIndex+1);
    this.controls.toneCapturePick.onclick = () => this.loadTone3000Model(this._toneModelIndex);
    this.controls.toneClear.onclick = () => this.clearTone3000Downloads();
    this._toneFeed = 'trending'; this._toneGear = ''; this._tonePage = 1;
    this.querySelectorAll('[data-tone-feed]').forEach((button) => button.onclick = () => { this._toneFeed = button.dataset.toneFeed; this._tonePage = 1; this.querySelectorAll('[data-tone-feed]').forEach((b) => b.setAttribute('aria-pressed', String(b === button))); this.loadTone3000Catalog(); });
    this.querySelectorAll('[data-tone-gear]').forEach((button) => button.onclick = () => { this._toneGear = button.dataset.toneGear; this._tonePage = 1; this.querySelectorAll('[data-tone-gear]').forEach((b) => b.setAttribute('aria-pressed', String(b === button))); this.loadTone3000Catalog(); });
    this.controls.tonePrev.onclick = () => { if (this._tonePage > 1) { this._tonePage--; this.loadTone3000Catalog(); } };
    this.controls.toneNext.onclick = () => { this._tonePage++; this.loadTone3000Catalog(); };
    this._tonePopup = null;
    this._toneCallbackHref = '';
    this._receiveTone3000Callback = (data) => {
      if(this.toneSession){this.toneSession.receive(data);return;}
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
    await this.toneSession?.complete();
    return this;
  }

  setEditorVisible(visible) {this._editorVisible=visible;if(visible)this.setPluginTab(this.node._metadata?'amp':'models');else this.closeModels();this.node.setSpectrumEnabled(visible&&this._activePluginTab==='amp').catch(()=>{});if(!visible)this.hideModelHover();}

  // The model catalogue is a modal dialog over the current section, as in a
  // DAW browser; every other name is an editor section (amp, preferences, about).
  setPluginTab(tabName) {
    if(tabName==='models'){this.openModels();return;}
    this.closeModels();
    const panels=this.controls.pluginPanels.filter(panel=>panel.dataset.pluginPanel!=='models');
    const panel=panels.find(panel=>panel.dataset.pluginPanel===tabName)||panels[0];
    this._activePluginTab=panel.dataset.pluginPanel;
    this.dataset.editorView=this._activePluginTab;
    this.querySelector('.editor-actions').hidden=false;
    this.querySelector('.back-to-amp').hidden=this._activePluginTab==='amp';
    this.querySelector('.editor-model-name').textContent=this.controls.currentModel.textContent||'Amp settings';
    this.querySelectorAll('[data-editor-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.editorView===this._activePluginTab)));
    panels.forEach((entry)=>{entry.hidden=entry!==panel;});
    this.hideModelHover();
    this.node.setSpectrumEnabled(this._editorVisible!==false&&this._activePluginTab==='amp').catch(()=>{});
    this.dispatchEvent(new CustomEvent('editor-tab-change',{bubbles:true}));
  }

  // Opens only while the editor is on screen; a hidden or detached GUI keeps
  // the request and the host's setEditorVisible(true) opens it later.
  openModels() {
    if(!this._activePluginTab)this.setPluginTab('amp');
    const dialog=this.controls.modelsDialog;this._modelsOpen=true;this.controls.modelsPanel.hidden=false;this.hideModelHover();
    if(dialog.open||!this.isConnected||this._editorVisible===false)return;
    try{dialog.showModal();}catch{}
  }
  closeModels() {this._modelsOpen=false;if(this.controls.modelsDialog.open)this.controls.modelsDialog.close();}

  // Host tab bar contract (FxChainView): with the host-tabs attribute the
  // host draws these tabs and this GUI hides its own header and navigation.
  get editorTabs() {return [{id:'amp',label:'Amp settings'},{id:'details',label:'Amp details'},{id:'preferences',label:'Preferences'},{id:'about',label:'Help'}];}
  get activeEditorTab() {return this._activePluginTab;}
  showEditorTab(id) {this.setPluginTab(id);}

  modelHoverInfo(value) {
    if(!value)return null;
    const provenance=value.provenance||{};const raw=value.rawMetadata||value.metadata||provenance.metadata||{};
    const creator=value.modeledBy&&value.modeledBy!=='Unknown'?value.modeledBy:raw.modeled_by||provenance.creator||value.creator?.name||value.creator_name||value.created_by;
    const title=raw.name||provenance.title||value.displayName||value.title||value.name||`Tone ${value.id||value.tone_id||''}`;
    const lines=[];const add=(label,data)=>{if(data!==undefined&&data!==null&&data!==''&&!lines.some((line)=>line===`${label}: ${data}`))lines.push(`${label}: ${data}`);};
    const filename=value.filename||(value.name&&value.name!==title?value.name:'');add('File',filename);
    add('Architecture',value.subtype||value.architecture);if(value.availableVariants?.length)add('Rendering modes','A2 Full, A2 Lite');
    const sampleRate=value.expectedSampleRate??value.sampleRate??value.sample_rate;if(Number(sampleRate)>0)add('Sample rate',`${sampleRate} Hz`);
    add('Modeled by',creator);add('NAM format',value.version);if(Number.isFinite(Number(value.loudness)))add('Model loudness',`${Number(value.loudness).toFixed(1)} dB`);
    add('Source',value.source||provenance.source);add('Gear make',raw.gear_make);if(raw.gear_model!==raw.gear_make)add('Gear model',raw.gear_model);
    add('Capture type',raw.gear_type||value.gear_type||value.gear||provenance.gear);add('Tone',raw.tone_type?String(raw.tone_type).replaceAll('_',' '):'');
    const date=metadataDate(raw.date);add('Captured',date);add('License',provenance.license||value.license);add('Provider',provenance.provider);add('Tone ID',provenance.toneId||value.tone_id);
    return {title:String(title),details:lines.join('\n')||'No additional metadata available'};
  }

  toneSelectionHoverData() {
    const tone=this._tone||{};const model=this._toneModels?.[this._toneModelIndex]||{};
    return {...tone,...model,provenance:{title:tone.title||tone.name,creator:tone.creator?.name||tone.creator_name||tone.created_by,gear:tone.gear||tone.gear_type,license:tone.license,toneId:this._toneId||tone.id||tone.tone_id,source:'TONE3000'}};
  }

  bindModelHover(element, provider) {
    if(!element)return;
    const schedule=(event)=>{this.hideModelHover();this._hoverPoint={x:event.clientX,y:event.clientY};this._hoverTimer=setTimeout(()=>{if(!element.isConnected||element.hidden)return;const info=this.modelHoverInfo(provider());if(info)this.showModelHover(element,info);},1000);};
    element.addEventListener('mouseenter',schedule);element.addEventListener('mousemove',(event)=>{this._hoverPoint={x:event.clientX,y:event.clientY};});element.addEventListener('mouseleave',()=>this.hideModelHover());
    element.addEventListener('focus',schedule);element.addEventListener('blur',()=>this.hideModelHover());
  }

  showModelHover(element, info) {
    const card=this.controls.modelHoverCard;this.controls.modelHoverTitle.textContent=info.title;this.controls.modelHoverDetails.textContent=info.details;card.hidden=false;
    const anchor=element.getBoundingClientRect();const width=card.offsetWidth,height=card.offsetHeight;let left=anchor.right+10,top=anchor.top;
    if(left+width>window.innerWidth-10)left=anchor.left-width-10;if(left<10)left=Math.max(10,Math.min(window.innerWidth-width-10,this._hoverPoint?.x+12||10));
    top=Math.max(10,Math.min(window.innerHeight-height-10,top));card.style.left=`${left+window.scrollX}px`;card.style.top=`${top+window.scrollY}px`;
  }

  hideModelHover() { clearTimeout(this._hoverTimer);this._hoverTimer=null;if(this.controls?.modelHoverCard)this.controls.modelHoverCard.hidden=true; }

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
    if(id==='noiseEnabled')this.syncNoiseGateVisual();
    if(id==='eqEnabled')this.syncEqEnabledVisual();
    if(['noiseEnabled','toneEnabled','eqEnabled','eqPre'].includes(id))this.renderSignalFlow();
  }

  syncParameters(values) { let hasEq=false;Object.values(values).forEach((data)=>{const isEq=/^eq[1-6](Freq|Gain|Q)$/u.test(data.id);hasEq=hasEq||isEq;this.syncParameter(data,isEq);});if(hasEq)this.renderEqGraph(); }

  syncNoiseGateVisual() {
    const enabled=this.controls.noiseEnabled.checked;
    this.controls.noise.disabled=!enabled;
    this.querySelector('.noise-side')?.classList.toggle('is-disabled',!enabled);
    this.controls.noise.title=enabled?'Noise gate threshold':'Enable Noise gate to adjust its threshold';
  }

  syncEqEnabledVisual() {
    const enabled=this.controls.eqEnabled.checked;
    this.controls.eqGraph?.classList.toggle('disabled',!enabled);
    this.controls.eqPanel.classList.toggle('is-off',!enabled);
  }

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
      if(id==='output')this.updateOutputGlow(peakDb,rmsDb);
    }
  }

  updateOutputGlow(peakDb,rmsDb) {
    const target=Number.isFinite(rmsDb)?Math.max(0,Math.min(1,(rmsDb+55)/55)):0;
    const energy=this._meterState.outputGlow=Math.max(target,this._meterState.outputGlow*.86);
    const strip=this.querySelector('.signal-strip');
    if(energy<.015){strip.style.borderColor='#393541';strip.style.boxShadow='none';return;}
    const hue=peakDb>-6?3:peakDb>-18?45:145;
    const alpha=(.16+energy*.7).toFixed(3),outer=(energy*.55).toFixed(3);
    strip.style.borderColor=`hsla(${hue},95%,60%,${alpha})`;
    strip.style.boxShadow=`0 0 ${Math.round(8+energy*26)}px hsla(${hue},100%,55%,${outer}), inset 0 0 ${Math.round(4+energy*12)}px hsla(${hue},100%,55%,${(energy*.22).toFixed(3)})`;
  }

  amplitudeToDb(amplitude) { return amplitude > 0 ? Math.max(-72, 20 * Math.log10(amplitude)) : -Infinity; }

  setToneImage(element, imageUrl, alt) {
    element.onerror = null;
    const fallback=element.nextElementSibling?.classList.contains('tone3000Visual')?element.nextElementSibling:null;
    if (!imageUrl) {
      element.hidden = true;
      if(fallback)fallback.hidden=false;
      element.removeAttribute('src');
      element.alt = '';
      return;
    }
    element.hidden = false;
    if(fallback)fallback.hidden=true;
    element.alt = alt;
    element.onerror = () => {
      element.onerror = null;
      element.hidden = true;
      if(fallback)fallback.hidden=false;
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
    this.controls.calibrationStatus.textContent=m.levelMode==='measured'&&m.measuredCalibration?.version>=2?(m.measuredCalibration.clamped?'Guitar calibration limited to preserve headroom.':'Calibrated with Funky-Guitar — target −24 dBFS.'):'';
    this.controls.autoLevel.checked=m.autoLevelEnabled!==false;
    if(m.modelVariant)this.controls.a2Variant.value=m.modelVariant;
    this.controls.status.classList.remove('error');
    this.controls.currentModel.textContent = m.provenance?.title || m.rawMetadata?.gear_model || m.rawMetadata?.name || m.name.replace(/\.nam$/iu, '');
    this.querySelector('.editor-model-name').textContent=this.controls.currentModel.textContent;
    this.controls.modelMode.textContent = m.subtype || 'A2';
    const creator=m.modeledBy&&m.modeledBy!=='Unknown'?m.modeledBy:m.provenance?.creator;
    this.querySelector('.editor-model-mode').textContent=m.subtype||'A2';
    this.querySelector('.editor-model-meta').textContent=[m.source||m.provenance?.source,creator&&`Modeled by ${creator}`].filter(Boolean).join(' · ');
    const hasLoudness = Number.isFinite(m.loudness);
    const correction = Number(m.autoLevelCompensationDb);
    const measured = m.levelMode === 'measured' && m.measuredCalibration;
    const levelAvailable = m.autoLevelEnabled && Number.isFinite(correction) && (hasLoudness || measured);
    this.controls.modelLevel.textContent = !m.autoLevelEnabled ? 'LEVEL OFF' : levelAvailable
      ? `${measured ? 'MEASURED' : 'LEVEL'} ${correction >= 0 ? '+' : ''}${correction.toFixed(1)} dB` : 'LEVEL N/A';
    this.controls.modelLevel.classList.toggle('inactive', !levelAvailable);
    this.controls.modelLevel.title = !m.autoLevelEnabled ? 'Automatic model level is disabled' : levelAvailable
      ? measured
        ? `Measured NAM correction: ${correction >= 0 ? '+' : ''}${correction.toFixed(1)} dB · ${measured.reference||'Sine reference'} · output ${measured.outputRmsDb.toFixed(1)} dBFS · target ${measured.targetRmsDb??-18} dBFS`
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
    if(measured)details.push(`Measured level: ${correction>=0?'+':''}${correction.toFixed(1)} dB (reference ${measured.outputRmsDb.toFixed(1)} dBFS → target ${measured.targetRmsDb??-18} dBFS${measured.clamped?', limited':''})`);
    else details.push(m.autoLevelEnabled?(Number.isFinite(m.loudness)?`Auto level: ${m.autoLevelCompensationDb>=0?'+':''}${m.autoLevelCompensationDb.toFixed(1)} dB (target −18 dB)`:'Auto level: unavailable — no loudness metadata'):'Auto level: off');
    if (m.source) details.push(`Source: ${m.source}`);
    // TONE3000 fills unknown gear fields with "T3K-Null".
    const known=(value)=>value&&!/^t3k-null$/iu.test(value)?String(value):'';
    const gearLabels={amp:'Amp','amp-cab':'Amp + cab','full-rig':'Full rig',pedal:'Pedal',preamp:'Preamp',outboard:'Outboard'};
    const gearType=String(raw.gear_type||'').toLowerCase().replaceAll('_','-');
    if (known(raw.gear_make)) details.push(`Gear make: ${raw.gear_make}`);
    if (known(raw.gear_model) && raw.gear_model !== raw.gear_make) details.push(`Gear model: ${raw.gear_model}`);
    if (gearType) details.push(`Capture type: ${gearLabels[gearType]||raw.gear_type}`);
    if (known(raw.tone_type)) details.push(`Tone: ${String(raw.tone_type).replaceAll('_', ' ')}`);
    if (raw.trainer) details.push(`Trainer: ${raw.trainer}`);
    const date = metadataDate(raw.date); if (date) details.push(`Captured: ${date}`);
    if (Number.isFinite(raw.input_level_dbu)) details.push(`Input level: ${raw.input_level_dbu} dBu`);
    if (Number.isFinite(raw.output_level_dbu)) details.push(`Output level: ${raw.output_level_dbu} dBu`);
    if (m.provenance?.license) details.push(`License: ${m.provenance.license}`);
    if (m.provenance?.provider && m.provenance.provider !== 'Local') details.push(`Provider: ${m.provenance.provider}`);
    if (m.provenance?.toneId) details.push(`Tone ID: ${m.provenance.toneId}`);
    // Each "Label: value" line becomes a fact card; the first line is the file name.
    const facts=details.map((line,index)=>{const split=line.indexOf(': ');return index===0||split<0?['File',line]:[line.slice(0,split),line.slice(split+2)];});
    this.querySelector('.model-facts').replaceChildren(...facts.map(([label,value])=>{const article=document.createElement('article');if(value.length>48)article.className='wide';const name=document.createElement('span');name.textContent=label;const text=document.createElement('strong');text.textContent=value;article.append(name,text);return article;}));
    this.controls.status.textContent = '';
  }

  async calibrateCurrentModelLevel() {
    this.controls.calibrateLevel.disabled = true;
    this.controls.useMetadataLevel.disabled = true;
    const previousText = this.controls.calibrateLevel.textContent;
    this.controls.calibrateLevel.textContent = 'Measuring guitar…';
    this.controls.calibrationStatus.textContent='Analysing the guitar reference in the background…';
    try {
      const result = await this.node.calibrateModelLevel();
      this.controls.autoLevel.checked = true;
      try { localStorage.setItem(autoLevelStorageKey, 'on'); } catch { /* Keep session state. */ }
      if (result.clamped) this.controls.modelLevel.title += ' · target not reached: correction or peak limit';
      this.controls.calibrationStatus.textContent=result.clamped?'Calibration complete — level limited to preserve peak headroom.':'Calibrated with Funky-Guitar — target −24 dBFS.';
    } catch (error) {
      this.controls.status.classList.add('error');
      this.controls.status.textContent = `Level calibration failed: ${error.message}`;
      this.controls.calibrationStatus.textContent=this.controls.status.textContent;
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
    if (show) this.controls.toneBack.hidden = true;
  }

  backToTone3000MainView() {
    ++this._toneSelectionSerial;
    this._toneModelLoading = false;
    this.controls.toneSelection.hidden = true;
    this.controls.toneCatalog.hidden = false;
    this.controls.toneBack.hidden = true;
    this.setToneStatus('Choose a tone to see compatible A2 models');
    if (!this.controls.toneCards.childElementCount) return this.loadTone3000Catalog();
  }

  setSourceFilter(source) {
    this._sourceFilter = source;
    this.controls.sourceTabs.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.source === source)));
    this.controls.factoryCategories.hidden = source !== 'Factory';
    this.controls.tonePanel.hidden = source !== 'TONE3000';
    if (source === 'TONE3000') this.tone3000?.reloadTokens?.();
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
    this.setSourceFilter('TONE3000'); this.showToneAuthentication(false); this.setPluginTab('models');
    this.setToneStatus('Opening TONE3000…'); this._toneCallbackHref = '';
    this.toneSession?.claim();
    sessionStorage.setItem('nam-a2-wam.tone3000.owner', 'amp');
    sessionStorage.setItem('nam-a2-wam.tone3000.popup', '1');
    const popup = window.open('about:blank', 'tone3000-oauth', 'popup,width=1180,height=820');
    sessionStorage.removeItem('nam-a2-wam.tone3000.popup');
    if (!popup) { sessionStorage.removeItem('nam-a2-wam.tone3000.owner'); this.setToneStatus('TONE3000 window blocked — allow pop-ups for this site and try again.', true); return; }
    this._tonePopup = popup;
    try { popup.location.replace(await createUrl()); this.setToneStatus(waitingStatus); }
    catch (error) { popup.close(); this._tonePopup = null; sessionStorage.removeItem('nam-a2-wam.tone3000.owner'); this.setToneStatus(error.message, true); }
  }

  async completeTone3000Callback(location = window.location) {
    const hasCallback = /[?&](?:code|error|canceled)=/u.test(new URL(location.href).search);
    if (!hasCallback) { if (this.tone3000.configured) this.setToneStatus('Ready — click Browse TONE3000 to select a tone'); return; }
    if (sessionStorage.getItem('nam-a2-wam.tone3000.owner') === 'cabinet') return;
    if (!this.tone3000.configured) { this.setToneStatus('TONE3000 callback received, but integration is not configured', true); return; }
    this._sourceFilter = 'TONE3000';
    this.controls.sourceTabs.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.source === 'TONE3000')));
    this.controls.tonePanel.hidden = false;
    this.setPluginTab('models');
    this.renderBrowser();
    this.setToneStatus('Completing TONE3000 authorization…');
    const result = await this.tone3000.completeAuthorization(location);
    sessionStorage.removeItem('nam-a2-wam.tone3000.owner');
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
    this.controls.toneCatalog.hidden = false; this.controls.toneSelection.hidden = true; this.controls.toneBack.hidden = true; this.setToneStatus('Loading TONE3000 catalog…');
    try {
      const options = {page: this._tonePage, pageSize: 12, gear: this._toneGear};
      const result = this._toneFeed === 'latest' ? await this.tone3000.listLatestTones() : this._toneFeed === 'trending' ? await this.tone3000.listTrendingTones(this._toneGear) : await this.tone3000[`list${this._toneFeed[0].toUpperCase()}${this._toneFeed.slice(1)}Tones`](options);
      const tones = Array.isArray(result) ? result : result.data || [];
      this.controls.toneCards.replaceChildren(...tones.map((tone) => { const button=document.createElement('button'); button.type='button'; button.className='toneCard'; const image=document.createElement('img'); image.crossOrigin='anonymous'; image.referrerPolicy='no-referrer'; image.alt=''; image.src=getToneImageUrl(tone);this.bindModelHover(image,()=>({...tone,provenance:{title:tone.title||tone.name,creator:tone.creator?.name||tone.creator_name||tone.user?.username,gear:tone.gear||tone.gear_type,license:tone.license,toneId:tone.id||tone.tone_id,source:'TONE3000'}})); const title=document.createElement('strong'); title.textContent=tone.title || tone.name || `Tone ${tone.id}`; const creator=document.createElement('small'); creator.textContent=tone.creator?.name || tone.creator_name || tone.user?.username || 'TONE3000 creator'; button.append(image,title,creator); button.onclick=()=>this.loadTone3000Selection(tone.id); return button; }));
      this.controls.tonePage.textContent = `Page ${this._tonePage}`; this.controls.tonePrev.disabled = this._tonePage <= 1; this.controls.toneNext.disabled = tones.length < 12; this.setToneStatus(tones.length ? 'Choose a tone to see compatible A2 models' : 'No tones found for this filter.');
    } catch (error) { this.setToneStatus(error.message, true); }
  }

  async loadTone3000Selection(toneId, {autoLoad = true} = {}) {
    const serial=++this._toneSelectionSerial;
    try {
      this.setToneStatus('Loading tone metadata…');
      const tone = await this.tone3000.getTone(toneId);
      if(serial!==this._toneSelectionSerial)return;
      this.setToneStatus('Loading compatible A2 models…');
      const models = await this.tone3000.getCompatibleModels(toneId);
      if(serial!==this._toneSelectionSerial)return;
      this._toneModels = models.filter((model) => String(model.architecture ?? 2) === '2');
      this._toneModelIndex=0;this._toneModelLoading=false;this._tone=tone;this._toneId=toneId;
      this.controls.toneSelection.hidden = false;
      this.querySelector('.tone3000Downloads').open=false;
      this._toneDownloadedExpanded=false;this.renderBrowser();
      this.controls.toneCatalog.hidden = true;
      this.controls.toneBack.hidden = false;
      this.controls.toneCaptureLabel.textContent = captureCountLabel(this._toneModels.length);
      const imageUrl = getToneImageUrl(tone);
      const toneTitle = tone.title || tone.name || `Tone ${toneId}`;
      this.setToneImage(this.controls.toneImage, imageUrl, `${toneTitle} — TONE3000 tone image`);
      this.controls.toneTitle.textContent=toneTitle;
      this.controls.toneInfo.textContent = `Creator: ${tone.creator?.name || tone.creator_name || tone.created_by || 'Unknown'}\nGear: ${tone.gear_type || tone.gear || 'NAM'}${tone.license ? `\nLicense: ${tone.license}` : ''}`;
      this.controls.toneCaptureList.replaceChildren(...this._toneModels.map((model,index)=>{const button=document.createElement('button');button.type='button';button.className='factoryCapture';button.textContent=model.name||`Model ${model.id}`;button.title=button.textContent;button.setAttribute('aria-label',`Load ${button.textContent}`);button.onclick=()=>this.loadTone3000Model(index);return button;}));
      this.renderTone3000Selection();
      if (!this._toneModels.length) { this.setToneStatus('No compatible NAM A2 model is available for this tone.', true); return; }
      this.setToneStatus('Tone selected — loading the first A2 model…');
      if (autoLoad) await this.loadTone3000Model();
      if(serial===this._toneSelectionSerial&&this._modelsOpen)this.controls.toneSelection.scrollIntoView?.({block:'nearest'});
    } catch (error) { this.setToneStatus(error.message, true); }
  }

  renderTone3000Selection() {
    const index=this._toneModelIndex,models=this._toneModels,model=models[index],busy=this._toneModelLoading;
    this.controls.toneCapturePrevious.disabled=busy||index<=0;
    this.controls.toneCaptureNext.disabled=busy||index>=models.length-1;
    this.controls.toneCapturePick.disabled=busy||!model;
    this.controls.toneFilename.textContent=model?.name||'';
    this.controls.toneFilename.title=model?.name||'';
    const identity=model?`tone3000:${this._toneId}:${model.id}`:'';
    const loaded=!!identity&&identity===this._selectedId;
    this.controls.toneCounter.textContent=model?`${index+1} / ${models.length}${loaded?' · loaded':''}`:'No compatible captures';
    this.controls.toneCapturePick.classList.toggle('selected',loaded);
    [...this.controls.toneCaptureList.children].forEach((button,buttonIndex)=>{button.disabled=busy;const active=`tone3000:${this._toneId}:${models[buttonIndex].id}`===this._selectedId;button.classList.toggle('selected',active);button.classList.toggle('loaded',active);button.setAttribute('aria-current',active?'true':'false');});
    const selected=this.controls.toneCaptureList.children[index];
    if(selected)this.controls.toneCaptureList.scrollTop=Math.max(0,selected.offsetTop-(this.controls.toneCaptureList.clientHeight-selected.offsetHeight)/2);
  }

  async loadTone3000Model(index=this._toneModelIndex) {
    const model = this._toneModels[index];
    if (!model || this._toneModelLoading) return;
    this._toneModelIndex=index;this._toneModelLoading=true;this.renderTone3000Selection();
    const serial=this._toneSelectionSerial;
    const toneId = this._toneId ?? this._tone?.id ?? this._tone?.tone_id;
    const provenance = {identity: `tone3000:${toneId}:${model.id}`, toneId, modelId: model.id,
      title: this._tone?.title || this._tone?.name, creator: this._tone?.creator?.name || this._tone?.creator_name,
      gear: this._tone?.gear || this._tone?.gear_type, format: this._tone?.format,
      license: this._tone?.license, imageUrl: getToneImageUrl(this._tone), source: 'TONE3000'};
    try { this.setToneStatus('Downloading model…'); const downloaded = await this.tone3000.downloadModel(model);if(serial!==this._toneSelectionSerial)return;this.setToneStatus('Loading NAM model…'); await this.node.loadModelText(downloaded.text, downloaded.name, provenance); const record={...provenance,name:downloaded.name,text:downloaded.text,downloadedAt:new Date().toISOString()};try{await this.tone3000Downloads.save(record);this.upsertTone3000Asset(record);this.renderTone3000Downloads();this.setToneStatus('TONE3000 model loaded and saved on this device');}catch(cacheError){this.setToneStatus(`Model loaded, but local storage failed: ${cacheError.message}`,true);} if(serial===this._toneSelectionSerial){this.setPluginTab('amp');} return true; }
    catch (error) { if(serial===this._toneSelectionSerial)this.setToneStatus(error.message, true); return false; }
    finally { if(serial===this._toneSelectionSerial){this._toneModelLoading=false;this.renderTone3000Selection();} }
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

  // Called by the host after sign-in/sign-out. Variant and auto-level belong
  // to the rack state (presets), so only the favorites are reloaded here.
  async reloadAccountData() {
    this._favoriteIds.clear();
    await this.loadFavorites();
  }

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
      const row=document.createElement('article'); row.className='downloadedTone';const select=document.createElement('button');select.type='button';select.className='downloadedToneSelect';select.setAttribute('aria-label',`Load ${asset.filename}`);
      const visual=document.createElement('div'); visual.className='downloadedToneVisual'; visual.textContent='T3K';
      if(asset.provenance?.imageUrl){const image=document.createElement('img');image.alt='';image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.src=asset.provenance.imageUrl;image.onerror=()=>image.replaceWith(visual);this.bindModelHover(image,()=>asset);select.append(image);}else select.append(visual);
      const meta=document.createElement('div');meta.className='downloadedToneMeta';const title=document.createElement('strong');title.textContent=asset.provenance?.title||asset.displayName;const by=document.createElement('small');by.textContent=[asset.provenance?.creator,asset.provenance?.license].filter(Boolean).join(' · ')||'TONE3000';meta.append(title,by);
      select.append(meta);select.onclick=async()=>{select.disabled=true;try{await this.node.loadModelText(asset.data,asset.filename,asset.provenance);this._selectedId=asset.id;this.setToneStatus('Downloaded TONE3000 model loaded');this.renderBrowser();}catch(error){this.setToneStatus(error.message,true);}finally{select.disabled=false;}};const remove=document.createElement('button');remove.type='button';remove.className='downloadedToneDelete';remove.textContent='Delete';remove.onclick=()=>this.deleteTone3000Download(asset);row.append(select,remove);return row;
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

  async loadManifest(){
    try{
      const response=await fetch(manifestUrl);if(!response.ok)throw Error(`HTTP ${response.status}`);
      const manifest=await response.json();this._assets=manifest.assets||[];this.renderBrowser();
    }catch(error){this.setModelStatus({status:'error',error:`Factory library unavailable: ${error.message}`});return;}
    const state=await this.node.getState();
    if(state.model?.data){this.setModelStatus({status:'ready',metadata:state.metadata,loadMs:0});await this._modelListener(state.metadata,state.model);}return;
  }
  createFactoryAssetEntry(asset) {
    const button=document.createElement('button');button.className='factoryAsset';
    const fallback=document.createElement('span');fallback.className='factoryAssetVisual';fallback.textContent=asset.metadata?.gear_make||asset.metadata?.gear_type||'NAM';
    const imageUrl=factoryImageUrl(asset);
    if(imageUrl){const image=document.createElement('img');image.alt='';image.src=imageUrl;image.onerror=()=>image.replaceWith(fallback);this.bindModelHover(image,()=>asset);button.append(image);}else button.append(fallback);
    const text=document.createElement('span');text.className='factoryAssetText';const title=document.createElement('strong');title.textContent=asset.displayName||asset.metadata?.name;const filename=document.createElement('small');filename.className='factoryAssetFilename';filename.textContent=`File: ${asset.filename}`;const gear=document.createElement('small');gear.textContent=[asset.metadata?.gear_make,asset.metadata?.gear_model].filter((value,index,array)=>value&&array.indexOf(value)===index).join(' · ')||asset.provenance?.title||'NAM capture';const attribution=document.createElement('small');attribution.textContent=[asset.metadata?.gear_type||asset.provenance?.gear,asset.metadata?.tone_type?.replaceAll('_',' '),(asset.metadata?.modeled_by||asset.provenance?.creator)&&`by ${asset.metadata?.modeled_by||asset.provenance?.creator}`,asset.provenance?.license].filter(Boolean).join(' · ');text.append(title,filename,gear,attribution);button.append(text);return button;
  }

  createFactoryToneCard(name,assets,selectedId,onSelect) {
    if(!assets.length||!assets.every((asset)=>asset.id.startsWith('factory:'))||(assets.length===1&&assets[0].provenance?.toneId==null))return null;
    const tone=assets[0];const card=document.createElement('section');card.className='factoryToneCard';
    const media=document.createElement('div');media.className='factoryToneMedia';
    const details=document.createElement('div');details.className='factoryToneDetails';
    const title=document.createElement('strong');title.className='factoryToneTitle';title.textContent=tone.provenance?.title||name;
    const meta=document.createElement('small');meta.className='factoryToneMeta';meta.textContent=[tone.provenance?.creator&&`by ${tone.provenance.creator}`,tone.metadata?.gear_type||tone.provenance?.gear,tone.provenance?.license,`${assets.length} capture${assets.length===1?'':'s'}`].filter(Boolean).join(' · ');
    const viewer=document.createElement('div');viewer.className='factoryToneViewer';
    const previous=document.createElement('button');previous.type='button';previous.className='factoryToneNav';previous.textContent='‹';
    const pick=document.createElement('button');pick.type='button';pick.className='factoryTonePick';
    const next=document.createElement('button');next.type='button';next.className='factoryToneNav';next.textContent='›';
    const imageUrl=factoryImageUrl(tone);const fallback=document.createElement('span');fallback.className='factoryToneVisual';fallback.textContent='NAM';
    if(imageUrl){const image=document.createElement('img');image.className='factoryToneArtwork';image.alt='';image.src=imageUrl;image.onerror=()=>image.replaceWith(fallback);this.bindModelHover(image,()=>assets[index]);pick.append(image);}else pick.append(fallback);
    const filename=document.createElement('span');filename.className='factoryToneFilename';
    const counter=document.createElement('small');counter.className='factoryToneCounter';
    const star=document.createElement('button');star.type='button';star.className='favoriteToggle factoryToneFavorite';
    const footer=document.createElement('div');footer.className='factoryToneFooter';
    const captureLabel=document.createElement('span');captureLabel.className='factoryCaptureLabel';captureLabel.textContent=captureCountLabel(assets.length);
    const captureList=document.createElement('div');captureList.className='factoryCaptureList';captureList.setAttribute('role','group');captureList.setAttribute('aria-label',`Captures for ${title.textContent}`);
    const captureButtons=assets.map((asset)=>{const button=document.createElement('button');button.type='button';button.className='factoryCapture';button.dataset.assetId=asset.id;button.textContent=asset.filename;button.title=asset.filename;button.setAttribute('aria-label',`Load ${asset.filename}`);captureList.append(button);return button;});
    let index=Math.max(0,assets.findIndex((asset)=>asset.id===selectedId));
    const update=()=>{const asset=assets[index];const current=assets.some(entry=>entry.id===this._selectedId);card.classList.toggle('current-model-card',current);card.setAttribute('aria-label',`${title.textContent}${current?' — Current model':''}`);previous.disabled=index===0;next.disabled=index===assets.length-1;previous.setAttribute('aria-label',`Previous capture of ${title.textContent}`);next.setAttribute('aria-label',`Next capture of ${title.textContent}`);pick.dataset.assetId=asset.id;pick.classList.toggle('selected',asset.id===this._selectedId);pick.setAttribute('aria-label',`Load ${asset.filename}`);filename.textContent=asset.filename;filename.title=asset.filename;counter.textContent=`${index+1} / ${assets.length}${asset.id===this._selectedId?' · loaded':''}`;captureButtons.forEach((button,buttonIndex)=>{const loaded=assets[buttonIndex].id===this._selectedId;button.classList.toggle('selected',loaded);button.classList.toggle('loaded',loaded);button.setAttribute('aria-current',loaded?'true':'false');});const favorite=this.isFavorite(asset);star.classList.toggle('active',favorite);star.textContent=favorite?'★':'☆';star.title=favorite?'Remove from favorites':'Add to favorites';star.setAttribute('aria-label',`${favorite?'Remove from':'Add to'} favorites: ${asset.filename}`);};
    const revealSelected=()=>{const button=captureButtons[index];captureList.scrollTop=Math.max(0,button.offsetTop-(captureList.clientHeight-button.offsetHeight)/2);};
    const choose=async(newIndex)=>{index=newIndex;update();revealSelected();previous.disabled=true;next.disabled=true;pick.disabled=true;captureButtons.forEach((button)=>{button.disabled=true;});try{await onSelect(assets[index]);}finally{pick.disabled=false;captureButtons.forEach((button)=>{button.disabled=false;});update();}};
    previous.onclick=()=>choose(index-1);next.onclick=()=>choose(index+1);pick.onclick=()=>choose(index);
    captureButtons.forEach((button,buttonIndex)=>{button.onclick=()=>choose(buttonIndex);});
    star.onclick=()=>this.toggleFavorite(assets[index]);
    // Collapsed, the card is a photo tile of the catalogue grid; opening it
    // shows the capture carousel and list. Single-capture tones load directly.
    const summary=document.createElement('button');summary.type='button';summary.className='factoryToneSummary';
    const thumb=document.createElement('span');thumb.className='factoryToneThumb';
    if(imageUrl){const image=document.createElement('img');image.alt='';image.src=imageUrl;image.loading='lazy';image.onerror=()=>image.remove();thumb.append(image);}
    // TONE3000 fills unknown gear fields with "T3K-Null".
    const known=(value)=>value&&!/^t3k-null$/iu.test(value)?String(value):'';
    const gearLabels={amp:'Amp','amp-cab':'Amp + cab','full-rig':'Full rig',pedal:'Pedal',preamp:'Preamp',outboard:'Outboard'};
    const gearType=String(tone.metadata?.gear_type||tone.provenance?.gear||'').toLowerCase().replaceAll('_','-');
    const toneType=known(tone.metadata?.tone_type);
    const brand=document.createElement('b');brand.textContent=known(tone.metadata?.gear_make)||(tone.provenance?.title||name).split(' ')[0];thumb.append(brand);
    const summaryText=document.createElement('span');summaryText.className='factoryToneSummaryText';
    const summaryTitle=document.createElement('strong');summaryTitle.textContent=title.textContent;
    const summaryMeta=document.createElement('small');summaryMeta.textContent=[gearLabels[gearType]||gearType,toneType&&toneType[0].toUpperCase()+toneType.slice(1),tone.provenance?.creator&&`by ${tone.provenance.creator}`].filter(Boolean).join(' · ');
    const summaryCount=document.createElement('small');summaryCount.className='factoryToneSummaryCount';summaryCount.textContent=`${assets.length} capture${assets.length===1?'':'s'}`;
    summaryText.append(summaryTitle,summaryMeta,summaryCount);
    const check=document.createElement('i');check.className='factoryToneCheck';check.setAttribute('aria-hidden','true');check.textContent='\u2713';
    summary.append(thumb,summaryText,check);
    const setOpen=(open)=>{card.classList.toggle('is-open',open);summary.setAttribute('aria-expanded',String(open));};
    summary.onclick=()=>{
      if(assets.length===1){choose(0);return;}
      const open=!card.classList.contains('is-open');
      card.parentElement?.querySelectorAll(':scope > .factoryToneCard.is-open').forEach((other)=>{if(other!==card){other.classList.remove('is-open');other.querySelector('.factoryToneSummary')?.setAttribute('aria-expanded','false');}});
      this._openToneGroup=open?name:null;setOpen(open);if(open)requestAnimationFrame(revealSelected);
    };
    setOpen(assets.length>1&&this._openToneGroup===name);
    update();viewer.append(previous,pick,next);footer.append(counter,star);media.append(title,meta,viewer,filename,footer);details.append(captureLabel,captureList);card.append(media,details,summary);
    requestAnimationFrame(()=>{if(card.isConnected)revealSelected();});return card;
  }

  initMainCaptureNavigation() {
    const artwork=this.querySelector('.currentModelArtwork');
    const media=document.createElement('div');media.className='mainCaptureMedia';
    const viewer=document.createElement('div');viewer.className='mainCaptureViewer';
    const previous=document.createElement('button'),next=document.createElement('button');
    previous.type=next.type='button';previous.textContent='‹';next.textContent='›';
    previous.setAttribute('aria-label','Previous capture');next.setAttribute('aria-label','Next capture');
    previous.disabled=next.disabled=true;
    const name=document.createElement('span');name.className='mainCaptureName';
    artwork.replaceWith(media);viewer.append(previous,artwork,next);media.append(viewer);
    this.querySelector('.currentModelInfo').append(name);
    this.querySelector('.level-actions').prepend(this.controls.modelLevel);
    this._mainCaptures={previous,next,name};
    previous.onclick=()=>this.moveMainCapture(-1);next.onclick=()=>this.moveMainCapture(1);
  }

  mainCaptureCollection() {
    const asset=this._assets.find(entry=>entry.id===this._selectedId);
    if(!asset)return {items:[],index:-1};
    if(asset.source==='TONE3000'&&String(asset.provenance?.toneId)===String(this._toneId)&&this._toneModels?.length){
      return {items:this._toneModels,index:this._toneModels.findIndex(model=>`tone3000:${this._toneId}:${model.id}`===asset.id),remote:true};
    }
    const items=this._assets.filter(entry=>{
      if(entry.id===asset.id)return true;
      if(asset.provenance?.toneId!=null)return entry.source===asset.source&&String(entry.provenance?.toneId)===String(asset.provenance.toneId);
      return asset.id.startsWith('factory:')&&entry.id.startsWith('factory:')&&JSON.stringify(entry.groups)===JSON.stringify(asset.groups);
    });
    return {items,index:items.findIndex(entry=>entry.id===asset.id)};
  }

  updateMainCaptureNavigation() {
    if(!this._mainCaptures)return;
    const {items,index}=this.mainCaptureCollection(),ui=this._mainCaptures;
    ui.previous.disabled=!!this._mainCaptureLoading||index<=0;
    ui.next.disabled=!!this._mainCaptureLoading||index<0||index>=items.length-1;
    const asset=this._assets.find(entry=>entry.id===this._selectedId);
    ui.name.textContent=asset?`${asset.filename}${items.length>1?` · ${index+1} / ${items.length}`:''}`:'';
    ui.name.title=asset?.filename||'';
  }

  moveMainCapture(direction) {
    return this.selectMainCapture(this.mainCaptureCollection().index+direction);
  }

  async selectMainCapture(target) {
    if(this._mainCaptureLoading)return;
    const {items,index,remote}=this.mainCaptureCollection(),asset=items[target];
    if(index<0||!asset)return;
    this._mainCaptureLoading=true;this.updateMainCaptureNavigation();
    try {
      if(remote){if(!await this.loadTone3000Model(target))throw Error('Capture could not be loaded');}
      else {
        let text=asset.data;
        if(!text){const response=await fetch(factoryAssetUrl(manifestUrl,'models',asset.relativePath));if(!response.ok)throw Error(`HTTP ${response.status}`);text=await response.text();}
        await this.node.loadModelText(text,asset.filename,asset.id.startsWith('factory:')?factoryProvenance(asset):asset.provenance);
        this._selectedId=asset.id;this.renderBrowser();
      }
      return true;
    } catch(error){this.setModelStatus({status:'error',error:error.message});return false;}
    finally{this._mainCaptureLoading=false;this.updateMainCaptureNavigation();}
  }

  renderBrowser() {
    this.updateMainCaptureNavigation();
    const factoryAssets=this._assets.filter((asset)=>asset.source!=='TONE3000'&&!asset.id.startsWith('external:'));
    const counts={all:factoryAssets.length,guitar:0,bass:0,pedal:0};for(const asset of factoryAssets)if(Object.hasOwn(counts,asset.category))counts[asset.category]++;
    const labels={all:'All',guitar:'Guitar',bass:'Bass',pedal:'Pedals'};this.controls.factoryCategoryButtons.forEach((button)=>{button.textContent=`${labels[button.dataset.category]} ${counts[button.dataset.category]}`;});
    const sourceAssets=this._sourceFilter==='Favorites'?this._assets.filter((asset)=>this.isFavorite(asset)):this._sourceFilter==='TONE3000'?this._assets.filter((asset)=>asset.source==='TONE3000'):this._sourceFilter==='External'?this._assets.filter((asset)=>asset.source==='External'||asset.id.startsWith('external:')):factoryAssets;
    const assets=this._sourceFilter==='Factory'&&this._factoryCategory!=='all'?sourceAssets.filter((asset)=>asset.category===this._factoryCategory):sourceAssets;
    const browserScrollTop=this.controls.browser.scrollTop;
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
    // The generic asset tree expands the selected model's ancestors. For local
    // TONE3000 downloads, keep the user's accordion choice instead: the remote
    // selection card below is the primary view after returning from Browse.
    if(this._sourceFilter==='TONE3000')for(const group of this.controls.browser.querySelectorAll('details')){
      if(group.querySelector(':scope > summary')?.textContent!=='Downloaded on this device')continue;
      const searching=Boolean(this.controls.search.value.trim());
      group.open=searching||Boolean(this._toneDownloadedExpanded);
      group.addEventListener('toggle',()=>{
        if(group.isConnected&&!searching)this._toneDownloadedExpanded=group.open;
      });
    }
    this.controls.browser.scrollTop=browserScrollTop;
  }
  async addExternal(text,name){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');const asset=addExternalAsset(this._assets,{id:`external:${hash}`,filename:name,relativePath:name,groups:['External'],displayName:name.replace(/\.nam$/i,''),type:'nam',source:'External',data:text});asset.data=text;this._selectedId=asset.id;this.controls.modelSource.textContent='External';this.setSourceFilter('External');this.renderBrowser();}
  destroy() { this.hideModelHover();this.node.setSpectrumEnabled(false).catch(()=>{});this.node.removeEventListener('wam-automation', this._automation); this.node.removeMeterListener(this._meterListener);this.node.removeSpectrumListener(this._spectrumListener); this.node.removeModelListener(this._modelListener); window.removeEventListener('message', this._toneMessage); window.removeEventListener('storage', this._toneStorageMessage); this._toneChannel?.close(); this._tonePopup?.close(); this.tone3000Downloads?.close(); this.modelFavorites?.close(); this.node.gui = null; }
}

if (!customElements.get('nam-a2-gui')) customElements.define('nam-a2-gui', NamA2Gui);
export const createElement = async (plugin) => new NamA2Gui().initialize(plugin);
