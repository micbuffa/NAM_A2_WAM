import {define, shadow, Pressable} from '../define.js';
import './tl-icon.js';

// <tl-button variant="primary|secondary|ghost|danger" size="sm" icon="save" dot block>Save</tl-button>
// The label is the light-DOM text, so app code can keep doing `button.textContent = '…'`.
// aria-pressed="true" renders the active (latched) state.
const styles = `
  :host { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: var(--tl-space-2);
    height: 38px; padding: 0 14px; border: 1px solid var(--tl-border); border-radius: var(--tl-radius-md);
    background: var(--tl-surface-3); color: var(--tl-text-2); font-size: var(--tl-fs-control); font-weight: 600; line-height: 1;
    white-space: nowrap; cursor: pointer; user-select: none; outline: none; transition: background .15s, border-color .15s, color .15s; }
  :host(:hover) { border-color: var(--tl-border-hover); color: var(--tl-text); }
  :host(:focus-visible) { box-shadow: var(--tl-focus-ring); }
  :host([disabled]) { opacity: .35; cursor: not-allowed; pointer-events: none; }
  :host([block]) { display: flex; width: 100%; }
  :host([size="sm"]) { height: 30px; padding: 0 10px; border-radius: var(--tl-radius-sm); font-size: var(--tl-fs-xs); }
  :host([variant="primary"]) { border-color: var(--tl-accent); background: var(--tl-accent); color: var(--tl-on-accent); box-shadow: var(--tl-glow-accent); }
  :host([variant="primary"]:hover) { background: var(--tl-accent-hover); border-color: var(--tl-accent-hover); }
  :host([variant="ghost"]) { border-color: transparent; background: none; color: var(--tl-text-muted); }
  :host([variant="ghost"]:hover) { color: var(--tl-accent); }
  :host([variant="danger"]) { color: var(--tl-danger); }
  :host([variant="danger"]:hover) { border-color: var(--tl-danger); background: var(--tl-danger-tint); }
  :host([aria-pressed="true"]), :host([aria-expanded="true"]) { border-color: var(--tl-accent-border); background: var(--tl-accent-tint); color: var(--tl-accent); }
  /* A latched primary (e.g. live input on) keeps the latched look on hover, not accent-on-accent. */
  :host([variant="primary"][aria-pressed="true"]), :host([variant="primary"][aria-pressed="true"]:hover) { box-shadow: none;
    border-color: var(--tl-accent-border); background: var(--tl-accent-tint-strong); color: var(--tl-accent); }
  [part="dot"] { display: none; position: absolute; top: 4px; right: 4px; width: 5px; height: 5px; border-radius: 50%; background: var(--tl-warning); }
  :host([dot]) [part="dot"] { display: block; }
  tl-icon:not([name]), tl-icon[name=""] { display: none; }
`;

export class TlButton extends Pressable {
  static observedAttributes = [...Pressable.observedAttributes, 'icon'];
  constructor() { super(); shadow(this, styles, '<tl-icon part="icon"></tl-icon><slot></slot><i part="dot"></i>'); }
  attributeChangedCallback(name, old, value) {
    super.attributeChangedCallback(name);
    if (name === 'icon') { const icon = this.shadowRoot.querySelector('tl-icon'); value ? icon.setAttribute('name', value) : icon.removeAttribute('name'); icon.setAttribute('size', this.getAttribute('size') === 'sm' ? 15 : 17); }
  }
}
define('tl-button', TlButton);
