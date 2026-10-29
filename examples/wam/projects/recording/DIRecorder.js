import {RingBuffer} from '../../source-separation/vendor/ringbuf/index.js';
import {MAX_TAKE_BYTES} from './TakePCM.js';
const moduleId = 'studio-di-recorder';
const modules = new WeakMap();
export class DIRecorder extends EventTarget {
  constructor({context, groupId, workerFactory = () => new Worker(new URL('./capture-worker.js', import.meta.url), {type: 'module'})}) {
    super(); Object.assign(this, {context, groupId, workerFactory});
  }
  static supported() { return globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined'; }
  async prepare(metadata) {
    if (!DIRecorder.supported()) throw Error('Recording requires cross-origin isolation (COOP/COEP) and SharedArrayBuffer.');
    const {default: WamNode} = await import('../../../../third_party/wam-examples/packages/sdk/src/WamNode.js');
    if (!modules.has(this.context)) modules.set(this.context, (async () => {
      await WamNode.addModules(this.context, moduleId);
      await this.context.audioWorklet.addModule(new URL('./capture-processor.js', import.meta.url));
    })().catch(error => { modules.delete(this.context); throw error; }));
    await modules.get(this.context);
    this.sessionId = crypto.randomUUID(); this.metadata = metadata;
    this.storage = RingBuffer.getStorageForCapacity(this.context.sampleRate * 2, Float32Array);
    this.control = new SharedArrayBuffer(12);
    this.node = new WamNode({audioContext: this.context, groupId: this.groupId, moduleId, instanceId: `${moduleId}-${this.sessionId}`},
      {numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit', processorOptions: {useSab: false}});
    await this.node._initialize();
    this.node.onprocessorerror = () => this.fail(Error('Recording audio processor failed.'));
    this.node.connect(this.context.destination); // processor output is always silence
    this.worker = this.workerFactory();
    this.worker.onerror = event => this.fail(Error(event.message || 'Recording worker failed.'));
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Recording worker did not start.')), 10000);
      this.worker.onmessage = ({data}) => {
        if (data.sessionId !== this.sessionId) return;
        if (data.type === 'ready') { clearTimeout(timeout); resolve(); }
        else if (data.type === 'progress') this.dispatchEvent(new CustomEvent('progress', {detail: data}));
        else if (data.type === 'complete') { clearTimeout(this.stopTimeout); this.finish?.resolve(data); }
        else if (data.type === 'error') { clearTimeout(timeout); const error = Error(data.error); reject(error); this.fail(error); }
      };
      this.worker.postMessage({type: 'init', sessionId: this.sessionId, metadata, storage: this.storage, control: this.control});
    });
    this.listener = ({data}) => {
      if (data.sessionId === this.sessionId && data.type === 'capture-stopped') this.worker.postMessage({type: 'finish', sessionId: this.sessionId, frames: data.frames});
    };
    this.node.port.addEventListener('message', this.listener);
  }
  start(input, startFrame) {
    this.input = input; input.connect(this.node);
    const padding = Math.max(0, this.metadata.startProjectFrame - this.metadata.compensationFrames);
    this.node.port.postMessage({type: 'capture-start', sessionId: this.sessionId, startFrame, storage: this.storage, control: this.control,
      maxFrames: Math.floor((MAX_TAKE_BYTES - 44) / 4) - padding});
  }
  stop() {
    if (this.finish) return this.finish.promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    this.finish = {promise, resolve, reject};
    this.stopTimeout = setTimeout(() => this.fail(Error('Recording stop acknowledgement timed out.')), 10000);
    this.node.port.postMessage({type: 'capture-stop', sessionId: this.sessionId});
    return promise;
  }
  fail(error) { this.finish?.reject(error); this.dispatchEvent(new CustomEvent('error', {detail: error})); }
  destroy() {
    clearTimeout(this.stopTimeout);
    if (this.input && this.node) try { this.input.disconnect(this.node); } catch { /* input already removed */ }
    this.worker?.terminate(); this.node?.destroy();
  }
}
