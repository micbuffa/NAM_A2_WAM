import {define, shadow, Pressable} from '../define.js';

// <tl-switch checked name="audio" aria-label="Audio">Audio on</tl-switch>
// variant="led" is the small module on/off toggle with a glowing lime knob.
// Toggling fires `input` then `change` (bubbling, composed) like a native checkbox; form-associated.
const styles = `
  :host { display: inline-flex; align-items: center; gap: var(--tl-space-2); color: var(--tl-text-2); font-size: var(--tl-fs-sm);
    cursor: pointer; user-select: none; outline: none; }
  :host([disabled]) { opacity: .35; cursor: not-allowed; pointer-events: none; }
  [part="track"] { position: relative; flex: none; width: 38px; height: 21px; border: 1px solid var(--tl-border-strong);
    border-radius: var(--tl-radius-pill); background: var(--tl-surface-6); transition: background .2s, border-color .2s; }
  [part="thumb"] { position: absolute; top: 3px; left: 3px; width: 13px; height: 13px; border-radius: 50%; background: var(--tl-text-muted);
    transition: transform .2s, background .2s, box-shadow .2s; }
  :host([aria-checked="true"]) [part="track"] { border-color: var(--tl-accent); background: var(--tl-accent); }
  :host([aria-checked="true"]) [part="thumb"] { transform: translateX(17px); background: var(--tl-on-accent); }
  :host(:focus-visible) [part="track"] { box-shadow: var(--tl-focus-ring); }

  :host([variant="led"]) [part="track"] { width: 28px; height: 16px; background: var(--tl-surface-6); border-color: var(--tl-border-strong); }
  :host([variant="led"]) [part="thumb"] { width: 8px; height: 8px; }
  :host([variant="led"][aria-checked="true"]) [part="track"] { background: var(--tl-accent-tint-strong); border-color: var(--tl-accent-border); }
  :host([variant="led"][aria-checked="true"]) [part="thumb"] { transform: translateX(12px); background: var(--tl-accent); box-shadow: 0 0 5px var(--tl-accent); }
  slot:not(.filled) { display: none; }
`;

export class TlSwitch extends Pressable {
  static role = 'switch';
  static formAssociated = true;
  static observedAttributes = [...Pressable.observedAttributes, 'checked'];
  #internals = this.attachInternals();
  constructor() {
    super();
    shadow(this, styles, '<span part="track"><span part="thumb"></span></span><slot></slot>');
    const slot = this.shadowRoot.querySelector('slot');
    slot.addEventListener('slotchange', () => slot.classList.toggle('filled', slot.assignedNodes().some(n => n.textContent.trim())));
    this.addEventListener('click', () => {
      this.checked = !this.checked;
      this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
      this.dispatchEvent(new Event('change', {bubbles: true}));
    });
  }
  connectedCallback() { super.connectedCallback(); this.sync(); }
  attributeChangedCallback(name) { super.attributeChangedCallback(name); if (name === 'checked') this.sync(); }
  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { this.toggleAttribute('checked', !!v); }
  get value() { return this.getAttribute('value') ?? 'on'; }
  get name() { return this.getAttribute('name'); }
  get form() { return this.#internals.form; }
  sync() { this.setAttribute('aria-checked', String(this.checked)); this.#internals.setFormValue(this.checked ? this.value : null); }
}
define('tl-switch', TlSwitch);
