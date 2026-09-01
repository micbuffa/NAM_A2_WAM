const getNamProcessor = (moduleId) => {
  const scope = globalThis;
  const ModuleScope = scope.webAudioModules.getModuleScope(moduleId);
  const {WamProcessor, WamParameterInfo} = ModuleScope;
  const QUANTUM = 128;
  const DIAGNOSTIC_CAPACITY = 16384;

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
    }

    _generateWamParameterInfo() {
      return {
        inputGain: new WamParameterInfo('inputGain', {label: 'Input Gain', defaultValue: 0,
          minValue: -48, maxValue: 24, units: 'dB'}),
        outputGain: new WamParameterInfo('outputGain', {label: 'Output Gain', defaultValue: 0,
          minValue: -24, maxValue: 12, units: 'dB'}),
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
        if (data.namRequest === 'load') response.content = this._loadModel(data.modelData, data.name);
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

    _loadModel(data, name) {
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
      const old = this._namHandle;
      this._namHandle = candidate;
      this._inputPtr = this._wasmExports.nam_input_buffer(candidate);
      this._outputPtr = this._wasmExports.nam_output_buffer(candidate);
      this._wasmInput = new Float32Array(this._wasmMemory.buffer, this._inputPtr, QUANTUM);
      this._wasmOutput = new Float32Array(this._wasmMemory.buffer, this._outputPtr, QUANTUM);
      if (old) this._wasmExports.nam_destroy(old);
      this._loading = false;
      this._ready = true;
      return {name, expectedSampleRate, loadMs: Date.now() - started,
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
        for (let i = startSample; i < endSample; ++i) output[i] = 0;
      } else if (this._diagnosticPassThrough || bypass || !this._ready || this._loading) {
        for (let i = startSample; i < endSample; ++i) {
          const sample = right ? 0.5 * (left[i] + right[i]) : left[i];
          const absolute = Math.abs(sample);
          if (absolute > inputPeak) inputPeak = absolute;
          if (absolute > outputPeak) outputPeak = absolute;
          if (absolute >= 1) inputClip = outputClip = true;
          inputSquares += sample * sample;
          outputSquares += sample * sample;
          output[i] = sample;
        }
      } else {
        const inputGain = this._parameterInterpolators.inputGain;
        const outputGain = this._parameterInterpolators.outputGain;
        const inputConstant = inputGain.done;
        const outputConstant = outputGain.done;
        const inputLinear = inputConstant ? 10 ** (inputGain.values[startSample] / 20) : 0;
        const outputLinear = outputConstant ? 10 ** (outputGain.values[startSample] / 20) : 0;
        for (let i = 0; i < frames; ++i) {
          const n = startSample + i;
          const sample = right ? 0.5 * (left[n] + right[n]) : left[n];
          const gain = inputConstant ? inputLinear : 10 ** (inputGain.values[n] / 20);
          const meteredInput = sample * gain;
          const absolute = Math.abs(meteredInput);
          if (absolute > inputPeak) inputPeak = absolute;
          if (absolute >= 1) inputClip = true;
          inputSquares += meteredInput * meteredInput;
          this._wasmInput[i] = meteredInput;
        }
        const ok = this._wasmExports.nam_process(this._namHandle, this._inputPtr, this._outputPtr, frames);
        ++this._namCalls;
        if (!ok) {
          ++this._namFailures;
          for (let n = startSample; n < endSample; ++n) output[n] = 0;
        } else {
          for (let i = 0; i < frames; ++i) {
            const n = startSample + i;
            const gain = outputConstant ? outputLinear : 10 ** (outputGain.values[n] / 20);
            const meteredOutput = this._wasmOutput[i] * gain;
            const absolute = Math.abs(meteredOutput);
            if (absolute > outputPeak) outputPeak = absolute;
            if (absolute >= 1) outputClip = true;
            outputSquares += meteredOutput * meteredOutput;
            output[n] = meteredOutput;
          }
        }
      }
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
