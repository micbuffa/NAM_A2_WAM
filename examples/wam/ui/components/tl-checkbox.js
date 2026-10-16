import {define, shadow} from '../define.js';

// <label><tl-checkbox variant="switch"><input id="loop" type="checkbox"></tl-checkbox> Loop</label>
// Skins a native checkbox kept in the light DOM, like tl-select: app code keeps its id, .checked,
// onchange, disabled and the surrounding <label>. Default look is a lime check box;
// variant="switch" draws it as a small tl-switch-style toggle.
const check = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='%2310150d' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
const styles = `
  :host { display: inline-flex; flex: none; vertical-align: middle; }
  ::slotted(input) { appearance: none !important; -webkit-appearance: none !important; display: block !important; flex: none; width: 16px !important;
    height: 16px !important; margin: 0 !important; border: 1px solid var(--tl-border-strong) !important; border-radius: 4px !important;
    background: var(--tl-surface-2) center / 14px no-repeat !important; cursor: pointer; transition: background-color .15s, border-color .15s; }
  ::slotted(input:hover) { border-color: var(--tl-border-hover) !important; }
  ::slotted(input:checked) { border-color: var(--tl-accent) !important; background-color: var(--tl-accent) !important; background-image: ${check} !important; }
  ::slotted(input:focus-visible) { outline: none !important; box-shadow: var(--tl-focus-ring) !important; }
  ::slotted(input:disabled) { opacity: .35; cursor: not-allowed; }

  :host([variant="switch"]) ::slotted(input) { width: 30px !important; height: 17px !important; border-radius: var(--tl-radius-pill) !important;
    background: radial-gradient(circle, var(--tl-text-muted) 0 4.5px, transparent 5px) 0 50% / 15px 15px no-repeat, var(--tl-surface-6) !important;
    transition: background-position .2s, background-color .2s, border-color .2s; }
  :host([variant="switch"]) ::slotted(input:checked) { border-color: var(--tl-accent) !important;
    background: radial-gradient(circle, var(--tl-on-accent) 0 4.5px, transparent 5px) 100% 50% / 15px 15px no-repeat, var(--tl-accent) !important; }
  @media (prefers-reduced-motion: reduce) { ::slotted(input) { transition: none; } }
`;

export class TlCheckbox extends HTMLElement {
  constructor() { super(); shadow(this, styles, '<slot></slot>'); }
}
define('tl-checkbox', TlCheckbox);
