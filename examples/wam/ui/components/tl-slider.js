import {define, shadow} from '../define.js';

// <tl-slider bipolar><input id="pan" type="range" min="-1" max="1" step=".01" value="0" aria-label="Pan"></tl-slider>
// Horizontal fader around a native range input kept in the light DOM, like tl-knob: app code keeps its
// id, .value, min/max/step, oninput/onchange, disabled, aria-* and keyboard behaviour. The slider draws
// the track and handles pointer drag (shift = fine). `bipolar` fills from the centre (pan, balance).
const styles = `
  :host { position: relative; display: block; min-width: 60px; height: 18px; touch-action: none; user-select: none; cursor: pointer; }
  :host([data-disabled]) { opacity: .35; cursor: not-allowed; }
  [part="track"] { position: absolute; left: 0; right: 0; top: calc(50% - 2px); height: 4px; border-radius: var(--tl-radius-pill);
    background: var(--tl-surface-6); box-shadow: inset 0 0 0 1px var(--tl-border); }
  [part="fill"] { position: absolute; top: 0; bottom: 0; border-radius: inherit; background: var(--tl-accent); }
  [part="thumb"] { position: absolute; top: calc(50% - 7px); width: 14px; height: 14px; margin-left: -7px; border-radius: 50%;
    background: var(--tl-text); border: 2px solid var(--tl-surface-1); box-shadow: 0 0 0 1px var(--tl-border-strong), 0 1px 3px #0008; }
  :host(:focus-within) [part="thumb"] { box-shadow: var(--tl-focus-ring); }
  :host(:hover:not([data-disabled])) [part="thumb"] { background: var(--tl-accent-hover); }
  ::slotted(input) { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important;
    opacity: 0 !important; pointer-events: none !important; }
`;
const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

export class TlSlider extends HTMLElement {
  constructor() {
    super();
    shadow(this, styles, '<div part="track"><span part="fill"></span></div><span part="thumb"></span><slot></slot>');
    this.addEventListener('input', () => this.render());
    this.addEventListener('change', () => this.render());
    this.addEventListener('pointerdown', e => this.drag(e));
    this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this.connectInput());
  }
  connectedCallback() { this.connectInput(); }
  connectInput() {
    const input = this.querySelector(':scope > input[type="range"]');
    if (!input || input === this.input) return this.render();
    this.input = input;
    // `input.disabled = …` reflects to the attribute; mirror it on the host for styling.
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.render());
    this.observer.observe(input, {attributes: true, attributeFilter: ['disabled', 'min', 'max']});
    const slider = this;  // programmatic `input.value = x` (no event) must still move the thumb
    Object.defineProperty(input, 'value', {configurable: true, get() { return valueDescriptor.get.call(this); }, set(v) { valueDescriptor.set.call(this, v); slider.render(); }});
    this.render();
  }
  range() { return {min: Number(this.input?.min || 0), max: Number(this.input?.max || 100)}; }
  ratio(value = Number(this.input?.value ?? 0)) { const {min, max} = this.range(); return max > min ? (value - min) / (max - min) : 0; }
  render() {
    if (!this.input) return;
    this.toggleAttribute('data-disabled', this.input.disabled);
    const r = this.ratio(), from = this.hasAttribute('bipolar') ? .5 : 0, fill = this.shadowRoot.querySelector('[part="fill"]');
    fill.style.left = `${Math.min(r, from) * 100}%`;
    fill.style.width = `${Math.abs(r - from) * 100}%`;
    // Thumb travels inside the track so it never overhangs the host box.
    this.shadowRoot.querySelector('[part="thumb"]').style.left = `calc(7px + (100% - 14px) * ${r})`;
  }
  drag(event) {
    if (!this.input || this.input.disabled || event.button > 0) return;
    event.preventDefault();
    this.input.focus({preventScroll: true});
    this.setPointerCapture(event.pointerId);
    const {min, max} = this.range();
    let moved = false, last = event.clientX, value = Number(this.input.value);
    const set = v => {
      const before = this.input.value;
      this.input.value = Math.min(max, Math.max(min, v));
      if (this.input.value !== before) { moved = true; this.input.dispatchEvent(new Event('input', {bubbles: true})); }
    };
    const at = x => { const box = this.getBoundingClientRect(); return min + (max - min) * Math.min(1, Math.max(0, (x - box.left - 7) / Math.max(1, box.width - 14))); };
    set(value = at(event.clientX));
    const move = e => {
      // Shift: fine relative motion (10× slower) from the current value instead of jumping to the pointer.
      value = e.shiftKey ? value + (at(e.clientX) - at(last)) / 10 : at(e.clientX);
      last = e.clientX;
      set(value);
    };
    const up = () => {
      this.removeEventListener('pointermove', move); this.removeEventListener('pointerup', up); this.removeEventListener('pointercancel', up);
      if (moved) this.input.dispatchEvent(new Event('change', {bubbles: true}));
    };
    this.addEventListener('pointermove', move); this.addEventListener('pointerup', up); this.addEventListener('pointercancel', up);
  }
}
define('tl-slider', TlSlider);
