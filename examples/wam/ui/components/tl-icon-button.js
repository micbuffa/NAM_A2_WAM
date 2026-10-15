import {define, shadow, Pressable} from '../define.js';
import './tl-icon.js';

// <tl-icon-button icon="settings" aria-label="Settings"> — square, icon-only. aria-label is required.
const styles = `
  :host { display: inline-grid; place-items: center; flex: none; width: 36px; height: 36px;
    border: 1px solid var(--tl-border); border-radius: var(--tl-radius-md); background: var(--tl-surface-3); color: var(--tl-text-2);
    cursor: pointer; outline: none; transition: background .15s, border-color .15s, color .15s; }
  :host(:hover) { border-color: var(--tl-border-hover); background: var(--tl-surface-5); color: var(--tl-text); }
  :host(:focus-visible) { box-shadow: var(--tl-focus-ring); }
  :host([disabled]) { opacity: .35; cursor: not-allowed; pointer-events: none; }
  :host([size="sm"]) { width: 28px; height: 28px; border-radius: var(--tl-radius-sm); }
  :host([variant="ghost"]) { border-color: transparent; background: none; }
  :host([variant="danger"]:hover) { border-color: var(--tl-danger); background: var(--tl-danger-tint); color: var(--tl-danger); }
  :host([aria-pressed="true"]), :host([aria-expanded="true"]) { border-color: var(--tl-accent-border); background: var(--tl-accent-tint); color: var(--tl-accent); }
`;

export class TlIconButton extends Pressable {
  static observedAttributes = [...Pressable.observedAttributes, 'icon', 'size'];
  constructor() { super(); shadow(this, styles, '<tl-icon part="icon"></tl-icon>'); }
  attributeChangedCallback(name) {
    super.attributeChangedCallback(name);
    const icon = this.shadowRoot.querySelector('tl-icon');
    icon.setAttribute('name', this.getAttribute('icon') || '');
    icon.setAttribute('size', this.getAttribute('size') === 'sm' ? 15 : 18);
  }
}
define('tl-icon-button', TlIconButton);
