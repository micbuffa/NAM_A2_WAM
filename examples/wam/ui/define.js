// Shared plumbing for tl-* components: idempotent registration, cached constructable
// stylesheets and the shadow-root setup every component uses.
export const define = (tag, cls) => { if (!customElements.get(tag)) customElements.define(tag, cls); return cls; };

const sheets = new Map();
export const css = text => { let s = sheets.get(text); if (!s) { s = new CSSStyleSheet(); s.replaceSync(text); sheets.set(text, s); } return s; };

// Applied to every shadow root: `hidden` must win over :host display, and tokens drive the type.
export const baseStyles = css(`
  :host { box-sizing: border-box; font-family: var(--tl-font-ui); }
  :host([hidden]) { display: none !important; }
  *, *::before, *::after { box-sizing: inherit; }
`);

export const shadow = (host, styles, html = '') => {
  const root = host.attachShadow({mode: 'open'});
  root.adoptedStyleSheets = [baseStyles, css(styles)];
  root.innerHTML = html;
  return root;
};

// Host-is-the-control base: role, tabindex, keyboard activation and `disabled`, all on the
// host element, so ids, aria-* and title set by app code (main.js, views) keep working.
export class Pressable extends HTMLElement {
  static role = 'button';
  static observedAttributes = ['disabled'];
  constructor() {
    super();
    this.addEventListener('click', e => { if (this.disabled) { e.preventDefault(); e.stopImmediatePropagation(); } }, {capture: true});
    this.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === this) { e.preventDefault(); if (!e.repeat) this.click(); } });
  }
  connectedCallback() { if (!this.hasAttribute('role')) this.setAttribute('role', this.constructor.role); this.syncDisabled(); }
  attributeChangedCallback(name) { if (name === 'disabled') this.syncDisabled(); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { this.toggleAttribute('disabled', !!v); }
  syncDisabled() {
    if (this.disabled) { this.setAttribute('aria-disabled', 'true'); this.removeAttribute('tabindex'); if (this.matches(':focus')) this.blur(); }
    else { this.removeAttribute('aria-disabled'); if (!this.hasAttribute('tabindex')) this.tabIndex = 0; }
  }
}
