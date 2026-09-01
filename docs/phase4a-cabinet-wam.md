# Phase 4a Cabinet WAM

## Architecture decision

Production is `source -> NAM A2 WAM -> Cabinet WAM -> AudioContext.destination`. The Cabinet WAM owns exactly one `AudioWorkletNode`; its processor calls a C ABI wrapper around pinned NeuralAmpModelerCore `nam::Linear` compiled into the existing WASM module. `ConvolverNode` is used only by automated reference validation.

The pinned Core revision is `2563c0fd4cb1f9ce457d89a761738ea15097e1f3`. Its `nam::Linear` supports direct and zero-latency partitioned FFT convolution. Phase 4a explicitly requests FFT. The tuned plan uses a 64-sample direct head for IRs up to 240,000 taps, power-of-two FFT tiers, staggered jobs, and output rings. Construction/Reset creates vectors, kernel spectra, rings, and FFT plans. The steady-state `process()` path performs no explicit allocation, logging, locking, or messaging.

## Official plugin cross-check

Reference NeuralAmpModelerPlugin revision `16be869746b8915885c7a35bafdcc0061faeb50e` (AudioDSPTools submodule `e19ef4b5b3bf2171c431847563acde29eedf85c0`, Core submodule `9c7b185de346fe0725dea537bcee4bc38b5bb6d6`) includes `AudioDSPTools/dsp/ImpulseResponse.h`, constructs `dsp::ImpulseResponse`, and calls `mIR->Process()` at `NeuralAmpModeler.cpp:374-376`. Thus its cabinet implementation is plugin-specific AudioDSPTools code, not Core `nam::Linear`.

That legacy implementation resamples cubically at load, truncates to 8,192 taps, applies -18 dB gain, and performs an Eigen dot product for every output sample: direct O(N) convolution. It is unsuitable here because the supplied files contain 32,256–36,864 frames before resampling and would be truncated, while long direct convolution is inappropriate for a browser audio callback.

Core `nam::Linear` is sufficiently generic and separable. WASM compilation needs Core `linear.cpp`, `dsp.cpp`/Buffer support, Eigen headers including `unsupported/Eigen/FFT`, and the existing exception/SIMD build settings. WAV decoding and 44.1-to-48 kHz conversion occur once on the main thread through `decodeAudioData`; mono Float32 coefficients are then transferred to the worklet and copied into Core during load. The coefficients are not normalized or silently attenuated.

## Validation

Native deterministic impulse comparison against direct convolution (4,096-tap synthetic IR): maximum error `3.72529e-9`, RMS error `4.73602e-10`. Native Cabinet-only mean for 4,000 128-frame quanta was `0.0139966 ms` (not a browser timing).

Chrome 151, 48 kHz, 128 frames, supplied `TWIN REVERB __ CLEAN.wav` decoded to 35,108 samples:

| Measurement | Quanta | Average | p95 | Maximum | Failures | Deadline misses |
|---|---:|---:|---:|---:|---:|---:|
| NAM A2-Full in serial NAM→Cabinet graph | 4,040 | 0.3802 ms | 1 ms | 1 ms | 0 | 0 |
| Cabinet WAM in same simultaneous window | 4,038 | 0.1127 ms | 1 ms | 1 ms | 0 | 0 |

The sum of separately measured average node costs is approximately `0.4929 ms`, 18.5% of the 2.6667 ms quantum deadline. `Date.now()` has millisecond resolution, so maxima cannot be summed as a correlated end-to-end callback measurement. Both processors reported zero failures and zero individual deadline misses.

The browser `ConvolverNode` oracle used `normalize=false` and the same decoded IR. Against direct convolution of a deterministic 512-sample signal, the first 4,096 output samples differed by maximum `3.10894e-8`, RMS `3.95177e-9`. Core's native impulse result and ConvolverNode independently agree with direct convolution to floating-point tolerance. The supplied IR loaded completely in Core after browser resampling; it was not truncated.

All 22 Node automated tests pass, including all pre-existing Phase 3 tests and new single-worklet/steady-state/graph contract tests. Both native and WASM builds pass.
