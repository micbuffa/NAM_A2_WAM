export default class OutputDeviceManager {
  constructor({audioContext, mediaDevices = navigator.mediaDevices}) {
    this.audioContext = audioContext;
    this.mediaDevices = mediaDevices;
    this.selectedDeviceId = '';
    // Some browsers return only the default output (or omit labels) until an
    // explicit selectAudioOutput() permission gesture has completed. Keep
    // authorized devices so a subsequent refresh cannot make the selection
    // disappear merely because enumerateDevices() returned a reduced list.
    this.authorizedOutputs = new Map();
    this._selection = Promise.resolve();
  }

  get supported() { return typeof this.audioContext.setSinkId === 'function'; }
  get authorizationSupported() { return typeof this.mediaDevices?.selectAudioOutput === 'function'; }

  async enumerateOutputs({includeAuthorized = true} = {}) {
    const devices = await this.mediaDevices?.enumerateDevices?.() || [];
    for (const device of devices) {
      if (device.kind === 'audiooutput' && device.deviceId) this.authorizedOutputs.set(device.deviceId, device);
    }
    const outputs = devices.filter((device) => device.kind === 'audiooutput' && device.deviceId);
    if (!includeAuthorized) {
      this.authorizedOutputs.clear();
      return outputs;
    }
    const byId = new Map(outputs.map((device) => [device.deviceId, device]));
    for (const [id, device] of this.authorizedOutputs) if (!byId.has(id)) byId.set(id, device);
    return [...byId.values()];
  }

  async select(deviceId = '') {
    if (!this.supported) {
      this.selectedDeviceId = '';
      return false;
    }
    const operation = this._selection.catch(() => {}).then(async () => {
      await this.audioContext.setSinkId(deviceId);
      this.selectedDeviceId = deviceId;
      return true;
    });
    this._selection = operation;
    return operation;
  }

  async recover() {
    if (this.audioContext.state === 'closed') throw new Error('The browser closed the audio engine. Reload the page to restart audio.');
    if (this.supported) await this.select('');
    if (this.audioContext.state !== 'running') await this.audioContext.resume();
    if (this.audioContext.state !== 'running') throw new Error('Audio is interrupted. Reconnect an output and click Recover audio.');
  }

  async authorize() {
    if (!this.authorizationSupported) return null;
    const device = await this.mediaDevices.selectAudioOutput();
    if (device?.deviceId) {
      this.authorizedOutputs.set(device.deviceId, device);
      await this.select(device.deviceId);
    }
    return device || null;
  }

  async refresh(options = {}) {
    const outputs = await this.enumerateOutputs(options);
    if (this.selectedDeviceId && !outputs.some((device) => device.deviceId === this.selectedDeviceId)) await this.select('');
    return outputs;
  }
}
