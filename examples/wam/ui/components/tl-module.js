import {define, shadow} from '../define.js';
import './tl-icon-button.js';
import './tl-switch.js';

// <tl-module kicker="Amplifier" heading="JCM 800" icon="audio" active> body… </tl-module>
// Signal-chain module frame: titlebar (icon, kicker, heading, edit / remove / on-off) and a body slot.
// The titlebar controls fire bubbling `module-edit`, `module-remove` and `module-toggle` events;
// the host decides what they do. `active` reflects the on/off switch; without it the body is dimmed.
// `noedit` hides the edit button. Extra titlebar controls go in slot="actions".
const styles = `
  :host { display: flex; flex-direction: column; min-width: 0; overflow: hidden; color: var(--tl-text);
    border: 1px solid var(--tl-border-module, var(--tl-border)); border-radius: var(--tl-radius-lg); background: var(--tl-surface-1);
    box-shadow: var(--tl-shadow-module); transition: border-color .2s; }
  header { display: flex; align-items: center; gap: var(--tl-space-2); height: 50px; flex: none; padding: 0 8px 0 12px;
    border-bottom: 1px solid var(--tl-border); background: var(--tl-surface-4); }
  .icon { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: var(--tl-radius-sm);
    color: var(--tl-text-2); background: var(--tl-surface-6); }
  .icon:not(.filled) { display: none; }
  .titles { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  small { overflow: hidden; color: var(--tl-text-muted); font-size: var(--tl-fs-xs); letter-spacing: .08em; text-transform: uppercase;
    white-space: nowrap; text-overflow: ellipsis; }
  strong { overflow: hidden; margin-top: 2px; font-size: var(--tl-fs-sm); font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
  .actions { display: flex; align-items: center; gap: 2px; flex: none; }
  tl-icon-button { color: var(--tl-text-faint); }
  tl-icon-button.edit:hover { color: var(--tl-accent); background: var(--tl-accent-tint); }
  tl-icon-button.remove:hover { color: var(--tl-danger); background: var(--tl-danger-tint); }
  tl-switch { margin-left: 4px; }
  :host([noedit]) .edit { display: none; }
  .body { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; transition: opacity .2s, filter .2s; }
  :host(:not([active])) { --tl-border-module: var(--tl-border-subtle); }
  :host(:not([active])) .body { opacity: .38; filter: grayscale(.8); }
  :host(:not([active])) .icon { color: var(--tl-text-faint); background: var(--tl-surface-5); }
  :host(:not([active])) strong { color: var(--tl-text-muted); }
  @media (prefers-reduced-motion: reduce) { :host, .body { transition: none; } }
`;

const html = `
  <header part="titlebar">
    <span class="icon" part="icon"><tl-icon size="16"></tl-icon></span>
    <div class="titles"><small part="kicker"></small><strong part="heading"></strong></div>
    <div class="actions"><slot name="actions"></slot>
      <tl-icon-button class="edit" icon="edit" size="sm" variant="ghost"></tl-icon-button>
      <tl-icon-button class="remove" icon="trash" size="sm" variant="ghost"></tl-icon-button>
      <tl-switch variant="led"></tl-switch>
    </div>
  </header>
  <div class="body" part="body"><slot></slot></div>`;

export class TlModule extends HTMLElement {
  static observedAttributes = ['kicker', 'heading', 'icon', 'active'];
  constructor() {
    super();
    const root = shadow(this, styles, html);
    this.$ = {icon: root.querySelector('.icon'), kicker: root.querySelector('small'), heading: root.querySelector('strong'),
      edit: root.querySelector('.edit'), remove: root.querySelector('.remove'), toggle: root.querySelector('tl-switch')};
    const fire = type => () => this.dispatchEvent(new CustomEvent(type, {bubbles: true}));
    this.$.edit.addEventListener('click', fire('module-edit'));
    this.$.remove.addEventListener('click', fire('module-remove'));
    // The switch flips itself; mirror it on the host, then let the app confirm (or revert) via `active`.
    this.$.toggle.addEventListener('change', event => { event.stopPropagation(); this.active = this.$.toggle.checked; fire('module-toggle')(); });
    this.sync();
  }
  attributeChangedCallback() { this.sync(); }
  get active() { return this.hasAttribute('active'); }
  set active(v) { this.toggleAttribute('active', !!v); }
  sync() {
    if (!this.$) return;
    const name = this.getAttribute('heading') || '', icon = this.getAttribute('icon');
    this.$.kicker.textContent = this.getAttribute('kicker') || '';
    this.$.heading.textContent = name;
    this.$.heading.title = name;
    this.$.icon.classList.toggle('filled', !!icon);
    this.$.icon.firstElementChild.setAttribute('name', icon || '');
    this.$.toggle.checked = this.active;
    this.$.edit.setAttribute('aria-label', `Edit ${name}`);
    this.$.remove.setAttribute('aria-label', `Remove ${name}`);
    this.$.toggle.setAttribute('aria-label', `${name} on`);
    this.$.edit.title = 'Open editor';
    this.$.remove.title = 'Remove module';
    this.$.toggle.title = this.active ? 'Active — click to bypass' : 'Bypassed — click to activate';
  }
}
define('tl-module', TlModule);
