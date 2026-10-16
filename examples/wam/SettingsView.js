import {createModal, modalActions, modalButton} from './ui/modal.js';

// Application settings (topbar gear), as in the TONELAB mockup: a modal with a
// section nav on the left. Owners register their section and render it on
// demand: account/AccountPanel.js adds "Account".
// section: {id, label, icon, render(container)}
export class SettingsView {
  constructor({button}) {
    this.button = button;
    this.sections = [];
    this.current = null;
    this.dialog = null;
    button.disabled = true;
    button.setAttribute('aria-haspopup', 'dialog');
    button.onclick = () => this.open();
  }

  addSection(section) {
    this.sections = [...this.sections.filter((existing) => existing.id !== section.id), section];
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
    this.content.replaceChildren();
    section?.render(this.content);
  }
}
