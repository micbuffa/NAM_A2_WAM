import {RangeCapture} from './RangeCapture.js';
import {RingBuffer} from '../../source-separation/vendor/ringbuf/index.js';
import {readDI, punchTake} from './PunchTake.js';
import {IncrementalTake} from './TakePCM.js';
let ring, control, take, timer, sessionId, lastProgress, failed, base, metadata;
function pull(force = false) {
  try {
    if (failed) return false;
    if (Atomics.load(control, 2)) throw Error('Audio capture overflow or input interruption. The take was discarded.');
    while (ring.available_read()) {
      const chunk = new Float32Array(Math.min(8192, ring.available_read()));
      if (ring.pop(chunk) !== chunk.length) throw Error('Audio queue lost frames.');
      take.append(chunk); // Each drained sample is encoded exactly once here.
    }
    if (force || performance.now() - lastProgress > 100) {
      lastProgress = performance.now();
      const delta = take.delta();
      if (delta) postMessage({type: 'progress', sessionId, ...delta}, [delta.peaks.buffer]);
    }
    return true;
  } catch (error) { failed = true; clearInterval(timer); postMessage({type: 'error', sessionId, error: error.message}); return false; }
}
onmessage = async ({data}) => {
  if (data.type === 'init') {
    sessionId = data.sessionId; metadata=data.metadata;
    try { base=data.baseAudio?await readDI(data.baseAudio,metadata.sampleRate):null; } catch(error){postMessage({type:'error',sessionId,error:error.message});return;}
    ring = new RingBuffer(data.storage, Float32Array); control = new Int32Array(data.control);
    take = metadata.rangeRecording?new RangeCapture(metadata):new IncrementalTake(data.metadata); failed = false; lastProgress = 0; timer = setInterval(pull, 25);
    postMessage({type: 'ready', sessionId,baseWave:base?{peaks:base.peaks,sampleRate:metadata.sampleRate,peakFrames:1024,duration:base.frames/metadata.sampleRate}:null});
  } else if(data.type==='select'&&data.sessionId===sessionId){
    try{const result=await take.render(data.number,base);postMessage({type:'selection',sessionId,requestId:data.requestId,...result},[result.peaks.buffer]);}catch(error){postMessage({type:'selection-error',sessionId,requestId:data.requestId,error:error.message});}
  } else if (data.type === 'finish' && data.sessionId === sessionId) {
    clearInterval(timer);
    try {
      if (!Atomics.load(control, 1)) throw Error('Audio producer has not stopped.');
      if (!pull(true)) return;
      if (data.frames !== Atomics.load(control, 0)) throw Error('Recording final drain is incomplete.');
      let result;
      if(take instanceof RangeCapture){const selected=take.finish(data.frames);result=await take.render(selected,base);}
      else{result=take.finish(data.frames);if(base)result=await punchTake(base,result,metadata);}
      postMessage({type: 'complete', sessionId, ...result, capturedFrames: data.frames}, [result.peaks.buffer]); if(!(take instanceof RangeCapture))take=null;
    } catch (error) { postMessage({type: 'error', sessionId, error: error.message}); }
  }
};
