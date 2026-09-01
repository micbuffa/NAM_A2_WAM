import fs from 'node:fs';
import createNamModule from '../build-wasm/dist/nam.js';

const modelPath = process.argv[2];
const outputPath = process.argv[3];
const sampleRate = Number(process.argv[4] ?? 48000);
const bytes = fs.readFileSync(modelPath);
const Module = await createNamModule();
const handle = Module._nam_create(sampleRate);
const data = Module._malloc(bytes.length);
Module.HEAPU8.set(bytes, data);
if (!Module._nam_load_model(handle, data, bytes.length)) {
  throw new Error(Module.UTF8ToString(Module._nam_last_error(handle)));
}
Module._free(data);
const inputPtr = Module._nam_input_buffer(handle);
const outputPtr = Module._nam_output_buffer(handle);
const frames = 48000;
const output = new Float32Array(frames);
const times = [];
for (let p = 0; p < frames; p += 128) {
  const input = new Float32Array(Module.HEAPF32.buffer, inputPtr, 128);
  for (let i = 0; i < 128; ++i) input[i] = 0.15 * Math.sin(2 * Math.PI * 997 * (p + i) / sampleRate);
  const begin = performance.now();
  if (!Module._nam_process(handle, inputPtr, outputPtr, 128)) throw new Error('process failed');
  times.push((performance.now() - begin) * 1000);
  output.set(new Float32Array(Module.HEAPF32.buffer, outputPtr, 128), p);
}
fs.writeFileSync(outputPath, Buffer.from(output.buffer));
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / times.length;
const deadline = 128e6 / sampleRate;
console.log(JSON.stringify({sample_rate: sampleRate, avg_us: avg, p95_us: times[Math.floor(times.length * .95)], max_us: times.at(-1), deadline_us: deadline, margin: deadline / avg}));
Module._nam_destroy(handle);
