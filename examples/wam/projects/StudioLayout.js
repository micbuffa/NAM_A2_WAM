// UI-only preference: never modifies projects, audio routing or transport.
const KEY = 'nam-a2.studio-sidebar';
export class StudioLayout {
  constructor({workspaces, button, sidebar, root = document.body, storage = globalThis.localStorage}) {
    Object.assign(this, {workspaces, button, sidebar, root, storage});
    this.collapsed = false;
    try { this.collapsed = storage?.getItem(KEY) === 'collapsed'; } catch { /* Session-only preference. */ }
    this.toggle = () => this.setCollapsed(!this.collapsed);
    this.workspaceChanged = () => this.render();
    button.addEventListener('click', this.toggle);
    workspaces.addEventListener('change', this.workspaceChanged);
    this.render();
  }
  setCollapsed(value) {
    // If a keyboard action closes a panel containing focus, return it to the toggle.
    if (value && this.sidebar.contains?.(this.root.ownerDocument?.activeElement)) this.button.focus();
    this.collapsed = Boolean(value);
    try { this.storage?.setItem(KEY, this.collapsed ? 'collapsed' : 'expanded'); } catch { /* Keep usable without storage. */ }
    this.render();
  }
  render() {
    const hidden = this.workspaces.current === 'projects' && this.collapsed;
    this.root.dataset.studioSidebar = this.collapsed ? 'collapsed' : 'expanded';
    this.sidebar.inert = hidden;
    this.button.setAttribute('aria-expanded', String(!this.collapsed));
    this.button.setAttribute('aria-label', this.collapsed ? 'Show sidebar' : 'Hide sidebar');
    this.button.title = this.collapsed ? 'Show sidebar' : 'Hide sidebar';
  }
  destroy() {
    this.button.removeEventListener('click', this.toggle);
    this.workspaces.removeEventListener('change', this.workspaceChanged);
    this.sidebar.inert = false;
    delete this.root.dataset.studioSidebar;
  }
}
