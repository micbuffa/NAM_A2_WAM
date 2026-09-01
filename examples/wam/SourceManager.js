export const MUSIC_CAPTURE_CONSTRAINTS = Object.freeze({
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
});
export const DEFAULT_SOURCE_TRIM_DB = Object.freeze({file: -18, live: 0});
export const dbToLinear = (db) => 10 ** (db / 20);

export default class SourceManager {
  constructor({audioContext, wamNode, mediaDevices = navigator.mediaDevices, player}) {
    this.audioContext = audioContext;
    this.wamNode = wamNode;
    this.mediaDevices = mediaDevices;
    this.player = player;
    this.mediaElementNode = audioContext.createMediaElementSource(player);
    this.sourceTrim = audioContext.createGain();
    this.sourceTrim.connect(wamNode);
    this.trimDb = {...DEFAULT_SOURCE_TRIM_DB};
    this.liveNode = null;
    this.liveStream = null;
    this.mode = null;
  }

  get activeTrimDb() { return this.mode ? this.trimDb[this.mode] : DEFAULT_SOURCE_TRIM_DB.file; }

  setTrimDb(db, mode = this.mode || 'file') {
    const value = Math.max(-48, Math.min(12, Number(db)));
    this.trimDb[mode] = value;
    if (this.mode === mode || !this.mode) this.sourceTrim.gain.setValueAtTime(dbToLinear(value), this.audioContext.currentTime);
    return value;
  }

  _activateTrim(mode) {
    this.mode = mode;
    this.sourceTrim.gain.setValueAtTime(dbToLinear(this.trimDb[mode]), this.audioContext.currentTime);
  }

  async enumerateInputs({requestPermission = false} = {}) {
    let permissionStream = null;
    if (requestPermission) {
      permissionStream = await this.mediaDevices.getUserMedia({audio: MUSIC_CAPTURE_CONSTRAINTS});
      permissionStream.getTracks().forEach((track) => track.stop());
    }
    const devices = await this.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audioinput');
  }

  async disconnectCurrent() {
    if (this.liveNode) {
      this.liveNode.disconnect();
      this.liveNode = null;
    }
    if (this.liveStream) {
      this.liveStream.getTracks().forEach((track) => track.stop());
      this.liveStream = null;
    }
    this.player.pause();
    try { this.mediaElementNode.disconnect(); } catch (error) { /* not connected */ }
    this.mode = null;
  }

  async activateLive(deviceId) {
    await this.disconnectCurrent();
    const audio = {...MUSIC_CAPTURE_CONSTRAINTS};
    if (deviceId) audio.deviceId = {exact: deviceId};
    const stream = await this.mediaDevices.getUserMedia({audio});
    const node = this.audioContext.createMediaStreamSource(stream);
    node.connect(this.sourceTrim);
    this.liveStream = stream;
    this.liveNode = node;
    this._activateTrim('live');
    return stream;
  }

  async activateFile(url) {
    await this.disconnectCurrent();
    this.player.src = url;
    this.player.load();
    this.mediaElementNode.connect(this.sourceTrim);
    this._activateTrim('file');
  }

  async destroy() { await this.disconnectCurrent(); }
}
