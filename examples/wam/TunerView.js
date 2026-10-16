import {destroyPluginInstance} from './WamPluginRegistry.js';

// Analysis-only tap before chain A's effects. Nothing is inserted into the rack.
export class TunerView {
  constructor({context, registry, groupId, input, button}) {
    Object.assign(this, {context, registry, groupId, input, button});
    this.serial = 0;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'host-tuner tl-modal';
    this.dialog.id = 'tunerDialog';
    this.dialog.setAttribute('aria-labelledby', 'tunerTitle');
    this.dialog.innerHTML = '<header class="tl-modal-header"><div><p class="tl-eyebrow">Input A · before effects</p><h2 class="tl-modal-title" id="tunerTitle">Tuner</h2></div><tl-icon-button icon="close" variant="ghost" aria-label="Close tuner"></tl-icon-button></header><div class="tl-modal-body"><p class="host-help">Use Enable live input to tune your instrument.</p><div class="tuner-mount" role="status"></div></div>';
    document.body.append(this.dialog);
    this.mount = this.dialog.querySelector('.tuner-mount');
    this.dialog.querySelector('tl-icon-button').onclick = () => this.close();
    this.dialog.addEventListener('cancel', event => {event.preventDefault(); this.close();});
    this.dialog.addEventListener('close', () => {if (!this.dialog.open && this.button.getAttribute('aria-expanded') === 'true') this.close();});
    button.setAttribute('aria-controls', this.dialog.id);
    button.setAttribute('aria-expanded', 'false');
    button.disabled = !registry.records.some(record => record.role === 'tuner');
    if (button.disabled) button.title = 'Tuner is unavailable in the plugin catalogue';
    button.onclick = () => this.open();
    document.addEventListener('keydown', event => this.shortcut(event));
  }

  // T toggles the tuner, except while typing (composedPath reaches inputs inside plugin GUIs)
  // or when another dialog is open.
  shortcut(event) {
    if (event.key.toLowerCase() !== 't' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    const target = event.composedPath()[0];
    if (target?.closest?.('input, select, textarea, [contenteditable=""], [contenteditable="true"]')) return;
    if (this.dialog.open) { event.preventDefault(); this.close(); return; }
    if (this.button.disabled || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    this.open();
  }

  release(resources) {
    if (!resources) return;
    const {plugin, gui, sink} = resources;
    gui?.stopMeasuringPitch?.();
    try {this.input.disconnect(plugin.audioNode);} catch { /* Already disconnected. */ }
    sink?.disconnect();
    destroyPluginInstance(plugin, gui);
  }

  async open() {
    if (this.dialog.open) return;
    const serial = ++this.serial;
    this.dialog.showModal(); // Mount the canvas GUI only after the dialog is visible.
    this.button.setAttribute('aria-expanded', 'true');
    this.mount.textContent = 'Loading tuner…';
    let resources = {};
    try {
      await this.context.resume();
      if (serial !== this.serial) return;
      const record = this.registry.records.find(item => item.role === 'tuner');
      if (!record) throw new Error('Tuner is unavailable in the plugin catalogue');
      resources.plugin = await this.registry.instantiate(record, {groupId:this.groupId, audioContext:this.context});
      if (serial !== this.serial) return;
      resources.gui = await resources.plugin.createGui();
      if (serial !== this.serial) return;
      if (!resources.gui) throw new Error('The tuner has no GUI');
      resources.sink = this.context.createGain();
      resources.sink.gain.value = 0;
      this.input.connect(resources.plugin.audioNode);
      resources.plugin.audioNode.connect(resources.sink).connect(this.context.destination);
      this.mount.replaceChildren(resources.gui);
      // The bundled tuner starts OFF. Activate its existing switch after layout.
      const power = resources.gui.shadowRoot?.querySelector('#switch1');
      if (power && !resources.plugin.audioNode.getParamValue('enabled')) {
        power.value = 1;
        power.dispatchEvent(new Event('change'));
      }
      this.resources = resources;
      resources = null;
    } catch (error) {
      if (serial === this.serial) this.mount.textContent = `Cannot open tuner: ${error.message}. Close and try again.`;
    } finally {
      this.release(resources);
    }
  }

  close() {
    ++this.serial;
    this.release(this.resources);
    this.resources = null;
    this.mount.replaceChildren();
    if (this.dialog.open) this.dialog.close();
    this.button.setAttribute('aria-expanded', 'false');
    this.button.focus();
  }
}
