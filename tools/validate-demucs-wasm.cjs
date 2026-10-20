// Optional real-inference test: no network, uses previously downloaded weights.
// Usage: node tools/validate-demucs-wasm.cjs /path/to/htdemucs_6s.ort.gzipped
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '../examples/wam/source-separation');
const vendor = path.join(base, 'vendor/demucs-wasm');
const model = JSON.parse(fs.readFileSync(path.join(base, 'models.json'))).models.find(m => m.id === 'htdemucs_6s');
if (!process.argv[2]) { console.error('Usage: node tools/validate-demucs-wasm.cjs /path/to/htdemucs_6s.ort.gzipped'); process.exit(1); }
const weights = fs.readFileSync(process.argv[2]);
assert.equal(crypto.createHash('sha256').update(weights).digest('hex'), model.files[0].sha256, 'Pinned model hash');
const messages = [];
const scope = vm.createContext({module: {exports: {}}, exports: {}, require, __dirname: vendor,
  __filename: path.join(vendor, 'demucs_onnx_simd.js'), process, Buffer, WebAssembly, fetch,
  TextDecoder, TextEncoder, setTimeout, clearTimeout, performance, crypto: globalThis.crypto,
  URL, console: {log() {}, warn() {}, error: console.error},
  location: {href: pathToFileURL(path.join(base, 'demucs-worker.js')).href},
  postMessage: data => messages.push(data),
});
scope.importScripts = () => vm.runInContext(fs.readFileSync(path.join(vendor, 'demucs_onnx_simd.js'), 'utf8'), scope);
vm.runInContext(fs.readFileSync(path.join(base, 'demucs-worker.js'), 'utf8'), scope);
scope.weights = new Uint8Array(weights).buffer;
const duration = Number(process.argv[3] || 1);
assert.ok(Number.isFinite(duration) && duration >= 1 && duration <= 10);
scope.sampleCount = Math.round(44100 * duration);
(async () => {
  // Construct the arrays inside the VM, as the browser does in its Worker.
  await vm.runInContext(`onmessage({data:{files:[weights],targets:6,
    left:Float32Array.from({length:sampleCount},(_,i)=>.1*Math.sin(2*Math.PI*220*i/44100)),
    right:Float32Array.from({length:sampleCount},(_,i)=>.1*Math.sin(2*Math.PI*220*i/44100))}})`, scope);
  const error = messages.find(message => message.type === 'error');
  if (error) throw Error(error.message);
  const result = messages.find(message => message.type === 'result');
  assert.ok(result); assert.equal(result.stems.length, 12);
  const statistics = result.stems.map(channel => {
    assert.equal(channel.length, scope.sampleCount); assert.ok(channel.every(Number.isFinite));
    let energy = 0, peak = 0; for (const sample of channel) { energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
    return {peak, rms: Math.sqrt(energy / channel.length)};
  });
  assert.ok(statistics.some(channel => channel.peak > .001), 'Non-silent output');
  console.log(JSON.stringify({model: model.id, inputSeconds: duration, sampleRate: result.sampleRate,
    elapsedMs: result.elapsedMs, heapBytes: result.heapBytes, statistics,
    progressEvents: messages.filter(message => message.msg === 'PROGRESS_UPDATE').map(message => message.data), status:'passed'}, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
