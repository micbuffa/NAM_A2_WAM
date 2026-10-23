import {define, shadow} from '../define.js';
import {ValuePopup, popupHtml, popupStyles, popupText} from '../value-popup.js';

// <tl-knob label="Gain" size="sm"><input id="x" type="range" min="-48" max="12" step=".5" value="0"><output slot="value">0.0 dB</output></tl-knob>
// Wraps a native range input kept in the light DOM: app code keeps its id, .value, min/max/step,
// oninput/onchange, aria-* and keyboard behaviour. The knob only draws it and adds vertical drag
// (shift = fine). dblclick is forwarded to the input so `input.ondblclick` resets keep working.
// Without a slotted value, the knob prints its own value with the `unit` attribute.
// `arc`: a light face with a dark pointer inside a dark ring, lit from the start of the range (from
// the centre when the range spans 0, e.g. pan) to the value; the value is not printed and the dial has no
// focus ring. `popup="Pan"`: "Pan: +63" under the dial while hovered, dragged or used from the keyboard
// (signed when the range spans 0, else with `unit`; see value-popup.js).
const styles = popupStyles + `
  :host { display: inline-flex; flex-direction: column; align-items: center; gap: 5px; color: var(--tl-text-muted);
    font-size: var(--tl-fs-xs); user-select: none; touch-action: none; }
  [part="dial"] { position: relative; width: 45px; height: 45px; border: 1px solid var(--tl-border-strong); border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #3a403d 0, #1b1f1d 52%, #0b0d0c 100%); box-shadow: var(--tl-shadow-knob); cursor: ns-resize; }
  :host([size="sm"]) [part="dial"] { width: 34px; height: 34px; }
  [part="indicator"] { position: absolute; left: calc(50% - 1px); top: 4px; width: 2px; height: 30%; border-radius: 1px;
    background: var(--tl-accent); box-shadow: 0 0 4px var(--tl-accent-glow); transform-origin: 1px calc(50cqh - 4px); }
  [part="dial"] { container-type: size; }
  :host(:focus-within) [part="dial"] { box-shadow: var(--tl-shadow-knob), var(--tl-focus-ring); }
  :host([disabled]) { opacity: .35; pointer-events: none; }
  ::slotted(input) { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important;
    opacity: 0 !important; pointer-events: none !important; }
  [part="label"] { font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
  [part="label"]:empty { display: none; }
  [part="arc"], [part="face"] { display: none; }
  :host([arc]) [part="dial"] { border: 0; background: none; box-shadow: none; }
  :host([arc]) [part="arc"] { position: absolute; inset: 0; display: block; overflow: visible; }
  [part="arc"] path { fill: none; stroke-width: 5; }
  [part="track"] { stroke: var(--tl-surface-sunken); }
  [part="level"] { stroke: var(--tl-accent); }
  :host([arc]) [part="face"] { position: absolute; inset: 16%; display: block; border-radius: 50%;
    background: radial-gradient(circle at 40% 32%, #c9cdca 0, #a3a8a5 55%, #7d827f 100%); box-shadow: 0 1px 3px #0009, inset 0 1px #fff6; }
  :host([arc]) [part="indicator"] { top: 18cqh; height: 20cqh; background: #141716; box-shadow: none; transform-origin: 1px 32cqh; }
  :host([arc]:focus-within) [part="dial"] { box-shadow: none; }
  :host([arc]) [part="value"], :host([arc]) ::slotted([slot="value"]) { display: none; }
  [part="value"], ::slotted([slot="value"]) { color: var(--tl-text-1); font: 500 var(--tl-fs-xs)/1.2 var(--tl-font-mono); font-variant-numeric: tabular-nums; }
`;
// An arc of the 40×40 ring between two angles (degrees clockwise from the top).
const arcPath = (a, b) => {
  const r = 17.5, at = deg => `${(20 + r * Math.sin(deg * Math.PI / 180)).toFixed(2)} ${(20 - r * Math.cos(deg * Math.PI / 180)).toFixed(2)}`;
  return `M ${at(a)} A ${r} ${r} 0 ${Math.abs(b - a) > 180 ? 1 : 0} ${b > a ? 1 : 0} ${at(b)}`;
};
const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

export class TlKnob extends HTMLElement {
  static observedAttributes = ['label', 'disabled'];
  constructor() {
    super();
    shadow(this, styles, `<div part="dial"><svg part="arc" viewBox="0 0 40 40" aria-hidden="true"><path part="track"/><path part="level"/></svg><span part="face"></span><span part="indicator"></span><slot></slot></div><span part="label"></span><slot name="value"><output part="value"></output></slot>${popupHtml}`);
    this.dial = this.shadowRoot.querySelector('[part="dial"]');
    this.popup = new ValuePopup(this, () => this.dial);
    this.addEventListener('input', () => this.render());
    this.addEventListener('change', () => this.render());
    this.addEventListener('dblclick', e => { if (e.target !== this.input) this.input?.dispatchEvent(new MouseEvent('dblclick', {bubbles: true})); });
    this.dial.addEventListener('pointerdown', e => this.drag(e));
    this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this.connectInput());
  }
  connectedCallback() { this.connectInput(); }
  disconnectedCallback() { this.popup.hide(); }
  attributeChangedCallback(name) {
    if (name === 'label') this.shadowRoot.querySelector('[part="label"]').textContent = this.getAttribute('label') || '';
    if (name === 'disabled' && this.input) this.input.disabled = this.hasAttribute('disabled');
  }
  connectInput() {
    const input = this.querySelector(':scope > input[type="range"]');
    if (!input || input === this.input) return this.render();
    this.input = input;
    const knob = this;  // programmatic `input.value = x` (no event) must still move the knob
    Object.defineProperty(input, 'value', {configurable: true, get() { return valueDescriptor.get.call(this); }, set(v) { valueDescriptor.set.call(this, v); knob.render(); }});
    this.render();
  }
  get value() { return Number(this.input?.value ?? 0); }
  set value(v) { if (this.input) this.input.value = v; }
  ratio() { const {min, max} = this.range(); return max > min ? (this.value - min) / (max - min) : 0; }
  range() { return {min: Number(this.input?.min || 0), max: Number(this.input?.max || 100)}; }
  render() {
    if (!this.input) return;
    const angle = -135 + this.ratio() * 270;
    this.shadowRoot.querySelector('[part="indicator"]').style.transform = `rotate(${angle}deg)`;
    if (this.hasAttribute('arc')) {
      const {min, max} = this.range(), from = min < 0 && max > 0 ? -135 - min / (max - min) * 270 : -135;
      this.shadowRoot.querySelector('[part="track"]').setAttribute('d', arcPath(-135, 135));
      this.shadowRoot.querySelector('[part="level"]').setAttribute('d', Math.abs(angle - from) < .5 ? '' : arcPath(from, angle));
    }
    const unit = this.getAttribute('unit');
    const {min, max} = this.range();
    this.popup.update(popupText(this.input, min < 0 && max > 0
      ? `${this.value > 0 ? '+' : this.value < 0 ? '−' : ''}${Math.abs(this.value)}` : `${this.value}${unit ? ` ${unit}` : ''}`));
    this.shadowRoot.querySelector('output[part="value"]').textContent = `${this.value}${unit ? ` ${unit}` : ''}`;
  }
  drag(event) {
    if (!this.input || this.input.disabled) return;
    event.preventDefault();
    this.input.focus({preventScroll: true});
    this.dial.setPointerCapture(event.pointerId);
    const {min, max} = this.range(), startY = event.clientY, start = this.value;
    let moved = false;
    this.popup.drag(true);
    const move = e => {
      const span = (max - min) * (startY - e.clientY) / (e.shiftKey ? 1000 : 200);
      const before = this.input.value;
      this.input.value = Math.min(max, Math.max(min, start + span));
      if (this.input.value !== before) { moved = true; this.input.dispatchEvent(new Event('input', {bubbles: true})); }
    };
    const up = () => {
      this.dial.removeEventListener('pointermove', move); this.dial.removeEventListener('pointerup', up); this.dial.removeEventListener('pointercancel', up);
      if (moved) this.input.dispatchEvent(new Event('change', {bubbles: true}));
      this.popup.drag(false);
    };
    this.dial.addEventListener('pointermove', move); this.dial.addEventListener('pointerup', up); this.dial.addEventListener('pointercancel', up);
  }
}
define('tl-knob', TlKnob);
