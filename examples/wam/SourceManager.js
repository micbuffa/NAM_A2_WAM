export const MUSIC_CAPTURE_CONSTRAINTS = Object.freeze({
  channelCount: Object.freeze({ideal: 2}),
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
    this.sourceTrim.channelCount = 1;
    this.sourceTrim.channelCountMode = 'explicit';
    this.sourceTrim.channelInterpretation = 'discrete';
    this.sourceTrim.connect(wamNode);
    this.trimDb = {...DEFAULT_SOURCE_TRIM_DB};
    this.liveNode = null;
    this.liveSplitter = null;
    this.liveStream = null;
    this.liveInput = null;
    this._liveRequestId = 0;
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

  async disconnectCurrent({keepLiveRequest = false} = {}) {
    if (!keepLiveRequest) ++this._liveRequestId;
    if (this.liveNode) {
      this.liveNode.disconnect();
      this.liveNode = null;
    }
    if (this.liveSplitter) {
      this.liveSplitter.disconnect();
      this.liveSplitter = null;
    }
    if (this.liveStream) {
      this.liveStream.getTracks().forEach((track) => track.stop());
      this.liveStream = null;
    }
    this.liveInput = null;
    this.player.pause();
    try { this.mediaElementNode.disconnect(); } catch (error) { /* not connected */ }
    this.mode = null;
  }

  async activateLive(deviceId, channelIndex = 0) {
    const requestId = ++this._liveRequestId;
    await this.disconnectCurrent({keepLiveRequest: true});
    const audio = {...MUSIC_CAPTURE_CONSTRAINTS};
    if (deviceId) audio.deviceId = {exact: deviceId};
    const stream = await this.mediaDevices.getUserMedia({audio});
    if (requestId !== this._liveRequestId) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    const track = stream.getAudioTracks?.()[0] || stream.getTracks()[0];
    const settings = track?.getSettings?.() || {};
    const actualDeviceId = settings.deviceId || '';
    if (deviceId && deviceId !== 'default' && actualDeviceId && actualDeviceId !== deviceId) {
      stream.getTracks().forEach((entry) => entry.stop());
      throw new Error(`Browser opened a different audio input (requested ${deviceId}, received ${actualDeviceId})`);
    }
    const channelCount = Math.max(1, Number(settings.channelCount) || 1);
    const selectedChannel = Math.max(0, Math.min(channelCount - 1, Math.trunc(Number(channelIndex) || 0)));
    const node = this.audioContext.createMediaStreamSource(stream);
    let splitter = null;
    if (typeof this.audioContext.createChannelSplitter === 'function') {
      splitter = this.audioContext.createChannelSplitter(channelCount);
      node.connect(splitter);
      splitter.connect(this.sourceTrim, selectedChannel, 0);
    } else node.connect(this.sourceTrim);
    this.liveStream = stream;
    this.liveNode = node;
    this.liveSplitter = splitter;
    this.liveInput = {requestedDeviceId: deviceId || '', deviceId: actualDeviceId || deviceId || '', label: track?.label || '', channelCount, channelIndex:selectedChannel};
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
