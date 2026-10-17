import {define, shadow} from '../define.js';

// <tl-meter id="chainOutputMeter" role="meter" aria-label="Output level dBFS" orientation="vertical"></tl-meter>
// Purely CSS-driven: the level is the `--meter-level` custom property (0…1) set on the element,
// which is how the rack's animation loop already drives meters; `value="0.6"` sets it declaratively.
// Class `is-clipping` lights the clip LED. `channels="2"` draws an L/R pair (both bars read the same level
// unless `--meter-level-r` is set).
const styles = `
  :host { --meter-level: 0; display: inline-flex; gap: 3px; width: 120px; height: 8px; }
  :host([orientation="vertical"]) { flex-direction: row; width: 12px; height: 73px; }
  :host([channels="2"][orientation="vertical"]) { width: 23px; }
  .bar { position: relative; flex: 1; overflow: hidden; border: 1px solid var(--tl-border); border-radius: 2px; background: var(--tl-surface-sunken);
    box-shadow: inset 0 0 3px #000; }
  .fill { position: absolute; inset: 0; background: linear-gradient(90deg, var(--tl-meter-ok) 0 77%, var(--tl-meter-warn) 77% 92%, var(--tl-meter-clip) 92%);
    clip-path: inset(0 calc((1 - var(--level)) * 100%) 0 0); transition: clip-path 60ms linear; }
  :host([orientation="vertical"]) .fill { background: linear-gradient(0deg, var(--tl-meter-ok) 0 77%, var(--tl-meter-warn) 77% 92%, var(--tl-meter-clip) 92%);
    clip-path: inset(calc((1 - var(--level)) * 100%) 0 0 0); }
  .fill::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 4px, var(--tl-surface-sunken) 4px 5px); }
  :host([orientation="vertical"]) .fill::after { background: repeating-linear-gradient(0deg, transparent 0 4px, var(--tl-surface-sunken) 4px 6px); }
  .l { --level: var(--meter-level); }
  .r { --level: var(--meter-level-r, var(--meter-level)); }
  :host(:not([channels="2"])) .r { display: none; }
  :host(.is-clipping) .bar { border-color: var(--tl-meter-clip); box-shadow: 0 0 5px var(--tl-meter-clip); }
`;

export class TlMeter extends HTMLElement {
  static observedAttributes = ['value'];
  constructor() { super(); shadow(this, styles, '<span class="bar l" part="bar"><span class="fill"></span></span><span class="bar r" part="bar"><span class="fill"></span></span>'); }
  connectedCallback() { if (!this.hasAttribute('role')) this.setAttribute('role', 'meter'); }
  attributeChangedCallback(_, __, value) { this.style.setProperty('--meter-level', String(Math.min(1, Math.max(0, Number(value) || 0)))); }
}
define('tl-meter', TlMeter);
