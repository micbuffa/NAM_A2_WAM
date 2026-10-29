import {LatencyCapture} from './LatencyCapture.js';
class LatencyProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();this.capture=new LatencyCapture(options.processorOptions,data=>this.port.postMessage(data,data.samples?[data.samples.buffer]:[]));
    this.armed=false;
    this.port.onmessage=({data})=>{if(data.type==='start'){try{this.capture.arm(data.startFrame);this.armed=true;}catch(error){this.port.postMessage({type:'error',message:error.message});}}};
    this.port.postMessage({type:'ready'});
  }
  process(inputs,outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    if(this.armed)this.capture.process(inputs[0]?.[0],currentFrame,outputs[0]?.[0]?.length ?? inputs[0]?.[0]?.length ?? 128);
    return !this.capture.done;
  }
}
registerProcessor('studio-latency-capture',LatencyProcessor);
