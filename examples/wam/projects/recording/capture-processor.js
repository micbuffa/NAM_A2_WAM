import {CaptureWriter} from './CaptureWriter.js';
const moduleId = 'studio-di-recorder';
const {WamProcessor} = globalThis.webAudioModules.getModuleScope(moduleId);
class CaptureProcessor extends WamProcessor {
  async _onMessage(message) {
    const data = message.data;
    if (data.type === 'capture-start') {
      this.sessionId = data.sessionId;this.sentStop=false;
      this.writer = new CaptureWriter(data);
      this.port.postMessage({type: 'capture-ready', sessionId: this.sessionId});
    } else if (data.type === 'capture-stop' && data.sessionId === this.sessionId) {
      // Flush the latency tail after a manual range Stop. Punch auto-stop
      // already includes this tail and must never extend its exact B boundary.
      const tail=Math.max(0,Number.isSafeInteger(data.tailFrames)?data.tailFrames:0);
      if(tail&&!this.writer.stopped)this.writer.stopAfterFrames=Math.min(this.writer.stopAfterFrames??Infinity,this.writer.frames+tail);
      else this.writer.stop();
      if(this.writer.stopped)this.notifyStopped();
    } else return super._onMessage(message);
  }
  notifyStopped(){if(!this.sentStop){this.sentStop=true;this.port.postMessage({type:'capture-stopped',sessionId:this.sessionId,frames:this.writer.frames});}}
  // This capture-only WAM has no parameters/events: use actual quantum lengths.
  process(inputs, outputs) {
    if (this._destroyed) return false;
    const length = outputs[0]?.[0]?.length ?? inputs[0]?.[0]?.length ?? 0;
    this.writer?.process(inputs[0]?.[0], currentFrame, length);
    if(this.writer?.stopped)this.notifyStopped();
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor(moduleId, CaptureProcessor);
