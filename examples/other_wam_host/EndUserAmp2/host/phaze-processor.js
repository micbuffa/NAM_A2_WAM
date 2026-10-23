"use strict";

// ============================================================================
// Inline FFT implementation (Cooley-Tukey radix-2)
// Inspired by fft.js by @nicedoc — no external dependency needed
// ============================================================================

class FFT {
    constructor(size) {
        this.size = size;
        this.halfSize = size / 2;

        // Precompute bit-reversal table
        this._bitRevTable = new Uint32Array(size);
        const bits = Math.log2(size) | 0;
        for (let i = 0; i < size; i++) {
            let reversed = 0;
            let val = i;
            for (let b = 0; b < bits; b++) {
                reversed = (reversed << 1) | (val & 1);
                val >>= 1;
            }
            this._bitRevTable[i] = reversed;
        }

        // Precompute twiddle factors
        this._cosTable = new Float64Array(this.halfSize);
        this._sinTable = new Float64Array(this.halfSize);
        for (let i = 0; i < this.halfSize; i++) {
            this._cosTable[i] = Math.cos(-2 * Math.PI * i / size);
            this._sinTable[i] = Math.sin(-2 * Math.PI * i / size);
        }
    }

    createComplexArray() {
        return new Float64Array(this.size * 2);
    }

    /**
     * Real-valued forward transform.
     * Input: real[size], Output: complex[size*2] (interleaved real/imag)
     */
    realTransform(out, input) {
        const n = this.size;

        // Copy input with bit-reversal into complex array
        for (let i = 0; i < n; i++) {
            const j = this._bitRevTable[i];
            out[j * 2] = input[i];
            out[j * 2 + 1] = 0;
        }

        // Butterfly passes
        for (let len = 2; len <= n; len *= 2) {
            const halfLen = len / 2;
            const step = n / len;
            for (let i = 0; i < n; i += len) {
                for (let j = 0; j < halfLen; j++) {
                    const tIdx = j * step;
                    const cos = this._cosTable[tIdx];
                    const sin = this._sinTable[tIdx];

                    const eRe = out[(i + j) * 2];
                    const eIm = out[(i + j) * 2 + 1];
                    const oRe = out[(i + j + halfLen) * 2];
                    const oIm = out[(i + j + halfLen) * 2 + 1];

                    const tRe = cos * oRe - sin * oIm;
                    const tIm = cos * oIm + sin * oRe;

                    out[(i + j) * 2] = eRe + tRe;
                    out[(i + j) * 2 + 1] = eIm + tIm;
                    out[(i + j + halfLen) * 2] = eRe - tRe;
                    out[(i + j + halfLen) * 2 + 1] = eIm - tIm;
                }
            }
        }
    }

    /**
     * Inverse transform.
     * Input: complex[size*2], Output: complex[size*2]
     */
    inverseTransform(out, input) {
        const n = this.size;

        // Copy with bit-reversal, swapping real/imag for inverse
        for (let i = 0; i < n; i++) {
            const j = this._bitRevTable[i];
            out[j * 2] = input[i * 2];
            out[j * 2 + 1] = input[i * 2 + 1];
        }

        // Butterfly passes (conjugate twiddles for inverse)
        for (let len = 2; len <= n; len *= 2) {
            const halfLen = len / 2;
            const step = n / len;
            for (let i = 0; i < n; i += len) {
                for (let j = 0; j < halfLen; j++) {
                    const tIdx = j * step;
                    const cos = this._cosTable[tIdx];
                    const sin = -this._sinTable[tIdx]; // conjugate for inverse

                    const eRe = out[(i + j) * 2];
                    const eIm = out[(i + j) * 2 + 1];
                    const oRe = out[(i + j + halfLen) * 2];
                    const oIm = out[(i + j + halfLen) * 2 + 1];

                    const tRe = cos * oRe - sin * oIm;
                    const tIm = cos * oIm + sin * oRe;

                    out[(i + j) * 2] = eRe + tRe;
                    out[(i + j) * 2 + 1] = eIm + tIm;
                    out[(i + j + halfLen) * 2] = eRe - tRe;
                    out[(i + j + halfLen) * 2 + 1] = eIm - tIm;
                }
            }
        }

        // Normalize
        const invN = 1 / n;
        for (let i = 0; i < n * 2; i++) {
            out[i] *= invN;
        }
    }

    /**
     * Extract real part from interleaved complex array
     */
    fromComplexArray(complex, output) {
        for (let i = 0; i < this.size; i++) {
            output[i] = complex[i * 2];
        }
    }

    /**
     * Complete the spectrum using Hermitian symmetry (for real signals)
     */
    completeSpectrum(complex) {
        const n = this.size;
        for (let i = 1; i < n / 2; i++) {
            complex[(n - i) * 2] = complex[i * 2];
            complex[(n - i) * 2 + 1] = -complex[i * 2 + 1];
        }
    }
}

// ============================================================================
// OLA (Overlap-Add) Processor Base Class
// Adapted from olvb/phaze — handles buffering and overlap-add framework
// ============================================================================

const WEBAUDIO_BLOCK_SIZE = 128;

class OLAProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);

        this.nbInputs = options.numberOfInputs;
        this.nbOutputs = options.numberOfOutputs;

        this.blockSize = options.processorOptions.blockSize;
        this.hopSize = WEBAUDIO_BLOCK_SIZE;
        this.nbOverlaps = this.blockSize / this.hopSize;

        // Pre-allocate input buffers
        this.inputBuffers = new Array(this.nbInputs);
        this.inputBuffersHead = new Array(this.nbInputs);
        this.inputBuffersToSend = new Array(this.nbInputs);
        for (let i = 0; i < this.nbInputs; i++) {
            this.allocateInputChannels(i, 1);
        }

        // Pre-allocate output buffers
        this.outputBuffers = new Array(this.nbOutputs);
        this.outputBuffersToRetrieve = new Array(this.nbOutputs);
        for (let i = 0; i < this.nbOutputs; i++) {
            this.allocateOutputChannels(i, 1);
        }
    }

    reallocateChannelsIfNeeded(inputs, outputs) {
        for (let i = 0; i < this.nbInputs; i++) {
            let nbChannels = inputs[i].length;
            if (nbChannels !== this.inputBuffers[i].length) {
                this.allocateInputChannels(i, nbChannels);
            }
        }
        for (let i = 0; i < this.nbOutputs; i++) {
            let nbChannels = outputs[i].length;
            if (nbChannels !== this.outputBuffers[i].length) {
                this.allocateOutputChannels(i, nbChannels);
            }
        }
    }

    allocateInputChannels(inputIndex, nbChannels) {
        this.inputBuffers[inputIndex] = new Array(nbChannels);
        for (let i = 0; i < nbChannels; i++) {
            this.inputBuffers[inputIndex][i] = new Float32Array(this.blockSize + WEBAUDIO_BLOCK_SIZE);
            this.inputBuffers[inputIndex][i].fill(0);
        }
        this.inputBuffersHead[inputIndex] = new Array(nbChannels);
        this.inputBuffersToSend[inputIndex] = new Array(nbChannels);
        for (let i = 0; i < nbChannels; i++) {
            this.inputBuffersHead[inputIndex][i] = this.inputBuffers[inputIndex][i].subarray(0, this.blockSize);
            this.inputBuffersToSend[inputIndex][i] = new Float32Array(this.blockSize);
        }
    }

    allocateOutputChannels(outputIndex, nbChannels) {
        this.outputBuffers[outputIndex] = new Array(nbChannels);
        for (let i = 0; i < nbChannels; i++) {
            this.outputBuffers[outputIndex][i] = new Float32Array(this.blockSize);
            this.outputBuffers[outputIndex][i].fill(0);
        }
        this.outputBuffersToRetrieve[outputIndex] = new Array(nbChannels);
        for (let i = 0; i < nbChannels; i++) {
            this.outputBuffersToRetrieve[outputIndex][i] = new Float32Array(this.blockSize);
            this.outputBuffersToRetrieve[outputIndex][i].fill(0);
        }
    }

    readInputs(inputs) {
        if (inputs[0].length && inputs[0][0].length === 0) {
            for (let i = 0; i < this.nbInputs; i++) {
                for (let j = 0; j < this.inputBuffers[i].length; j++) {
                    this.inputBuffers[i][j].fill(0, this.blockSize);
                }
            }
            return;
        }
        for (let i = 0; i < this.nbInputs; i++) {
            for (let j = 0; j < this.inputBuffers[i].length; j++) {
                let webAudioBlock = inputs[i][j];
                this.inputBuffers[i][j].set(webAudioBlock, this.blockSize);
            }
        }
    }

    writeOutputs(outputs) {
        for (let i = 0; i < this.nbInputs; i++) {
            for (let j = 0; j < this.inputBuffers[i].length; j++) {
                let webAudioBlock = this.outputBuffers[i][j].subarray(0, WEBAUDIO_BLOCK_SIZE);
                outputs[i][j].set(webAudioBlock);
            }
        }
    }

    shiftInputBuffers() {
        for (let i = 0; i < this.nbInputs; i++) {
            for (let j = 0; j < this.inputBuffers[i].length; j++) {
                this.inputBuffers[i][j].copyWithin(0, WEBAUDIO_BLOCK_SIZE);
            }
        }
    }

    shiftOutputBuffers() {
        for (let i = 0; i < this.nbOutputs; i++) {
            for (let j = 0; j < this.outputBuffers[i].length; j++) {
                this.outputBuffers[i][j].copyWithin(0, WEBAUDIO_BLOCK_SIZE);
                this.outputBuffers[i][j].subarray(this.blockSize - WEBAUDIO_BLOCK_SIZE).fill(0);
            }
        }
    }

    prepareInputBuffersToSend() {
        for (let i = 0; i < this.nbInputs; i++) {
            for (let j = 0; j < this.inputBuffers[i].length; j++) {
                this.inputBuffersToSend[i][j].set(this.inputBuffersHead[i][j]);
            }
        }
    }

    handleOutputBuffersToRetrieve() {
        for (let i = 0; i < this.nbOutputs; i++) {
            for (let j = 0; j < this.outputBuffers[i].length; j++) {
                for (let k = 0; k < this.blockSize; k++) {
                    this.outputBuffers[i][j][k] += this.outputBuffersToRetrieve[i][j][k] / this.nbOverlaps;
                }
            }
        }
    }

    process(inputs, outputs, params) {
        this.reallocateChannelsIfNeeded(inputs, outputs);
        this.readInputs(inputs);
        this.shiftInputBuffers();
        this.prepareInputBuffersToSend();
        this.processOLA(this.inputBuffersToSend, this.outputBuffersToRetrieve, params);
        this.handleOutputBuffersToRetrieve();
        this.writeOutputs(outputs);
        this.shiftOutputBuffers();
        return true;
    }

    processOLA(inputs, outputs, params) {
        // To be overridden by subclass
    }
}

// ============================================================================
// Phase Vocoder Processor
// Extends OLA with FFT-based pitch shifting (adapted from olvb/phaze)
// Used for time stretching: play source at different speed, pitch-correct here
// ============================================================================

const BUFFERED_BLOCK_SIZE = 2048;

function genHannWindow(length) {
    let win = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / length));
    }
    return win;
}

class PhaseVocoderProcessor extends OLAProcessor {
    static get parameterDescriptors() {
        return [{
            name: 'pitchFactor',
            defaultValue: 1.0,
            minValue: 0.5,
            maxValue: 2.0
        }];
    }

    constructor(options) {
        options.processorOptions = {
            blockSize: BUFFERED_BLOCK_SIZE,
        };
        super(options);

        this.fftSize = this.blockSize;
        this.timeCursor = 0;

        this.hannWindow = genHannWindow(this.blockSize);

        // Prepare FFT and pre-allocate buffers
        this.fft = new FFT(this.fftSize);
        this.freqComplexBuffer = this.fft.createComplexArray();
        this.freqComplexBufferShifted = this.fft.createComplexArray();
        this.timeComplexBuffer = this.fft.createComplexArray();
        this.magnitudes = new Float32Array(this.fftSize / 2 + 1);
        this.peakIndexes = new Int32Array(this.magnitudes.length);
        this.nbPeaks = 0;
    }

    processOLA(inputs, outputs, parameters) {
        // No automation, take last value
        const pitchFactor = parameters.pitchFactor[parameters.pitchFactor.length - 1];

        for (let i = 0; i < this.nbInputs; i++) {
            for (let j = 0; j < inputs[i].length; j++) {
                var input = inputs[i][j];
                var output = outputs[i][j];

                this.applyHannWindow(input);

                this.fft.realTransform(this.freqComplexBuffer, input);

                this.computeMagnitudes();
                this.findPeaks();
                this.shiftPeaks(pitchFactor);

                this.fft.completeSpectrum(this.freqComplexBufferShifted);
                this.fft.inverseTransform(this.timeComplexBuffer, this.freqComplexBufferShifted);
                this.fft.fromComplexArray(this.timeComplexBuffer, output);

                this.applyHannWindow(output);
            }
        }

        this.timeCursor += this.hopSize;
    }

    /** Apply Hann window in-place */
    applyHannWindow(input) {
        for (let i = 0; i < this.blockSize; i++) {
            input[i] = input[i] * this.hannWindow[i];
        }
    }

    /** Compute squared magnitudes for peak finding */
    computeMagnitudes() {
        let i = 0, j = 0;
        while (i < this.magnitudes.length) {
            let real = this.freqComplexBuffer[j];
            let imag = this.freqComplexBuffer[j + 1];
            this.magnitudes[i] = real ** 2 + imag ** 2;
            i += 1;
            j += 2;
        }
    }

    /** Find peaks in spectrum magnitudes */
    findPeaks() {
        this.nbPeaks = 0;
        let i = 2;
        let end = this.magnitudes.length - 2;

        while (i < end) {
            let mag = this.magnitudes[i];

            if (this.magnitudes[i - 1] >= mag || this.magnitudes[i - 2] >= mag) {
                i++;
                continue;
            }
            if (this.magnitudes[i + 1] >= mag || this.magnitudes[i + 2] >= mag) {
                i++;
                continue;
            }

            this.peakIndexes[this.nbPeaks] = i;
            this.nbPeaks++;
            i += 2;
        }
    }

    /** Shift peaks and regions of influence by pitchFactor into new spectrum */
    shiftPeaks(pitchFactor) {
        // Zero-fill new spectrum
        this.freqComplexBufferShifted.fill(0);

        for (let i = 0; i < this.nbPeaks; i++) {
            let peakIndex = this.peakIndexes[i];
            let peakIndexShifted = Math.round(peakIndex * pitchFactor);

            if (peakIndexShifted > this.magnitudes.length) {
                break;
            }

            // Find region of influence
            let startIndex = 0;
            let endIndex = this.fftSize;
            if (i > 0) {
                let peakIndexBefore = this.peakIndexes[i - 1];
                startIndex = peakIndex - Math.floor((peakIndex - peakIndexBefore) / 2);
            }
            if (i < this.nbPeaks - 1) {
                let peakIndexAfter = this.peakIndexes[i + 1];
                endIndex = peakIndex + Math.ceil((peakIndexAfter - peakIndex) / 2);
            }

            // Shift whole region of influence around peak to shifted peak
            let startOffset = startIndex - peakIndex;
            let endOffset = endIndex - peakIndex;
            for (let j = startOffset; j < endOffset; j++) {
                let binIndex = peakIndex + j;
                let binIndexShifted = peakIndexShifted + j;

                if (binIndexShifted >= this.magnitudes.length) {
                    break;
                }

                // Apply phase correction
                let omegaDelta = 2 * Math.PI * (binIndexShifted - binIndex) / this.fftSize;
                let phaseShiftReal = Math.cos(omegaDelta * this.timeCursor);
                let phaseShiftImag = Math.sin(omegaDelta * this.timeCursor);

                let indexReal = binIndex * 2;
                let indexImag = indexReal + 1;
                let valueReal = this.freqComplexBuffer[indexReal];
                let valueImag = this.freqComplexBuffer[indexImag];

                let valueShiftedReal = valueReal * phaseShiftReal - valueImag * phaseShiftImag;
                let valueShiftedImag = valueReal * phaseShiftImag + valueImag * phaseShiftReal;

                let indexShiftedReal = binIndexShifted * 2;
                let indexShiftedImag = indexShiftedReal + 1;
                this.freqComplexBufferShifted[indexShiftedReal] += valueShiftedReal;
                this.freqComplexBufferShifted[indexShiftedImag] += valueShiftedImag;
            }
        }
    }
}

registerProcessor("phase-vocoder-processor", PhaseVocoderProcessor);
