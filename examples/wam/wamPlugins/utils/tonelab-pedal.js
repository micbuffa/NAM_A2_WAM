// Generic TONELAB pedal GUI for the bundled WAM effects: one layout for every pedal, built from the
// plugin's own parameters (getParameterInfo gives ranges and defaults). A pedal only describes itself:
//   createTonelabPedal(plugin, {name: 'TS9', color: '#3f9b4c', bypass: '/TS9/bypass',
//     knobs: [{id: '/TS9/drive', label: 'Drive'}, {id: '/TS9/level', label: 'Level', unit: 'dB'}]})
// Standalone like the plugin GUIs: no import from the rack UI, --tl-* tokens with fallbacks.
// Knobs: vertical drag (shift = fine), wheel, arrow keys, double-click = default value. A knob with
// `log: true` (frequencies) turns on a logarithmic scale; `unit` and `format(v)` shape the readout.
// `switches: [{id, label}]` adds on/off toggles (lit = 1) for checkbox parameters other than bypass.
// Amps use the same element with `variant: 'amp'` (createTonelabAmp): a wide faceplate, knobs on one row,
// bypass as an ON toggle and menus in the header. Plugins that don't drive their params through
// getParamValue/setParamValue pass `read(id)` and `write(id, value)` (may return a promise);
// `selects: [{label, options: [{value, label, disabled}], get(), set(value), disabled()}]` adds menus and
// `status()` a status line (loading, errors). In amps, a select with `header: true` sits in the header,
// the others on a row under the knobs. `meters: [{label, level()}]` (level 0..1) frame the knobs;
// `attach()`/`detach()` run when the GUI is shown/hidden (e.g. to plug a meter source).
// `sections: [{label, knobs, selects, switches}]` adds collapsible groups (amp advanced settings).
// `skin: {background, image, fit, font, fontUrl, ink, vendorInk}` brings back a plugin's own look (body gradient/colour,
// picture - `fit: 'stretch'` for faceplates drawn to size -, title font among FONT_FILES or from `fontUrl`, title and
// vendor colours); the controls then sit on a dark plate to stay readable.
const styles = `
  :host { display: inline-block; font-family: var(--tl-font-ui, Inter, system-ui, sans-serif); color: var(--tl-text-1, #e6eae7);
    user-select: none; -webkit-user-select: none; }
  .pedal { position: relative; box-sizing: border-box; width: var(--pedal-width); padding: 18px 16px 16px; border-radius: 14px;
    background: linear-gradient(180deg, #1d2220 0%, #121614 100%); border: 1px solid var(--tl-border-strong, #3d433f);
    box-shadow: 0 10px 24px rgba(0, 0, 0, .55), inset 0 1px rgba(255, 255, 255, .06); display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .pedal::before { content: ""; position: absolute; left: 12px; right: 12px; top: 0; height: 3px; border-radius: 0 0 3px 3px; background: var(--pedal-color); }
  header { text-align: center; }
  .name { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--pedal-color); }
  .vendor { margin-top: 2px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--tl-text-muted, #6f7773); }
  .knobs { display: grid; grid-template-columns: repeat(var(--cols), 64px); justify-content: center; gap: 14px 10px; }
  .knob { display: flex; flex-direction: column; align-items: center; gap: 5px; outline: none; }
  .dial { position: relative; width: 44px; height: 44px; box-sizing: border-box; border-radius: 50%; cursor: ns-resize; touch-action: none;
    border: 1px solid var(--tl-border-strong, #3d433f); background: radial-gradient(circle at 40% 35%, #3a403d 0, #1b1f1d 52%, #0b0d0c 100%);
    box-shadow: var(--tl-shadow-knob, 0 4px 8px #050606, inset 0 1px rgba(255, 255, 255, .08)); }
  .rotor { position: absolute; inset: 0; pointer-events: none; }
  .indicator { position: absolute; left: calc(50% - 1px); top: 4px; width: 2px; height: 30%; border-radius: 1px;
    background: var(--tl-accent, #c7f65b); box-shadow: 0 0 4px var(--tl-accent-glow, rgba(199, 246, 91, .65)); }
  .knob:focus-visible .dial { box-shadow: var(--tl-shadow-knob, 0 4px 8px #050606), 0 0 0 2px #0b0d0c, 0 0 0 4px var(--tl-accent, #c7f65b); }
  .label { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--tl-text-muted, #6f7773); text-align: center; white-space: nowrap; max-width: 72px; overflow: hidden; text-overflow: ellipsis; }
  .value { font: 500 10px/1.2 var(--tl-font-mono, "JetBrains Mono", ui-monospace, Menlo, monospace); font-variant-numeric: tabular-nums; color: var(--tl-text-1, #e6eae7); }
  .toggles { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .toggle { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--tl-border-strong, #3d433f); background: var(--tl-surface-2, #1b1f1d); color: var(--tl-text-muted, #6f7773);
    font: 600 10px/1 var(--tl-font-ui, Inter, system-ui, sans-serif); letter-spacing: .08em; text-transform: uppercase; }
  .toggle[aria-pressed="true"] { color: var(--tl-text-1, #e6eae7); border-color: var(--tl-accent-border, #63733e); }
  .toggle .led { width: 6px; height: 6px; }
  .toggle:focus-visible { outline: 2px solid var(--tl-accent, #c7f65b); outline-offset: 2px; }
  .footswitch { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 2px; }
  .led { width: 8px; height: 8px; border-radius: 50%; background: #0b0d0c; box-shadow: inset 0 1px 2px #000, 0 0 0 1px var(--tl-border-strong, #3d433f); transition: background .12s, box-shadow .12s; }
  .led.on { background: var(--tl-accent, #c7f65b); box-shadow: var(--tl-glow-led, 0 0 9px rgba(199, 246, 91, .65)); }
  .amp { width: auto; min-width: 520px; padding: 18px 22px 16px; align-items: stretch; }
  .amp header { display: flex; align-items: center; justify-content: space-between; gap: 18px; text-align: left; }
  .amp .name { font-size: 17px; }
  .header-controls, .selects { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
  .select { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--tl-text-muted, #6f7773); }
  select { height: 26px; max-width: 180px; padding: 0 24px 0 8px; border-radius: 6px; cursor: pointer; appearance: none;
    border: 1px solid var(--tl-border-strong, #3d433f); color: var(--tl-text-1, #e6eae7); font: 500 12px/1 var(--tl-font-ui, Inter, system-ui, sans-serif);
    background: var(--tl-surface-2, #1b1f1d) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a3aba6' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 8px center; }
  select:disabled { opacity: .5; cursor: progress; }
  select:focus-visible { outline: 2px solid var(--tl-accent, #c7f65b); outline-offset: 1px; }
  .amp .knobs { padding: 14px 10px 10px; border-radius: 10px; background: rgba(0, 0, 0, .22); border: 1px solid rgba(255, 255, 255, .04); }
  .deck { display: flex; align-items: stretch; justify-content: center; gap: 12px; }
  .meter { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 9px; font-weight: 600; letter-spacing: .1em;
    text-transform: uppercase; color: var(--tl-text-muted, #6f7773); }
  .meter-bar { position: relative; flex: 1; width: 8px; min-height: 60px; border-radius: 4px; overflow: hidden; background: #0b0d0c;
    box-shadow: inset 0 1px 2px #000, 0 0 0 1px var(--tl-border-strong, #3d433f); }
  .meter-fill { position: absolute; left: 0; right: 0; bottom: 0; height: 0; background: linear-gradient(0deg, var(--tl-accent, #c7f65b) 0 70%, #f2c94c 85%, #f2777a 100%);
    background-size: 100% 60px; background-position: bottom; }
  .amp .selects { justify-content: flex-start; gap: 10px 14px; padding: 2px 4px; }
  .amp .selects .select { flex-direction: column; align-items: flex-start; gap: 4px; }
  .section { border-top: 1px solid var(--tl-border, #2a2f2c); padding-top: 10px; }
  .section summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 600;
    letter-spacing: .1em; text-transform: uppercase; color: var(--tl-text-muted, #6f7773); }
  .section summary::-webkit-details-marker { display: none; }
  .section summary::before { content: ""; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg); transition: transform .15s; }
  .section[open] summary::before { transform: rotate(45deg); }
  .section summary:hover { color: var(--tl-text-1, #e6eae7); }
  .section summary:focus-visible { outline: 2px solid var(--tl-accent, #c7f65b); outline-offset: 2px; }
  .section-body { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 20px; padding: 12px 4px 2px; }
  .section-body .knobs { display: flex; flex-wrap: wrap; gap: 14px 10px; }
  .section-body .knob { width: 64px; }
  .pedal.skinned { background: var(--skin-image, none) center / var(--skin-size, cover) no-repeat, var(--skin-bg, #1d2220); }
  .pedal.skinned::before { display: none; }
  .skinned .name { color: var(--skin-ink, var(--pedal-color)); text-shadow: 0 2px 6px rgba(0, 0, 0, .55); }
  /* Faceplates drawn to size have a frame: keep the controls inside its panel. */
  .pedal.skinned.stretch { padding: 34px 44px 30px; }
  .skinned.custom-font .name { font: 400 24px/1.1 var(--skin-font); letter-spacing: 0; text-transform: none; }
  .skinned .vendor { color: var(--skin-vendor, rgba(255, 255, 255, .8)); text-shadow: 0 1px 3px rgba(0, 0, 0, .5); }
  .skinned .label { color: rgba(255, 255, 255, .62); }
  .skinned .header-controls .select > span { color: var(--skin-vendor, rgba(255, 255, 255, .8)); }
  .skinned .deck { padding: 12px 10px 10px; border-radius: 12px; background: rgba(8, 10, 9, .8); border: 1px solid rgba(255, 255, 255, .08);
    box-shadow: 0 6px 16px rgba(0, 0, 0, .35); backdrop-filter: blur(3px); }
  .skinned .knobs { padding: 0; background: none; border: 0; }
  .skinned .selects, .skinned .toggles, .skinned .section { padding: 8px 10px; border-radius: 10px; background: rgba(8, 10, 9, .8); }
  .skinned .status { color: rgba(255, 255, 255, .8); text-shadow: 0 1px 3px #000; }
  .status { min-height: 14px; font-size: 11px; text-align: center; color: var(--tl-text-muted, #6f7773); }
  .status.error { color: var(--tl-danger, #f2777a); }
  .status:empty { display: none; }
  .footswitch button { width: 46px; height: 46px; border-radius: 50%; cursor: pointer; border: 1px solid var(--tl-border-strong, #3d433f);
    background: radial-gradient(circle at 50% 40%, #c9cfcb 0, #8a918d 45%, #4b514e 100%); box-shadow: 0 4px 8px #050606, inset 0 -2px 3px rgba(0, 0, 0, .4); }
  .footswitch button:active { transform: translateY(1px); box-shadow: 0 2px 4px #050606, inset 0 -1px 2px rgba(0, 0, 0, .4); }
  .footswitch button:focus-visible { outline: 2px solid var(--tl-accent, #c7f65b); outline-offset: 3px; }
`;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Title fonts of the original pedal GUIs, bundled in ./fonts (Google Fonts, OFL / Apache 2.0, latin subset).
export const FONT_FILES = {
  'Bungee Shade': 'BungeeShade.woff2', 'Faster One': 'FasterOne.woff2', 'Fontdiner Swanky': 'FontdinerSwanky.woff2',
  'Francois One': 'FrancoisOne.woff2', 'Freckle Face': 'FreckleFace.woff2', 'Fruktur': 'Fruktur.woff2', 'Galada': 'Galada.woff2',
  'Gloria Hallelujah': 'GloriaHallelujah.woff2', 'Henny Penny': 'HennyPenny.woff2', 'Monoton': 'Monoton.woff2',
  'Skranji': 'Skranji.woff2', 'Vast Shadow': 'VastShadow.woff2',
};
const loadedFonts = new Set();
function ensureFont(family, url) {
  url ||= FONT_FILES[family] && new URL(`fonts/${FONT_FILES[family]}`, import.meta.url).href;
  if (!url || loadedFonts.has(family) || typeof FontFace === 'undefined') return;
  loadedFonts.add(family);
  const face = new FontFace(family, `url("${url}")`);
  document.fonts.add(face);
  face.load().catch(() => loadedFonts.delete(family));
}

export class TonelabPedal extends HTMLElement {
  constructor(plugin, config, info) {
    super();
    this.plugin = plugin;
    this.config = config;
    this.info = info;
    this.knobs = [];
    this.toggles = [];
    this.selects = [];
    const root = this.attachShadow({mode: 'open'});
    // Balanced rows: 4 knobs as 2 x 2, 5-6 on three columns, more on four.
    // Amps keep every knob on a single row.
    const amp = config.variant === 'amp';
    const n = config.knobs.length;
    const cols = amp ? Math.max(1, n) : n <= 3 ? Math.max(1, n) : n === 4 ? 2 : n <= 6 ? 3 : 4;
    const footswitch = config.bypass && !amp;
    root.innerHTML = `<style>${styles}</style>
      <div class="pedal${amp ? ' amp' : ''}${config.skin ? ' skinned' : ''}" part="pedal" style="--pedal-color:${config.color || 'var(--tl-accent, #c7f65b)'};--cols:${cols};--pedal-width:${Math.max(200, cols * 74 + 52)}px">
        <header><div><h2 class="name"></h2><div class="vendor"></div></div>${amp ? '<div class="header-controls"></div>' : ''}</header>
        <div class="deck"><div class="knobs"></div></div>
        <div class="selects"></div>
        <div class="toggles"></div>
        <div class="status" role="status"></div>
        ${footswitch ? '<div class="footswitch"><span class="led"></span><button type="button" aria-pressed="false"></button></div>' : ''}
      </div>`;
    this.statusEl = root.querySelector('.status');
    const skin = config.skin;
    if (skin) {
      const pedal = root.querySelector('.pedal');
      if (skin.background) pedal.style.setProperty('--skin-bg', skin.background);
      if (skin.image) pedal.style.setProperty('--skin-image', `url("${skin.image}")`);
      if (skin.ink) pedal.style.setProperty('--skin-ink', skin.ink);
      if (skin.vendorInk) pedal.style.setProperty('--skin-vendor', skin.vendorInk);
      if (skin.fit === 'stretch') { pedal.style.setProperty('--skin-size', '100% 100%'); pedal.classList.add('stretch'); }
      if (skin.font) {
        ensureFont(skin.font, skin.fontUrl);
        pedal.classList.add('custom-font');
        pedal.style.setProperty('--skin-font', `"${skin.font}", ${amp ? 'system-ui' : 'cursive'}`);
      }
    }
    root.querySelector('.name').textContent = config.name || plugin.descriptor?.name || '';
    root.querySelector('.vendor').textContent = config.vendor ?? plugin.descriptor?.vendor ?? '';
    const header = root.querySelector('.header-controls');
    this.addControls(root.querySelector('.pedal'), config, header);
    // Collapsible sections (amp "advanced" settings): same controls, folded under a summary.
    for (const section of config.sections || []) {
      const details = document.createElement('details');
      details.className = 'section';
      details.innerHTML = '<summary></summary><div class="section-body"><div class="knobs"></div><div class="selects"></div><div class="toggles"></div></div>';
      details.firstChild.textContent = section.label;
      root.querySelector('.status').before(details);
      this.addControls(details.lastChild, section);
    }
    this.meters = (config.meters || []).map((m, i) => {
      const el = document.createElement('div');
      el.className = 'meter';
      el.innerHTML = '<div class="meter-bar"><div class="meter-fill"></div></div><span></span>';
      el.lastChild.textContent = m.label;
      const deck = root.querySelector('.deck');
      i === 0 ? deck.prepend(el) : deck.append(el);
      return {...m, fill: el.querySelector('.meter-fill')};
    });
    if (footswitch) {
      this.led = root.querySelector('.footswitch .led');
      this.footswitch = root.querySelector('.footswitch button');
      this.footswitch.setAttribute('aria-label', 'Bypass');
      this.footswitch.onclick = () => this.setParam(config.bypass, this.isOn() ? 1 : 0);
    } else if (config.bypass) {
      // Amps: a power toggle in the header, lit while the amp runs.
      const power = document.createElement('button');
      power.type = 'button';
      power.className = 'toggle';
      power.innerHTML = '<span class="led"></span><span>On</span>';
      power.setAttribute('aria-label', 'Amp on');
      power.onclick = () => this.setParam(config.bypass, this.isOn() ? 1 : 0);
      header.append(power);
      this.led = power.firstChild;
      this.footswitch = power;
    }
    for (const el of root.querySelectorAll('.knobs, .selects, .toggles')) if (!el.childElementCount) el.remove();
    this.frame = () => { this.sync(); this.raf = requestAnimationFrame(this.frame); };
  }

  // Builds the knobs, menus and toggles of `spec` into `box` (the faceplate or a section body).
  addControls(box, spec, header) {
    const known = Object.keys(this.info).length > 0;
    for (const conf of spec.knobs || []) {
      if (known && !this.info[conf.id]) console.warn(`tonelab-pedal: unknown parameter ${conf.id}`);
      const p = this.info[conf.id] || {};
      const min = conf.min ?? p.minValue ?? 0, max = conf.max ?? p.maxValue ?? 1;
      const k = {...conf, min, max, def: conf.default ?? p.defaultValue ?? min, step: conf.step ?? (p.discreteStep || 0), log: Boolean(conf.log && min > 0), value: NaN};
      k.el = document.createElement('div');
      k.el.className = 'knob';
      k.el.tabIndex = 0;
      k.el.setAttribute('role', 'slider');
      k.el.setAttribute('aria-label', k.label);
      k.el.setAttribute('aria-valuemin', k.min);
      k.el.setAttribute('aria-valuemax', k.max);
      k.el.innerHTML = '<div class="dial"><div class="rotor"><span class="indicator"></span></div></div><span class="label"></span><span class="value"></span>';
      k.el.querySelector('.label').textContent = k.label;
      k.rotor = k.el.querySelector('.rotor');
      k.out = k.el.querySelector('.value');
      this.bindKnob(k);
      box.querySelector('.knobs').append(k.el);
      this.knobs.push(k);
    }
    for (const m of spec.selects || []) {
      const wrap = document.createElement('label');
      wrap.className = 'select';
      wrap.innerHTML = '<span></span><select></select>';
      wrap.firstChild.textContent = m.label;
      const el = wrap.lastChild;
      for (const o of typeof m.options === 'function' ? m.options() : m.options) {
        const option = new Option(o.label, o.value);
        option.disabled = Boolean(o.disabled);
        el.append(option);
      }
      el.onchange = () => { this.run(m.set(el.value)); this.changed(); };
      (header && m.header ? header : box.querySelector('.selects')).append(wrap);
      this.selects.push({...m, el});
    }
    for (const t of spec.switches || []) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'toggle';
      el.innerHTML = '<span class="led"></span><span></span>';
      el.lastChild.textContent = t.label;
      el.onclick = () => this.setParam(t.id, Number(this.read(t.id)) >= 0.5 ? 0 : 1);
      box.querySelector('.toggles').append(el);
      this.toggles.push({...t, el, led: el.firstChild});
    }
  }

  // Bypass params are 1 = bypassed (Faust convention).
  isOn() { return Number(this.read(this.config.bypass)) < 0.5; }
  read(id) { return this.config.read ? this.config.read(id) : this.plugin.audioNode.getParamValue(id); }
  setParam(id, value) {
    this.run(this.config.write ? this.config.write(id, value) : this.plugin.audioNode.setParamValue(id, value));
    this.changed();
  }
  changed() { this.dispatchEvent(new Event('change', {bubbles: true, composed: true})); }
  // Async writes (amps) report their failure in the status line.
  run(result) {
    this.error = '';
    Promise.resolve(result).catch(e => { this.error = e?.message || String(e); });
  }

  format(k, v) {
    if (k.format) return k.format(v);
    if (k.unit === 'Hz' && v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz`;
    const span = Math.abs(k.max - k.min);
    const digits = span <= 2 ? 2 : span <= 50 ? 1 : 0;
    return `${v.toFixed(digits)}${k.unit ? ` ${k.unit}` : ''}`;
  }

  // Knob position 0..1 <-> parameter value.
  toPos(k, v) { return k.log ? Math.log(v / k.min) / Math.log(k.max / k.min) : (v - k.min) / (k.max - k.min || 1); }
  toValue(k, pos) { pos = clamp(pos, 0, 1); return k.log ? k.min * (k.max / k.min) ** pos : k.min + pos * (k.max - k.min); }

  draw(k, v) {
    if (v === k.value) return;
    k.value = v;
    k.rotor.style.transform = `rotate(${270 * (this.toPos(k, v) - 0.5)}deg)`;
    k.out.textContent = this.format(k, v);
    k.el.setAttribute('aria-valuenow', v);
    k.el.setAttribute('aria-valuetext', k.out.textContent);
  }

  set(k, v) {
    v = clamp(v, k.min, k.max);
    if (k.step) v = clamp(Math.round((v - k.min) / k.step) * k.step + k.min, k.min, k.max);
    this.draw(k, v);
    // Async params land a little later: don't redraw the stale value meanwhile.
    k.hold = performance.now() + 300;
    this.setParam(k.id, v);
  }

  // Moves the knob by `delta` of its travel (1 = whole range).
  nudge(k, delta) { this.set(k, this.toValue(k, this.toPos(k, k.value) + delta)); }

  bindKnob(k) {
    const dial = k.el.querySelector('.dial');
    dial.addEventListener('pointerdown', e => {
      e.preventDefault();
      k.el.focus();
      dial.setPointerCapture(e.pointerId);
      let y = e.clientY, pos = this.toPos(k, k.value);
      const move = m => { pos = clamp(pos + (y - m.clientY) / (m.shiftKey ? 600 : 150), 0, 1); y = m.clientY; this.set(k, this.toValue(k, pos)); };
      const up = () => { dial.removeEventListener('pointermove', move); dial.removeEventListener('pointerup', up); dial.removeEventListener('pointercancel', up); };
      dial.addEventListener('pointermove', move);
      dial.addEventListener('pointerup', up);
      dial.addEventListener('pointercancel', up);
    });
    dial.addEventListener('dblclick', () => this.set(k, k.def));
    dial.addEventListener('wheel', e => { e.preventDefault(); this.nudge(k, -Math.sign(e.deltaY) / (e.shiftKey ? 200 : 50)); }, {passive: false});
    k.el.addEventListener('keydown', e => {
      const d = {ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1}[e.key];
      if (d) { e.preventDefault(); this.nudge(k, d / (e.shiftKey ? 200 : 50)); }
      else if (e.key === 'Home') this.set(k, k.min);
      else if (e.key === 'End') this.set(k, k.max);
    });
  }

  // Presets, MIDI and automation change params behind the GUI: follow the node while shown.
  sync() {
    const now = performance.now();
    for (const k of this.knobs) {
      if (k.hold > now) continue;
      const v = Number(this.read(k.id));
      if (Number.isFinite(v)) this.draw(k, v);
    }
    for (const m of this.meters) {
      const level = clamp(Number(m.level()) || 0, 0, 1);
      if (level !== m.last) { m.last = level; m.fill.style.height = `${level * 100}%`; }
    }
    for (const m of this.selects) {
      if (m.el !== this.shadowRoot.activeElement) m.el.value = String(m.get());
      m.el.disabled = Boolean(m.disabled?.());
    }
    const status = this.error || this.config.status?.() || '';
    if (this.statusEl.textContent !== status) this.statusEl.textContent = status;
    this.statusEl.classList.toggle('error', Boolean(this.error));
    for (const t of this.toggles) {
      const on = Number(this.read(t.id)) >= 0.5;
      t.led.classList.toggle('on', on);
      t.el.setAttribute('aria-pressed', String(on));
    }
    if (this.led) {
      const on = this.isOn();
      this.led.classList.toggle('on', on);
      this.footswitch.setAttribute('aria-pressed', String(on));
    }
  }

  // Runs only while shown: the rack parks closed editors in the page (setEditorVisible(false)).
  start() {
    if (this.running || this.parked || this.destroyed || !this.isConnected) return;
    this.running = true;
    this.config.attach?.();
    this.frame();
  }
  stop() {
    cancelAnimationFrame(this.raf);
    if (!this.running) return;
    this.running = false;
    this.config.detach?.();
  }
  setEditorVisible(visible) { this.parked = !visible; visible ? this.start() : this.stop(); }
  connectedCallback() { this.start(); }
  disconnectedCallback() { this.stop(); }
  destroy() { this.destroyed = true; this.stop(); }
}

if (!customElements.get('tonelab-pedal')) customElements.define('tonelab-pedal', TonelabPedal);

export async function createTonelabPedal(plugin, config) {
  let info = {};
  try { info = await plugin.audioNode.getParameterInfo?.() || {}; } catch {}
  return new (customElements.get('tonelab-pedal'))(plugin, config, info);
}

export function createTonelabAmp(plugin, config) {
  return createTonelabPedal(plugin, {...config, variant: 'amp'});
}
