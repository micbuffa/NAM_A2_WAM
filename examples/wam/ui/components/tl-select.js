import {define, shadow} from '../define.js';
import './tl-icon.js';

// <tl-select size="sm" icon="device"><select id="inputDevice">…</select></tl-select>
// Skins a native <select> kept in the light DOM, so app code keeps .options, .value,
// replaceChildren(new Option(…)), onchange and disabled. Wrap it in a <label> for its name.
const styles = `
  :host { position: relative; display: inline-flex; align-items: center; min-width: 0; width: 100%; color: var(--tl-text-1); }
  ::slotted(select) { appearance: none !important; -webkit-appearance: none !important; width: 100% !important; min-width: 0 !important;
    height: 38px !important; min-height: 0 !important; margin: 0 !important; padding: 0 32px 0 12px !important;
    border: 1px solid var(--tl-border) !important; border-radius: var(--tl-radius-md) !important; background: var(--tl-surface-2) !important;
    color: inherit !important; font: 500 var(--tl-fs-sm) var(--tl-font-ui) !important; text-overflow: ellipsis; cursor: pointer;
    outline: none !important; transition: border-color .15s; }
  :host([icon]) ::slotted(select) { padding-left: 34px !important; }
  :host([size="sm"]) ::slotted(select) { height: 30px !important; border-radius: var(--tl-radius-sm) !important; font-size: var(--tl-fs-xs) !important; }
  :host(:hover) ::slotted(select) { border-color: var(--tl-border-hover) !important; }
  ::slotted(select:focus-visible) { box-shadow: var(--tl-focus-ring) !important; }
  ::slotted(select:disabled) { opacity: .45; cursor: not-allowed; }
  tl-icon { position: absolute; pointer-events: none; color: var(--tl-text-muted); }
  [part="chevron"] { right: 10px; }
  [part="icon"] { left: 11px; }
  :host(:not([icon])) [part="icon"] { display: none; }
`;
// The !important flags let the skin win over legacy page rules (`button, select {…}`) while they still exist.

export class TlSelect extends HTMLElement {
  static observedAttributes = ['icon'];
  constructor() { super(); shadow(this, styles, '<tl-icon part="icon" size="15"></tl-icon><slot></slot><tl-icon part="chevron" name="chevron" size="16"></tl-icon>'); }
  attributeChangedCallback() { this.shadowRoot.querySelector('[part="icon"]').setAttribute('name', this.getAttribute('icon') || ''); }
}
define('tl-select', TlSelect);
