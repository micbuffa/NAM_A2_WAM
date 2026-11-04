// Audio devices popup, opened from the navigation column (HostNav 'devices').
// The dialog is static markup in index.html, so main.js keeps driving its
// controls (#inputDevice, #outputDevice, #recoverAudio...) by id.
// The nav entry gets an alert dot when audio needs recovering or no input
// device is listed.
export class AudioDevicesDialog {
  constructor({dialog, nav, item = null, recover = null, input = null, Observer = globalThis.MutationObserver}) {
    Object.assign(this, {dialog, item, recover, input});
    this.open = () => { if (!dialog.open) dialog.showModal(); };
    nav.addEventListener('devices', this.open);
    const close = dialog.querySelector('[data-close]');
    if (close) close.onclick = () => dialog.close('cancel');
    if (Observer && item) {
      const observer = new Observer(() => this.render());
      if (recover) observer.observe(recover, {attributes: true, attributeFilter: ['hidden']});
      if (input) observer.observe(input, {childList: true});
    }
    this.render();
  }

  get alert() {
    if (this.recover && !this.recover.hidden) return 'Audio needs recovering';
    if (this.input && !this.input.options?.length) return 'No audio input device';
    return '';
  }

  render() {
    if (!this.item) return;
    const alert = this.alert;
    if (alert) this.item.dataset.alert = '';
    else delete this.item.dataset.alert;
    this.item.title = alert ? `Audio devices: ${alert.toLowerCase()}` : 'Audio devices';
  }
}
