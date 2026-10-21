// TONELAB skin for the g200kg webaudio-controls used by the bundled plugin GUIs.
// Several copies of the library ship with the plugins (webaudio-knob, ifc-, ifc2-, wap2- prefixes) and the
// first one loaded wins the tag, so the skin patches the registered classes instead of one file. Every copy
// keeps the same internals: `this.elem` is the drawn body, setupImage() sizes it and redraw() shows the value.
// The sprite images (`src`) are ignored: knobs and switches are drawn with the --tl-* tokens (with fallbacks,
// the plugins stay standalone). Behaviour (drag, wheel, dblclick, MIDI learn, tooltips) is untouched.
const PREFIXES = ['', 'ifc-', 'ifc2-', 'wap2-'];
const SKINNED = Symbol('tonelabSkin');

const css = (el, props) => { for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v); };
const layer = (elem, cls) => {
  let el = elem.querySelector(`:scope > .${cls}`);
  if (!el) { el = document.createElement('div'); el.className = cls; elem.append(el); }
  return el;
};

function setupKnob() {
  const elem = this.elem;
  if (!elem) return;
  this.kw = +(this.width || this.diameter) || 64;
  this.kh = +(this.height || this.diameter) || 64;
  const size = Math.min(this.kw, this.kh);
  css(elem, {
    'background-image': 'none', 'background-color': 'transparent', 'outline': 'none', 'transform': 'none',
    'width': `${this.kw}px`, 'height': `${this.kh}px`, 'position': 'relative', 'cursor': 'ns-resize',
  });
  // Sprite knobs were drawn with a margin: keep the dial a bit inside the original box.
  const dial = layer(elem, 'tl-skin-dial');
  const d = Math.round(size * 0.78);
  css(dial, {
    'position': 'absolute', 'left': '50%', 'top': '50%', 'width': `${d}px`, 'height': `${d}px`, 'margin': `${-d / 2}px 0 0 ${-d / 2}px`,
    'box-sizing': 'border-box', 'border-radius': '50%', 'pointer-events': 'none',
    'border': '1px solid var(--tl-border-strong, #3d433f)',
    'background': 'radial-gradient(circle at 40% 35%, #3a403d 0, #1b1f1d 52%, #0b0d0c 100%)',
    'box-shadow': 'var(--tl-shadow-knob, 0 4px 8px #050606, inset 0 1px rgba(255, 255, 255, .08))',
  });
  const rotor = layer(dial, 'tl-skin-rotor');
  css(rotor, {'position': 'absolute', 'inset': '0', 'pointer-events': 'none'});
  const ind = layer(rotor, 'tl-skin-indicator');
  css(ind, {
    'position': 'absolute', 'left': 'calc(50% - 1px)', 'top': `${Math.max(2, Math.round(d * 0.09))}px`, 'width': '2px', 'height': '30%',
    'border-radius': '1px', 'background': 'var(--tl-accent, #c7f65b)', 'box-shadow': '0 0 4px var(--tl-accent-glow, rgba(199, 246, 91, .65))',
  });
  this.redraw();
}

function redrawKnob() {
  this.digits = 0;
  if (this.step && this.step < 1) for (let n = this.step; n < 1; n *= 10) ++this.digits;
  if (this.value < this.min) { this.value = this.min; return; }
  if (this.value > this.max) { this.value = this.max; return; }
  const rotor = this.elem?.querySelector('.tl-skin-rotor');
  if (!rotor) return;
  const range = this.max - this.min || 1;
  rotor.style.transform = `rotate(${270 * ((this.value - this.min) / range - 0.5)}deg)`;
}

function setupSwitch() {
  const elem = this.elem;
  if (!elem) return;
  const w = +(this.width || this.diameter) || 32;
  const h = +(this.height || this.diameter) || 32;
  const size = Math.min(w, h);
  css(elem, {
    'background-image': 'none', 'outline': 'none', 'width': `${w}px`, 'height': `${h}px`, 'position': 'relative',
    'box-sizing': 'border-box', 'border-radius': `${Math.round(size * 0.22)}px`,
    'border': '1px solid var(--tl-border-strong, #3d433f)',
    'background-color': 'var(--tl-surface-2, #1b1f1d)',
    'box-shadow': 'var(--tl-shadow-knob, 0 4px 8px #050606, inset 0 1px rgba(255, 255, 255, .08))',
  });
  const led = layer(elem, 'tl-skin-led');
  const l = Math.max(6, Math.round(size * 0.28));
  css(led, {
    'position': 'absolute', 'left': '50%', 'top': '50%', 'width': `${l}px`, 'height': `${l}px`, 'margin': `${-l / 2}px 0 0 ${-l / 2}px`,
    'border-radius': '50%', 'pointer-events': 'none', 'transition': 'background .12s, box-shadow .12s',
  });
  this.redraw();
}

function redrawSwitch() {
  const led = this.elem?.querySelector('.tl-skin-led');
  if (!led) return;
  const on = !!(this.value ^ this.invert);
  css(led, on
    ? {'background': 'var(--tl-accent, #c7f65b)', 'box-shadow': 'var(--tl-glow-led, 0 0 9px rgba(199, 246, 91, .65))'}
    : {'background': '#0b0d0c', 'box-shadow': 'inset 0 1px 2px #000, 0 0 0 1px var(--tl-border-strong, #3d433f)'});
}

// The library value tooltip sits above the control: restyle it and flip it below when an ancestor
// (the editor popup, the pedal box) would clip it. Rules live in a <style> next to the control because
// the controls render in the light DOM of each plugin's own shadow root.
const TOOLTIP_CSS = `.webaudioctrl-tooltip.tl-skin-tip { background: var(--tl-surface-3, #232825) !important; color: var(--tl-text-1, #e6eae7) !important;
  border: 1px solid var(--tl-border-strong, #3d433f) !important; border-radius: 6px !important; padding: 3px 7px !important;
  font: 500 11px/1.3 var(--tl-font-mono, ui-monospace, Menlo, monospace) !important; white-space: nowrap; box-shadow: 0 4px 10px rgba(0, 0, 0, .45); }
.webaudioctrl-tooltip.tl-skin-tip::before, .webaudioctrl-tooltip.tl-skin-tip::after { display: none !important; }`;

function clipTop(el) {
  let top = 0;
  for (let n = el; n; ) {
    n = n.parentElement || n.getRootNode?.().host;
    if (!n) break;
    const {overflow} = getComputedStyle(n);
    if (overflow !== 'visible') top = Math.max(top, n.getBoundingClientRect().top);
  }
  return top;
}

function placeTip() {
  const tip = this.ttframe;
  if (!tip || tip.style.visibility !== 'visible') return;
  if (!tip.classList.contains('tl-skin-tip')) {
    tip.classList.add('tl-skin-tip');
    if (!this.querySelector(':scope > style.tl-skin-style')) {
      const style = document.createElement('style');
      style.className = 'tl-skin-style';
      style.textContent = TOOLTIP_CSS;
      this.append(style);
    }
  }
  // Same box model as the library: left/top are relative to the control, with a -1000px horizontal margin.
  const rc = this.getBoundingClientRect(), tr = tip.getBoundingClientRect();
  const offset = tip.offsetParent === this.elem ? this.elem.getBoundingClientRect().top - rc.top : 0;
  tip.style.left = (rc.width - tr.width) * 0.5 + 1000 + 'px';
  const above = rc.top - tr.height - 6 >= clipTop(this);
  tip.style.top = (above ? -tr.height - 6 : rc.height + 6) - offset + 'px';
}

function skin(tag, setup, redraw) {
  customElements.whenDefined(tag).then(cls => {
    if (cls.prototype[SKINNED]) return;
    cls.prototype[SKINNED] = true;
    cls.prototype.setupImage = setup;
    cls.prototype.redraw = redraw;
    const showtip = cls.prototype.showtip;
    if (showtip) cls.prototype.showtip = function (d) { showtip.call(this, d); placeTip.call(this); };
  });
}

export function installTonelabSkin() {
  if (!window.customElements) return;
  for (const p of PREFIXES) {
    skin(`${p}webaudio-knob`, setupKnob, redrawKnob);
    skin(`${p}webaudio-switch`, setupSwitch, redrawSwitch);
  }
}
