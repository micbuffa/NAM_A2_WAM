import {define, shadow} from '../define.js';

// <tl-segmented value="1" aria-label="Chains"><option value="1">1 chain</option><option value="2">2 chains</option></tl-segmented>
// Light-DOM <option>s describe the segments; the segments themselves live in the shadow root.
// role=radiogroup, arrow keys move the selection; picking a segment fires `input` and `change`.
const styles = `
  :host { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--tl-border); border-radius: var(--tl-radius-md);
    background: var(--tl-surface-sunken); }
  :host([disabled]) { opacity: .45; pointer-events: none; }
  button { height: 31px; padding: 0 14px; border: 0; border-radius: var(--tl-radius-sm); background: none; color: var(--tl-text-muted);
    font: 600 var(--tl-fs-sm) var(--tl-font-ui); white-space: nowrap; cursor: pointer; outline: none; transition: background .15s, color .15s; }
  button:hover { color: var(--tl-text); }
  button[aria-checked="true"] { background: var(--tl-surface-6); color: var(--tl-text); box-shadow: inset 0 1px rgba(255, 255, 255, .04); }
  button:focus-visible { box-shadow: var(--tl-focus-ring); }
  :host([size="sm"]) button { height: 24px; padding: 0 10px; font-size: var(--tl-fs-xs); }
`;

export class TlSegmented extends HTMLElement {
  static observedAttributes = ['value', 'disabled'];
  constructor() {
    super();
    shadow(this, styles);
    this.shadowRoot.addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.pick(b.value); });
    this.shadowRoot.addEventListener('keydown', e => {
      const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key]; if (!step) return;
      e.preventDefault();
      const values = this.options().map(o => o.value), next = values[(values.indexOf(this.value) + step + values.length) % values.length];
      this.pick(next); this.shadowRoot.querySelector(`button[value="${CSS.escape(next)}"]`)?.focus();
    });
    new MutationObserver(() => this.build()).observe(this, {childList: true, subtree: true, characterData: true});
  }
  connectedCallback() { this.setAttribute('role', 'radiogroup'); this.build(); }
  attributeChangedCallback() { this.sync(); }
  options() { return [...this.querySelectorAll(':scope > option')]; }
  get value() { return this.getAttribute('value') ?? this.options()[0]?.value ?? ''; }
  set value(v) { this.setAttribute('value', String(v)); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { this.toggleAttribute('disabled', !!v); }
  pick(value) {
    if (this.disabled || value === this.value) return;
    this.value = value;
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.dispatchEvent(new Event('change', {bubbles: true}));
  }
  build() {
    this.shadowRoot.replaceChildren(...this.options().map(o => {
      const b = Object.assign(document.createElement('button'), {type: 'button', value: o.value, textContent: o.textContent});
      b.setAttribute('role', 'radio'); return b;
    }));
    this.sync();
  }
  sync() {
    for (const b of this.shadowRoot.querySelectorAll('button')) {
      const on = b.value === this.value;
      b.setAttribute('aria-checked', String(on)); b.tabIndex = on && !this.disabled ? 0 : -1; b.disabled = this.disabled;
    }
  }
}
define('tl-segmented', TlSegmented);
