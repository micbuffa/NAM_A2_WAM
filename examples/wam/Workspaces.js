// Tone / Projects workspaces (topbar switch), as in the TONELAB mockup.
// Switching only changes what is shown (body[data-workspace] + CSS): the rack
// and the open project keep playing (the Play along pauses outside Tone). The choice is remembered in this browser.
export const WORKSPACES = ['tone', 'projects'];
const STORAGE_KEY = 'nam-a2-wam.workspace';
const RENAMED = {tracks: 'projects'}; // remembered before the Tracks tab became Projects

export class Workspaces extends EventTarget {
  constructor({control, root = document.body, storage = globalThis.localStorage}) {
    super();
    Object.assign(this, {control, root, storage});
    control.addEventListener('change', () => this.show(control.value));
    let saved = null;
    try { saved = storage?.getItem(STORAGE_KEY); } catch { /* Storage can be unavailable in privacy modes. */ }
    saved = RENAMED[saved] ?? saved;
    this.show(WORKSPACES.includes(saved) ? saved : 'tone', {remember: false});
  }

  get current() { return this.root.dataset.workspace; }

  show(name, {remember = true} = {}) {
    if (!WORKSPACES.includes(name)) return;
    this.root.dataset.workspace = name;
    if (this.control.value !== name) this.control.value = name;
    if (remember) try { this.storage?.setItem(STORAGE_KEY, name); } catch { /* Not remembered. */ }
    this.dispatchEvent(new CustomEvent('change', {detail: {workspace: name}}));
  }
}
