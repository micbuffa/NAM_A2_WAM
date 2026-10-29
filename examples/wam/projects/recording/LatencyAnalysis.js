import {fftRadix2InPlace} from '../../source-separation/vendor/bs-roformer-web/fft-radix2.js';
export const ACOUSTIC_PROTOCOL = 'acoustic-chirp-v1';
export const LATENCY_PROTOCOL = 'loopback-correlation-v1';
export const PROBE_COUNT = 6;
export const MAX_DELAY_SECONDS = .75;

// Explicit bounded level; never increase automatically in response to feedback.
export function makeLatencyProbe(sampleRate,{mode='cable',levelDb=-18}={}) {
  if(!['cable','acoustic'].includes(mode)||!Number.isFinite(levelDb)||levelDb < -30||levelDb > -6)throw Error('Invalid calibration mode or probe level.');
  const chip = Math.max(1, Math.round(sampleRate / 24000));
  const probe = new Float32Array(mode==='acoustic'?Math.round(sampleRate*.08):1023*chip);
  let seed = 0x91e10da5, value = 0, peak=0;
  const f0=600,f1=Math.min(4500,sampleRate*.35),duration=probe.length/sampleRate,k=Math.log(f1/f0)/duration;
  for (let i = 0; i < probe.length; i++) {
    if(mode==='acoustic')value=Math.sin(2*Math.PI*f0*(Math.exp(k*i/sampleRate)-1)/k);
    else {
      if (i % chip === 0) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; }
      value += ((seed & 1 ? 1 : -1) - value) * .5;
    }
    const fade=mode==='acoustic'?sampleRate*.005:32;
    probe[i] = value * Math.min(1,i/fade,(probe.length-1-i)/fade);peak=Math.max(peak,Math.abs(probe[i]));
  }
  const gain=10**(levelDb/20)/peak;
  for(let i=0;i<probe.length;i++)probe[i]*=gain;
  return probe;
}

// Matched filtering runs only in a Worker. Convolve with the reversed code,
// then normalize each candidate by its local energy (gain/polarity independent).
export function analyzeLatencyReturn(samples, probe, {sampleRate, pulseOffset, maxDelayFrames, mode='cable'}) {
  if (samples.length < probe.length + pulseOffset || !['cable','acoustic'].includes(mode) || samples.some(value => !Number.isFinite(value))) return {valid:false, reason:'Invalid input samples'};
  let peak = 0; for (const value of samples) peak = Math.max(peak, Math.abs(value));
  if (peak >= .98) return {valid:false, reason:'Input clipping: reduce interface input gain'};
  if (peak < .00001) return {valid:false, reason:'No return signal: check cable and selected input/output'};
  let n = 1; while (n < samples.length + probe.length - 1) n *= 2;
  const a = new Float64Array(n * 2), b = new Float64Array(n * 2), energy = new Float64Array(samples.length + 1);
  let probeEnergy = 0, baseline = 0;
  for (let i = 0; i < samples.length; i++) { a[i*2] = samples[i]; energy[i+1] = energy[i] + samples[i] ** 2; if (i < pulseOffset) baseline += samples[i] ** 2; }
  for (let i = 0; i < probe.length; i++) { b[i*2] = probe[probe.length-1-i]; probeEnergy += probe[i] ** 2; }
  fftRadix2InPlace(a,n); fftRadix2InPlace(b,n);
  for (let i = 0; i < n * 2; i += 2) { const re=a[i]*b[i]-a[i+1]*b[i+1], im=a[i]*b[i+1]+a[i+1]*b[i]; a[i]=re; a[i+1]=-im; }
  fftRadix2InPlace(a,n); // inverse via conjugation; only the real component is used
  const end = Math.min(pulseOffset + maxDelayFrames, samples.length - probe.length);
  const scores = new Float64Array(end - pulseOffset + 1);
  let confidence = 0, lag = pulseOffset, polarity = 1;
  for (let i = pulseOffset; i <= end; i++) {
    const dot = a[(i + probe.length - 1)*2] / n, localEnergy = energy[i+probe.length]-energy[i];
    const score = Math.min(1, Math.abs(dot) / Math.sqrt(Math.max(1e-30, probeEnergy*localEnergy)));
    scores[i-pulseOffset] = score;
    if (score > confidence) { confidence = score; lag = i; polarity = Math.sign(dot); }
  }
  let competitor = 0; const exclusion = Math.max(8, Math.round(sampleRate * .0005));
  for (let i = 0; i < scores.length; i++) if (Math.abs(i + pulseOffset - lag) > exclusion) competitor = Math.max(competitor, scores[i]);
  const returnRms = Math.sqrt((energy[lag+probe.length]-energy[lag])/probe.length);
  const noiseRms = Math.sqrt(baseline/Math.max(1,pulseOffset));
  const snrDb = 20*Math.log10(returnRms/Math.max(1e-8,noiseRms));
  const acoustic=mode==='acoustic';
  const valid = confidence >= (acoustic ? .3 : .65) && confidence / Math.max(.001,competitor) >= (acoustic?1.15:1.3) && snrDb >= (acoustic?6:8);
  const diagnostics=`input ${(20*Math.log10(Math.max(peak,1e-10))).toFixed(1)} dBFS · SNR ${snrDb.toFixed(1)} dB · correlation ${confidence.toFixed(2)}`;
  return {valid, frames:lag-pulseOffset, confidence, snrDb, polarity, peak,
    reason:valid ? '' : `Return rejected (${diagnostics}). ${snrDb < (acoustic?6:8)?'Raise the test level or input gain, without clipping.':acoustic?'Reflections/noise obscure the return; move the microphone or use a cable.':'Check cable/gain, or choose Acoustic test for speakers and microphone.'}`};
}

export function summarizeLatency(observations, sampleRate, {mode='cable'}={}) {
  if (observations.length !== PROBE_COUNT) throw Error('Calibration is incomplete.');
  const measured = observations.slice(0,-1).filter(result => result.valid), check = observations.at(-1);
  if (measured.length < 4 || !check.valid) throw Error(check.reason || observations.find(result=>!result.valid)?.reason || 'Not enough reliable return signals. Check cable and gain, then retry.');
  const delays = measured.map(result=>result.frames).sort((a,b)=>a-b), middle = delays.length >> 1;
  const frames = Math.round(delays.length%2 ? delays[middle] : (delays[middle-1]+delays[middle])/2);
  const spreadFrames = delays.at(-1)-delays[0], validationResidualFrames = check.frames-frames;
  const acoustic=mode==='acoustic';
  if (spreadFrames > Math.max(3,Math.round(sampleRate*(acoustic ? .002 : .001))) || Math.abs(validationResidualFrames) > Math.max(2,Math.round(sampleRate*(acoustic ? .001 : .0005)))) throw Error('Latency is unstable. Check the interface, close heavy audio tasks and retry.');
  return {protocol:acoustic?ACOUSTIC_PROTOCOL:LATENCY_PROTOCOL, compensationKind:acoustic?'acoustic-round-trip':'round-trip', sampleRate, frames, spreadFrames,
    validProbes:measured.length, totalProbes:PROBE_COUNT, confidence:Math.min(...measured.map(r=>r.confidence),check.confidence),
    validationResidualFrames, measuredAt:new Date().toISOString()};
}
