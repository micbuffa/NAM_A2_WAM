const getNamProcessor = (moduleId) => {
  const scope = globalThis;
  const ModuleScope = scope.webAudioModules.getModuleScope(moduleId);
  const {WamProcessor, WamParameterInfo} = ModuleScope;
  const QUANTUM = 128;
  const DIAGNOSTIC_CAPACITY = 16384;
  const CALIBRATION_WARMUP_FRAMES = 4096;
  const CALIBRATION_MEASURE_FRAMES = 16384;
  const CALIBRATION_TARGET_RMS_DB = -18;
  const CALIBRATION_PEAK_CEILING_DB = -1;
  const CALIBRATION_MAX_CORRECTION_DB = 12;
  const CALIBRATION_PROBE_FREQUENCY = 997;
  const CALIBRATION_PROBE_PEAK = 0.15;
  const EQ_FREQ_IDS = ['eq1Freq','eq2Freq','eq3Freq','eq4Freq','eq5Freq','eq6Freq'];
  const EQ_GAIN_IDS = ['eq1Gain','eq2Gain','eq3Gain','eq4Gain','eq5Gain','eq6Gain'];
  const EQ_Q_IDS = ['eq1Q','eq2Q','eq3Q','eq4Q','eq5Q','eq6Q'];
  const SPECTRUM_FFT_SIZE = 2048;
  const SPECTRUM_RING_SIZE = 4096;
  const SPECTRUM_BINS = 64;
  const SPECTRUM_MIN_DB = -100;

  class NamProcessor extends WamProcessor {
    constructor(options) {
      super(options);
      this._wasmModule = options.processorOptions.wasmModule;
      this._wasmInstance = null;
      this._wasmExports = null;
      this._wasmMemory = null;
      this._namHandle = 0;
      this._inputPtr = 0;
      this._outputPtr = 0;
      this._wasmInput = null;
      this._wasmOutput = null;
      this._ready = false;
      this._loading = false;
      this._decoder = typeof TextDecoder === 'function' ? new TextDecoder() : null;
      this._diagnosticEnabled = false;
      this._diagnosticTimings = new Float64Array(DIAGNOSTIC_CAPACITY);
      this._diagnosticCount = 0;
      this._diagnosticWrite = 0;
      this._namCalls = 0;
      this._namFailures = 0;
      this._diagnosticPassThrough = false;
      this._meterFrames = 0;
      this._meterInputPeak = 0;
      this._meterInputSquares = 0;
      this._meterOutputPeak = 0;
      this._meterOutputSquares = 0;
      this._meterInputClip = false;
      this._meterOutputClip = false;
      this._meterReportFrames = Math.max(QUANTUM, Math.round(scope.sampleRate / 25));
      this._meterMessage = {type: 'nam-meter', inputPeak: 0, inputRms: 0, outputPeak: 0, outputRms: 0,
        inputClip: false, outputClip: false};
      this._normalizationCurrent = 1;
      this._normalizationTarget = 1;
      this._toneFilters = [this._newBiquad(), this._newBiquad(), this._newBiquad()];
      this._toneValues = new Float64Array(4).fill(Number.NaN);
      this._eqFilters = Array.from({length:6}, () => this._newBiquad());
      this._eqValues = new Float64Array(20).fill(Number.NaN);
      this._gateEnvelope = 0;
      this._gateGain = 0;
      this._gateHoldCounter = 0;
      this._gateState = 0;
      this._gateWasEnabled = false;
      this._gateSvfIc1 = 0;
      this._gateSvfIc2 = 0;
      this._gateLowpassState = 0;
      const gateG = Math.tan(Math.PI * 80 / scope.sampleRate);
      const gateK = Math.SQRT2;
      this._gateK = gateK;
      this._gateA1 = 1 / (1 + gateG * (gateG + gateK));
      this._gateA2 = gateG * this._gateA1;
      this._gateA3 = gateG * this._gateA2;
      this._gateLowpassCoeff = 1 - Math.exp(-2 * Math.PI * 5000 / scope.sampleRate);
      this._gateDetectorRise = 1 - Math.exp(-1 / (.0002 * scope.sampleRate));
      this._gateDetectorFall = 1 - Math.exp(-1 / (.025 * scope.sampleRate));
      this._gateAttack = this._gateDetectorRise;
      this._gateRelease = 1 - Math.exp(-1 / (.1 * scope.sampleRate));
      this._gateHoldSamples = Math.round(.05 * scope.sampleRate);
      this._gateThresholdDb = Number.NaN;
      this._gateOpenThreshold = 1;
      this._gateCloseThreshold = 1;
      this._gateInvOpenThreshold = 1;
      this._spectrumEnabled = false;
      this._spectrumWrite = 0;
      this._spectrumFrames = 0;
      this._spectrumReportFrames = Math.max(QUANTUM, Math.round(scope.sampleRate / 30));
      this._spectrumInputRing = new Float32Array(SPECTRUM_RING_SIZE);
      this._spectrumFilteredRing = new Float32Array(SPECTRUM_RING_SIZE);
      this._spectrumFinalRing = new Float32Array(SPECTRUM_RING_SIZE);
      this._spectrumReal = new Float64Array(SPECTRUM_FFT_SIZE);
      this._spectrumImag = new Float64Array(SPECTRUM_FFT_SIZE);
      this._spectrumWindow = new Float32Array(SPECTRUM_FFT_SIZE);
      this._spectrumBitReverse = new Uint16Array(SPECTRUM_FFT_SIZE);
      this._spectrumTwiddleReal = new Float64Array(SPECTRUM_FFT_SIZE / 2);
      this._spectrumTwiddleImag = new Float64Array(SPECTRUM_FFT_SIZE / 2);
      this._spectrumInputBins = new Float32Array(SPECTRUM_BINS).fill(SPECTRUM_MIN_DB);
      this._spectrumFilteredBins = new Float32Array(SPECTRUM_BINS).fill(SPECTRUM_MIN_DB);
      this._spectrumFinalBins = new Float32Array(SPECTRUM_BINS).fill(SPECTRUM_MIN_DB);
      this._spectrumMessage = {type:'nam-spectrum', minFrequency:20, maxFrequency:20000,
        minDb:SPECTRUM_MIN_DB, sampleRate:scope.sampleRate,
        inputBins:this._spectrumInputBins, filteredBins:this._spectrumFilteredBins,
        finalBins:this._spectrumFinalBins};
      const fftBits = Math.log2(SPECTRUM_FFT_SIZE);
      for (let i = 0; i < SPECTRUM_FFT_SIZE; ++i) {
        this._spectrumWindow[i] = .5 * (1 - Math.cos(2 * Math.PI * i / (SPECTRUM_FFT_SIZE - 1)));
        let value = i; let reversed = 0;
        for (let bit = 0; bit < fftBits; ++bit) { reversed = (reversed << 1) | (value & 1); value >>= 1; }
        this._spectrumBitReverse[i] = reversed;
      }
      for (let i = 0; i < SPECTRUM_FFT_SIZE / 2; ++i) {
        const angle = -2 * Math.PI * i / SPECTRUM_FFT_SIZE;
        this._spectrumTwiddleReal[i] = Math.cos(angle); this._spectrumTwiddleImag[i] = Math.sin(angle);
      }
    }

    _newBiquad() {
      return {b0:1, b1:0, b2:0, a1:0, a2:0, z1:0, z2:0, active:true};
    }

    _resetBiquad(filter) { filter.z1 = 0; filter.z2 = 0; }

    _processBiquad(filter, sample) {
      const output = filter.b0 * sample + filter.z1;
      filter.z1 = filter.b1 * sample - filter.a1 * output + filter.z2;
      filter.z2 = filter.b2 * sample - filter.a2 * output;
      return output;
    }

    _setBiquad(filter, type, frequency, gainDb, q) {
      const freq = Math.max(20, Math.min(20000, scope.sampleRate * .49, frequency));
      const A = 10 ** (gainDb / 40);
      const omega = 2 * Math.PI * freq / scope.sampleRate;
      const sn = Math.sin(omega);
      const cs = Math.cos(omega);
      const alpha = sn / (2 * q);
      const sqrtA = Math.sqrt(A);
      let b0 = 1; let b1 = 0; let b2 = 0; let a0 = 1; let a1 = 0; let a2 = 0;
      if (type === 'bell') {
        b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A;
        a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A;
      } else if (type === 'lowShelf') {
        b0 = A * ((A + 1) - (A - 1) * cs + 2 * sqrtA * alpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cs);
        b2 = A * ((A + 1) - (A - 1) * cs - 2 * sqrtA * alpha);
        a0 = (A + 1) + (A - 1) * cs + 2 * sqrtA * alpha;
        a1 = -2 * ((A - 1) + (A + 1) * cs);
        a2 = (A + 1) + (A - 1) * cs - 2 * sqrtA * alpha;
      } else {
        b0 = A * ((A + 1) + (A - 1) * cs + 2 * sqrtA * alpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cs);
        b2 = A * ((A + 1) + (A - 1) * cs - 2 * sqrtA * alpha);
        a0 = (A + 1) - (A - 1) * cs + 2 * sqrtA * alpha;
        a1 = 2 * ((A - 1) - (A + 1) * cs);
        a2 = (A + 1) - (A - 1) * cs - 2 * sqrtA * alpha;
      }
      const norm = 1 / a0;
      filter.b0 = b0 * norm; filter.b1 = b1 * norm; filter.b2 = b2 * norm;
      filter.a1 = a1 * norm; filter.a2 = a2 * norm;
      filter.active = Math.abs(gainDb) >= .05;
    }

    _updateToneFilters(parameters, sample) {
      const enabled = parameters.toneEnabled.values[sample] >= .5 ? 1 : 0;
      const bass = parameters.bass.values[sample];
      const middle = parameters.middle.values[sample];
      const treble = parameters.treble.values[sample];
      if (enabled !== this._toneValues[0]) {
        for (let i = 0; i < 3; ++i) this._resetBiquad(this._toneFilters[i]);
      }
      if (bass !== this._toneValues[1]) this._setBiquad(this._toneFilters[0], 'lowShelf', 150, 4 * (bass - 5), .707);
      if (middle !== this._toneValues[2]) {
        const gainDb = 3 * (middle - 5);
        this._setBiquad(this._toneFilters[1], 'bell', 425, gainDb, gainDb < 0 ? 1.5 : .7);
      }
      if (treble !== this._toneValues[3]) this._setBiquad(this._toneFilters[2], 'highShelf', 1800, 2 * (treble - 5), .707);
      this._toneValues[0] = enabled; this._toneValues[1] = bass;
      this._toneValues[2] = middle; this._toneValues[3] = treble;
      return enabled;
    }

    _updateEqFilters(parameters, sample) {
      const enabled = parameters.eqEnabled.values[sample] >= .5 ? 1 : 0;
      const pre = parameters.eqPre.values[sample] >= .5 ? 1 : 0;
      if (enabled !== this._eqValues[0] || pre !== this._eqValues[1]) {
        for (let i = 0; i < 6; ++i) this._resetBiquad(this._eqFilters[i]);
      }
      for (let i = 0; i < 6; ++i) {
        const base = 2 + i * 3;
        const frequency = parameters[EQ_FREQ_IDS[i]].values[sample];
        const gainDb = parameters[EQ_GAIN_IDS[i]].values[sample];
        const q = parameters[EQ_Q_IDS[i]].values[sample];
        if (frequency !== this._eqValues[base] || gainDb !== this._eqValues[base + 1] || q !== this._eqValues[base + 2]) {
          this._setBiquad(this._eqFilters[i], i === 0 ? 'lowShelf' : i === 5 ? 'highShelf' : 'bell', frequency, gainDb, q);
        }
        this._eqValues[base] = frequency; this._eqValues[base + 1] = gainDb; this._eqValues[base + 2] = q;
      }
      this._eqValues[0] = enabled; this._eqValues[1] = pre;
      return enabled ? (pre ? 1 : 2) : 0;
    }

    _processEqSample(sample) {
      let value = sample;
      for (let i = 0; i < 6; ++i) if (this._eqFilters[i].active) value = this._processBiquad(this._eqFilters[i], value);
      return value;
    }

    _processToneSample(sample) {
      let value = sample;
      for (let i = 0; i < 3; ++i) if (this._toneFilters[i].active) value = this._processBiquad(this._toneFilters[i], value);
      return value;
    }

    _setSpectrumEnabled(enabled) {
      this._spectrumEnabled = Boolean(enabled);
      this._spectrumFrames = 0;
      if (this._spectrumEnabled) {
        this._spectrumInputRing.fill(0); this._spectrumFilteredRing.fill(0); this._spectrumFinalRing.fill(0);
        this._spectrumInputBins.fill(SPECTRUM_MIN_DB); this._spectrumFilteredBins.fill(SPECTRUM_MIN_DB);
        this._spectrumFinalBins.fill(SPECTRUM_MIN_DB);
        this._spectrumWrite = 0;
      }
      return this._spectrumEnabled;
    }

    _captureSpectrumPair(inputSample, filteredSample) {
      if (!this._spectrumEnabled) return;
      this._spectrumInputRing[this._spectrumWrite] = inputSample;
      this._spectrumFilteredRing[this._spectrumWrite] = filteredSample;
    }

    _captureSpectrumFinal(sample) {
      if (!this._spectrumEnabled) return;
      this._spectrumFinalRing[this._spectrumWrite] = sample;
      this._spectrumWrite = (this._spectrumWrite + 1) & (SPECTRUM_RING_SIZE - 1);
    }

    _flushSpectrum(frames) {
      if (!this._spectrumEnabled) return;
      this._spectrumFrames += frames;
      if (this._spectrumFrames < this._spectrumReportFrames) return;
      this._spectrumFrames = 0;
      this._analyzeSpectrum(this._spectrumInputRing, this._spectrumInputBins);
      this._analyzeSpectrum(this._spectrumFilteredRing, this._spectrumFilteredBins);
      this._analyzeSpectrum(this._spectrumFinalRing, this._spectrumFinalBins);
      this.port.postMessage(this._spectrumMessage);
    }

    _analyzeSpectrum(ring, bins) {
      const real = this._spectrumReal; const imag = this._spectrumImag;
      const start = (this._spectrumWrite - SPECTRUM_FFT_SIZE) & (SPECTRUM_RING_SIZE - 1);
      for (let i = 0; i < SPECTRUM_FFT_SIZE; ++i) {
        const target = this._spectrumBitReverse[i];
        real[target] = ring[(start + i) & (SPECTRUM_RING_SIZE - 1)] * this._spectrumWindow[i];
        imag[target] = 0;
      }
      for (let size = 2; size <= SPECTRUM_FFT_SIZE; size <<= 1) {
        const half = size >> 1; const twiddleStride = SPECTRUM_FFT_SIZE / size;
        for (let offset = 0; offset < SPECTRUM_FFT_SIZE; offset += size) {
          for (let j = 0; j < half; ++j) {
            const twiddle = j * twiddleStride;
            const cosine = this._spectrumTwiddleReal[twiddle]; const sine = this._spectrumTwiddleImag[twiddle];
            const even = offset + j; const odd = even + half;
            const tr = cosine * real[odd] - sine * imag[odd];
            const ti = sine * real[odd] + cosine * imag[odd];
            real[odd] = real[even] - tr; imag[odd] = imag[even] - ti;
            real[even] += tr; imag[even] += ti;
          }
        }
      }
      const binHz = scope.sampleRate / SPECTRUM_FFT_SIZE;
      const logRatio = Math.log(1000);
      for (let i = 0; i < SPECTRUM_BINS; ++i) {
        const f0 = 20 * Math.exp(logRatio * i / SPECTRUM_BINS);
        const f1 = 20 * Math.exp(logRatio * (i + 1) / SPECTRUM_BINS);
        const b0 = Math.ceil(f0 / binHz); const b1 = Math.floor(f1 / binHz);
        let magnitude = 0;
        if (b1 >= b0) for (let bin = b0; bin <= b1; ++bin) magnitude = Math.max(magnitude, this._spectrumMagnitudeAt(bin));
        else {
          const exact = (f0 + f1) * .5 / binHz; const lower = Math.floor(exact); const fraction = exact - lower;
          magnitude = this._spectrumMagnitudeAt(lower) * (1 - fraction) + this._spectrumMagnitudeAt(lower + 1) * fraction;
        }
        const amplitude = magnitude * 4 / SPECTRUM_FFT_SIZE;
        const db = amplitude > 1e-9 ? Math.max(SPECTRUM_MIN_DB, Math.min(0, 20 * Math.log10(amplitude))) : SPECTRUM_MIN_DB;
        const coefficient = db > bins[i] ? .7 : .18;
        bins[i] += (db - bins[i]) * coefficient;
      }
    }

    _spectrumMagnitudeAt(bin) {
      const index = Math.max(0, Math.min(SPECTRUM_FFT_SIZE / 2 - 1, bin));
      return Math.hypot(this._spectrumReal[index], this._spectrumImag[index]);
    }

    _resetGate() {
      this._gateEnvelope = 0; this._gateGain = 0; this._gateHoldCounter = 0; this._gateState = 0;
      this._gateSvfIc1 = 0; this._gateSvfIc2 = 0; this._gateLowpassState = 0;
    }

    _prepareGate(thresholdDb, enabled) {
      if (enabled && !this._gateWasEnabled) this._resetGate();
      this._gateWasEnabled = enabled;
      if (thresholdDb !== this._gateThresholdDb) {
        this._gateThresholdDb = thresholdDb;
        this._gateOpenThreshold = 10 ** (thresholdDb / 20);
        this._gateCloseThreshold = 10 ** ((thresholdDb - 5) / 20);
        this._gateInvOpenThreshold = 1 / this._gateOpenThreshold;
      }
    }

    _processGateSample(sample) {
      const v3 = sample - this._gateSvfIc2;
      const v1 = this._gateA1 * this._gateSvfIc1 + this._gateA2 * v3;
      const v2 = this._gateSvfIc2 + this._gateA2 * this._gateSvfIc1 + this._gateA3 * v3;
      this._gateSvfIc1 = 2 * v1 - this._gateSvfIc1;
      this._gateSvfIc2 = 2 * v2 - this._gateSvfIc2;
      const highpassed = sample - this._gateK * v1 - v2;
      this._gateLowpassState += this._gateLowpassCoeff * (highpassed - this._gateLowpassState);
      const rectified = Math.abs(this._gateLowpassState);
      this._gateEnvelope += (rectified > this._gateEnvelope ? this._gateDetectorRise : this._gateDetectorFall)
        * (rectified - this._gateEnvelope);
      if (this._gateState === 0) {
        if (this._gateEnvelope >= this._gateOpenThreshold) this._gateState = 1;
      } else if (this._gateState === 1) {
        if (this._gateEnvelope < this._gateCloseThreshold) { this._gateState = 2; this._gateHoldCounter = this._gateHoldSamples; }
      } else if (this._gateEnvelope >= this._gateCloseThreshold) this._gateState = 1;
      else if (--this._gateHoldCounter <= 0) this._gateState = 0;
      let targetGain = 1;
      if (this._gateState === 0) {
        const ratio = this._gateEnvelope * this._gateInvOpenThreshold;
        targetGain = Math.max(ratio * ratio * ratio, 1e-4);
      }
      this._gateGain += (targetGain > this._gateGain ? this._gateAttack : this._gateRelease) * (targetGain - this._gateGain);
      return sample * this._gateGain;
    }

    _generateWamParameterInfo() {
      return {
        inputGain: new WamParameterInfo('inputGain', {label: 'Input Gain', defaultValue: 0,
          minValue: -48, maxValue: 24, units: 'dB'}),
        outputGain: new WamParameterInfo('outputGain', {label: 'Output Gain', defaultValue: 0,
          minValue: -24, maxValue: 12, units: 'dB'}),
        noise: new WamParameterInfo('noise', {label: 'Noise Gate', defaultValue: -80,
          minValue: -100, maxValue: 0, units: 'dB'}),
        noiseEnabled: new WamParameterInfo('noiseEnabled', {type:'boolean', label:'Noise Gate Enabled', defaultValue:0}),
        bass: new WamParameterInfo('bass', {label:'Bass', defaultValue:5, minValue:0, maxValue:10}),
        middle: new WamParameterInfo('middle', {label:'Middle', defaultValue:5, minValue:0, maxValue:10}),
        treble: new WamParameterInfo('treble', {label:'Treble', defaultValue:5, minValue:0, maxValue:10}),
        toneEnabled: new WamParameterInfo('toneEnabled', {type:'boolean', label:'Tone Stack Enabled', defaultValue:1}),
        eqEnabled: new WamParameterInfo('eqEnabled', {type:'boolean', label:'Parametric EQ Enabled', defaultValue:1}),
        eqPre: new WamParameterInfo('eqPre', {type:'boolean', label:'Parametric EQ Pre NAM', defaultValue:0}),
        eq1Freq:new WamParameterInfo('eq1Freq',{label:'EQ Low Shelf Frequency',defaultValue:100,minValue:20,maxValue:20000,units:'Hz'}),
        eq1Gain:new WamParameterInfo('eq1Gain',{label:'EQ Low Shelf Gain',defaultValue:0,minValue:-15,maxValue:15,units:'dB'}),
        eq1Q:new WamParameterInfo('eq1Q',{label:'EQ Low Shelf Q',defaultValue:.71,minValue:.1,maxValue:10}),
        eq2Freq:new WamParameterInfo('eq2Freq',{label:'EQ Mud Frequency',defaultValue:250,minValue:20,maxValue:20000,units:'Hz'}),
        eq2Gain:new WamParameterInfo('eq2Gain',{label:'EQ Mud Gain',defaultValue:0,minValue:-15,maxValue:15,units:'dB'}),
        eq2Q:new WamParameterInfo('eq2Q',{label:'EQ Mud Q',defaultValue:1,minValue:.1,maxValue:10}),
        eq3Freq:new WamParameterInfo('eq3Freq',{label:'EQ Box Frequency',defaultValue:650,minValue:20,maxValue:20000,units:'Hz'}),
        eq3Gain:new WamParameterInfo('eq3Gain',{label:'EQ Box Gain',defaultValue:0,minValue:-15,maxValue:15,units:'dB'}),
        eq3Q:new WamParameterInfo('eq3Q',{label:'EQ Box Q',defaultValue:1,minValue:.1,maxValue:10}),
        eq4Freq:new WamParameterInfo('eq4Freq',{label:'EQ Presence Frequency',defaultValue:1600,minValue:20,maxValue:20000,units:'Hz'}),
        eq4Gain:new WamParameterInfo('eq4Gain',{label:'EQ Presence Gain',defaultValue:0,minValue:-15,maxValue:15,units:'dB'}),
        eq4Q:new WamParameterInfo('eq4Q',{label:'EQ Presence Q',defaultValue:1,minValue:.1,maxValue:10}),
        eq5Freq:new WamParameterInfo('eq5Freq',{label:'EQ Bite Frequency',defaultValue:3500,minValue:20,maxValue:20000,units:'Hz'}),
        eq5Gain:new WamParameterInfo('eq5Gain',{label:'EQ Bite Gain',defaultValue:0,minValue:-15,maxValue:15,units:'dB'}),
        eq5Q:new WamParameterInfo('eq5Q',{label:'EQ Bite Q',defaultValue:1.4,minValue:.1,maxValue:10}),
        eq6Freq:new WamParameterInfo('eq6Freq',{label:'EQ High Shelf Frequency',defaultValue:8000,minValue:20,maxValue:20000,units:'Hz'}),
        eq6Gain:new WamParameterInfo('eq6Gain',{label:'EQ High Shelf Gain',defaultValue:0,minValue:-15,maxValue:15,units:'dB'}),
        eq6Q:new WamParameterInfo('eq6Q',{label:'EQ High Shelf Q',defaultValue:.71,minValue:.1,maxValue:10}),
        bypass: new WamParameterInfo('bypass', {type: 'boolean', label: 'Bypass', defaultValue: 0}),
      };
    }

    _initialize() {
      super._initialize();
      const noop = () => 0;
      const imports = {env: {emscripten_notify_memory_growth: noop}, wasi_snapshot_preview1: {
        fd_seek: noop, fd_write: noop, fd_read: noop, fd_close: noop,
        environ_sizes_get: noop, environ_get: noop,
      }};
      this._wasmInstance = new WebAssembly.Instance(this._wasmModule, imports);
      this._wasmExports = this._wasmInstance.exports;
      this._wasmMemory = this._wasmExports.memory;
      this._wasmExports._initialize();
    }

    async _onMessage(message) {
      const data = message.data;
      if (!data.namRequest) {
        await super._onMessage(message);
        return;
      }
      const response = {namResponse: data.namRequest, requestId: data.requestId, ok: false};
      try {
        if (data.namRequest === 'load') response.content = this._loadModel(data.modelData, data.name, data.variant, data.compensationDb);
        else if (data.namRequest === 'variant') response.content = this._setVariant(data.variant);
        else if (data.namRequest === 'normalization') response.content = this._setNormalization(data.compensationDb);
        else if (data.namRequest === 'calibrate') response.content = this._calibrateLevel();
        else if (data.namRequest === 'spectrum/enabled') response.content = this._setSpectrumEnabled(data.enabled);
        else if (data.namRequest === 'diagnostic/start') {
          this._diagnosticEnabled = true;
          this._diagnosticCount = this._diagnosticWrite = this._namCalls = this._namFailures = 0;
          response.content = true;
        } else if (data.namRequest === 'diagnostic/stop') response.content = this._stopDiagnostic();
        else if (data.namRequest === 'diagnostic/passthrough') {
          this._diagnosticPassThrough = !!data.enabled;
          response.content = this._diagnosticPassThrough;
        }
        else if (data.namRequest === 'status') response.content = {
          ready: this._ready, loading: this._loading, namCalls: this._namCalls,
          namFailures: this._namFailures, initialized: this._initialized,
          memoryBytes: this._wasmMemory.buffer.byteLength,
        };
        response.ok = true;
      } catch (error) {
        this._ready = this._namHandle !== 0;
        this._loading = false;
        response.error = String(error && error.message ? error.message : error);
      }
      this.port.postMessage(response);
    }

    _readCString(pointer) {
      const bytes = new Uint8Array(this._wasmMemory.buffer);
      let end = pointer;
      while (bytes[end] !== 0) ++end;
      if (this._decoder) return this._decoder.decode(bytes.subarray(pointer, end));
      let text = '';
      for (let i = pointer; i < end; ++i) text += String.fromCharCode(bytes[i]);
      return text;
    }

    _variantValue(variant) { return variant === 'lite' ? 0 : 1; }

    _setVariant(variant) {
      const normalized = variant === 'lite' ? 'lite' : 'full';
      if (!this._namHandle) return {applied: false, variant: normalized};
      const applied = Boolean(this._wasmExports.nam_set_slimmable_size(this._namHandle, this._variantValue(normalized)));
      return {applied, variant: normalized};
    }

    _setNormalization(compensationDb, immediate = false) {
      const value = Number.isFinite(Number(compensationDb)) ? Math.max(-12, Math.min(12, Number(compensationDb))) : 0;
      this._normalizationTarget = 10 ** (value / 20);
      if (immediate) this._normalizationCurrent = this._normalizationTarget;
      return {compensationDb:value,gain:this._normalizationTarget};
    }

    _calibrateLevel() {
      if (!this._namHandle || !this._ready) throw new Error('Load a NAM model before calibrating its level');
      const totalFrames = CALIBRATION_WARMUP_FRAMES + CALIBRATION_MEASURE_FRAMES;
      let outputSquares = 0;
      let outputPeak = 0;
      let measuredFrames = 0;
      this._loading = true;
      try {
        if (!this._wasmExports.nam_reset(this._namHandle)) throw new Error('Could not reset NAM before level calibration');
        for (let offset = 0; offset < totalFrames; offset += QUANTUM) {
          const frames = Math.min(QUANTUM, totalFrames - offset);
          for (let i = 0; i < frames; ++i) {
            const sampleIndex = offset + i;
            this._wasmInput[i] = CALIBRATION_PROBE_PEAK
              * Math.sin(2 * Math.PI * CALIBRATION_PROBE_FREQUENCY * sampleIndex / scope.sampleRate);
          }
          if (!this._wasmExports.nam_process(this._namHandle, this._inputPtr, this._outputPtr, frames))
            throw new Error('NAM failed while measuring its output level');
          const firstMeasured = Math.max(0, CALIBRATION_WARMUP_FRAMES - offset);
          for (let i = firstMeasured; i < frames; ++i) {
            const sample = this._wasmOutput[i];
            if (!Number.isFinite(sample)) throw new Error('NAM produced non-finite calibration output');
            outputSquares += sample * sample;
            outputPeak = Math.max(outputPeak, Math.abs(sample));
            ++measuredFrames;
          }
        }
      } finally {
        const reset = this._wasmExports.nam_reset(this._namHandle);
        this._loading = false;
        if (!reset) throw new Error('Could not reset NAM after level calibration');
      }
      const outputRms = Math.sqrt(outputSquares / Math.max(1, measuredFrames));
      if (!(outputRms > 1e-5) || !(outputPeak > 0)) throw new Error('Calibration probe produced silence');
      const outputRmsDb = 20 * Math.log10(outputRms);
      const outputPeakDb = 20 * Math.log10(outputPeak);
      const requestedDb = CALIBRATION_TARGET_RMS_DB - outputRmsDb;
      const peakLimitDb = CALIBRATION_PEAK_CEILING_DB - outputPeakDb;
      const compensationDb = Math.max(-CALIBRATION_MAX_CORRECTION_DB,
        Math.min(CALIBRATION_MAX_CORRECTION_DB, requestedDb, peakLimitDb));
      const normalization = this._setNormalization(compensationDb);
      return {version:1, mode:'measured', compensationDb:normalization.compensationDb, outputRmsDb, outputPeakDb,
        targetRmsDb:CALIBRATION_TARGET_RMS_DB, requestedDb,
        peakLimited:compensationDb < requestedDb - 1e-9, clamped:Math.abs(compensationDb - requestedDb) > 1e-9,
        probeFrames:totalFrames, probeFrequency:CALIBRATION_PROBE_FREQUENCY,
        probeInputRmsDb:20 * Math.log10(CALIBRATION_PROBE_PEAK / Math.sqrt(2))};
    }

    _loadModel(data, name, variant = 'full', compensationDb = 0) {
      this._loading = true;
      this._ready = false;
      const started = Date.now();
      const beforeMemory = this._wasmMemory.buffer.byteLength;
      const candidate = this._wasmExports.nam_create(scope.sampleRate);
      if (!candidate) throw new Error('nam_create failed');
      const dataPtr = this._wasmExports.malloc(data.byteLength);
      if (!dataPtr) {
        this._wasmExports.nam_destroy(candidate);
        throw new Error('Insufficient WASM memory');
      }
      new Uint8Array(this._wasmMemory.buffer, dataPtr, data.byteLength).set(new Uint8Array(data));
      const loaded = this._wasmExports.nam_load_model(candidate, dataPtr, data.byteLength);
      this._wasmExports.free(dataPtr);
      if (!loaded) {
        const error = this._readCString(this._wasmExports.nam_last_error(candidate));
        this._wasmExports.nam_destroy(candidate);
        throw new Error(error);
      }
      const expectedSampleRate = this._wasmExports.nam_expected_sample_rate(candidate);
      if (expectedSampleRate > 0 && Math.abs(expectedSampleRate - scope.sampleRate) > 0.5) {
        this._wasmExports.nam_destroy(candidate);
        throw new Error(`Model sample-rate mismatch: model=${expectedSampleRate} Hz, context=${scope.sampleRate} Hz`);
      }
      const normalizedVariant = variant === 'lite' ? 'lite' : 'full';
      const slimmable = Boolean(this._wasmExports.nam_set_slimmable_size(candidate, this._variantValue(normalizedVariant)));
      const old = this._namHandle;
      this._namHandle = candidate;
      this._inputPtr = this._wasmExports.nam_input_buffer(candidate);
      this._outputPtr = this._wasmExports.nam_output_buffer(candidate);
      this._wasmInput = new Float32Array(this._wasmMemory.buffer, this._inputPtr, QUANTUM);
      this._wasmOutput = new Float32Array(this._wasmMemory.buffer, this._outputPtr, QUANTUM);
      const normalization = this._setNormalization(compensationDb, true);
      if (old) this._wasmExports.nam_destroy(old);
      this._loading = false;
      this._ready = true;
      return {name, expectedSampleRate, loadMs: Date.now() - started, slimmable, variant: normalizedVariant,
        compensationDb:normalization.compensationDb,
        memoryBytes: this._wasmMemory.buffer.byteLength,
        memoryGrowthBytes: this._wasmMemory.buffer.byteLength - beforeMemory};
    }

    _stopDiagnostic() {
      this._diagnosticEnabled = false;
      const count = Math.min(this._diagnosticCount, DIAGNOSTIC_CAPACITY);
      const values = new Float64Array(count);
      for (let i = 0; i < count; ++i) values[i] = this._diagnosticTimings[i];
      values.sort();
      let sum = 0;
      let deadlineMisses = 0;
      const deadlineMs = 128000 / scope.sampleRate;
      for (let i = 0; i < count; ++i) { sum += values[i]; if (values[i] >= deadlineMs) ++deadlineMisses; }
      const percentile = (p) => count ? values[Math.floor((count - 1) * p)] : 0;
      return {samples: count, averageMs: count ? sum / count : 0, p50Ms: percentile(.5),
        p95Ms: percentile(.95), p99Ms: percentile(.99), maximumMs: count ? values[count - 1] : 0,
        deadlineMs, deadlineMisses, namCalls: this._namCalls, namFailures: this._namFailures};
    }

    _process(startSample, endSample, inputs, outputs) {
      const inputBus = inputs[0];
      const outputBus = outputs[0];
      if (!outputBus || !outputBus[0]) return;
      const output = outputBus[0];
      const left = inputBus && inputBus[0];
      const right = inputBus && inputBus[1];
      const bypass = this._parameterInterpolators.bypass.values[startSample] >= 0.5;
      const diagnosticStart = this._diagnosticEnabled ? Date.now() : 0;
      const frames = endSample - startSample;
      let inputPeak = 0;
      let inputSquares = 0;
      let outputPeak = 0;
      let outputSquares = 0;
      let inputClip = false;
      let outputClip = false;
      if (!left) {
        for (let i = startSample; i < endSample; ++i) { output[i] = 0; this._captureSpectrumPair(0, 0); this._captureSpectrumFinal(0); }
      } else if (this._diagnosticPassThrough || bypass || this._loading) {
        for (let i = startSample; i < endSample; ++i) {
          const sample = right ? 0.5 * (left[i] + right[i]) : left[i];
          const absolute = Math.abs(sample);
          if (absolute > inputPeak) inputPeak = absolute;
          if (absolute > outputPeak) outputPeak = absolute;
          if (absolute >= 1) inputClip = outputClip = true;
          inputSquares += sample * sample;
          outputSquares += sample * sample;
          output[i] = sample;
          this._captureSpectrumPair(sample, sample);
          this._captureSpectrumFinal(sample);
        }
      } else {
        const parameters = this._parameterInterpolators;
        const inputGain = parameters.inputGain;
        const outputGain = parameters.outputGain;
        const inputConstant = inputGain.done;
        const outputConstant = outputGain.done;
        const inputLinear = inputConstant ? 10 ** (inputGain.values[startSample] / 20) : 0;
        const outputLinear = outputConstant ? 10 ** (outputGain.values[startSample] / 20) : 0;
        const gateEnabled = parameters.noiseEnabled.values[startSample] >= .5;
        this._prepareGate(parameters.noise.values[startSample], gateEnabled);
        const eqPosition = this._updateEqFilters(parameters, startSample);
        const eqEnabled = eqPosition !== 0;
        const eqIsPre = parameters.eqPre.values[startSample] >= .5;
        const toneEnabled = this._updateToneFilters(parameters, startSample);
        for (let i = 0; i < frames; ++i) {
          const n = startSample + i;
          const sample = right ? 0.5 * (left[n] + right[n]) : left[n];
          const gain = inputConstant ? inputLinear : 10 ** (inputGain.values[n] / 20);
          const meteredInput = sample * gain;
          const absolute = Math.abs(meteredInput);
          if (absolute > inputPeak) inputPeak = absolute;
          if (absolute >= 1) inputClip = true;
          inputSquares += meteredInput * meteredInput;
          const eqInput = gateEnabled ? this._processGateSample(meteredInput) : meteredInput;
          let processedInput = eqInput;
          if (eqIsPre) {
            if (eqEnabled) processedInput = this._processEqSample(processedInput);
            this._captureSpectrumPair(eqInput, processedInput);
          }
          if (this._ready) this._wasmInput[i] = processedInput;
          else output[n] = processedInput;
        }
        const ok = !this._ready || this._wasmExports.nam_process(this._namHandle, this._inputPtr, this._outputPtr, frames);
        if (this._ready) ++this._namCalls;
        if (!ok) {
          ++this._namFailures;
          for (let n = startSample; n < endSample; ++n) {
            output[n] = 0;
            if (!eqIsPre) this._captureSpectrumPair(0, 0);
            this._captureSpectrumFinal(0);
          }
        } else {
          for (let i = 0; i < frames; ++i) {
            const n = startSample + i;
            const gain = outputConstant ? outputLinear : 10 ** (outputGain.values[n] / 20);
            this._normalizationCurrent += (this._normalizationTarget - this._normalizationCurrent) * 0.005;
            let processedOutput = this._ready ? this._wasmOutput[i] * this._normalizationCurrent : output[n];
            if (!eqIsPre) {
              const eqInput = processedOutput;
              if (eqEnabled) processedOutput = this._processEqSample(processedOutput);
              this._captureSpectrumPair(eqInput, processedOutput);
            }
            if (toneEnabled) processedOutput = this._processToneSample(processedOutput);
            const meteredOutput = processedOutput * gain;
            const absolute = Math.abs(meteredOutput);
            if (absolute > outputPeak) outputPeak = absolute;
            if (absolute >= 1) outputClip = true;
            outputSquares += meteredOutput * meteredOutput;
            output[n] = meteredOutput;
            this._captureSpectrumFinal(meteredOutput);
          }
        }
      }
      this._flushSpectrum(frames);
      this._meterFrames += frames;
      if (inputPeak > this._meterInputPeak) this._meterInputPeak = inputPeak;
      if (outputPeak > this._meterOutputPeak) this._meterOutputPeak = outputPeak;
      this._meterInputSquares += inputSquares;
      this._meterOutputSquares += outputSquares;
      if (inputClip) this._meterInputClip = true;
      if (outputClip) this._meterOutputClip = true;
      if (this._meterFrames >= this._meterReportFrames) {
        this._meterMessage.inputPeak = this._meterInputPeak;
        this._meterMessage.inputRms = Math.sqrt(this._meterInputSquares / this._meterFrames);
        this._meterMessage.outputPeak = this._meterOutputPeak;
        this._meterMessage.outputRms = Math.sqrt(this._meterOutputSquares / this._meterFrames);
        this._meterMessage.inputClip = this._meterInputClip;
        this._meterMessage.outputClip = this._meterOutputClip;
        this.port.postMessage(this._meterMessage);
        this._meterFrames = 0;
        this._meterInputPeak = 0;
        this._meterInputSquares = 0;
        this._meterOutputPeak = 0;
        this._meterOutputSquares = 0;
        this._meterInputClip = false;
        this._meterOutputClip = false;
      }
      if (this._diagnosticEnabled) {
        this._diagnosticTimings[this._diagnosticWrite] = Date.now() - diagnosticStart;
        this._diagnosticWrite = (this._diagnosticWrite + 1) & (DIAGNOSTIC_CAPACITY - 1);
        if (this._diagnosticCount < DIAGNOSTIC_CAPACITY) ++this._diagnosticCount;
      }
    }

    destroy() {
      if (this._namHandle) this._wasmExports.nam_destroy(this._namHandle);
      this._namHandle = 0;
      super.destroy();
    }
  }

  scope.registerProcessor(moduleId, NamProcessor);
  return NamProcessor;
};

export default getNamProcessor;
