import {RingBuffer} from '../../source-separation/vendor/ringbuf/index.js';
import {IncrementalTake} from './TakePCM.js';
let ring, control, take, timer, sessionId, lastProgress, failed;
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
onmessage = ({data}) => {
  if (data.type === 'init') {
    sessionId = data.sessionId; ring = new RingBuffer(data.storage, Float32Array); control = new Int32Array(data.control);
    take = new IncrementalTake(data.metadata); failed = false; lastProgress = 0; timer = setInterval(pull, 25);
    postMessage({type: 'ready', sessionId});
  } else if (data.type === 'finish' && data.sessionId === sessionId) {
    clearInterval(timer);
    try {
      if (!Atomics.load(control, 1)) throw Error('Audio producer has not stopped.');
      if (!pull(true)) return;
      if (data.frames !== Atomics.load(control, 0)) throw Error('Recording final drain is incomplete.');
      const result = take.finish(data.frames);
      postMessage({type: 'complete', sessionId, ...result, capturedFrames: data.frames}, [result.peaks.buffer]); take = null;
    } catch (error) { postMessage({type: 'error', sessionId, error: error.message}); }
  }
};
