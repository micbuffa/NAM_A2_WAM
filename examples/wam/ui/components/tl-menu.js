import {define, shadow} from '../define.js';
import './tl-icon-button.js';

// <tl-menu label="More actions"><button>Item</button>…</tl-menu> — a ⋯ button opening a
// small menu of rare actions. Items are the light-DOM children (plain <button>s), so app code
// keeps their ids, onclick, hidden, disabled and title. Choosing an item closes the menu. The
// menu hides itself when none of its items is visible.
// Item styles live in ui/components.css. The panel is a popover (top layer, light dismiss, Esc), placed under the button, right-aligned.
const styles = `
  :host { display: inline-flex; position: relative; }
  :host([empty]) { display: none; }
  [part="menu"] { margin: 0; inset: auto; position: fixed; min-width: 190px; padding: 4px;
    border: 1px solid var(--tl-border); border-radius: var(--tl-radius-md); background: var(--tl-surface-2);
    color: var(--tl-text-2); box-shadow: var(--tl-shadow-panel); }
  [part="menu"]:popover-open { display: flex; flex-direction: column; gap: 1px; }
  /* Items are light-DOM <button>s: styled in ui/components.css (tl-menu > button), above page button rules. */
`;

export class TlMenu extends HTMLElement {
  static observedAttributes = ['label', 'size', 'disabled'];
  constructor() {
    super();
    const root = shadow(this, styles, '<tl-icon-button part="trigger" icon="more" aria-haspopup="menu" aria-expanded="false"></tl-icon-button><div part="menu" popover role="menu"><slot></slot></div>');
    this.trigger = root.querySelector('[part="trigger"]');
    this.menu = root.querySelector('[part="menu"]');
    // Light dismiss closes the menu on a press outside it, the button included: a press on the
    // button while open only closes it, instead of reopening it right away.
    let wasOpen = false;
    this.trigger.addEventListener('pointerdown', () => { wasOpen = this.open; });
    this.trigger.addEventListener('click', () => {
      if (wasOpen || this.open) { wasOpen = false; this.close(); return; }
      this.show({focus: false});
    });
    this.trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); this.show(); }
    });
    this.menu.addEventListener('toggle', (event) => {
      const open = event.newState === 'open';
      this.trigger.setAttribute('aria-expanded', String(open));
      if (!open && this.contains(document.activeElement)) this.trigger.focus();
    });
    this.menu.addEventListener('keydown', (event) => this.navigate(event));
    this.addEventListener('click', (event) => { if (event.target.closest?.('tl-menu > *')?.parentElement === this) this.close(); });
    this.observer = new MutationObserver(() => this.sync());
    window.addEventListener('resize', () => this.close());
  }
  connectedCallback() {
    this.observer.observe(this, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled']});
    this.sync();
  }
  disconnectedCallback() { this.observer.disconnect(); }
  attributeChangedCallback() { this.sync(); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) { this.toggleAttribute('disabled', Boolean(value)); }
  get open() { return this.menu.matches(':popover-open'); }
  get items() { return [...this.children]; }
  get available() { return this.items.filter((item) => !item.hidden && !item.disabled); }

  sync() {
    this.trigger.setAttribute('aria-label', this.getAttribute('label') || 'More actions');
    this.trigger.title = this.getAttribute('label') || 'More actions';
    this.trigger.setAttribute('size', this.getAttribute('size') || '');
    this.trigger.toggleAttribute('disabled', this.hasAttribute('disabled'));
    if (this.hasAttribute('disabled')) this.close();
    for (const item of this.items) item.setAttribute('role', 'menuitem');
    const empty = this.items.every((item) => item.hidden);
    this.toggleAttribute('empty', empty);
    if (empty && this.open) this.close();
  }

  show({focus = true} = {}) {
    if (this.hasAttribute('disabled') || !this.available.length) return;
    this.menu.showPopover();
    const anchor = this.trigger.getBoundingClientRect(), box = this.menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.right - box.width, innerWidth - box.width - 8));
    const below = anchor.bottom + 4, above = anchor.top - box.height - 4;
    this.menu.style.left = `${left}px`;
    this.menu.style.top = `${below + box.height > innerHeight - 8 && above > 8 ? above : below}px`;
    if (focus) this.available[0]?.focus();
  }

  close() { if (this.open) this.menu.hidePopover(); }

  navigate(event) {
    const items = this.available, index = items.indexOf(document.activeElement);
    const go = (next) => { event.preventDefault(); items[(next + items.length) % items.length]?.focus(); };
    if (event.key === 'ArrowDown') go(index + 1);
    else if (event.key === 'ArrowUp') go(index < 0 ? -1 : index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(-1);
    else if (event.key === 'Tab') this.close();
  }
}
define('tl-menu', TlMenu);
