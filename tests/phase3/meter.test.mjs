import test from 'node:test';
import assert from 'node:assert/strict';
import getNamProcessor from '../../src/nam-wam/NamProcessor.js';

const makeProcessor = ({amplitude = 0.25, inputGainDb = 0, outputGainDb = 0, bypass = 0} = {}) => {
  const messages = [];
  class WamProcessor {
    constructor(options) { this.port = {postMessage:(message)=>messages.push({...message})}; this._initialized = true; }
    _initialize() {}
    destroy() {}
  }
  class WamParameterInfo { constructor(id, options) { Object.assign(this, {id}, options); } }
  globalThis.sampleRate = 48000;
  globalThis.webAudioModules = {getModuleScope:()=>({WamProcessor,WamParameterInfo})};
  globalThis.registerProcessor = () => {};
  const Processor = getNamProcessor('meter-test');
  const processor = new Processor({processorOptions:{wasmModule:{}}});
  const values = (value) => new Float32Array(128).fill(value);
  processor._parameterInterpolators = {
    inputGain:{done:true,values:values(inputGainDb)}, outputGain:{done:true,values:values(outputGainDb)}, bypass:{done:true,values:values(bypass)},
  };
  processor._ready = true;
  processor._wasmInput = new Float32Array(128);
  processor._wasmOutput = new Float32Array(128);
  processor._wasmExports = {nam_process:()=>{processor._wasmOutput.set(processor._wasmInput);return 1;}};
  processor._namHandle = 1;
  processor._inputPtr = 1;
  processor._outputPtr = 2;
  const input = new Float32Array(128);
  for (let i = 0; i < input.length; ++i) input[i] = i & 1 ? amplitude : -amplitude;
  const output = new Float32Array(128);
  const render = (quanta = 15, suppliedInput = input) => {
    for (let i = 0; i < quanta; ++i) processor._process(0, 128, [[suppliedInput]], [[output]]);
    return messages.at(-1);
  };
  return {processor,messages,input,output,render};
};

test('meter reports at an accumulated interval with correct peak and RMS', () => {
  const fixture = makeProcessor({amplitude:0.25});
  fixture.render(14);
  assert.equal(fixture.messages.length, 0);
  const report = fixture.render(1);
  assert.equal(report.type, 'nam-meter');
  assert.ok(Math.abs(report.inputPeak - 0.25) < 1e-6);
  assert.ok(Math.abs(report.inputRms - 0.25) < 1e-6);
  assert.ok(Math.abs(20 * Math.log10(report.inputPeak) + 12.0412) < 0.01);
});

test('inputGain affects input meter and outputGain affects output meter', () => {
  const report = makeProcessor({amplitude:0.25,inputGainDb:6,outputGainDb:-6}).render();
  assert.ok(Math.abs(report.inputPeak - 0.25 * 10 ** (6 / 20)) < 1e-6);
  assert.ok(Math.abs(report.outputPeak - 0.25) < 1e-6);
});

test('bypass meters the coherent signal actually passed through', () => {
  const report = makeProcessor({amplitude:0.2,inputGainDb:12,outputGainDb:-12,bypass:1}).render();
  assert.ok(Math.abs(report.inputPeak - 0.2) < 1e-6);
  assert.ok(Math.abs(report.outputPeak - 0.2) < 1e-6);
  assert.ok(Math.abs(report.inputRms - report.outputRms) < 1e-9);
});

test('silence reports zero floor values without NaN or Infinity', () => {
  const fixture = makeProcessor();
  const report = fixture.render(15, new Float32Array(128));
  for (const key of ['inputPeak','inputRms','outputPeak','outputRms']) {
    assert.equal(report[key], 0);
    assert.equal(Number.isFinite(report[key]), true);
  }
});

test('input and output clip flags use the abs(sample) >= 1 threshold', () => {
  const report = makeProcessor({amplitude:1}).render();
  assert.equal(report.inputClip, true);
  assert.equal(report.outputClip, true);
});
