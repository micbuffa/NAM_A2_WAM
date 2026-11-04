// The rack dock (preset header + chains) at the bottom of the screen, shared by
// Play and Studio: collapsing it keeps only its header. UI-only preference,
// remembered in this browser; never touches audio, presets or projects.
// Expanded, it is as tall as its header and first chain (--rack-dock-fit):
// a second chain is reached by scrolling.
const KEY = 'nam-a2.rack-dock';

export class RackDock {
  constructor({button, dock = null, root = document.body, storage = globalThis.localStorage}) {
    Object.assign(this, {button, dock, root, storage});
    this.collapsed = false;
    try { this.collapsed = storage?.getItem(KEY) === 'collapsed'; } catch { /* Storage can be unavailable in privacy modes. */ }
    this.toggle = () => this.setCollapsed(!this.collapsed);
    button.addEventListener('click', this.toggle);
    if (dock && globalThis.ResizeObserver) {
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(dock);
      for (const part of dock.querySelectorAll('.rack-header, .fx-rack, #fxChain')) this.observer.observe(part);
    }
    this.render();
  }

  // Height of the header plus chain A's row (its effects and its input/output
  // strips; chain B sits below them in the same .fx-rack), with the paddings.
  fit() {
    const rack = this.dock.querySelector('.fx-rack');
    const row = rack ? [rack.querySelector('#fxChain'), ...rack.querySelectorAll('.fx-endpoints > .fx-endpoint-cell:first-child')].filter((part) => part?.offsetParent) : [];
    if (!row.length) { this.dock.style.removeProperty('--rack-dock-fit'); return; }
    const top = this.dock.getBoundingClientRect().top - this.dock.scrollTop;
    const bottom = Math.max(...row.map((part) => part.getBoundingClientRect().bottom));
    const pad = (element) => parseFloat(getComputedStyle(element).paddingBottom) || 0;
    this.dock.style.setProperty('--rack-dock-fit', `${Math.ceil(bottom - top + pad(rack) + pad(rack.parentElement))}px`);
  }

  setCollapsed(value) {
    this.collapsed = Boolean(value);
    try { this.storage?.setItem(KEY, this.collapsed ? 'collapsed' : 'expanded'); } catch { /* Not remembered. */ }
    this.render();
  }

  render() {
    const label = this.collapsed ? 'Expand the rack' : 'Collapse the rack';
    this.root.dataset.rackDock = this.collapsed ? 'collapsed' : 'expanded';
    this.button.setAttribute('aria-expanded', String(!this.collapsed));
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
  }

  destroy() {
    this.observer?.disconnect();
    this.button.removeEventListener('click', this.toggle);
    delete this.root.dataset.rackDock;
  }
}
