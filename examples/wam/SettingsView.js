import {createModal, modalActions, modalButton} from './ui/modal.js';

// Application settings (topbar gear), as in the TONELAB mockup: a modal with a
// section nav on the left (Audio, General, Account). Owners register their
// section: main.js adds Audio and General, account/AccountPanel.js Account.
// section: {id, label, icon, order, render(container)} or, for markup whose ids
// and handlers must survive (main.js binds them once), {…, element}: the
// element moves into the dialog while shown, then back to its hidden home.
export class SettingsView {
  constructor({button, home = document.getElementById('settingsPanels')}) {
    this.button = button;
    this.home = home;
    this.sections = [];
    this.current = null;
    this.dialog = null;
    button.disabled = true;
    button.setAttribute('aria-haspopup', 'dialog');
    button.onclick = () => this.open();
  }

  addSection(section) {
    this.sections = [...this.sections.filter((existing) => existing.id !== section.id), section]
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    this.button.disabled = false;
  }

  get openSection() { return this.dialog ? this.current : null; }

  open(id = this.current) {
    const section = this.sections.find((candidate) => candidate.id === id) || this.sections[0];
    if (!section) return;
    if (!this.dialog) this.create();
    this.show(section.id);
  }

  close() { this.dialog?.close(); }

  create() {
    const {dialog, body} = createModal({title: 'Settings', eyebrow: 'NAM A2 rack', className: 'host-settings', wide: true});
    this.dialog = dialog;
    this.button.setAttribute('aria-expanded', 'true');
    dialog.addEventListener('close', () => {
      this.park();
      this.dialog = null;
      this.button.setAttribute('aria-expanded', 'false');
      this.button.focus();
    }, {once: true});
    const layout = Object.assign(document.createElement('div'), {className: 'settings-layout'});
    this.nav = document.createElement('nav');
    this.nav.setAttribute('aria-label', 'Settings sections');
    this.content = Object.assign(document.createElement('section'), {className: 'settings-content'});
    this.content.setAttribute('aria-live', 'polite');
    layout.append(this.nav, this.content);
    const done = modalButton('Done', {variant: 'primary'});
    done.onclick = () => dialog.close();
    body.append(layout, modalActions(done));
    dialog.showModal();
  }

  show(id) {
    this.current = id;
    this.nav.replaceChildren(...this.sections.map((section) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'settings-nav-item';
      if (section.id === id) item.setAttribute('aria-current', 'page');
      const icon = document.createElement('tl-icon');
      icon.setAttribute('name', section.icon);
      icon.setAttribute('size', '16');
      item.append(icon, section.label);
      item.onclick = () => this.show(section.id);
      return item;
    }));
    this.refresh(id);
  }

  // Re-renders a section if it is the one on screen (e.g. after sign-in/out).
  refresh(id = this.current) {
    if (!this.dialog || id !== this.current) return;
    const section = this.sections.find((candidate) => candidate.id === id);
    this.park();
    this.content.replaceChildren();
    if (section?.element) { section.element.hidden = false; this.content.append(section.element); }
    else section?.render(this.content);
  }

  // Persistent section elements go back to their hidden home.
  park() {
    for (const section of this.sections) if (section.element && section.element.parentElement !== this.home) this.home?.append(section.element);
  }
}
