// Left navigation column: Play, Studio, Audio devices, and the
// entries stacked at the bottom. It is the Workspaces control (value + 'change'),
// so Play/Studio keep their internal values ('tone', 'projects').
// Studio opens Studio and fires 'home' (Studio always starts on its project
// list); Audio devices fires 'devices'.
// Collapsing keeps an icon rail (titles stay as tooltips). UI-only preference,
// remembered in this browser; never touches audio, presets or projects.
const KEY = 'nam-a2.host-nav';
const WORKSPACE_ITEMS = {tone: 'tone', projects: 'projects'};

export class HostNav extends EventTarget {
  constructor({nav, toggle, root = document.body, storage = globalThis.localStorage}) {
    super();
    Object.assign(this, {nav, toggle, root, storage});
    this.items = [...nav.querySelectorAll('[data-nav]')];
    this.current = 'tone';
    this.locked = false;
    this.collapsed = false;
    try { this.collapsed = storage?.getItem(KEY) === 'collapsed'; } catch { /* Storage can be unavailable in privacy modes. */ }
    this.click = (event) => {
      const item = event.target.closest?.('[data-nav]');
      if (item && !item.disabled) this.activate(item.dataset.nav);
    };
    this.flip = () => this.setCollapsed(!this.collapsed);
    nav.addEventListener('click', this.click);
    toggle?.addEventListener('click', this.flip);
    this.render();
  }

  get value() { return this.current; }
  set value(name) { this.current = name; this.render(); }
  get disabled() { return this.locked; }
  set disabled(value) { this.locked = Boolean(value); this.render(); }

  activate(target) {
    const workspace = WORKSPACE_ITEMS[target];
    if (workspace) {
      if (this.locked) return;
      if (workspace !== this.current) { this.current = workspace; this.render(); this.dispatchEvent(new Event('change')); }
      if (workspace === 'projects') this.dispatchEvent(new Event('home'));
      return;
    }
    this.dispatchEvent(new Event(target));
  }

  setCollapsed(value) {
    this.collapsed = Boolean(value);
    try { this.storage?.setItem(KEY, this.collapsed ? 'collapsed' : 'expanded'); } catch { /* Not remembered. */ }
    this.render();
  }

  render() {
    this.root.dataset.hostNav = this.collapsed ? 'collapsed' : 'expanded';
    for (const item of this.items) {
      const workspace = WORKSPACE_ITEMS[item.dataset.nav];
      if (!workspace) continue;
      item.disabled = this.locked;
      if (workspace === this.current) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
    if (!this.toggle) return;
    const label = this.collapsed ? 'Expand navigation' : 'Collapse navigation';
    this.toggle.setAttribute('aria-expanded', String(!this.collapsed));
    this.toggle.setAttribute('aria-label', label);
    this.toggle.title = label;
  }

  destroy() {
    this.nav.removeEventListener('click', this.click);
    this.toggle?.removeEventListener('click', this.flip);
    delete this.root.dataset.hostNav;
  }
}
