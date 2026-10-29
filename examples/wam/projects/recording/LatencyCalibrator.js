import {makeLatencyProbe, PROBE_COUNT, MAX_DELAY_SECONDS} from './LatencyAnalysis.js';
const modules=new WeakMap();
export class LatencyCalibrator extends EventTarget {
  constructor({context,source,output=context.destination,workerFactory=()=>new Worker(new URL('./latency-worker.js',import.meta.url),{type:'module'}),createNode=options=>new AudioWorkletNode(context,'studio-latency-capture',options)}) {
    super();Object.assign(this,{context,source,output,workerFactory,createNode});
  }
  cancel(message='Calibration cancelled.') {
    if (!this.active) return;
    this.active.cancelled=Error(message);this.active.reject?.(this.active.cancelled);
  }
  async run(outputChannel=0,{mode='cable',levelDb=-18}={}) {
    if (this.active) throw Error('Calibration is already running.');
    if (!this.context.audioWorklet || ![0,1].includes(outputChannel)) throw Error('AudioWorklet and a stereo output are required for calibration.');
    const state=this.active={sources:[]},context=this.context;
    const check=()=>{if(state.cancelled)throw state.cancelled;};
    const interrupted=()=>this.cancel('Audio input/output changed or disconnected. Calibration cancelled.');
    const stateChanged=()=>{if(context.state!=='running')interrupted();};
    try {
      await context.resume();check();
      if (!modules.has(context)) modules.set(context,context.audioWorklet.addModule(new URL('./latency-processor.js',import.meta.url)).catch(error=>{modules.delete(context);throw error;}));
      await modules.get(context);check();
      state.tap=this.source.createDITap();
      this.source.addEventListener('change',interrupted); context.addEventListener('sinkchange',interrupted);context.addEventListener('statechange',stateChanged);
      state.track=this.source.liveStream?.getAudioTracks()[0];state.track?.addEventListener('ended',interrupted);
      const sampleRate=context.sampleRate,probe=makeLatencyProbe(sampleRate,{mode,levelDb}),pulseOffset=Math.round(.1*sampleRate),maxDelayFrames=Math.round(MAX_DELAY_SECONDS*sampleRate);
      const windowFrames=pulseOffset+probe.length+maxDelayFrames+Math.round(.02*sampleRate),intervalFrames=windowFrames+Math.round(.1*sampleRate);
      const settings={sampleRate,pulseOffset,maxDelayFrames,count:PROBE_COUNT,mode};
      state.worker=this.workerFactory();
      state.timeout=setTimeout(()=>this.cancel('Calibration timed out. Check the audio engine and retry.'),15000);
      await new Promise((resolve,reject)=>{
        state.reject=error=>{reject(error);};
        state.worker.onerror=event=>state.reject(Error(event.message||'Calibration worker failed.'));
        state.worker.onmessage=({data})=>{
          if (this.active!==state || state.cancelled) return;
          if(data.type==='ready')resolve();
          else if(data.type==='progress')this.dispatchEvent(new CustomEvent('progress',{detail:data}));
          else if(data.type==='complete')state.resolve(data.result);
          else if(data.type==='error')state.reject(Error(data.message));
        };
        state.worker.postMessage({type:'init',probe,settings});
      });
      check();
      // Once ready, errors/cancel reject the final result promise.
      state.reject=null;
      const result=new Promise((resolve,reject)=>{state.resolve=resolve;state.reject=reject;});
      result.catch(()=>{});
      const rejectResult=state.reject;state.reject=error=>{state.nodeReadyReject?.(error);rejectResult(error);};
      state.node=this.createNode({numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit',processorOptions:{startFrame:0,windowFrames,intervalFrames,count:PROBE_COUNT}});
      state.node.onprocessorerror=()=>this.cancel('Calibration audio processor failed.');
      state.node.port.onmessage=({data})=>{
        if (this.active!==state || state.cancelled) return;
        if (data.type==='ready')state.nodeReadyResolve?.();
        else if (data.type==='error')this.cancel(data.message);
        else if (data.type==='window')state.worker.postMessage(data,[data.samples.buffer]);
      };
      state.tap.node.connect(state.node);state.node.connect(context.destination); // capture-only output is silence
      await new Promise((resolve,reject)=>{state.nodeReadyResolve=resolve;state.nodeReadyReject=reject;});check();
      state.nodeReadyReject=null;
      const startFrame=Math.ceil(context.currentTime*sampleRate)+Math.round(.35*sampleRate);
      state.node.port.postMessage({type:'start',startFrame});
      const buffer=context.createBuffer(1,probe.length,sampleRate);buffer.copyToChannel(probe,0);
      state.merger=context.createChannelMerger(2);state.merger.connect(this.output);
      for (let i=0;i<PROBE_COUNT;i++) {
        const source=context.createBufferSource();source.buffer=buffer;source.connect(state.merger,0,outputChannel);
        state.sources.push(source);source.start((startFrame+i*intervalFrames+pulseOffset)/sampleRate);
      }
      return await result;
    } finally {
      clearTimeout(state.timeout);
      for(const source of state.sources){try{source.stop();}catch{}source.disconnect();}
      state.tap?.release();state.node?.disconnect();state.node?.port.close();state.merger?.disconnect();state.worker?.terminate();
      this.source.removeEventListener('change',interrupted);context.removeEventListener('sinkchange',interrupted);context.removeEventListener('statechange',stateChanged);state.track?.removeEventListener('ended',interrupted);
      if(this.active===state)this.active=null;
    }
  }
}
