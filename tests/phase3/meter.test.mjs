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
    noise:{done:true,values:values(-80)}, noiseEnabled:{done:true,values:values(0)},
    bass:{done:true,values:values(5)}, middle:{done:true,values:values(5)}, treble:{done:true,values:values(5)}, toneEnabled:{done:true,values:values(1)},
    eqEnabled:{done:true,values:values(0)}, eqPre:{done:true,values:values(0)},
  };
  for (const [index,frequency,q] of [[1,100,.71],[2,250,1],[3,650,1],[4,1600,1],[5,3500,1.4],[6,8000,.71]]) {
    processor._parameterInterpolators[`eq${index}Freq`]={done:true,values:values(frequency)};
    processor._parameterInterpolators[`eq${index}Gain`]={done:true,values:values(0)};
    processor._parameterInterpolators[`eq${index}Q`]={done:true,values:values(q)};
  }
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

test('official-style noise gate attenuates signals below its threshold', () => {
  const fixture=makeProcessor({amplitude:.001});
  fixture.processor._parameterInterpolators.noiseEnabled.values.fill(1);
  fixture.processor._parameterInterpolators.noise.values.fill(-20);
  const report=fixture.render(30);
  assert.ok(report.outputRms < report.inputRms * .01);
});

test('tone stack and post EQ shape the NAM output while flat defaults stay neutral', () => {
  const fixture=makeProcessor({amplitude:.01});
  fixture.processor._parameterInterpolators.bass.values.fill(10);
  fixture.processor._parameterInterpolators.eqEnabled.values.fill(1);
  fixture.processor._parameterInterpolators.eq2Gain.values.fill(6);
  const lowTone=new Float32Array(128);for(let i=0;i<128;i++)lowTone[i]=.01*Math.sin(2*Math.PI*100*i/48000);
  const report=fixture.render(60,lowTone);
  assert.ok(report.outputRms > report.inputRms * 2);
});

test('real-time spectrum reports 64 log-spaced bins only while enabled', () => {
  const fixture=makeProcessor({amplitude:.1});
  const tone=new Float32Array(128);let phase=0;const increment=2*Math.PI*1000/48000;
  fixture.processor._setSpectrumEnabled(true);
  for(let quantum=0;quantum<16;quantum++){
    for(let i=0;i<tone.length;i++){tone[i]=.1*Math.sin(phase);phase+=increment;}
    fixture.render(1,tone);
  }
  const spectrum=fixture.messages.find((message)=>message.type==='nam-spectrum');
  assert.equal(spectrum.inputBins.length,64);assert.equal(spectrum.filteredBins.length,64);assert.equal(spectrum.finalBins.length,64);
  assert.ok([...spectrum.inputBins,...spectrum.filteredBins,...spectrum.finalBins].every(Number.isFinite));
  const peakIndex=[...spectrum.filteredBins].indexOf(Math.max(...spectrum.filteredBins));
  assert.ok(peakIndex>=34&&peakIndex<=39,`expected the 1 kHz peak near log bin 36, got ${peakIndex}`);
  const count=fixture.messages.filter((message)=>message.type==='nam-spectrum').length;
  fixture.processor._setSpectrumEnabled(false);fixture.render(20,tone);
  assert.equal(fixture.messages.filter((message)=>message.type==='nam-spectrum').length,count);
});

test('EQ and tone shaping remain audible and visible before a NAM model is loaded', () => {
  const fixture=makeProcessor({amplitude:.01});fixture.processor._ready=false;
  fixture.processor._parameterInterpolators.toneEnabled.values.fill(0);
  fixture.processor._parameterInterpolators.eqEnabled.values.fill(1);
  fixture.processor._parameterInterpolators.eq1Gain.values.fill(12);
  const lowTone=new Float32Array(128);for(let i=0;i<128;i++)lowTone[i]=.01*Math.sin(2*Math.PI*100*i/48000);
  const report=fixture.render(60,lowTone);
  assert.ok(report.outputRms>report.inputRms*2.5);
});

test('PRE EQ processes audio before NAM and is not bypassed', () => {
  const fixture=makeProcessor({amplitude:.01});
  fixture.processor._parameterInterpolators.toneEnabled.values.fill(0);
  fixture.processor._parameterInterpolators.eqEnabled.values.fill(1);
  fixture.processor._parameterInterpolators.eqPre.values.fill(1);
  fixture.processor._parameterInterpolators.eq4Freq.values.fill(1000);
  fixture.processor._parameterInterpolators.eq4Gain.values.fill(12);
  const tone=new Float32Array(128);let phase=0;for(let i=0;i<128;i++){tone[i]=.01*Math.sin(phase);phase+=2*Math.PI*1000/48000;}
  const report=fixture.render(60,tone);
  assert.ok(report.outputRms>report.inputRms*2.5);
});

test('post-EQ spectrum visibly follows a boosted band', () => {
  const fixture=makeProcessor({amplitude:.03});fixture.processor._parameterInterpolators.toneEnabled.values.fill(0);
  const tone=new Float32Array(128);let phase=0;const increment=2*Math.PI*1000/48000;
  const renderTone=()=>{for(let quantum=0;quantum<20;quantum++){for(let i=0;i<128;i++){tone[i]=.03*Math.sin(phase);phase+=increment;}fixture.render(1,tone);}};
  fixture.processor._setSpectrumEnabled(true);renderTone();
  const before=[...fixture.messages.filter((message)=>message.type==='nam-spectrum').at(-1).filteredBins];
  fixture.processor._parameterInterpolators.eqEnabled.values.fill(1);fixture.processor._parameterInterpolators.eq4Freq.values.fill(1000);fixture.processor._parameterInterpolators.eq4Gain.values.fill(12);
  fixture.processor._setSpectrumEnabled(true);renderTone();
  const spectrum=fixture.messages.filter((message)=>message.type==='nam-spectrum').at(-1);
  const after=[...spectrum.filteredBins];
  assert.ok(Math.max(...after)>Math.max(...before)+8);
  assert.ok(Math.max(...spectrum.filteredBins)>Math.max(...spectrum.inputBins)+8);
});

test('final-output spectrum follows tone-stack changes after the EQ', () => {
  const fixture=makeProcessor({amplitude:.02});fixture.processor._parameterInterpolators.bass.values.fill(10);
  fixture.processor._setSpectrumEnabled(true);
  const tone=new Float32Array(128);let phase=0;const increment=2*Math.PI*100/48000;
  for(let quantum=0;quantum<24;quantum++){for(let i=0;i<128;i++){tone[i]=.02*Math.sin(phase);phase+=increment;}fixture.render(1,tone);}
  const spectrum=fixture.messages.filter((message)=>message.type==='nam-spectrum').at(-1);
  assert.ok(Math.max(...spectrum.finalBins)>Math.max(...spectrum.filteredBins)+8);
});
