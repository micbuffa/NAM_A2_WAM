import {destroyPluginInstance} from './WamPluginRegistry.js';

// Analysis-only tap before chain A's effects. Nothing is inserted into the rack.
export class TunerView {
  constructor({context, registry, groupId, input, button}) {
    Object.assign(this, {context, registry, groupId, input, button});
    this.serial = 0;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'host-tuner';
    this.dialog.id = 'tunerDialog';
    this.dialog.setAttribute('aria-labelledby', 'tunerTitle');
    this.dialog.innerHTML = '<header><strong id="tunerTitle">Tuner</strong><button type="button" aria-label="Close tuner">×</button></header><p class="host-help">Input A · before effects. Use Enable live input to tune your instrument.</p><div class="tuner-mount" role="status"></div>';
    document.body.append(this.dialog);
    this.mount = this.dialog.querySelector('.tuner-mount');
    this.dialog.querySelector('button').onclick = () => this.close();
    this.dialog.addEventListener('cancel', event => {event.preventDefault(); this.close();});
    this.dialog.addEventListener('close', () => {if (!this.dialog.open && this.button.getAttribute('aria-expanded') === 'true') this.close();});
    button.setAttribute('aria-controls', this.dialog.id);
    button.setAttribute('aria-expanded', 'false');
    button.disabled = !registry.records.some(record => record.role === 'tuner');
    if (button.disabled) button.title = 'Tuner is unavailable in the plugin catalogue';
    button.onclick = () => this.open();
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
