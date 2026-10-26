import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {StreamingWorker,isVerifiedStreamChunk} from '../../examples/wam/source-separation/StreamTransport.js';

for (const shared of [true, false]) test(`real worker preserves stereo/source order and PCM under backpressure (${shared ? 'shared ring' : 'transfer fallback'})`, async () => {
  const worker = new Worker(new URL('./fixtures/studio-stream-producer.mjs', import.meta.url));
  const raw = {postMessage: (...args) => worker.postMessage(...args), terminate: () => worker.terminate()};
  worker.on('message', data => raw.onmessage({data}));
  worker.on('error', error => raw.onerror(error));
  const consumer = new StreamingWorker(raw, 12, {shared});
  const totalFrames = 44100 * 7 + 3;
  let offset = 0, turns = 0;
  try {
    await new Promise((resolve, reject) => {
      consumer.onerror = error => reject(Error(error.message));
      consumer.onmessage = ({data}) => {
        try {
          if (data.type === 'error') throw Error(data.message);
          if (data.type === 'chunk') {
            assert.equal(data.startFrame, offset);
            assert.equal(isVerifiedStreamChunk(data), true);
            for (let channel = 0; channel < 12; channel++) for (let i = 0; i < data.frames; i++) {
              assert.equal(data.stems[channel][i], Math.fround(((offset+i)%100-channel)/100));
            }
            assert.equal(data.peaks.length, 6);
            assert.ok(data.peaks.every(peaks => peaks.length === 2048));
            offset += data.frames;
            turns++;
          }
          if (data.type === 'done') {
            assert.equal(data.transportMode, shared ? 'shared-ringbuffer' : 'transfer');
            resolve();
          }
        } catch (error) { reject(error); }
      };
      consumer.postMessage({left: new Float32Array(totalFrames), right: new Float32Array(totalFrames)});
    });
    assert.equal(offset, totalFrames);
    assert.equal(turns, 8);
  } finally {consumer.terminate();}
});
