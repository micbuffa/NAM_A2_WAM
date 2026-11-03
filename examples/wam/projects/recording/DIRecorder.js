import {RingBuffer} from '../../source-separation/vendor/ringbuf/index.js';
import {MAX_TAKE_BYTES} from './TakePCM.js';
const moduleId = 'studio-di-recorder';
const modules = new WeakMap();
export class DIRecorder extends EventTarget {
  constructor({context, groupId, workerFactory = () => new Worker(new URL('./capture-worker.js', import.meta.url), {type: 'module'})}) {
    super(); Object.assign(this, {context, groupId, workerFactory});
  }
  static supported() { return globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined'; }
  async prepare(metadata, {baseAudio = null} = {}) {
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
        if (data.type === 'ready') { this.baseWave=data.baseWave; clearTimeout(timeout); resolve(); }
        else if (data.type === 'progress') this.dispatchEvent(new CustomEvent('progress', {detail: data}));
        else if(data.type==='selection'||data.type==='selection-error'){const request=this.requests?.get(data.requestId);this.requests?.delete(data.requestId);clearTimeout(request?.timeout);if(data.type==='selection')request?.resolve(data);else request?.reject(Error(data.error));}
        else if (data.type === 'complete') { clearTimeout(this.stopTimeout); this.finish?.resolve(data); }
        else if (data.type === 'error') { clearTimeout(timeout); const error = Error(data.error); reject(error); this.fail(error); }
      };
      this.worker.postMessage({type: 'init', sessionId: this.sessionId, metadata, baseAudio, storage: this.storage, control: this.control});
    });
    this.listener = ({data}) => {
      if (data.sessionId === this.sessionId && data.type === 'capture-stopped'){
        const automatic=!this.finish;this.ensureFinish();
        this.worker.postMessage({type:'finish',sessionId:this.sessionId,frames:data.frames});
        if(automatic)this.dispatchEvent(new Event('autostop'));
      }
    };
    this.node.port.addEventListener('message', this.listener);
  }
  start(input, startFrame) {
    this.input = input; input.connect(this.node);
    const padding = Math.max(0, this.metadata.startProjectFrame - this.metadata.compensationFrames);
    this.node.port.postMessage({type: 'capture-start', sessionId: this.sessionId, startFrame, storage: this.storage, control: this.control,
      stopAfterFrames:this.metadata.rangeRecording?.mode==='punch'?this.metadata.rangeRecording.endFrame-this.metadata.rangeRecording.transportStartFrame+this.metadata.compensationFrames:null,
      maxFrames: this.metadata.rangeRecording?Math.min(2147483000,this.context.sampleRate*3600):Math.floor((MAX_TAKE_BYTES - 44) / 4) - padding});
  }
  ensureFinish() {
    if (this.finish) return this.finish.promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    this.finish = {promise, resolve, reject};
    this.stopTimeout = setTimeout(() => this.fail(Error('Recording stop acknowledgement timed out.')), 10000);
    return promise;
  }
  stop(){
    const existing=Boolean(this.finish),promise=this.ensureFinish();
    if(!existing)this.node.port.postMessage({type:'capture-stop',sessionId:this.sessionId,tailFrames:this.metadata.rangeRecording?this.metadata.compensationFrames:0});return promise;
  }
  selectLoopTake(number){
    this.requests??=new Map();const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{this.requests.delete(requestId);reject(Error('Take preparation timed out.'));},10000);this.requests.set(requestId,{resolve,reject,timeout});this.worker.postMessage({type:'select',sessionId:this.sessionId,requestId,number});});
  }
  releaseInput(){if(this.input&&this.node)try{this.input.disconnect(this.node);}catch{}this.input=null;this.node?.destroy();this.node=null;}
  fail(error) { this.finish?.reject(error); this.dispatchEvent(new CustomEvent('error', {detail: error})); }
  destroy() {
    clearTimeout(this.stopTimeout);
    this.releaseInput();
    for(const request of this.requests?.values()??[]){clearTimeout(request.timeout);request.reject(Error('Take session closed.'));}this.requests?.clear();
    this.worker?.terminate();
  }
}
