import {CaptureWriter} from './CaptureWriter.js';
const moduleId = 'studio-di-recorder';
const {WamProcessor} = globalThis.webAudioModules.getModuleScope(moduleId);
class CaptureProcessor extends WamProcessor {
  async _onMessage(message) {
    const data = message.data;
    if (data.type === 'capture-start') {
      this.sessionId = data.sessionId;
      this.writer = new CaptureWriter(data);
      this.port.postMessage({type: 'capture-ready', sessionId: this.sessionId});
    } else if (data.type === 'capture-stop' && data.sessionId === this.sessionId) {
      this.writer.stop();
      this.port.postMessage({type: 'capture-stopped', sessionId: this.sessionId, frames: this.writer.frames});
    } else return super._onMessage(message);
  }
  // This capture-only WAM has no parameters/events: use actual quantum lengths.
  process(inputs, outputs) {
    if (this._destroyed) return false;
    const length = outputs[0]?.[0]?.length ?? inputs[0]?.[0]?.length ?? 0;
    this.writer?.process(inputs[0]?.[0], currentFrame, length);
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor(moduleId, CaptureProcessor);
