import {define, shadow} from '../define.js';
import {icons} from '../icons.js';

// <tl-icon name="save" size="18"> — decorative stroke icon, colored by currentColor.
export class TlIcon extends HTMLElement {
  static observedAttributes = ['name', 'size'];
  constructor() { super(); shadow(this, `:host { display: inline-flex; flex: none; line-height: 0; } svg { width: 100%; height: 100%; }`); }
  connectedCallback() { this.setAttribute('aria-hidden', 'true'); this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const size = `${parseFloat(this.getAttribute('size')) || 18}px`;
    this.style.width = this.style.height = size;
    this.shadowRoot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[this.getAttribute('name')] || ''}</svg>`;
  }
}
define('tl-icon', TlIcon);
