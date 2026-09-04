I want you to help me implement an open-source **Web Audio Modules v2 (WAM v2)** guitar amplifier plugin capable of loading and running **Neural Amp Modeler Architecture A2 / NAM A2 `.nam` profiles** directly in the browser.

## Important context

I am one of the co-creators of the **Web Audio Modules v2 standard**.

I am already very familiar with:

* WAM v2 architecture
* AudioWorklet / AudioWorkletProcessor
* Web Audio API
* WebAssembly
* real-time audio constraints
* guitar amplifier DSP
* nonlinear tube amplifier modeling
* convolution / cabinet IRs
* FAUST
* JavaScript DSP
* implementing effects as WAM plugins

I have already implemented several guitar amp simulators using physical / nonlinear modeling and FAUST.

Therefore:

**Do not teach me WAM v2 or basic Web Audio concepts.**

I want you to focus on the engineering problem of embedding the **official Neural Amp Modeler DSP runtime**, especially the new **A2 architecture**, inside a Web Audio Module.

---

# Main objective

Build a WAM v2 plugin with this initial signal chain:

```text
WAM input
   |
Input gain
   |
NAM A2 model
   |
Output gain
   |
WAM output
```

Initially the plugin must support:

* loading `.nam` files from the local machine
* Architecture A2 models
* real-time processing in an AudioWorklet
* Input Gain
* Output Gain
* Bypass
* WAM state save/restore
* a minimal GUI

Do NOT implement a cabinet IR loader in the first milestone.

We can add convolution / cabinet IR support later.

---

# Critical design decision

I want to use the **official NeuralAmpModelerCore C++ implementation** as much as possible.

Official repository:

https://github.com/sdatkinson/NeuralAmpModelerCore

Do not reimplement NAM inference in JavaScript unless there is a very strong technical reason.

The preferred architecture is:

```text
NeuralAmpModelerCore C++
          |
       Emscripten
          |
         WASM
          |
 AudioWorkletProcessor
          |
       WAM v2
```

Before writing significant amounts of code, inspect the current NeuralAmpModelerCore repository carefully.

In particular inspect:

* model loading
* A2 support
* WaveNet A2 implementation
* fast A2 processing paths
* `NAM/dsp.*`
* model factory code
* example A2 models
* `benchmodel`
* `bench_a2_fast`
* CMake configuration
* dependencies such as Eigen and nlohmann/json
* sample rate handling
* prewarming
* any code paths that allocate memory during inference

Use the **current API of NeuralAmpModelerCore**, not an API inferred from old documentation or old examples.

---

# Step 1 — Repository analysis

Before implementing anything, produce a short engineering analysis describing:

1. Which parts of NeuralAmpModelerCore need to be compiled to WASM.

2. Which C++ class/API should be exposed to JavaScript.

3. How `.nam` model data should be passed from JS to C++.

4. Whether the model should be parsed entirely inside C++ or partly in JS.

5. How model initialization and prewarming work.

6. Whether A2 models expect a specific sample rate and how NeuralAmpModelerCore handles sample-rate mismatch.

7. Whether A2 uses dynamic allocations during steady-state processing.

8. Which A2 fast paths are available in the current NeuralAmpModelerCore.

9. What potential Emscripten problems exist, especially around:

   * Eigen
   * SIMD
   * filesystem APIs
   * threading
   * exceptions
   * RTTI
   * aligned memory
   * JSON loading

10. Whether the filesystem-based NAM loading API should be bypassed in favor of loading the `.nam` JSON directly from memory.

Do not guess.

Inspect the actual repository before deciding.

---

# Step 2 — First target: native/WASM NAM rendering test

Before implementing the WAM, create the smallest possible WASM wrapper around NeuralAmpModelerCore.

I want an API conceptually similar to:

```cpp
NamModel* nam_create(double sampleRate);

bool nam_load_model(
    NamModel* model,
    const char* data,
    size_t length
);

void nam_process(
    NamModel* model,
    const float* input,
    float* output,
    int numSamples
);

void nam_reset(NamModel* model);

void nam_destroy(NamModel* model);
```

You do NOT have to use exactly this C API.

Choose the cleanest API based on NeuralAmpModelerCore's current implementation.

However, keep the WASM boundary deliberately small.

Avoid exposing a complex C++ object hierarchy to JavaScript.

---

# Requirements for audio processing

The eventual AudioWorklet processing callback must have:

* no dynamic allocations
* no filesystem operations
* no JSON parsing
* no model initialization
* no Promise
* no locks
* no `postMessage`
* no logging
* no garbage-producing JS operations

inside the steady-state audio rendering path.

Conceptually, the critical path should be approximately:

```cpp
nam.process(input, output, 128);
```

Everything expensive must happen during model loading or initialization.

---

# Important Web Audio constraint

The browser AudioWorklet normally processes render quanta of:

```text
128 samples
```

Therefore benchmark at least:

* 44100 Hz
* 48000 Hz
* optionally 96000 Hz

The corresponding processing deadlines are approximately:

```text
44100 Hz -> 2.90 ms
48000 Hz -> 2.67 ms
96000 Hz -> 1.33 ms
```

Measure the processing time per 128-sample quantum.

Do not only report "x times realtime".

I want latency-budget-oriented measurements.

---

# Step 3 — Numerical validation

Before connecting the WASM code to Web Audio, create an offline test.

Use the same:

* input WAV
* `.nam` model
* sample rate

with:

1. native NeuralAmpModelerCore
2. WebAssembly NeuralAmpModelerCore

Render output WAV files from both.

Compare the outputs numerically.

Report:

* maximum absolute error
* RMS error
* relative error if meaningful

Ideally add an automated regression test.

The goal is to establish that the WASM build performs the same inference as the native code before introducing AudioWorklet-specific issues.

---

# Step 4 — AudioWorklet prototype

Once the offline WASM validation works, build a minimal AudioWorklet example.

Not yet a WAM.

Architecture:

```text
MediaStream / guitar input
          |
    AudioWorklet
          |
   NAM A2 WASM
          |
     destination
```

The AudioWorklet should:

* instantiate/access the WASM DSP
* process mono audio
* support Web Audio's 128-frame render quantum
* avoid allocations inside `process()`
* report CPU statistics outside the real-time path
* allow loading another `.nam` model

---

# Model loading architecture

Model loading must NOT happen directly inside the audio rendering callback.

Design a safe model-loading mechanism.

Possible architecture:

```text
main thread

File
 ↓
ArrayBuffer / Uint8Array
 ↓
AudioWorklet message
 ↓
non-real-time model construction
 ↓
prewarm
 ↓
atomic/safe model switch
```

However, carefully evaluate what is actually possible inside AudioWorkletGlobalScope.

I want you to explicitly analyze whether model loading and construction should happen:

### Option A

inside the AudioWorkletGlobalScope

or

### Option B

outside the AudioWorklet, with an already-prepared model transferred or shared

or another approach.

Explain the tradeoffs.

Important:

Audio must not crash or produce invalid memory while a model is being replaced.

For the first implementation it is acceptable to briefly bypass or mute processing during model replacement if that simplifies correctness.

Do not introduce worker threads unnecessarily.

---

# Emscripten build

Create a reproducible Emscripten build.

Prefer CMake where practical.

Produce something along the lines of:

```text
src/nam-wasm/
    nam_wrapper.cpp
    nam_wrapper.h

third_party/
    NeuralAmpModelerCore/

CMakeLists.txt
```

and generated:

```text
dist/nam.js
dist/nam.wasm
```

or, preferably if possible for AudioWorklet integration:

```text
dist/nam.wasm
```

with a minimal custom JS/WASM loader.

Avoid a huge Emscripten-generated runtime if a smaller configuration is practical.

Investigate:

* MODULARIZE
* EXPORT_ES6
* ENVIRONMENT
* ALLOW_MEMORY_GROWTH
* INITIAL_MEMORY
* WASM_BIGINT
* exception catching
* filesystem support
* SIMD

Do not enable features unless required.

---

# Memory allocation strategy

Audio processing must reuse preallocated WASM memory.

For example:

```text
WASM memory

[input 128 floats]
[output 128 floats]
[model state ...]
```

Avoid doing this for every render quantum:

```js
_malloc(...)
_free(...)
```

The JS AudioWorklet should reuse typed-array views whenever possible.

If WASM memory can grow and therefore invalidate typed-array views, handle that explicitly.

Prefer disabling WASM memory growth if we can determine a safe memory budget after model loading.

---

# SIMD

Investigate whether compiling with WASM SIMD improves NeuralAmpModelerCore A2 performance.

Test:

```text
-msimd128
```

if compatible.

Compare:

```text
WASM scalar
WASM SIMD
native
```

Do not assume Eigen automatically generates useful WASM SIMD.

Inspect generated behavior and benchmark it.

---

# NeuralAmpModelerCore / Eigen warning

NeuralAmpModelerCore currently documents potential Eigen alignment/vectorization issues depending on compiler configuration.

Do NOT immediately solve this by defining:

```cpp
EIGEN_MAX_ALIGN_BYTES=0
EIGEN_DONT_VECTORIZE
```

because this could severely affect performance.

First determine whether the issue actually occurs with Emscripten/WASM.

Document whatever compile flags are necessary.

---

# Step 5 — Convert prototype into a WAM v2

Only once the AudioWorklet prototype works reliably, integrate it into a Web Audio Module v2.

Assume I already understand the WAM SDK.

Use a conventional WAM v2 architecture:

```text
NamWam
  |
NamNode
  |
NamProcessor
  |
NAM WASM DSP
```

Parameters:

```text
Input Gain
Output Gain
Bypass
```

Use proper WAM parameter automation for Input Gain and Output Gain.

Bypass should avoid unnecessary NAM processing when active if this can be done safely.

---

# WAM state

The WAM state should contain at least:

```js
{
    inputGain: ...,
    outputGain: ...,
    bypass: ...,
    model: ...
}
```

But think carefully about the model itself.

A `.nam` file can be relatively large.

Evaluate whether `getState()` should contain:

* the complete `.nam` data
* model metadata + external URL/reference
* model hash + model data
* another representation

For a self-contained saved WAM state, embedding the model may be desirable.

Propose a sensible solution.

---

# GUI

For the first version, keep the GUI intentionally minimal.

Something roughly equivalent to:

```text
+------------------------------------------------+
| NAM A2                                         |
|                                                |
| MODEL                                          |
| [ Mesa Mark IIC+ Lead.nam                 ]    |
| [ Load NAM... ]                                |
|                                                |
| Input                     Output               |
|  knob                       knob               |
|                                                |
| Model info:                                    |
| Architecture: A2                               |
| Sample rate: ...                               |
| Modeled by: ...                                |
|                                                |
| [ BYPASS ]                                     |
+------------------------------------------------+
```

Do not spend time on polished graphics.

Focus on functionality.

---

# `.nam` metadata

Parse and expose useful `.nam` metadata such as:

* model name
* architecture
* file format version
* modeled_by
* expected sample rate
* loudness/gain metadata
* A2-specific configuration information if useful

Do not duplicate parsing logic unnecessarily if NeuralAmpModelerCore already exposes the information.

---

# Important scope limitation

For milestone 1:

DO implement:

* A2 model loading
* A2 inference
* WASM build
* AudioWorklet real-time processing
* WAM v2 wrapper
* Input Gain
* Output Gain
* Bypass
* model loading GUI
* WAM state
* tests
* benchmarks

DO NOT implement yet:

* TONE3000 browser/API
* cabinet IR
* parametric NAM
* MIDI mapping UI
* stereo NAM processing
* oversampling
* fancy GUI
* cloud storage
* model training

Those can come later.

---

# Mono / stereo behavior

NAM amplifier captures are fundamentally mono processors for this use case.

Initial implementation:

```text
mono input -> NAM -> mono output
```

If the WAM host gives stereo input, define an explicit policy rather than accidentally processing only one side.

For milestone 1, either:

```text
(L + R) * 0.5 -> NAM -> duplicate to L/R
```

or require mono input.

Tell me which approach you choose and why.

---

# Sample-rate handling

This is important.

Investigate exactly how NeuralAmpModelerCore handles a model whose expected sample rate differs from the Web Audio AudioContext sample rate.

Do NOT silently add a resampler without explaining it.

If A2 requires execution at the model's original sample rate, propose an architecture for sample-rate conversion.

If NeuralAmpModelerCore handles this internally, explain how.

---

# Performance targets

The primary target platforms are:

* desktop Chrome / Chromium
* macOS Apple Silicon
* recent Windows machines

Secondary targets:

* mobile browsers
* Meta Quest / WebXR environments

The first goal is not necessarily to support every A2 model on mobile.

The goal is to determine which A2 model sizes can run reliably in an AudioWorklet.

Benchmark several model complexities if sample models are available.

---

# Benchmark output

Produce a table such as:

```text
Model        Platform        SR       SIMD   avg µs/q   p95 µs/q   max µs/q   realtime margin
------------------------------------------------------------------------------------------------
A2 Nano      Chrome/M3 Max   48k      yes       ...
A2 Standard  Chrome/M3 Max   48k      yes       ...
A2 Full      Chrome/M3 Max   48k      yes       ...
```

Use actual measured results.

Do not fabricate benchmarks.

---

# Tests

Create automated tests for at least:

1. `.nam` file loading

2. invalid `.nam` rejection

3. A2 model recognition

4. processing produces finite output

5. WASM/native numerical equivalence

6. model reset

7. bypass

8. input/output gain

9. model replacement

10. repeated processing without allocations if we can instrument this

---

# Error handling

Model loading errors should produce useful diagnostics.

Examples:

```text
Unsupported NAM version
Unsupported architecture
Invalid JSON
Invalid model weights
Model sample-rate mismatch
Insufficient WASM memory
```

Never throw or log repeatedly from the audio processing callback.

---

# Repository structure

Propose a clean structure before implementation.

Something similar to:

```text
nam-a2-wam/
├── src/
│   ├── wam/
│   │   ├── index.js
│   │   ├── NamNode.js
│   │   ├── NamProcessor.js
│   │   └── descriptor.json
│   │
│   ├── gui/
│   │   └── index.js
│   │
│   └── native/
│       ├── nam_wrapper.cpp
│       └── nam_wrapper.h
│
├── third_party/
│   └── NeuralAmpModelerCore/
│
├── tests/
│
├── benchmark/
│
├── examples/
│
├── CMakeLists.txt
├── package.json
└── README.md
```

Adjust this structure if there is a better technical reason.

---

# Development methodology

Work incrementally.

Do NOT generate the complete project in one large speculative pass.

Follow this sequence:

```text
1. Inspect NeuralAmpModelerCore
2. Write architecture notes
3. Build native minimal test
4. Build WASM minimal test
5. Compare native/WASM output
6. Benchmark WASM
7. Build AudioWorklet prototype
8. Test real-time performance
9. Build WAM wrapper
10. Add minimal GUI
11. Add state serialization
12. Add tests/documentation
```

After every major step:

* compile
* run tests
* fix errors
* commit logically isolated changes if Git is available

Do not leave placeholder code pretending that something works.

---

# Important coding-agent behavior

When you encounter an unknown NeuralAmpModelerCore API:

**inspect the source code.**

Do not invent function names.

When an Emscripten build fails:

**diagnose the actual compiler/linker error.**

Do not replace the official NAM core with a simplified homemade neural network.

When the AudioWorklet integration has performance problems:

**profile before redesigning it.**

---

# Implementation roadmap

## Phase 1 — Feasibility and minimal WASM DSP [DONE]

1. Clone or inspect the current `NeuralAmpModelerCore`.

2. Identify exactly how an A2 `.nam` model is loaded and processed.

3. Identify the minimum source files/dependencies required.

4. Determine a suitable memory-based loading API for WebAssembly.

5. Create a minimal C++ wrapper.

6. Compile it natively first.

7. Compile it with Emscripten.

8. Load the official/example `A2.nam` model from the NeuralAmpModelerCore repository.

9. Process a known block of samples.

10. Add an offline native-vs-WASM numerical comparison.

11. Benchmark 128-sample processing.

At the end of this phase, give me:

* the architecture decisions
* files created/changed
* build commands
* test results
* benchmark results
* known issues
* next recommended step

Do **not start the WAM implementation until Phase 1 actually works**.

## Phase 1 validation

Phase 1 is successful.

Do NOT implement the WAM yet.

## Phase 2 — Real-time browser AudioWorklet validation [DONE]

The purpose of this phase is to validate that the existing NeuralAmpModelerCore A2 WASM implementation works reliably under actual Chrome AudioWorklet real-time constraints.

## 1. Keep the existing DSP wrapper

Do not redesign the working C++ wrapper unless required.

The current architecture:

```text
NAM A2
  ↓
NeuralAmpModelerCore
  ↓
small C ABI
  ↓
WASM SIMD
```

has already demonstrated excellent native/WASM numerical equivalence and approximately 264 µs processing time for a 128-sample quantum at 48 kHz under Node/V8.

We now need actual browser measurements.

## 2. Create a minimal browser test application

Create:

```text
examples/audio-worklet/
    index.html
    main.js
    NamAudioWorkletProcessor.js
```

plus whatever minimal WASM loader is required.

Signal chain:

```text
microphone / guitar input
        ↓
AudioWorkletNode
        ↓
NAM A2 WASM
        ↓
AudioContext.destination
```

Also allow a generated/test signal as input so the prototype can be tested without an audio interface.

No WAM SDK yet.

## 3. WASM loading

Investigate the cleanest way to instantiate the WASM module inside `AudioWorkletGlobalScope`.

Prefer a minimal WASM loader over the current Node-oriented Emscripten glue.

The existing build uses:

```text
MODULARIZE
ENVIRONMENT=node
```

which is not appropriate as-is for the final AudioWorklet environment.

Determine whether we can:

* produce a standalone/minimal WASM module;
* instantiate it using `WebAssembly.instantiate()` or `WebAssembly.instantiateStreaming()`;
* expose only the existing C ABI.

Avoid introducing unnecessary Emscripten runtime dependencies.

## 4. Model loading

Implement loading a local `.nam` file from the main thread.

Desired flow:

```text
<input type=file>
      ↓
ArrayBuffer
      ↓
AudioWorkletNode.port
      ↓
AudioWorkletProcessor
      ↓
NAM WASM memory
      ↓
nam_load_model()
      ↓
Reset/prewarm
      ↓
ready
```

Model construction MUST NOT occur inside `process()`.

However, remember that message handlers attached to the
AudioWorkletProcessor execute in the AudioWorkletGlobalScope and may
share the rendering thread.

Therefore explicitly measure whether JSON parsing, model construction,
allocation and prewarming performed from a MessagePort handler stall
audio rendering.

For Phase 2, such a stall is acceptable and should be measured.

Do not mistake "outside process()" for "outside the real-time audio thread".
For this prototype it is acceptable to:

1. mute/bypass processing;
2. load and initialize the new model;
3. refresh WASM typed-array views if memory has grown;
4. resume processing.

Measure how long model loading + Reset/prewarm takes.

Report the interruption duration.

## 5. Audio callback

The steady-state `process()` method must perform no allocation under our control.

Reuse:

* WASM input buffer;
* WASM output buffer;
* Float32Array views;
* all JS objects required for processing.

Conceptually:

```text
copy WebAudio input -> preallocated WASM input
nam_process(handle, inputPtr, outputPtr, 128)
copy preallocated WASM output -> WebAudio output
```

Do not call `_malloc()` or `_free()` per quantum.

Do not parse JSON, log, post messages, create Promises, or perform model management in the steady-state processing path.

## 6. Typed-array / memory-growth handling

The Phase 1 build currently uses:

```text
ALLOW_MEMORY_GROWTH=1
```

Model loading may therefore invalidate existing typed-array views.

Explicitly detect/recreate the views after model loading.

Do not check/recreate them unnecessarily every audio quantum if this can be avoided.

Also measure actual WASM memory usage after loading:

* A2 Lite
* A2 Full

if possible.

Based on these measurements, recommend whether Phase 3 should use a fixed WASM memory size.

## 7. Sample rate

For Phase 2, DO NOT implement sample-rate conversion.

After loading:

```text
modelExpectedSampleRate = nam_expected_sample_rate(...)
contextSampleRate = audioContext.sampleRate
```

If they differ, reject the model and display a clear error.

Do not silently run a 48 kHz model at 44.1 kHz.

## 8. Real AudioWorklet performance benchmark

This is the main purpose of Phase 2.

Measure actual processing cost inside Chrome AudioWorklet for 128-frame quanta.

Report at least:

```text
average
p50
p95
p99
maximum
```

and deadline utilization.

For example at 48 kHz:

```text
deadline = 128 / 48000 = 2.6667 ms
```

Report:

```text
processing_time / deadline
```

rather than only x-realtime.

Do not send a `postMessage()` for every quantum.

Accumulate statistics locally and report them periodically outside the critical measurement section.

Be careful that the measurement mechanism itself does not significantly perturb the audio callback.

## 9. Detect real-time failures

Add counters for:

* processing calls;
* NAM processing failures;
* unusually slow quanta;
* quanta exceeding the nominal deadline;
* maximum observed processing time.

If browser APIs allow us to obtain useful underrun/glitch information, use them.

Otherwise clearly distinguish measured processing deadline overruns from actual hardware/browser audio underruns.

## 10. Test model replacement

Load:

```text
model A
↓
process audio
↓
load model B
↓
process audio
↓
load model A again
```

Verify:

* no crash;
* no stale WASM pointers;
* no invalid Float32Array after memory growth;
* no NaN/Inf;
* correct audio resumes.

For this phase, muting during replacement is acceptable.

## 11. Test bypass

Implement a simple prototype bypass.

When bypassed, skip `nam_process()` completely.

This will also provide a useful baseline for measuring AudioWorklet overhead without NAM inference.

## 12. Measure copy overhead separately

I specifically want to know the cost of:

```text
WebAudio Float32Array
        ↓ copy
WASM memory
        ↓ NAM
WASM memory
        ↓ copy
WebAudio Float32Array
```

Measure:

A. AudioWorklet with bypass/pass-through

B. AudioWorklet with the two WASM memory copies but NAM processing disabled

C. AudioWorklet with NAM processing

This will tell us how much CPU is inference versus JS/WASM boundary/copy overhead.

## 13. SIMD comparison

If practical in this phase, create both:

```text
nam-simd.wasm
nam-scalar.wasm
```

and compare them in the same Chrome AudioWorklet benchmark.

This was not completed in Phase 1.

Do not delay the AudioWorklet validation if this becomes complicated.

## 14. Browser targets

Test at least:

* current Chrome/Chromium on Apple Silicon macOS

If readily available also test another Chromium environment.

Record:

```text
browser/version
CPU
AudioContext sample rate
AudioContext baseLatency
AudioContext outputLatency if available
model
WASM SIMD enabled/disabled
```

## 15. Important constraint

Do NOT implement:

* WAM
* GUI beyond minimal test controls
* cabinet IR
* TONE3000
* MIDI
* presets
* state serialization

yet.

## Phase 2 exit criteria

Phase 2 is successful only if:

1. NAM A2 runs inside a real AudioWorklet.
2. Audio remains stable for an extended test.
3. No allocation under our control occurs in steady-state NAM processing.
4. Model replacement works.
5. Sample-rate mismatch is explicitly rejected.
6. Actual Chrome AudioWorklet timing statistics are available.
7. We know the JS↔WASM copy overhead.
8. We know whether the available real-time margin is sufficient.

At the end, report:

* architecture used;
* files added/modified;
* WASM loading strategy;
* model-loading strategy;
* memory usage;
* model loading/prewarm time;
* AudioWorklet benchmark results;
* copy overhead;
* observed glitches/deadline misses;
* model replacement results;
* known issues;
* recommendation for Phase 3.

Do NOT begin the WAM implementation automatically.

Stop after Phase 2 and show me the results.

## Phase 3 — WAM v2 integration [DONE]

Phase 1 and Phase 2 are complete and validated.

The NeuralAmpModelerCore A2 DSP now runs successfully as standalone WebAssembly inside a real Chrome AudioWorklet, with sufficient real-time margin on the reference Apple M3 Max machine.

Do NOT redesign the validated NAM/WASM DSP architecture unless required.

The purpose of Phase 3 is to turn the validated AudioWorklet prototype into a proper **Web Audio Module v2 plugin**, and to provide a practical host application for testing the plugin with either:

* a selected live audio input device, such as an external USB audio interface connected to a guitar;
* dynamically discovered dry/unprocessed guitar audio files.

The host audio-source management is part of Phase 3.

Do NOT begin Phase 4 automatically.

---

### 1. Core architectural requirement

The existing NAM AudioWorklet processor must become or be integrated directly into the WAM processor.

Target architecture:

```text
Main thread

NamPlugin / WebAudioModule
        |
      NamNode
        |
 WAM API / events / state
        |
--------------------------------
AudioWorkletGlobalScope
        |
    NamProcessor
   extends WamProcessor
        |
   WAM parameters
        |
   Input Gain
        |
     NAM A2 WASM
        |
   Output Gain
        |
      output
```

Do NOT introduce this architecture:

```text
WamProcessor
     |
AudioWorkletNode
     |
NAM AudioWorkletProcessor
```

There must be only one AudioWorklet processing node for the plugin.

The NAM inference code must execute directly inside the WAM processor's `process()` path.

Reuse as much of the validated Phase 2 implementation as possible.

---

### 2. WAM SDK integration

Use the current WAM v2 SDK/API available in the project or current official WAM repository.

Before implementing:

1. inspect the actual WAM SDK version being used;
2. inspect existing WAM examples if required;
3. use the real current API;
4. do not invent WAM SDK methods or class names.

Assume I am already familiar with WAM v2.

Do not explain basic WAM architecture.

The implementation should use the conventional WAM structure appropriate to the current SDK, conceptually:

```text
NamPlugin / index
NamNode
NamProcessor
descriptor.json
GUI
```

Adjust names if required by the actual WAM SDK.

---

### 3. Preserve the validated WASM implementation

Reuse the current standalone SIMD WASM build and small C ABI.

Do not reintroduce the large Emscripten JavaScript runtime.

Continue using direct WebAssembly instantiation where practical.

The current C interface should remain conceptually equivalent to:

```cpp
nam_create()
nam_load_model()
nam_process()
nam_reset()
nam_destroy()
nam_input_buffer()
nam_output_buffer()
nam_expected_sample_rate()
nam_last_error()
```

Do not expose C++ class hierarchies to JavaScript.

---

### 4. WAM parameters

Implement the following WAM parameters:

```text
inputGain
outputGain
bypass
```

Recommended ranges:

```text
Input Gain:
-24 dB to +24 dB
default 0 dB

Output Gain:
-24 dB to +12 dB
default 0 dB

Bypass:
0 / 1
default 0
```

Use proper WAM parameter definitions and automation.

Input Gain and Output Gain must support sample-accurate WAM automation if the SDK provides parameter arrays at render time.

Do not implement gain automation through MessagePort messages.

---

### 5. Real-time gain processing

Convert dB to linear gain efficiently.

For constant parameter blocks, avoid unnecessary repeated conversion.

For sample-accurate parameter arrays, apply the corresponding gain per sample.

Signal flow:

```text
input
  |
inputGain
  |
NAM
  |
outputGain
  |
output
```

Input gain should therefore affect the drive level seen by the NAM model.

Output gain must be applied after NAM inference.

---

### 6. Bypass behavior

When bypass is enabled:

* do not call `nam_process()`;
* copy input directly to output;
* avoid unnecessary DSP work.

For Phase 3, hard bypass is acceptable.

Do not implement crossfaded bypass unless required to avoid a serious issue.

If switching produces an audible click, document it for a later improvement rather than complicating the first WAM implementation.

---

### 7. Mono behavior

NAM processing remains mono in Phase 3.

Use an explicit mono policy.

Preferred behavior:

```text
mono input -> NAM -> mono output
```

Configure the WAM node accordingly where possible.

If a host provides stereo input despite this configuration, handle it deterministically.

Do not silently process only an arbitrary channel.

If required, use:

```text
0.5 * (L + R)
```

before NAM processing.

Document the actual behavior chosen.

Do not implement dual-mono/stereo NAM processing yet.

---

### 8. Model loading

Allow the user to load a local `.nam` file from the WAM GUI.

Reuse the validated Phase 2 loading design:

```text
GUI / main thread
       |
    File
       |
 ArrayBuffer
       |
 NamNode
       |
 MessagePort
       |
 NamProcessor
       |
 NAM WASM
```

Model construction may execute from the AudioWorklet message handler.

As established in Phase 2, this may stall the rendering thread during:

* JSON parsing;
* DSP construction;
* allocation;
* Reset/prewarm.

This is acceptable for Phase 3.

During loading:

1. mark the NAM processor not ready;
2. bypass or mute safely;
3. construct the candidate model;
4. verify its sample rate;
5. refresh WASM views if needed;
6. atomically publish the new model;
7. destroy the old model;
8. resume processing.

Do not destroy the active model before the replacement is known to be valid.

---

### 9. Sample-rate handling

Continue the Phase 2 policy.

Do NOT implement sample-rate conversion yet.

After model construction:

```text
expected model SR
vs
AudioWorklet sampleRate
```

If they differ, reject the model.

Display a clear message in the WAM GUI.

Do not silently execute a model at the wrong sample rate.

---

### 10. WAM state

Implement WAM `getState()` / `setState()` using the actual current WAM SDK API.

The state must restore:

* inputGain;
* outputGain;
* bypass;
* currently loaded NAM model.

The saved state should be self-contained.

For this first WAM version, prefer storing the actual `.nam` data in the state rather than only a filesystem name or external URL.

Suggested conceptual structure:

```js
{
  parameters: {
    inputGain: 0,
    outputGain: 0,
    bypass: false
  },

  model: {
    name: "...",
    data: ...
  }
}
```

Choose an efficient serialization compatible with the WAM host/state API.

Possible representations include:

* string containing original `.nam` JSON;
* ArrayBuffer / TypedArray if supported cleanly by the state mechanism;
* another self-contained representation.

Avoid Base64 unless the WAM state API requires JSON-only serialization.

Document the decision and resulting state size.

---

### 11. Model metadata

Expose useful NAM metadata to the WAM GUI when available.

At minimum:

```text
filename/model name
architecture
expected sample rate
modeled_by if present
NAM format/version if available
A2 subtype / Lite / Full if identifiable
```

Avoid implementing a second full NAM parser in JavaScript merely for metadata if the information is already available cheaply through the C++ side.

However, lightweight JSON inspection on the main thread is acceptable if clearly simpler.

Do not perform metadata parsing in the steady-state audio callback.

---

### 12. Minimal WAM GUI

Create a functional but deliberately simple WAM GUI.

Example:

```text
+----------------------------------------------+
| NAM A2                                       |
|                                              |
| Model                                        |
| [ A2-Model.nam                       ]       |
| [ Load NAM... ]                              |
|                                              |
| Input Gain              Output Gain          |
|    knob                    knob              |
|                                              |
| Architecture: A2 Full                        |
| Sample rate: 48000 Hz                        |
| Modeled by: ...                              |
|                                              |
| [ Bypass ]                                   |
+----------------------------------------------+
```

The WAM GUI must:

* load a local `.nam`;
* display model status;
* display model loading errors;
* control Input Gain;
* control Output Gain;
* control Bypass;
* reflect host automation/parameter changes.

Do not put audio input device selection in the WAM GUI.

Do not put test-audio-file management in the WAM GUI.

Those are host responsibilities.

Do not build a polished graphical amplifier UI yet.

Functionality comes first.

---

### 13. Host automation synchronization

GUI controls must not bypass the WAM parameter system.

GUI → parameter changes must use the WAM API.

Host automation → processor → GUI should remain synchronized using the standard WAM mechanism.

Do not build a parallel custom parameter protocol.

Model loading is not a regular automatable parameter and may use explicit node/processor messaging.

---

### 14. Remove Phase 2 benchmark overhead from production path

The Phase 2 AudioWorklet contains diagnostic instrumentation that should not remain unconditionally active in the production WAM.

In particular, do not keep an unconditional per-sample:

```js
Number.isFinite(...)
```

scan of every output quantum in the production path.

Also do not retain detailed per-quantum timing capture unless running in an explicit diagnostic mode.

Provide a clear distinction between:

```text
production processing
```

and:

```text
debug / benchmark instrumentation
```

The normal processing path should be approximately:

```text
input gain
copy to WASM
nam_process()
copy from WASM
output gain
```

plus normal WAM parameter handling.

---

### 15. WASM memory strategy

Phase 2 observed:

```text
WASM memory ≈ 16.9 MB
A2 Full load -> no memory growth
A2 Lite load -> no memory growth
A2 Full reload -> no memory growth
```

Investigate whether Phase 3 can safely use fixed WASM memory.

Do NOT assume the official example A2 model represents the largest real-world model.

Before setting:

```text
ALLOW_MEMORY_GROWTH=0
```

either:

1. test several representative A2 models, or
2. choose and justify a conservative fixed memory size.

If insufficient evidence exists, keeping memory growth enabled is acceptable for Phase 3 provided view refresh remains correct.

Do not optimize this prematurely.

---

### 16. Retain the Phase 2 regression tests

Preserve the Phase 2 standalone test application.

Do not replace it with the WAM demo.

We want both:

```text
examples/audio-worklet/
```

and:

```text
examples/wam/
```

or the equivalent.

The standalone AudioWorklet implementation remains useful to distinguish:

```text
NAM/WASM problem
```

from:

```text
WAM integration problem
```

---

### 17. WAM host test page and audio-source management

Provide a dedicated host application able to instantiate and exercise the NAM WAM.

Audio-source selection belongs to the HOST, not to the NAM WAM GUI.

The host is also intended to become a practical guitar-amplifier WAM test bench.

The host must provide:

* WAM loading;
* WAM GUI display;
* live audio input;
* selection of the actual audio input device;
* dynamically discovered dry guitar audio test files;
* an audio-file player;
* source switching;
* WAM parameter testing;
* state save/restore.

---

### 17.1 Overall host signal architecture

Only one source must feed the WAM at a time.

Conceptually:

```text
                 ┌── Live input
                 │     |
                 │ MediaStreamAudioSourceNode
                 │
Source selector ─┤
                 │
                 └── Dry guitar test file
                        |
                 audio-file player
                        |
                  selected source
                        |
                     NAM WAM
                        |
              AudioContext.destination
```

The host must explicitly disconnect the previous source when switching.

Live input and prerecorded test audio must never accidentally be summed together.

---

### 17.2 Audio source selector

Provide a primary selector such as:

```text
Audio source:
[ Live input                     v ]
```

The options must contain:

1. `Live input`
2. all dynamically discovered dry guitar audio files available under the host audio assets directory.

For example:

```text
Audio source:
[ Live input                     v ]
[ CleanStratDI.wav                 ]
[ FunkDI.wav                       ]
[ PalmMutes.wav                    ]
[ ...                              ]
```

The actual test filenames MUST NOT be hardcoded.

---

### 17.3 Live input device enumeration

When `Live input` is selected, the host must use a real browser audio input device.

Enumerate audio input devices using the appropriate MediaDevices API.

Provide a second menu such as:

```text
Input device:
[ USB Audio Interface - Input 1   v ]
```

This is required because the guitar may be connected to an external audio interface rather than the computer's default microphone.

The user must be able to explicitly choose the input device.

Use `navigator.mediaDevices.enumerateDevices()` and the current browser API as appropriate.

Because browsers may hide device labels before media permission has been granted:

1. request microphone/audio permission at the appropriate time;
2. then re-enumerate devices;
3. populate the selector with the now-available labels.

Do not assume the first input device is the correct guitar interface.

---

### 17.4 Live input constraints

When acquiring the guitar input, use capture constraints appropriate to music rather than speech.

At minimum disable:

```js
{
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false
}
```

Request mono input where practical.

Do not intentionally enable browser voice-processing features.

When a device is selected, use its `deviceId` in the media constraints.

---

### 17.5 Input device switching

When the selected input device changes:

1. disconnect the current `MediaStreamAudioSourceNode`;
2. stop every track belonging to the previous `MediaStream`;
3. request a new MediaStream targeting the newly selected `deviceId`;
4. create a new `MediaStreamAudioSourceNode`;
5. connect it to the WAM input.

Do not leave the previous input stream active.

Switching devices must not require recreating the WAM.

---

### 17.6 Device hot-plugging

Listen for:

```js
navigator.mediaDevices.devicechange
```

when supported.

If an audio interface is connected or disconnected:

* refresh the input device list;
* preserve the currently selected device if it still exists;
* clearly handle the case where the selected device disappears;
* select a sensible available replacement if necessary.

Do not silently fail.

---

### 17.7 Dry guitar test audio directory

The host must support prerecorded dry/unprocessed guitar signals for testing without a physical guitar.

Use a directory such as:

```text
examples/wam/assets/audio/
```

The exact path may be adjusted to the actual host structure, but keep the same concept.

Files in this directory are development/test assets.

Do NOT hardcode their filenames anywhere in the host source.

I want to be able to simply copy/drop new audio files into this directory and have them appear automatically in the host menu after reloading the page.

---

### 17.8 Dynamic discovery of test audio files

A browser cannot portably enumerate arbitrary HTTP directory contents.

Therefore, do NOT rely on:

```js
fetch('./assets/audio/')
```

returning a directory listing.

Instead, the development/test server must dynamically scan the audio directory, or automatically generate an up-to-date manifest from the directory contents.

Acceptable architectures include:

```text
filesystem
   |
assets/audio/
   |
development server
   |
GET /api/test-audio-files
   |
browser host
```

For example:

```http
GET /api/test-audio-files
```

may return:

```json
[
  "CleanStratDI.wav",
  "FunkDI.wav",
  "LeadDI.wav"
]
```

The exact API path is not important.

The important requirements are:

* filenames are not hardcoded in JavaScript;
* no manually maintained file list is required;
* adding/removing a file from `assets/audio/` changes the menu after page reload;
* do not depend on HTTP directory listing being enabled.

If the existing development tooling has a cleaner mechanism, use it.

---

### 17.9 Supported audio files

Support browser-decodable audio formats where practical.

WAV should be treated as the reference format for deterministic tests.

Other browser-supported formats such as MP3, AAC, OGG or FLAC may work if naturally supported by the chosen playback implementation.

Do not build custom codecs in Phase 3.

The important use case is dry DI guitar recordings.

Use the term **dry guitar audio files** rather than `.raw` unless an actual headerless raw PCM format is intentionally implemented.

---

### 17.10 Host UI behavior

When `Live input` is selected:

```text
Audio source:
[ Live input                     v ]

Input device:
[ USB Audio Interface            v ]

Player:
[ disabled ]
```

Behavior:

* enable the input-device selector;
* disable the audio-file player;
* acquire/use the selected MediaStream input;
* route the MediaStream through the NAM WAM.

Signal graph:

```text
selected audio input device
          |
MediaStreamAudioSourceNode
          |
        NAM WAM
          |
AudioContext.destination
```

---

### 17.11 Test-file mode

When a dry guitar test file is selected:

```text
Audio source:
[ CleanStratDI.wav               v ]

Input device:
[ disabled ]

Player:
[ Play ] [ Pause ] [ Stop ] [ Loop ]
[ ---------------------- position ------ ]
```

Behavior:

* disconnect the live MediaStream source;
* stop its tracks;
* disable the input-device selector;
* enable the audio player;
* load the selected audio file;
* route the player through the NAM WAM.

Signal graph:

```text
dry guitar audio file
        |
 audio-file player
        |
      NAM WAM
        |
AudioContext.destination
```

The file player's audio must NEVER bypass the WAM and connect directly to the destination.

---

### 17.12 Audio file player

Provide at least:

* Play;
* Pause;
* Stop;
* seek/progress control;
* Loop on/off.

Loop mode is important for amplifier development and should be easy to enable.

The player must be disabled while `Live input` is selected.

Choose either:

* `HTMLMediaElement` + `MediaElementAudioSourceNode`;
* or an `AudioBuffer`-based player.

Choose the solution that gives the cleanest reliable integration with Web Audio.

Document the choice.

---

### 17.13 Source switching

Source switching must be deterministic.

On transition:

```text
Live input -> file
```

the host must:

1. disconnect the MediaStream source;
2. stop the MediaStream tracks;
3. enable the file player;
4. connect the file playback source to the WAM.

On transition:

```text
file -> Live input
```

the host must:

1. stop/pause/disconnect the file source as appropriate;
2. reacquire the selected input device;
3. create/connect the MediaStream source to the WAM.

At no time should two sources remain connected to the WAM unless this is explicitly introduced in a later phase.

---

### 17.14 Generated test signal

The generated sine/test signal used during Phase 2 may be retained for low-level diagnostics if useful.

However, it is not a substitute for the new dry guitar audio-file functionality.

The normal Phase 3 host UI should prioritize:

```text
Live input
Dry guitar audio files
```

The generated signal may be hidden behind a debug/developer option if retained.

---

### 17.15 Host versus plugin responsibilities

Keep the responsibility boundary explicit.

The NAM WAM owns:

```text
NAM model loading
Input Gain
Output Gain
Bypass
model metadata
WAM state
DSP
plugin GUI
```

The host owns:

```text
audio input device enumeration
MediaStream acquisition
input device selection
audio test-file discovery
audio test-file playback
source selection
source routing
WAM instantiation
WAM state test controls
```

Do not move host source-management functionality into the plugin itself.

---

### 18. WAM host state controls

The host must provide simple controls for exercising WAM state management.

At minimum:

```text
[ Save WAM state ]
[ Restore WAM state ]
```

The host does not need a complex preset system.

It only needs to demonstrate that the loaded NAM model and WAM parameters are correctly serialized and restored.

Host audio-source choice itself does not need to be part of the WAM state because it is not a WAM plugin parameter/state responsibility.

---

### 19. Validation tests

Validate at least:

#### WAM integration

1. WAM instantiation.
2. NAM model loading.
3. Invalid NAM rejection.
4. Sample-rate mismatch rejection.
5. Input Gain control.
6. Output Gain control.
7. Bypass.
8. Host parameter changes reaching DSP.
9. WAM GUI parameter changes reaching DSP.
10. Model replacement.
11. `getState()`.
12. `setState()`.
13. State restore reloads the correct NAM model.
14. No NaN/Inf during normal test processing.
15. No WASM stale pointers after model replacement.

#### Host audio input

16. Host enumerates available audio input devices.
17. Host can select a specific audio input device by `deviceId`.
18. Guitar-oriented capture constraints disable echo cancellation, noise suppression and automatic gain control.
19. Changing the input device releases/stops the previous MediaStream.
20. Device list refreshes after `devicechange` where supported.

#### Dry guitar test files

21. Test audio files are discovered dynamically from `assets/audio/`.
22. No test audio filenames are hardcoded.
23. Adding a supported file to the audio directory makes it available after page reload without editing source code.
24. Selecting `Live input` disables the audio-file player.
25. Selecting a dry guitar file disables live input/device selection and enables the player.
26. Test audio playback is routed through the NAM WAM.
27. Test audio playback never bypasses the WAM.
28. Play/Pause/Stop work.
29. Seek/progress control works.
30. Loop mode works.
31. Switching sources does not leave both live and prerecorded sources connected.

Retain native/WASM numerical regression tests from Phase 1.

Retain standalone AudioWorklet regression tests from Phase 2.

---

### 20. Performance regression

Run the WAM version with the same A2 Full reference model used during Phase 2.

Compare its steady-state CPU cost with the standalone AudioWorklet implementation.

The WAM integration should not introduce a large processing overhead.

Report:

```text
standalone AudioWorklet A2 Full
vs
WAM A2 Full
```

using the best timer available.

Because Phase 2 established that AudioWorklet timing is coarse when only `Date.now()` is available, do not overstate measurement precision.

The goal is to detect major regressions, not claim microsecond accuracy.

Host UI/file-player work does not belong in the AudioWorklet processing path and should not alter the core NAM DSP cost.

---

### 21. Manual real-audio smoke test

Provide instructions for a manual Chrome test using a real guitar and external audio interface:

```text
guitar
  |
external USB audio interface
  |
selected browser audio input device
  |
MediaStreamAudioSourceNode
  |
NAM WAM
  |
AudioContext.destination
```

The manual test should verify:

* the intended audio interface can be explicitly selected;
* the guitar input is audible through NAM;
* browser speech-processing features are disabled;
* acceptable latency;
* no obvious glitches;
* model loading;
* model replacement;
* gain controls;
* bypass.

Do not claim that the plugin is glitch-free on real hardware solely from automated/headless browser tests.

Also manually test prerecorded mode:

```text
dry guitar WAV
       |
host player
       |
    NAM WAM
       |
   output
```

Verify that loop mode is useful for repeatedly auditioning a NAM model.

---

### 22. Scope limitation

Phase 3 SHOULD implement:

* full WAM v2 wrapper;
* direct NAM integration in `WamProcessor`;
* Input Gain;
* Output Gain;
* Bypass;
* local NAM loading;
* model metadata;
* WAM state;
* minimal WAM GUI;
* WAM host test page;
* selectable live audio input device;
* external audio-interface support through MediaDevices;
* dynamically discovered dry guitar audio files;
* audio test-file player;
* Play/Pause/Stop/Seek/Loop;
* safe source switching;
* automated regression tests.

Phase 3 MUST NOT implement yet:

* cabinet IR;
* TONE3000;
* cloud model browser;
* parametric NAM;
* stereo NAM;
* dual amp processing;
* oversampling;
* MIDI mapping UI;
* model training;
* elaborate amp graphics;
* DAW-like audio routing;
* multiple simultaneous host input sources.

---

### 23. Phase 3 exit criteria

Phase 3 is successful only if:

1. the NAM processor is a proper WAM v2 plugin;
2. there is only one AudioWorklet processing node for NAM;
3. A2 `.nam` models can be loaded from the WAM GUI;
4. Input Gain and Output Gain are proper WAM parameters;
5. Bypass is a proper WAM parameter;
6. host automation reaches the DSP correctly;
7. WAM state can save and restore the loaded model and parameters;
8. model replacement remains safe;
9. sample-rate mismatch remains explicitly rejected;
10. WAM integration does not introduce a major CPU regression;
11. standalone Phase 1 and Phase 2 tests still pass;
12. the host can enumerate and select available audio input devices;
13. an external audio interface can be selected explicitly;
14. dry guitar test files placed in the host `assets/audio/` directory are discovered without source-code modification;
15. no test audio filenames are hardcoded;
16. selecting `Live input` routes the selected MediaStream device through the WAM;
17. selecting a prerecorded guitar file disables live input and routes the file player through the same WAM;
18. the audio player supports Play, Pause, Stop, Seek and Loop;
19. switching source does not leave obsolete source nodes or MediaStreams active;
20. host source/device management remains outside the WAM plugin;
21. no cabinet/TONE3000/Phase 4 functionality has been introduced.

At the end report:

* WAM architecture;
* files added/modified;
* WAM SDK/API used;
* processor inheritance/registration strategy;
* parameter implementation;
* model-loading implementation;
* state representation and state size;
* WAM GUI implementation;
* WASM memory strategy;
* host architecture;
* audio input device enumeration strategy;
* MediaStream constraints;
* device-switching behavior;
* dry-guitar-file discovery mechanism;
* development-server/manifest mechanism used to enumerate `assets/audio/`;
* audio-player implementation;
* source-switching implementation;
* tests performed;
* standalone-vs-WAM performance;
* manual guitar/audio-interface test procedure;
* manual prerecorded-audio test procedure;
* known issues;
* recommended Phase 4 scope.

Do NOT begin Phase 4 automatically.

Stop after Phase 3 and show me the results.

## Phase 3b — Diagnose and fix WAM real-time rendering [CURRENT]

Phase 3 is structurally implemented but NOT validated.

Do not begin Phase 4.

The sole blocker is:

```text
WAM processor initializes
WAM processor responds to messages
NAM model loads successfully
AudioContext is running
audio graph is connected

BUT:

process() render quanta = 0
NAM calls = 0
```

The unchanged Phase 2 AudioWorklet renders normally in the same Chrome environment.

Therefore this phase is strictly a diagnosis/fix phase for WAM real-time rendering.

Do not add features.

---

### 1. Reproduce the failure

Reproduce the Phase 3 WAM test with the existing generated oscillator:

```text
OscillatorNode
    |
GainNode
    |
NAM WAM
    |
AudioContext.destination
```

Confirm before changing code:

```text
AudioContext.state
currentTime progression
WAM processor initialized
WAM processor message responsiveness
render quantum count
NAM process call count
```

Keep the unchanged Phase 2 AudioWorklet as the control case.

---

### 2. Inspect the exact pinned WAM SDK

The project currently uses the pinned WAM SDK under:

```text
third_party/wam-examples/packages/sdk
```

Do not reason from memory or generic WAM examples.

Inspect the exact pinned SDK source.

In particular inspect:

```text
WamProcessor
WamNode
WebAudioModule
addFunctionModule
initializeWamHost
initializeWamEnv
initializeWamGroup
```

Determine exactly:

* how `WamProcessor.process()` is implemented;
* whether subclasses are expected to override `process()` or `_process()`;
* how parameters are rendered;
* whether the base processor can stop returning `true`;
* what constructor options are expected;
* how processor registration is performed;
* how `WamNode` constructs its `AudioWorkletNode`.

Compare the NAM implementation line by line against at least one known working WAM from the SAME pinned SDK.

Do not use a different SDK version as the implementation reference.

---

### 3. Build the smallest possible WAM rendering probe

Before involving NAM, create or temporarily reduce the processor to the smallest possible WAM DSP:

```text
input -> copy -> output
```

The WAM should:

* extend the same pinned `WamProcessor`;
* use the same `NamNode`;
* use the same processor registration mechanism;
* use the same host.

Count render quanta.

Expected result:

```text
oscillator -> WAM pass-through -> destination
renderQuanta > 0
audible/observable output
```

If this does NOT render, the bug is definitely in the WAM wrapper/node/registration configuration.

Do not investigate NAM until the pass-through WAM renders.

---

### 4. Compare against a known working SDK WAM

Instantiate one simple known-working WAM from the pinned `wam-examples` SDK repository in the SAME Phase 3 host and AudioContext.

Connect:

```text
OscillatorNode
   |
known working WAM
   |
destination
```

Verify that its processor receives render calls.

Then compare:

```text
working WAM AudioWorkletNode options
vs
NAM WamNode options
```

Compare at least:

* processor name / moduleId;
* `numberOfInputs`;
* `numberOfOutputs`;
* `outputChannelCount`;
* `channelCount`;
* `channelCountMode`;
* `channelInterpretation`;
* `processorOptions`;
* instanceId/groupId/moduleId;
* processor registration.

Report every relevant difference.

---

### 5. Investigate WamProcessor process contract

This is a priority.

Determine from the pinned SDK whether the custom DSP belongs in:

```js
process(inputs, outputs, parameters)
```

or another SDK hook such as:

```js
_process(...)
```

or equivalent.

Do not assume that directly overriding `process()` is correct.

If the base `WamProcessor.process()` performs:

* parameter interpolation;
* scheduled-event handling;
* lifecycle handling;
* calls to another overridable DSP method;

then preserve that mechanism and put NAM processing in the intended override point.

Do not bypass the SDK's normal event/parameter machinery.

---

### 6. Check whether the processor has accidentally become inactive

Inspect all possible return paths from the registered processor's render callback.

An AudioWorklet processor that returns `false` may no longer be called.

Verify that every steady-state path which should remain alive returns:

```js
true
```

Also check whether:

* the base WamProcessor can return false before NAM is ready;
* constructor state causes inactivity;
* initialization code changes a lifecycle flag;
* the subclass accidentally shadows an expected SDK property.

Instrument this minimally.

---

### 7. Check AudioWorkletNode topology

Explicitly inspect the actual Phase 3 `AudioWorkletNode`.

Report:

```text
numberOfInputs
numberOfOutputs
channelCount
channelCountMode
channelInterpretation
outputChannelCount
```

The NAM WAM is intended as a mono effect:

```text
mono input
    |
NAM
    |
mono output
```

Ensure that the node is configured as a processing effect with at least one output channel that Chrome will pull.

Do not rely on implicit defaults if the working Phase 2 node uses explicit topology.

Phase 2 used an explicit node configuration; compare Phase 3 with it.

---

### 8. Check processor registration identity

Verify that the exact processor name used by:

```text
registerProcessor(...)
```

matches the processor name passed to the `AudioWorkletNode` constructor.

Also verify that WAM `moduleId` and processor registration naming follow the pinned SDK convention.

Do not silently catch duplicate-registration or registration-name errors.

Temporarily surface them during diagnosis.

---

### 9. Verify graph pull

Use an analyzer or another trivial downstream node if helpful to establish that the WAM output is part of an actively pulled graph.

For example:

```text
Oscillator
   |
NAM/pass-through WAM
   |
AnalyserNode
   |
destination
```

Verify both:

* source is producing;
* destination graph is active;
* processor is actually pulled.

Do not solve this by introducing a second AudioWorkletNode.

The final NAM WAM must still contain only one AudioWorklet processing node.

---

### 10. Reintroduce complexity incrementally

Once the minimal pass-through WAM renders:

1. enable WAM parameter handling;
2. verify render still works;
3. instantiate NAM WASM;
4. verify render still works;
5. load NAM model;
6. verify render still works;
7. call `nam_process()`;
8. verify audible/observable DSP;
9. enable input gain;
10. enable output gain;
11. enable bypass;
12. enable state/model replacement.

Identify the exact step, if any, that stops rendering.

Do not change several architectural components simultaneously.

---

### 11. Preserve Phase 1 and Phase 2

Do not modify the working Phase 1 native/WASM tests except if required for shared build fixes.

Do not modify the Phase 2 standalone AudioWorklet merely to make Phase 3 appear successful.

It is the control implementation.

At every important point verify:

```text
Phase 2 renders
Phase 3 pass-through WAM renders
Phase 3 NAM WAM renders
```

---

### 12. Exit criteria

Phase 3b is complete only when:

1. a minimal pass-through WAM using the same pinned SDK receives render quanta;
2. the root cause of the original zero-render condition is identified and documented;
3. the NAM WAM receives continuous render quanta;
4. NAM `process()` is actually called;
5. generated oscillator input produces processed output;
6. inputGain changes the NAM input level;
7. outputGain changes output level;
8. bypass actually bypasses NAM DSP;
9. model replacement does not stop rendering;
10. WAM state restore does not stop rendering;
11. Phase 2 remains working;
12. only one AudioWorklet node is used by the NAM WAM.

After the fix, run the original Phase 3 performance comparison:

```text
Phase 2 standalone A2 Full
vs
Phase 3 WAM A2 Full
```

Then perform or provide the manual real-audio checks:

```text
external guitar interface -> NAM WAM -> output
dry guitar file -> NAM WAM -> output
```

Do NOT begin Phase 4.

Stop and report:

* exact root cause;
* exact code changes;
* working WAM processor lifecycle;
* AudioWorkletNode topology;
* processor registration mechanism;
* render quantum count;
* NAM call count;
* parameter DSP validation;
* bypass validation;
* model replacement validation;
* state restore validation;
* Phase 2 vs Phase 3 performance;
* any remaining manual test requirements.

# Phase 3c — Gain staging, level meters, and audio output routing

Phase 3 is complete and validated. Do **not** begin Phase 4 features such as cabinet IRs, Tone3000 integration, model browsing, or GUI redesign.

Phase 3c is a focused usability/audio-I/O refinement of the existing validated WAM.

The existing Phase 1, Phase 2, and Phase 3 DSP architecture must remain unchanged unless explicitly required below.

## Goals

Phase 3c adds:

1. correct and practical gain staging for both dry audio files and live guitar,
2. real-time input/output level meters in dBFS,
3. explicit audio output-device selection in the Phase 3 host,
4. preservation of the existing real-time guarantees and WAM parameter/state behavior.

---

# 1. Gain staging

## Problem

Dry guitar files can have near-normalized digital levels and currently drive even clean A2 NAM models much too hard unless `inputGain` is reduced dramatically.

A live guitar signal from an audio interface is normally much lower.

Do not solve this by silently changing NAM model data or applying undocumented attenuation inside the DSP.

Instead distinguish:

* source level,
* WAM input gain,
* NAM processing,
* WAM output gain.

The conceptual signal path must become:

```text
File / Live input
        |
   sourceTrim
        |
     WAM input
        |
    inputGain
        |
   INPUT METER
        |
       NAM
        |
   outputGain
        |
   OUTPUT METER
        |
 AudioContext destination
```

## Host source trim

Add a host-side gain stage before the WAM:

```text
source -> GainNode(sourceTrim) -> NAM WAM
```

This is a host feature, not a WAM parameter.

Expose:

```text
Source trim
```

in dB.

Range:

```text
-48 dB .. +12 dB
```

step:

```text
0.5 dB
```

For **live input**, default:

```text
0 dB
```

For **audio-file input**, default:

```text
-18 dB
```

The user must be able to change it.

When switching between File and Live modes, remember separate trim settings for both modes during the host session.

Do not automatically normalize audio files.

Do not implement AGC, compression, limiting, or loudness normalization.

The purpose is simply to provide practical calibration before the signal reaches the WAM.

The host should clearly display the current source trim value numerically, e.g.:

```text
Source trim: -18.0 dB
```

---

# 2. WAM input/output gain

Keep the existing WAM parameters:

```text
inputGain
outputGain
bypass
```

Do not replace them with host controls.

The plugin GUI and host parameter controls must continue to control the same WAM parameters through the WAM API.

Keep automation/state compatibility.

Because strongly normalized DI files may still require substantial attenuation, extend `inputGain` if necessary to:

```text
-48 dB .. +24 dB
```

instead of the current:

```text
-24 dB .. +24 dB
```

Keep the default at:

```text
0 dB
```

Before changing the parameter range, verify that this does not break the existing WAM SDK state/automation tests.

`outputGain` can remain:

```text
-24 dB .. +12 dB
```

---

# 3. Input and output meters

Add two mono level meters to the WAM GUI:

```text
IN
OUT
```

These are **audio level meters**, not merely visual representations of the gain-control values.

Use dBFS.

## Input meter location

Measure the actual signal fed into NAM:

```text
source
 -> sourceTrim
 -> WAM
 -> inputGain
 -> [INPUT METER]
 -> NAM
```

Therefore changing `inputGain` must visibly change the IN meter.

## Output meter location

Measure the final WAM signal after NAM and `outputGain`:

```text
NAM
 -> outputGain
 -> [OUTPUT METER]
 -> WAM output
```

In bypass mode, meter the actual bypass signal passing through the corresponding points.

## Meter values

For both meters compute:

* peak level
* RMS level

Convert to:

```text
dBFS = 20 * log10(amplitude)
```

Use a display floor of:

```text
-72 dBFS
```

Silence should display:

```text
-∞
```

or visually sit at the meter floor.

The GUI should show at least the peak value numerically, for example:

```text
IN   -18.4 dBFS
OUT   -6.7 dBFS
```

RMS may be represented as a slower meter body while peak is represented by a peak marker.

## Meter visual range

Recommended visual scale:

```text
  0
 -3
 -6
-12
-18
-24
-36
-48
-60
-72 dBFS
```

Do not call the measurement dBu or dBV because there is no analogue calibration reference.

"Level meter" or "VU meter" is acceptable in the GUI, but the displayed unit must explicitly be:

```text
dBFS
```

## Ballistics

Implement useful visual ballistics:

* fast peak attack,
* slower peak decay,
* RMS smoothing,
* optional short peak hold.

A reasonable GUI refresh rate is approximately:

```text
20–30 Hz
```

Do not update the DOM at AudioWorklet quantum rate.

---

# 4. Real-time constraints for metering

Metering must not compromise the validated Phase 3 real-time path.

Inside `NamProcessor._process()`:

* no object allocation,
* no arrays created,
* no promises,
* no logging,
* no JSON,
* no string creation,
* no per-quantum `postMessage()`.

Peak and RMS accumulation may use scalar numeric fields only.

For each relevant processing slice calculate:

```text
peak = max(abs(sample))
sumSquares += sample * sample
```

for input and output.

Accumulate meter statistics over multiple render quanta.

Send meter data to the main thread only at approximately 20–30 Hz.

The message can contain:

```js
{
  type: 'nam-meter',
  inputPeak,
  inputRms,
  outputPeak,
  outputRms
}
```

Prefer reusing the existing WAM node/processor message channel rather than creating another AudioWorkletNode.

There must still be exactly:

```text
one AudioWorkletNode
```

for the NAM WAM.

The meter must not alter DSP output.

---

# 5. Clip indicators

Add a small clip indicator for IN and OUT.

Trigger when:

```text
abs(sample) >= 1.0
```

or equivalent 0 dBFS condition.

The indicator should latch visibly for approximately 1–2 seconds so a transient clip can be seen.

This latch should preferably be implemented in the GUI/main thread from received peak data rather than adding timers to the AudioWorklet.

Do not add a limiter.

The meter is diagnostic only.

---

# 6. Audio output device selection

Add an output-device section to the Phase 3 host:

```text
Audio output:
[ System default             v ]
```

Enumerate:

```text
audiooutput
```

devices from:

```js
navigator.mediaDevices.enumerateDevices()
```

and display their labels when available.

The first/default choice should be:

```text
System default
```

## Preferred implementation

When supported, route the existing `AudioContext` directly using:

```js
await audioContext.setSinkId(deviceId)
```

For the default system device use the appropriate default sink behavior supported by the browser.

Do **not** create a second AudioContext simply to change the output device.

Changing output devices must not recreate the NAM WAM or reload the NAM model.

The graph should remain:

```text
source
 -> sourceTrim
 -> NAM WAM
 -> audioContext.destination
```

Only the AudioContext output sink changes.

## Permission handling

Because output-device enumeration/selection can require permission, handle the browser APIs explicitly.

Where supported, use:

```js
navigator.mediaDevices.selectAudioOutput()
```

when user interaction is required to authorize an output device.

Provide a button if necessary:

```text
Choose / authorize output device
```

Then refresh the output-device list.

Do not request permissions automatically during page load.

## Unsupported browsers

Feature-detect:

```js
audioContext.setSinkId
navigator.mediaDevices.selectAudioOutput
```

If direct Web Audio output selection is unsupported:

* keep the system default output,
* disable or hide unsupported controls,
* display a concise explanation in the host.

Do not introduce a complicated MediaStream/HTMLAudioElement fallback in Phase 3c unless it is genuinely necessary for the target Chrome validation environment.

Chrome on the development machine is the primary validation target.

---

# 7. Device hot-plugging

Reuse the existing:

```text
devicechange
```

handling.

When an input or output device is connected/disconnected:

* refresh both input and output lists,
* preserve the currently selected device when it still exists,
* fall back safely to the system default if the selected output disappears,
* do not leave duplicated or orphaned sources.

Do not reload the WAM.

---

# 8. Host UI

Organize the host's audio I/O section approximately as:

```text
AUDIO SOURCE

Source:
[ Live input / file ]

Input device:
[ ... ]

Source trim:
[-18.0 dB -----------]

AUDIO OUTPUT

Output device:
[ System default       v ]
[ Choose/authorize output device ]

NAM WAM
...
```

The plugin GUI should contain:

```text
NAM A2

Model: ...

INPUT                    OUTPUT
[ meter ]                [ meter ]
-18.4 dBFS               -7.2 dBFS

Input Gain               Output Gain
...

Bypass
```

Do not spend Phase 3c on elaborate styling.

Functional, readable CSS is sufficient.

---

# 9. Tests

Add automated tests covering at least:

### Source trim

* file source defaults to -18 dB,
* live source defaults to 0 dB,
* changing file trim does not overwrite remembered live trim,
* source switching leaves only one active source.

### Metering

With a deterministic test signal:

* meter messages are produced,
* input peak approximately matches expected signal level,
* changing `inputGain` changes input meter level,
* changing `outputGain` changes output meter level,
* bypass still produces coherent input/output meter readings,
* silence reaches meter floor,
* no NaN/Infinity values are sent.

Allow appropriate tolerances.

Do not require exact dB values from a timer-dependent browser test.

### Output device

Mock where necessary:

* `audiooutput` devices are enumerated,
* selecting an output calls `AudioContext.setSinkId()` with the expected device ID,
* default output works,
* disappearing selected device falls back safely,
* unsupported `setSinkId()` is handled without breaking audio.

---

# 10. Performance regression

After implementing meters, rerun the existing A2-Full benchmark at:

```text
48 kHz
128 frames
```

Compare Phase 3c to the validated Phase 3 result:

```text
Phase 3 WAM:
average 0.3527 ms
p95     1 ms
maximum 1 ms
0 NAM failures
0 deadline misses
```

Because timing resolution is coarse, do not claim tiny speedups or regressions.

Phase 3c passes if:

* there are zero NAM failures,
* zero measured deadline misses,
* no meaningful performance regression,
* metering introduces no obvious rendering instability.

If metering noticeably affects performance, optimize meter accumulation/reporting rather than modifying NAM DSP.

---

# 11. Manual exit tests

At completion report exactly what remains for manual testing.

I will manually verify:

1. clean dry guitar through a clean A2 model,
2. useful gain staging with file source trim around -18 dB,
3. input meter behavior while changing source trim and WAM input gain,
4. output meter behavior while changing output gain,
5. clipping indicators,
6. live guitar input,
7. input-device switching,
8. output-device switching while audio is running,
9. File → Live → File switching,
10. bypass,
11. Full → Lite → restored Full state,
12. absence of clicks/dropouts/doubled audio except the already-known model-load interruption.

---

# Phase boundary

Do not begin Phase 4.

At the end provide a concise report containing:

* files changed,
* source-trim architecture,
* exact meter measurement points,
* meter reporting rate,
* output-device implementation/API used,
* browser feature-detection behavior,
* automated test results,
* Phase 3c performance result,
* remaining manual tests.

Do not redesign working Phase 1–3 code beyond what Phase 3c requires.

Continue the NAM A2 WAM project with **Phase 3d only**.

Phase 1, Phase 2, Phase 3, and Phase 3c are complete and validated.

Do **not** start Phase 4 implementation.

I have now added two folders under the WAM host directory:

* `models/`
* `IRs/`

The `models/` directory contains real `.nam` captures, sometimes directly in the folder and sometimes grouped in subdirectories.

Example: one subdirectory contains around 22 captures of the same 1971 Fender Twin Reverb with different settings.

The `IRs/` directory contains cabinet/speaker impulse responses.

For Phase 3d, **analyze the `.nam` files in `models/` recursively**.

Do not modify the NAM DSP, do not load IRs into the signal path, and do not implement Phase 4 features yet.

## Goal

Determine what information is actually present in the real `.nam` files we have, especially regarding:

* model architecture,
* metadata,
* input/output calibration,
* amp/cab/full-rig information,
* explicit or implicit IR/cabinet representation,
* consistency across related captures.

Use the real files as the primary evidence.

## 1. Recursively inventory all `.nam` files

Walk the complete `models/` tree recursively.

For every `.nam` file record:

* relative path,
* filename,
* parent folder,
* file size,
* JSON parse success/failure,
* detected NAM model architecture/type,
* version fields,
* sample rate if present,
* any metadata object/fields,
* any calibration/input/output level fields,
* any descriptive fields,
* any tags or user metadata,
* any fields whose meaning is unclear.

Do not assume all `.nam` files have the same schema.

## 2. Schema exploration

Collect all unique JSON key paths found across the files.

For example:

```text
architecture
config.*
metadata.*
metadata.name
metadata.gear.*
...
```

Produce:

* keys present in all models,
* keys present in most models,
* optional/rare keys,
* keys unique to particular captures/folders.

For each field, show a few representative values.

Do not dump neural-network weight arrays.

Large numeric arrays should only be summarized by:

* path,
* dimensions/count,
* numeric type if relevant.

## 3. Input/output calibration

Investigate specifically whether the `.nam` files contain information corresponding to concepts such as:

* input level,
* output level,
* dBu calibration,
* loudness,
* gain,
* normalization,
* expected input amplitude.

Search both obvious and non-obvious field names.

If NeuralAmpModelerCore exposes calibration values derived from these models, trace where those values originate in the `.nam` JSON.

Report:

* exact JSON field,
* units,
* representative values,
* whether present consistently,
* how NeuralAmpModelerCore consumes it.

If the Core derives such information rather than loading it directly, explain that distinction.

## 4. Cabinet / IR investigation

This is the most important question.

Determine whether any `.nam` file in `models/` contains:

A. an explicit impulse response,

B. explicit cabinet/speaker/micro data,

C. only metadata indicating a cabinet/micro/full rig,

D. no explicit cabinet information, meaning cabinet/mic response may only be implicitly learned by the neural model.

Search for:

* IR-like arrays,
* FIR coefficients,
* convolution data,
* impulse-response fields,
* cabinet names,
* speaker names,
* microphone names,
* amp/cab flags,
* model type labels,
* capture-chain descriptions.

Do not infer the presence of an explicit IR merely because a model may sound like a full rig.

For every claim, point to the actual field/path or NeuralAmpModelerCore code responsible.

## 5. Amp-only vs full-rig detectability

Determine whether the files themselves allow us to reliably distinguish:

```text
amp-only / direct / load-box capture
```

from:

```text
amp + cabinet + microphone / full-rig capture
```

Classify the answer as one of:

* reliably machine-detectable,
* heuristically detectable,
* metadata-dependent,
* not detectable from the `.nam` file alone.

If only heuristics are possible, list the heuristics and explain why they are not guaranteed.

Do not invent a classification when the evidence does not support one.

## 6. Analyze model families / subfolders

For directories containing multiple related captures, such as the 1971 Twin Reverb set:

compare the models and determine what changes between captures.

Look especially at:

* metadata,
* names,
* gain/settings information,
* calibration values,
* architecture,
* model size,
* neural weights/configuration,
* amp/cab/mic descriptions.

Produce a compact table for each obvious family.

For the Twin Reverb example, try to infer from filenames/metadata what the 22 variants represent, but clearly distinguish:

* explicit metadata,
* filename-derived information,
* inference.

## 7. Check A2 models specifically

Identify which files are A2 models.

For those models, compare their structure against the A2 format currently used by our WAM.

Verify whether our existing loader ignores any useful metadata that could later be surfaced in the GUI.

Do not change the loader yet.

Report potential useful fields only.

## 8. NeuralAmpModelerCore cross-check

Inspect the exact pinned NeuralAmpModelerCore version already used by this project.

Trace how it parses the relevant `.nam` fields.

Especially inspect anything related to:

* GetInputLevel()
* output level / loudness
* model metadata
* sample rate
* architecture detection
* IR / convolution support

Distinguish carefully between:

1. functionality supported somewhere in NeuralAmpModelerCore,
2. data actually embedded in our `.nam` files,
3. features currently used by our WAM.

Do not conclude that `.nam` embeds an IR merely because NeuralAmpModelerCore also contains convolution/IR DSP classes.

## 9. Compare with the `IRs/` directory only structurally

Do not implement or load the IRs.

For Phase 3d, just inventory:

* number of IR files,
* formats/extensions,
* directory organization,
* obvious naming conventions.

If convenient, inspect WAV headers only for:

* sample rate,
* channel count,
* duration / sample count,
* bit depth / encoding.

Do not perform convolution or add them to the audio graph.

The objective is merely to understand what assets are available for Phase 4.

## 10. Produce a machine-readable analysis file

Create a generated report such as:

```text
examples/wam/model-analysis.json
```

containing summarized information for every model.

Do not include huge neural-network weight arrays.

Suggested structure:

```json
{
  "summary": {},
  "models": [],
  "families": [],
  "schema": {},
  "irAssets": []
}
```

This file is diagnostic/development data only and should not be used by the runtime yet.

## 11. Produce a human-readable report

Create or update a development document, for example:

```text
docs/phase3d-model-analysis.md
```

Include:

* total number of `.nam` models,
* number of A2 models,
* architectures found,
* schema summary,
* calibration findings,
* explicit IR findings,
* amp-only/full-rig detectability,
* model-family observations,
* IR asset inventory,
* implications for Phase 4.

## 12. Questions the final report MUST answer

Answer these explicitly:

1. Do any of the `.nam` files in our `models/` folder contain an explicit impulse response?

2. Can a `.nam` file contain cabinet/speaker/micro response only implicitly as part of the learned neural model?

3. Do our files expose enough metadata to tell whether a capture is amp-only or full-rig?

4. Can this distinction be made automatically and reliably?

5. What input-level/calibration metadata exists in our real models?

6. Does NeuralAmpModelerCore expose useful level/calibration information that our current WAM is not yet using?

7. Are the related Twin Reverb captures structurally identical models with different weights/settings, or do they differ in architecture/configuration too?

8. What information from `.nam` files would be useful to expose in a future model browser?

9. Are there fields we should preserve when saving/restoring WAM state?

10. Based strictly on the evidence, what are the consequences for Phase 4 cabinet-IR design?

## Phase boundary

Do not implement:

* IR convolution,
* cabinet enable/disable,
* automatic cabinet detection,
* Tone3000,
* model browser UI,
* new audio routing,
* new DSP.

Phase 3d is investigation and documentation only.

At completion report:

1. files created/changed,
2. number of models analyzed,
3. architectures found,
4. important schema/metadata findings,
5. calibration findings,
6. explicit IR findings,
7. amp-only/full-rig detectability conclusion,
8. Twin Reverb family findings,
9. IR asset inventory,
10. recommended Phase 4 architecture based on the evidence.

Be conservative: if a conclusion cannot be proven from the files or pinned NeuralAmpModelerCore source, say so explicitly.

Phase 4a implementation constraint

Before implementing the Cabinet IR WAM, inspect the exact pinned NeuralAmpModelerCore and the reference NeuralAmpModelerPlugin code used for impulse-response/convolution processing.

The preferred production architecture is:

source
  -> Cabinet WAM AudioWorklet
       -> C++/WASM convolution DSP
  -> output

with exactly one AudioWorkletNode for the Cabinet WAM, analogous to the existing NAM A2 WAM.

Prefer reusing the official NAM/Core convolution or ImpulseResponse implementation if it is sufficiently generic, real-time safe, and separable from NAM inference.

Do not use Web Audio ConvolverNode as the production implementation unless the official/reference convolution code proves unsuitable.

If the NAM/Core implementation is unsuitable, explain precisely why before choosing another implementation.

A different efficient partitioned FFT convolution implementation in C++/WASM is preferable to a multi-node Web Audio implementation.

Do not implement long IRs using naive O(N) per-sample convolution.

Use ConvolverNode as a reference implementation

Where practical, build a test/reference path using Web Audio ConvolverNode.

Use it to compare:

impulse response output,
deterministic test-signal output,
numerical accuracy where meaningful,
handling of the supplied cabinet IRs,
real-time performance.

The purpose of ConvolverNode is validation/reference, not the final Cabinet WAM architecture.

Report:

which convolution code the official NAM plugin actually uses;
whether it comes from NeuralAmpModelerCore or plugin-specific code;
convolution strategy used (direct, FFT, partitioned FFT, etc.);
whether it is suitable for an independent Cabinet WAM;
dependencies required to compile it to WASM;
whether it performs allocations or other unsafe operations during steady-state processing;
numerical comparison with a reference convolution;
comparison against Web Audio ConvolverNode;
measured Cabinet-only performance at 48 kHz / 128 frames;
measured NAM A2-Full -> Cabinet WAM performance.

Stop and report before replacing the preferred architecture with ConvolverNode or another design if an unexpected architectural problem is found.

mplement a small Phase 4a.1 usability update. Do not redesign either WAM.

1. Cabinet IR level matching

The current Cabinet WAM intentionally preserves the authored amplitude of the loaded IR. In real guitar testing this results in noticeable level changes between Cabinet enabled and bypassed.

Add an optional per-IR Level Match feature.

At IR load time, outside the AudioWorklet real-time path, compute an energy/RMS-based gain compensation from the decoded/resampled impulse response. A suitable initial definition is based on the L2 norm:

rmsGain = sqrt(sum(h[n]^2))
compensation = 1 / rmsGain
compensationDb = 20 * log10(compensation)

Verify the exact interpretation mathematically and document it before implementing.

Apply only a scalar gain: never alter the IR coefficients in a way that changes its frequency response.

Requirements:

Level Match ON/OFF;
default ON;
display the calculated compensation in dB;
preserve normal Cabinet outputGain as an independent user trim;
no calculation in _process();
no hidden fixed attenuation such as the reference plugin's -18 dB;
sensible protection/clamping for pathological/silent IRs;
state save/restore includes the setting;
switching Level Match must be smoothed/click-free.

Analyze all IRs currently under examples/IRs/, including nested directories, and report their raw energy and resulting compensation dB.

2. Automatic Cabinet bypass for NAM full-rig captures

Implement this in the validation HOST, not inside the Cabinet WAM. The Cabinet WAM must remain completely NAM-independent.

When a NAM model is loaded, inspect the complete available metadata.

Primary detection:

metadata.gear_type === "full-rig"

case-insensitive.

Filename/name fallback:

recognize full rig, full-rig, full_rig, and fullrig, case-insensitive.

Do not use the generic word full alone.

Add host Cabinet routing mode:

AUTO / ON / BYPASS

Semantics:

AUTO:
  known full-rig NAM -> Cabinet bypassed
  otherwise          -> Cabinet enabled

ON:
  Cabinet enabled regardless of NAM metadata

BYPASS:
  Cabinet bypassed regardless of NAM metadata

AUTO should be the default.

Display why AUTO made its decision, for example:

Cabinet AUTO: bypassed — full-rig metadata
Cabinet AUTO: bypassed — "full rig" detected in model name
Cabinet AUTO: active — no full-rig indication

Changing NAM Full/Lite variant must not alter this decision because both variants belong to the same capture.

Restoring NAM state must reevaluate the AUTO Cabinet decision.

Manual ON/BYPASS selection must override automatic detection.

Do not modify NAM inference, Cabinet convolution, model loading, IR loading, or the validated single-AudioWorklet architecture.

Add focused automated tests and leave existing Phase 1–4a tests passing.

# Phase 4a.2 — Portable Factory Asset Browsers + Static Manifests + Per-IR Trim

## Context

Phases 1–4a.1 are complete and validated, including real-guitar testing.

The current validated audio architecture is:

```text
source
  -> sourceTrim
  -> NAM A2 WAM
  -> Cabinet IR WAM
  -> AudioContext destination
```

The NAM A2 WAM owns exactly one AudioWorkletNode and runs the pinned official NeuralAmpModelerCore A2 DSP through C++/WASM.

The Cabinet WAM owns exactly one AudioWorkletNode and runs pinned NeuralAmpModelerCore `nam::Linear` partitioned convolution through C++/WASM.

Phase 4a.1 added:

* Cabinet Level Match based on the L2 norm of the decoded/resampled IR;
* Level Match default ON;
* independent Cabinet Output Gain;
* click-free Level Match transitions;
* host-level Cabinet routing modes `AUTO / ON / BYPASS`;
* automatic Cabinet bypass for NAM full-rig captures;
* recursive IR analysis.

All validated DSP behavior must remain intact.

This phase must not redesign either WAM DSP architecture.

---

# 1. Main objective

Implement **Phase 4a.2 — Portable Factory Asset Browsers + Static Manifests + Per-IR Trim**.

The main goals are:

1. make the NAM and Cabinet WAMs self-contained and portable;
2. remove all server-specific asset discovery from the plugins;
3. make `models/` the NAM plugin's Factory Model Library;
4. make `IRs/` the Cabinet plugin's Factory IR Library;
5. use static generated JSON manifests to describe Factory assets;
6. provide a script to regenerate those manifests after assets are added, removed, or moved;
7. display Factory NAM models directly inside the NAM WAM GUI;
8. display Factory IRs directly inside the Cabinet WAM GUI;
9. preserve recursive folder hierarchy as browser groups;
10. retain external file selectors;
11. add externally loaded assets to the corresponding browser during the session;
12. avoid duplicate browser entries;
13. add a remembered user Trim independently for each IR;
14. preserve automatic Level Match;
15. preserve host-level AUTO full-rig Cabinet routing.

A plugin deployment must require only ordinary static hosting.

No dynamic server API, directory listing endpoint, or custom discovery server should be required.

---

# 2. Portability requirement

The WAMs must work when deployed to any normal static web server.

For example, deployment should work with:

* GitHub Pages;
* nginx static hosting;
* Apache static hosting;
* Vite/webpack static output;
* another WAM host serving plugin files statically.

The plugin must not depend on:

* Node.js at runtime;
* Express;
* filesystem APIs;
* dynamic server routes;
* server directory scanning;
* server-generated JSON responses;
* custom asset-discovery endpoints.

A build/development script may use Node, Python, Bash, `find`, etc. to generate static manifest files.

Runtime plugin code must only consume static files.

---

# 3. Preserve validated DSP architecture

Do not modify:

* NAM A2 inference;
* A2 Lite/Full behavior;
* `nam::Linear` convolution;
* Cabinet IR coefficients;
* IR resampling semantics;
* Level Match mathematics;
* meter semantics;
* source trim;
* output-device handling;
* WAM parameter architecture;
* NAM state behavior;
* Cabinet state behavior;
* AUTO full-rig semantics.

Do not use Web Audio `ConvolverNode` in production.

Do not introduce additional production AudioWorkletNodes.

Do not perform asset catalog work inside AudioWorklets.

---

# 4. Reorganize plugins as self-contained packages

Conceptually target:

```text
src/
  nam-wam/
    index.js
    NamNode.js
    NamProcessor.js
    gui.js
    descriptor.json
    ...
    models/
      ...
    models-manifest.json

  cabinet-wam/
    index.js
    CabinetNode.js
    CabinetProcessor.js
    gui.js
    descriptor.json
    ...
    IRs/
      ...
    irs-manifest.json
```

Adapt exact paths to repository conventions if necessary.

The architectural rule is:

```text
NAM WAM owns:
  models/
  models-manifest.json

Cabinet WAM owns:
  IRs/
  irs-manifest.json
```

These are the canonical Factory Asset locations.

Do not leave competing canonical copies elsewhere.

---

# 5. Factory Asset semantics

Treat:

```text
nam-wam/models/
```

as the:

```text
Factory Model Library
```

Treat:

```text
cabinet-wam/IRs/
```

as the:

```text
Factory IR Library
```

These assets conceptually ship with the plugins.

Folder hierarchy defines browser grouping.

Example:

```text
models/
  Fender/
    Twin/
      Clean.nam
      Driven.nam
  Marshall/
    JCM800.nam
```

becomes:

```text
FACTORY MODELS

▾ Fender
   ▾ Twin
      Clean
      Driven

▾ Marshall
      JCM800
```

Likewise for IRs.

Support arbitrary nesting depth.

---

# 6. Static Factory manifests

Do not scan directories at runtime.

Generate static JSON manifest files offline.

Use:

```text
models-manifest.json
```

for NAM Factory Models.

Use:

```text
irs-manifest.json
```

for Cabinet Factory IRs.

The plugin loads the appropriate manifest through a URL relative to the plugin/module.

For example conceptually:

```js
const manifestUrl = new URL("./models-manifest.json", import.meta.url);
const manifest = await fetch(manifestUrl).then(r => r.json());
```

and:

```js
const manifestUrl = new URL("./irs-manifest.json", import.meta.url);
```

Use the project's existing module-loading conventions if `import.meta.url` is not appropriate.

Do not hardcode deployment root paths.

---

# 7. Factory manifest format

Choose a stable, simple JSON format.

A flat list is preferred because the hierarchy can be derived from `relativePath`.

Conceptually:

```json
{
  "version": 1,
  "generatedAt": "...",
  "assets": [
    {
      "id": "factory:Fender/Twin/Clean.nam",
      "filename": "Clean.nam",
      "relativePath": "Fender/Twin/Clean.nam",
      "groups": ["Fender", "Twin"],
      "displayName": "Clean",
      "type": "nam"
    }
  ]
}
```

For IRs:

```json
{
  "version": 1,
  "generatedAt": "...",
  "assets": [
    {
      "id": "factory:Fender/Twin/CLEAN.wav",
      "filename": "CLEAN.wav",
      "relativePath": "Fender/Twin/CLEAN.wav",
      "groups": ["Fender", "Twin"],
      "displayName": "CLEAN",
      "type": "ir"
    }
  ]
}
```

The exact schema may differ, but preserve:

* stable ID;
* filename;
* relative path;
* hierarchy/groups;
* type;
* useful display information.

Factory URLs should be derived from the manifest file location plus `relativePath`, not stored as absolute deployment URLs.

---

# 8. Manifest determinism

Manifest generation must be deterministic.

Sort assets lexicographically using normalized relative paths.

Normalize path separators to:

```text
/
```

even when generation occurs on another platform.

Do not depend on filesystem enumeration order.

Avoid random IDs.

Do not use modification timestamp as the primary Factory identity.

Moving a Factory asset intentionally changes its path-based identity.

---

# 9. Manifest generated timestamp

A `generatedAt` field is optional.

If included, realize that it makes the file change on every regeneration.

Prefer either:

* omit `generatedAt`, for fully deterministic output;
* or support an option to omit it.

For version control friendliness, deterministic content is preferable.

Use:

```json
"version": 1
```

for schema versioning.

---

# 10. NAM manifest metadata

For NAM files, the generator may parse `.nam` JSON and add useful metadata to the static manifest.

Prefer doing this at generation time rather than requiring every `.nam` file to be fetched/parsing merely to render the browser.

Include useful fields where available:

```text
metadata.name
metadata.gear_make
metadata.gear_model
metadata.gear_type
metadata.tone_type
metadata.modeled_by
metadata.trainer
metadata.date
architecture
version
sample_rate
```

Do not fail manifest generation merely because optional metadata is missing.

Always preserve the actual filename and relative path.

Do not merge assets based on metadata names.

If a `.nam` file is invalid JSON or unusable, report it clearly and return a non-zero exit code rather than silently omitting it.

---

# 11. IR manifest metadata

For IR files, the minimum manifest does not need to decode the entire WAV.

However, if the existing tooling already has safe WAV metadata extraction, optionally include:

```text
sample rate
channels
sample format / bit depth
frame count
duration
```

Do not make manifest generation unnecessarily fragile.

The primary purpose of the manifest is asset listing and grouping.

The existing runtime decode/resample path remains authoritative.

---

# 12. Manifest regeneration script

Create a user-facing script:

```text
tools/regenerate-factory-assets.sh
```

It must regenerate both:

```text
models-manifest.json
irs-manifest.json
```

from the canonical Factory directories.

The intended workflow is:

```bash
./tools/regenerate-factory-assets.sh
```

after adding, removing, renaming, or moving Factory assets.

The script must be safe to run repeatedly.

---

# 13. Script behavior

The script must:

1. locate the repository root robustly from its own location;
2. locate the canonical NAM `models/` directory;
3. locate the canonical Cabinet `IRs/` directory;
4. recursively enumerate supported files;
5. ignore hidden files and irrelevant filesystem metadata;
6. sort entries deterministically;
7. normalize paths to `/`;
8. generate the NAM manifest;
9. generate the IR manifest;
10. write formatted human-readable JSON;
11. use temporary files plus atomic replacement where practical;
12. return non-zero on validation/generation failure;
13. print a concise summary.

Example output:

```text
Generating Factory Asset manifests...

NAM:
  30 models
  -> src/nam-wam/models-manifest.json

Cabinet:
  36 IRs
  -> src/cabinet-wam/irs-manifest.json

Done.
```

---

# 14. Bash script versus helper program

The user-facing entry point should be Bash:

```bash
./tools/regenerate-factory-assets.sh
```

However, do not implement complex JSON parsing of `.nam` files using fragile shell string manipulation.

It is acceptable, and probably preferable, for the Bash script to call a small repository-local Node `.mjs` helper.

For example:

```text
tools/
  regenerate-factory-assets.sh
  generate-factory-manifests.mjs
```

The Bash script remains the convenient public command.

The Node helper can safely:

* recurse directories;
* parse `.nam` JSON;
* inspect metadata;
* generate JSON;
* validate duplicates;
* sort paths.

Do not add a third-party npm dependency if standard Node APIs are sufficient.

---

# 15. Required script portability

Target:

```text
macOS
Linux
```

The user works on macOS, so the script must not depend on GNU-only options such as:

```text
find -printf
readlink -f
sed extensions only available on GNU
```

unless alternatives are provided.

Prefer using Node for recursive filesystem work to avoid BSD/GNU shell portability problems.

The Bash wrapper can simply find the repo root and invoke Node.

Use:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

or equivalent robust shell behavior.

---

# 16. npm convenience command

Also add a package command, for example:

```json
{
  "scripts": {
    "factory-assets": "./tools/regenerate-factory-assets.sh"
  }
}
```

or:

```text
npm run factory-assets
```

Use naming consistent with the existing `package.json`.

Both commands should regenerate the same manifests.

---

# 17. Manifest validation

The generator must detect obvious problems.

For Factory assets, reject or clearly report:

* duplicate normalized relative paths;
* invalid `.nam` JSON;
* malformed manifest output;
* unsupported input where validation is expected.

Do not silently skip assets because of parsing errors.

For WAV files that are only being indexed by filename/path, do not require full audio decoding unless metadata extraction is explicitly implemented.

---

# 18. Plugin runtime manifest loading

The NAM GUI/node loads:

```text
models-manifest.json
```

as a static asset.

The Cabinet GUI/node loads:

```text
irs-manifest.json
```

as a static asset.

Handle missing/failed manifests gracefully.

If a manifest cannot load:

* the WAM itself must still instantiate;
* external file loading must still work;
* display a useful GUI status such as `Factory library unavailable`;
* do not crash audio processing.

---

# 19. No host dependency for Factory assets

Revise any previous host-driven Factory discovery.

The validation host must **not** enumerate the NAM `models/` folder.

The validation host must **not** enumerate the Cabinet `IRs/` folder.

Factory catalogs belong to and are loaded by their respective plugins.

The host should not know individual Factory assets.

This is essential for plugin portability.

---

# 20. Optional host-provided assets

Keep the conceptual ability for another host to provide additional assets if cleanly supported.

These are separate from Factory assets.

Conceptually:

```text
Factory
Host
External
```

But do not make Host catalog support a prerequisite for Phase 4a.2.

Factory + External are the important paths.

---

# 21. NAM Factory Model browser

Add a hierarchical Factory Model browser directly inside the NAM GUI.

Conceptually:

```text
MODELS

[ Search models... ]

▾ Fender
   ▾ Twin
      Clean
      Driven
      Sweet Spot

▾ Marshall
      Plexi
      JCM800

▸ Mesa

▾ External
      My Custom Amp

[ Load external NAM... ]
```

Nested folders must work recursively.

Root-level models remain visible.

Folder groups must be collapsible.

The currently loaded model must be visibly selected.

Clicking a model loads it immediately using the existing validated model-loading path.

Do not duplicate model-loading logic.

---

# 22. NAM browser display information

Prefer manifest-extracted authored model names when useful.

Preserve enough context to distinguish captures.

Do not merge models because they share:

```text
metadata.name
```

Identity remains path/content based.

A useful row may show:

```text
Clean
Fender Twin Reverb
```

but avoid a major UI redesign.

---

# 23. Cabinet Factory IR browser

Add a hierarchical Factory IR browser directly inside the Cabinet GUI.

Conceptually:

```text
IMPULSE RESPONSES

[ Search IRs... ]

▾ Fender
   ▾ Twin
      CLEAN
      BALANCED
      MIDS

▾ Marshall
   ▸ Greenback

▾ tests
      ...

▾ External
      My Own V30

[ Load external IR... ]
```

Nested folders must work recursively.

Root-level IRs remain visible.

Current IR must be visibly selected.

Clicking an IR uses the existing validated IR path:

```text
load/fetch
 -> decodeAudioData
 -> resample to context rate
 -> Level Match analysis
 -> worklet transfer
 -> nam::Linear
```

Do not create a second IR pipeline.

---

# 24. Search/filter

Both browsers need simple filtering.

Use:

```text
Search models...
Search IRs...
```

Simple case-insensitive substring matching is sufficient.

Match:

* display name;
* filename;
* relative path;
* useful NAM metadata fields where available in the manifest.

When a child asset matches, show the parent folder hierarchy necessary to reach it.

Do not add fuzzy-search dependencies.

---

# 25. External NAM loading

Keep:

```text
Load external NAM...
```

After successful loading:

* add the asset to an `External` browser group;
* highlight/select it;
* allow immediate reselection without another file picker;
* avoid duplicates;
* do not write it to the Factory `models/` directory;
* do not modify `models-manifest.json`.

External entries are runtime/session assets.

---

# 26. External IR loading

Keep:

```text
Load external IR...
```

After successful loading:

* add the IR to an `External` browser group;
* highlight/select it;
* allow immediate reselection;
* avoid duplicates;
* do not write it to Factory `IRs/`;
* do not modify `irs-manifest.json`.

---

# 27. Stable Factory identity

Use normalized relative path.

Examples:

```text
factory:Fender/Twin/Clean.nam
factory:Fender/Twin/CLEAN.wav
factory:tests/Marshall/SM57.wav
```

Do not key assets by filename only.

Factory assets with the same filename in different folders are distinct.

---

# 28. External identity

Define a robust External identity.

Do not use filename alone.

Use browser File information and/or content hashing.

A content hash is preferable if inexpensive and performed outside the real-time path.

For example conceptually:

```text
external:sha256:<hash>
```

This allows the same external file selected twice to be recognized as the same asset even if the user navigates to it again.

Do not perform hashing in the AudioWorklet.

Document the final strategy.

---

# 29. External asset lifetime

No persistent asset database in Phase 4a.2.

External assets must remain usable during the current application session.

Existing WAM state should continue to preserve/restorable model or IR data as already implemented.

If complete persistent External libraries across browser restarts require IndexedDB, leave that for a later phase.

---

# 30. Per-IR remembered Trim

Add an independent user Trim for each IR.

Do not replace Level Match.

Conceptually:

```text
effectiveGainDb =
    automaticLevelMatchDb
    + perIrTrimDb
    + cabinetOutputGainDb
```

when Level Match is enabled.

When Level Match is disabled:

```text
effectiveGainDb =
    perIrTrimDb
    + cabinetOutputGainDb
```

Do not alter IR coefficients.

Scalar gain only.

---

# 31. Default Trim behavior

For an untouched IR:

```text
Trim = 0 dB
```

Therefore only automatic Level Match is applied.

Example:

```text
Auto Level Match: -7.85 dB
IR Trim:           0.00 dB
Output Gain:       0.00 dB

Effective:        -7.85 dB
```

If the user sets:

```text
IR Trim: +1.50 dB
```

then remember `+1.50 dB` for that IR.

Switch away and back: restore it automatically.

---

# 32. Trim range

Use:

```text
-12 .. +12 dB
```

with preferably:

```text
0.1 dB
```

resolution.

Use click-free smoothing.

Reuse existing scalar transition/gain smoothing mechanisms where clean.

No expensive per-IR calculations occur in `_process()`.

---

# 33. Reset Trim

Add:

```text
Reset Trim
```

for the selected IR.

It sets:

```text
perIrTrimDb = 0
```

for that IR only.

It must not disable Level Match.

---

# 34. Trim identity and memory

Remember per-IR Trim using stable asset identity.

Therefore:

```text
factory:Fender/Twin/CLEAN.wav
```

and:

```text
factory:tests/CLEAN.wav
```

can have different Trim values.

An External `CLEAN.wav` is separate again.

Do not use filename as the Trim key.

---

# 35. Cabinet Output Gain remains global

Do not confuse:

```text
automatic Level Match
per-IR Trim
Cabinet Output Gain
```

They are independent controls.

Per-IR Trim follows the IR.

Cabinet Output Gain remains the global output control for the Cabinet plugin.

---

# 36. AUTO full-rig behavior

Preserve Phase 4a.1 exactly.

AUTO routing stays in the host.

The Cabinet WAM remains NAM-independent.

Detection remains:

Primary:

```text
metadata.gear_type === "full-rig"
```

case-insensitive.

Fallback:

```text
full rig
full-rig
full_rig
fullrig
```

Do not match generic:

```text
full
```

Modes remain:

```text
AUTO / ON / BYPASS
```

---

# 37. Browser NAM selection and AUTO reevaluation

Selecting a Factory NAM from the new browser must trigger the same host AUTO reevaluation as loading via file selector.

Example:

```text
select amp-only NAM
 -> Cabinet AUTO active
```

```text
select full-rig NAM
 -> Cabinet AUTO bypass
```

A2 Full/Lite switching must not change capture classification.

---

# 38. State restoration

State restoration must reconcile with manifests.

If the restored asset corresponds to:

```text
factory:Fender/Twin/Clean.nam
```

select the existing Factory entry.

Do not create an External duplicate.

Same for Factory IRs.

If restored state represents an External asset not currently present in the External list, recreate exactly one External entry.

Restore its per-IR Trim.

---

# 39. Update existing analysis tooling

The Phase 4a.1 IR Level Match analysis must now use the canonical:

```text
cabinet-wam/IRs/
```

Factory directory.

Its analysis output may remain a separate diagnostics JSON or be moved as appropriate.

Do not confuse:

```text
irs-manifest.json
```

with:

```text
IR level analysis diagnostics
```

They serve different purposes.

The Factory manifest is runtime asset indexing.

The analysis JSON is diagnostic/test output.

---

# 40. Large Factory libraries

Do not fetch/load every asset at startup.

The manifest can be loaded entirely because it is lightweight.

But:

* do not fetch all `.nam` payloads at startup;
* do not fetch/decode all WAV files at startup;
* do not instantiate DSP models merely to list them;
* do not initialize convolution engines for unselected IRs.

Only load the selected asset payload.

---

# 41. Migration

Move the existing Factory NAM files into the NAM WAM package.

Move the existing Factory IR files, including nested test folders, into the Cabinet WAM package.

Update all references.

Search the repository for old asset paths.

Update:

* tests;
* build scripts;
* example host;
* benchmarks;
* IR analysis;
* documentation;
* any development tooling.

Remove obsolete server asset-discovery routes if they are now unnecessary for Factory assets.

Do not remove unrelated server functionality used by the development environment unless safe.

The plugins themselves must not require it.

---

# 42. Automated manifest tests

Test manifest generation with temporary fixture trees.

Verify:

* recursion;
* nested directories;
* root-level assets;
* deterministic sorting;
* `/` path normalization;
* correct group arrays;
* stable IDs;
* same filename in different folders;
* invalid NAM JSON handling;
* ignored non-NAM files in model tree;
* ignored non-WAV files in IR tree;
* repeat generation produces byte-identical output if inputs did not change;
* script exits non-zero on fatal generation errors.

---

# 43. Automated browser tests

Add tests for:

* static manifest loading;
* missing manifest graceful behavior;
* Factory NAM grouping;
* Factory IR grouping;
* arbitrary nesting;
* selected item;
* filtering;
* external insertion;
* duplicate external handling;
* same filename across Factory folders;
* Factory/External distinction;
* state/catalog reconciliation.

---

# 44. Per-IR Trim tests

Test:

* default Trim 0 dB;
* different Trims for several IRs;
* switching IRs restores each Trim;
* Reset Trim;
* Level Match ON + Trim;
* Level Match OFF + Trim;
* Cabinet Output Gain independence;
* Factory identity Trim isolation;
* External identity Trim isolation;
* state save/restore.

---

# 45. AUTO regression tests

Test Factory browser loading of:

* known full-rig model;
* regular amp-only model.

Verify:

```text
full-rig -> AUTO bypass
amp-only -> AUTO active
```

Manual `ON` and `BYPASS` remain authoritative.

---

# 46. Existing regression tests

All existing Phase 1–4a.1 tests must continue to pass.

Do not change validated DSP behavior to make new UI/catalog tests pass.

---

# 47. Build validation

Verify:

```text
native build
WASM build
Node tests
Chrome host
```

after migration.

Verify the plugins function with static manifests and without dynamic Factory-directory server discovery.

---

# 48. Static-host validation

Add or perform a validation proving that Factory browsing does not depend on a custom API.

A simple static HTTP server is sufficient.

For example, a generic static server may serve the built files, but no special endpoint may generate asset lists at runtime.

Verify:

```text
NAM GUI -> models-manifest.json -> Factory models
Cabinet GUI -> irs-manifest.json -> Factory IRs
```

works.

---

# 49. Performance regression

Run a short 48 kHz / 128-frame regression.

UI/catalog functionality should add effectively zero steady-state DSP cost.

Report:

* NAM average;
* Cabinet average;
* failures;
* deadline misses.

Do not interpret below-resolution timing differences as meaningful.

---

# 50. Manual tests to leave for me

Leave these manual tests:

1. run `./tools/regenerate-factory-assets.sh`;
2. inspect both generated JSON files;
3. add a NAM under a nested Factory subfolder;
4. rerun the script;
5. verify it appears in the manifest and NAM browser;
6. delete/move that NAM and regenerate;
7. verify the manifest updates;
8. add an IR under a nested Factory subfolder;
9. regenerate;
10. verify it appears in the Cabinet browser;
11. test model grouping;
12. test IR grouping;
13. search models;
14. search IRs;
15. switch Factory models;
16. verify full-rig AUTO bypass;
17. switch Factory IRs;
18. set different Trim values on several IRs;
19. switch among them;
20. Reset Trim;
21. load an External NAM;
22. reselect it without file picker;
23. reload same External NAM and verify no duplicate;
24. load an External IR;
25. reselect it without file picker;
26. reload same External IR and verify no duplicate;
27. test same filenames in different folders;
28. save/restore state;
29. serve plugins using an ordinary static server;
30. confirm no custom Factory asset API is required;
31. test real guitar for clicks/dropouts and level behavior.

---

# 51. Explicitly out of scope

Do NOT implement:

* Tone3000;
* online asset downloads;
* permanent user asset database;
* IndexedDB Factory storage;
* upload-to-server;
* runtime directory scanning;
* server-side Factory discovery API;
* favorites;
* ratings;
* tags;
* recommendations;
* automatic NAM/IR matching;
* cabinet extraction;
* filename-based speaker/mic inference;
* advanced library management;
* EQ;
* tone stack;
* effects;
* combined multi-WAM preset system.

Do not begin Phase 4b.

---

# 52. Completion report

At completion report:

1. final NAM WAM directory tree;
2. final Cabinet WAM directory tree;
3. assets moved;
4. old Factory paths removed;
5. exact manifest paths;
6. manifest JSON schema;
7. regeneration script path;
8. helper script path, if any;
9. exact commands to regenerate manifests;
10. number of models indexed;
11. number of IRs indexed;
12. manifest deterministic-generation test result;
13. NAM metadata extracted into manifest;
14. IR metadata extracted into manifest, if any;
15. Factory identity strategy;
16. External identity strategy;
17. duplicate-handling strategy;
18. browser grouping behavior;
19. filtering behavior;
20. external-file behavior;
21. per-IR Trim implementation;
22. Trim state behavior;
23. Level Match/Trim/Output interaction;
24. AUTO routing regression;
25. static-host validation;
26. automated test results;
27. native/WASM build results;
28. performance regression results;
29. remaining manual tests.

If implementing any requirement would require changing the validated DSP architecture or introducing runtime server dependence, stop and explain before making that architectural change.

Do not begin Phase 4b.

# Phase 4a.3 — Static Distribution Packaging

## Context

Phase 4a.2 is complete.

The NAM and Cabinet WAMs are now portable static plugins with:

* Factory assets owned by each plugin;
* static JSON Factory manifests;
* no runtime server-side asset discovery;
* external asset loading through browser file selectors;
* unchanged validated DSP architecture.

We now need a **deployment/distribution step** that produces one completely self-contained static directory ready to upload to a normal VPS/web server.

Do not modify the DSP architecture.

---

# 1. Objective

Add a distribution script that builds a ready-to-upload static package at:

```text
dist/NAM_A2_WAM/
```

After generation, this directory must be deployable directly under any ordinary HTTP/HTTPS static document root.

For example, after copying:

```text
dist/NAM_A2_WAM/
```

to:

```text
/var/www/html/audio/NAM_A2_WAM/
```

the demo host should open directly at:

```text
https://example.org/audio/NAM_A2_WAM/
```

with the web server serving `index.html`.

No runtime Node.js, Express, Python, PHP, filesystem discovery, or custom API must be required.

---

# 2. Required distribution layout

Prefer the following structure:

```text
dist/
  NAM_A2_WAM/
    index.html
    main.js
    SourceManager.js
    OutputDeviceManager.js
    [other host files/assets]

    plugins/
      nam-wam/
        index.js
        NamNode.js
        NamProcessor.js
        gui.js
        descriptor.json
        [required JS/WASM support files]

        models/
          [complete Factory Model tree]

        models-manifest.json

      cabinet-wam/
        index.js
        CabinetNode.js
        CabinetProcessor.js
        gui.js
        descriptor.json
        [required JS/WASM support files]

        IRs/
          [complete Factory IR tree]

        irs-manifest.json
```

Adapt individual support filenames to the repository, but preserve this key rule:

```text
dist/NAM_A2_WAM/plugins/
```

contains the deployable plugins.

The host files remain at the root of:

```text
dist/NAM_A2_WAM/
```

so that:

```text
dist/NAM_A2_WAM/index.html
```

is the demo entry point.

---

# 3. Distribution script

Create a new user-facing script:

```text
tools/build-static-distribution.sh
```

The intended command is:

```bash
./tools/build-static-distribution.sh
```

It must generate:

```text
dist/NAM_A2_WAM/
```

from the repository sources.

Also add an npm alias such as:

```bash
npm run dist
```

or another clear existing-project-consistent name.

---

# 4. Regenerate Factory manifests automatically

The distribution script must first ensure that Factory manifests are current.

It should call the existing:

```bash
./tools/regenerate-factory-assets.sh
```

before copying/building the distribution.

Therefore the normal deployment workflow becomes:

```bash
./tools/build-static-distribution.sh
```

and this automatically performs:

```text
regenerate manifests
    ↓
build WASM/assets if needed
    ↓
construct static distribution
    ↓
validate output
```

The user should not need to remember to manually regenerate manifests first.

---

# 5. Clean distribution build

Before creating a new package, remove the previous generated directory:

```text
dist/NAM_A2_WAM/
```

Do not delete unrelated directories under:

```text
dist/
```

Then recreate the package from scratch.

This prevents obsolete files from remaining after models, IRs, JS files, or WASM artifacts are removed or renamed.

---

# 6. Copy host demo

Use the existing validated WAM host as the basis of the static demo.

Copy only the files required at runtime.

Do not copy:

* source tests;
* benchmark reports;
* CMake build directories;
* native binaries;
* repository metadata;
* documentation not needed at runtime;
* generated diagnostics;
* development-only scripts.

The resulting package should contain a clean deployable application, not a copy of the source repository.

---

# 7. Plugins directory

Change the deployed host references so plugins are loaded from:

```text
./plugins/nam-wam/
```

and:

```text
./plugins/cabinet-wam/
```

Do not use source-tree paths such as:

```text
../../src/nam-wam/
```

inside the final package.

All runtime references must resolve inside:

```text
dist/NAM_A2_WAM/
```

---

# 8. Relative URL requirement

This is critical.

The distribution must work when installed under an arbitrary URL prefix.

For example all of these should be possible without rebuilding:

```text
https://example.org/NAM_A2_WAM/
```

```text
https://example.org/audio/NAM_A2_WAM/
```

```text
https://example.org/projects/web-audio/NAM_A2_WAM/
```

Therefore:

* do not use root-relative `/plugins/...`;
* do not use hardcoded domain names;
* do not use hardcoded `/NAM_A2_WAM/...` URLs;
* do not assume deployment at `/`.

Use relative/module-relative URLs.

Prefer mechanisms such as:

```js
new URL("./models-manifest.json", import.meta.url)
```

inside plugins.

For host-relative plugin URLs use appropriate paths based on the host module/document location.

---

# 9. Factory asset URLs

After deployment, Factory NAM URLs must resolve from the NAM plugin package.

Conceptually:

```text
plugins/nam-wam/models-manifest.json
plugins/nam-wam/models/Fender/Twin/...
```

Similarly Cabinet:

```text
plugins/cabinet-wam/irs-manifest.json
plugins/cabinet-wam/IRs/Fender/Twin/...
```

The manifests must continue using normalized relative paths.

Do not rewrite manifests with absolute URLs for the distribution.

---

# 10. WASM deployment

Identify every runtime WASM artifact required by:

* NAM WAM;
* Cabinet WAM.

Copy them into the appropriate plugin package or shared runtime location.

Prefer keeping each plugin self-contained where practical.

For example:

```text
plugins/nam-wam/
  nam.wasm
```

and:

```text
plugins/cabinet-wam/
  cabinet.wasm
```

if those are separate artifacts.

If both intentionally share one generated NeuralAmpModelerCore WASM runtime, preserve the current validated loading architecture, but ensure all URLs remain valid in the static distribution.

Do not duplicate very large WASM binaries unnecessarily unless plugin independence requires it.

Document the final choice.

---

# 11. WAM SDK/static dependencies

Copy all runtime WAM SDK or helper modules required by the host/plugins.

Do not assume:

```text
node_modules/
```

is accessible on the deployed server.

The final distribution must contain or bundle all runtime JavaScript dependencies that are not fetched intentionally from a public CDN.

Prefer no external CDN dependency unless one already exists intentionally and is documented.

The package should ideally work offline after being served locally.

---

# 12. No source-tree dependencies

After distribution generation, runtime must not require files outside:

```text
dist/NAM_A2_WAM/
```

This must be tested.

A strong validation is to serve only this directory.

For example:

```bash
cd dist/NAM_A2_WAM
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

The application must work.

It must not rely on:

```text
../src/
../examples/
../node_modules/
../build/
```

or any other repository path.

---

# 13. MIME/static server assumptions

The package may assume a normal modern static web server that serves:

```text
.js
.json
.wasm
.wav
.nam
.html
```

The application should not require server-side processing.

Document recommended MIME types if needed, especially:

```text
.wasm -> application/wasm
.js   -> text/javascript or application/javascript
.json -> application/json
.wav  -> audio/wav
```

Do not require special server rewrites.

---

# 14. Directory URL

The final deployment must support opening:

```text
https://server/path/NAM_A2_WAM/
```

with the web server automatically serving:

```text
index.html
```

Do not require the user to append:

```text
/index.html
```

although that URL should also work.

No SPA fallback routing is needed.

---

# 15. Factory manifests remain editable/generatable

Do not generate Factory manifests only inside `dist`.

The canonical manifests remain:

```text
src/nam-wam/models-manifest.json
src/cabinet-wam/irs-manifest.json
```

or the corresponding final source-package locations.

The distribution script copies those generated static manifests into the distribution.

Normal workflow:

```text
add/remove Factory model or IR
    ↓
./tools/build-static-distribution.sh
    ↓
manifests regenerated
    ↓
dist/NAM_A2_WAM rebuilt
```

---

# 16. Optional --no-regenerate flag

If cleanly implemented, the build script may support:

```bash
./tools/build-static-distribution.sh --no-regenerate
```

for development/testing.

Default behavior must regenerate manifests.

Do not make the optional flag necessary.

---

# 17. Build artifacts

If WASM compilation is required before packaging, determine whether the distribution script should:

A. invoke the existing WASM build automatically;

or

B. require an existing current WASM build and fail clearly if missing.

Prefer automatic build if reasonably fast and reliable.

A convenient end-user command is more important than minimizing script steps.

The ideal command remains:

```bash
npm run dist
```

which creates a complete package.

---

# 18. Distribution validation script/check

At the end of the build, validate that required files exist.

At minimum check:

```text
dist/NAM_A2_WAM/index.html

dist/NAM_A2_WAM/plugins/nam-wam/index.js
dist/NAM_A2_WAM/plugins/nam-wam/models-manifest.json
dist/NAM_A2_WAM/plugins/nam-wam/models/

dist/NAM_A2_WAM/plugins/cabinet-wam/index.js
dist/NAM_A2_WAM/plugins/cabinet-wam/irs-manifest.json
dist/NAM_A2_WAM/plugins/cabinet-wam/IRs/
```

Also validate required WASM and WAM SDK runtime files.

Fail the build if essential runtime files are absent.

---

# 19. Manifest/package consistency validation

After copying assets, verify:

```text
every Factory manifest entry
    ↓
corresponds to a file inside dist
```

For NAM:

```text
plugins/nam-wam/models/<relativePath>
```

For IR:

```text
plugins/cabinet-wam/IRs/<relativePath>
```

If a manifest references a missing packaged asset, fail the distribution build.

This prevents uploading a silently broken package.

---

# 20. Distribution summary

At completion, print a concise report such as:

```text
NAM A2 WAM static distribution created.

Output:
  dist/NAM_A2_WAM/

Factory assets:
  NAM models: 54
  Cabinet IRs: 36

Entry point:
  dist/NAM_A2_WAM/index.html

Deployment:
  Copy the contents of dist/NAM_A2_WAM/ to any static web server.

Example:
  https://server.example/audio/NAM_A2_WAM/
```

Do not hardcode those counts; derive them from manifests.

---

# 21. Optional archive

Also create, if straightforward:

```text
dist/NAM_A2_WAM.zip
```

containing the complete:

```text
NAM_A2_WAM/
```

directory.

This is useful for VPS transfer.

Do not make ZIP creation mandatory if the required command is unavailable.

The directory itself remains the canonical distribution output.

---

# 22. Recommended npm scripts

Add convenient commands following existing package naming conventions.

Conceptually:

```json
{
  "scripts": {
    "factory-assets": "./tools/regenerate-factory-assets.sh",
    "dist": "./tools/build-static-distribution.sh"
  }
}
```

Do not remove existing scripts.

---

# 23. Static deployment test

Perform a real static-only test.

Serve only:

```text
dist/NAM_A2_WAM/
```

using a generic static server.

Do not serve the repository root.

Open the demo in Chrome.

Verify:

* host loads;
* NAM WAM loads;
* Cabinet WAM loads;
* Factory NAM manifest loads;
* Factory IR manifest loads;
* Factory models appear;
* Factory IRs appear;
* a NAM Factory model can be loaded;
* a Factory IR can be loaded;
* external file pickers still work;
* meters work;
* Level Match works;
* per-IR Trim works;
* AUTO routing works;
* WASM loads;
* no 404 runtime requests;
* no requests escape `dist/NAM_A2_WAM/`.

Inspect browser network requests for accidental source-tree dependencies.

---

# 24. Subdirectory deployment test

Also verify that the application does not assume web-root deployment.

A practical local simulation is useful.

For example serve:

```text
dist/
```

and access:

```text
http://localhost:8080/NAM_A2_WAM/
```

or place the package under another nested directory and verify it still works.

This is required because the real VPS deployment may use a URL such as:

```text
https://server.example/my/audio/apps/NAM_A2_WAM/
```

All paths must remain correct.

---

# 25. HTTPS consideration

Real guitar input through:

```text
getUserMedia()
```

requires a secure context in normal remote deployment.

Document that the production VPS URL should use:

```text
HTTPS
```

`localhost` remains acceptable for development.

Do not add HTTPS/server management code to the project.

---

# 26. Cache considerations

Do not implement a service worker in this phase.

Static files may be normally cached by the web server/browser.

Because Factory manifests may change when assets are updated, ensure normal reload behavior remains sane.

Do not add complex cache busting unless existing build tooling already supports it cleanly.

If browser caching of static manifests becomes an issue, document it rather than introducing a new caching architecture in this phase.

---

# 27. Preserve external assets

External files loaded with browser file selectors remain local/session assets.

They must continue to work in the static deployment.

Do not introduce upload endpoints.

No server storage is needed.

---

# 28. Preserve plugin independence

The deployment layout:

```text
plugins/nam-wam/
plugins/cabinet-wam/
```

must not create DSP coupling.

NAM and Cabinet remain independent WAMs.

The host still performs:

```text
NAM -> Cabinet
```

routing and AUTO full-rig policy.

The Cabinet plugin remains unaware of NAM.

---

# 29. Do not embed Factory assets in JavaScript bundles

Keep models and IRs as individual static files.

Do not base64/embed all `.nam` or `.wav` assets into JavaScript.

Reasons:

* independent browser loading;
* caching;
* manageable package size;
* user can add Factory assets and regenerate manifests;
* only selected assets are fetched.

---

# 30. Do not alter manifest identity

Distribution packaging must preserve Factory identities such as:

```text
factory:Fender/Twin/Clean.nam
factory:Fender/Twin/CLEAN.wav
```

Do not change identities merely because files are copied beneath:

```text
plugins/
```

Asset identity remains relative to the Factory root.

This is important for:

* state restore;
* per-IR Trim;
* selected asset reconciliation.

---

# 31. Regression testing

All previous Phase 1–4a.2 tests must continue to pass.

Add tests/contracts for:

* distribution directory generation;
* required files;
* plugins under `plugins/`;
* manifest copying;
* Factory asset copying;
* manifest-to-file consistency;
* relative URL policy where statically testable;
* absence of obvious source-tree runtime paths in distributed host files.

Do not alter validated DSP to satisfy packaging tests.

---

# 32. Manual deployment workflow

The intended final user workflow must be documented as:

```bash
npm run dist
```

or:

```bash
./tools/build-static-distribution.sh
```

Then transfer:

```text
dist/NAM_A2_WAM/
```

to the VPS.

For example:

```bash
rsync -av --delete dist/NAM_A2_WAM/ user@server:/var/www/html/audio/NAM_A2_WAM/
```

This command is only an example for documentation; do not hardcode a specific server.

Then browse:

```text
https://server.example/audio/NAM_A2_WAM/
```

No installation step is required on the server beyond normal static web hosting.

---

# 33. Explicitly out of scope

Do NOT add:

* Express production server;
* Node runtime server;
* PHP;
* dynamic Factory APIs;
* upload server;
* server-side asset database;
* service worker;
* SPA routing;
* authentication;
* Tone3000;
* CDN publishing;
* Docker deployment;
* nginx configuration automation;
* TLS certificate automation;
* DSP changes.

Do not begin Phase 4b.

---

# 34. Completion report

At completion report:

1. files created;
2. files modified;
3. new distribution script;
4. npm command;
5. exact output directory;
6. complete generated distribution tree;
7. how Factory manifests are regenerated;
8. how host files are copied/built;
9. how plugin paths are rewritten/resolved;
10. where WASM files are deployed;
11. where WAM SDK/runtime dependencies are deployed;
12. NAM model count;
13. Cabinet IR count;
14. manifest/package consistency result;
15. generic static-host test;
16. nested-subdirectory deployment test;
17. browser 404/network validation;
18. all automated regression test results;
19. exact one-command deployment-build workflow;
20. remaining manual VPS tests.

If the current repository organization makes a proposed path inappropriate, adapt the exact path while preserving:

```text
dist/NAM_A2_WAM/index.html
dist/NAM_A2_WAM/plugins/nam-wam/
dist/NAM_A2_WAM/plugins/cabinet-wam/
```

as the target public deployment structure.

Do not begin Phase 4b.

# Phase 4b.1 — TONE3000 Select Flow Integration in the NAM WAM

## Context

Phases 1 through 4a.3 are complete and validated.

The project currently provides:

- a reusable NAM A2 WAM;
- a separate reusable Cabinet WAM;
- Factory and External NAM model sources;
- Factory and External Cabinet IR sources;
- static distribution under `dist/NAM_A2_WAM/`;
- static VPS deployment already validated;
- host-only Cabinet AUTO routing;
- no server-side runtime dependency.

The next phase adds TONE3000 as an **online model source inside the NAM WAM**.

Do not modify the validated DSP architecture.

Do not begin broader Phase 4b features such as a custom full TONE3000 browser, persistence/database, favorites, recommendations, ToneStack, effects, or cabinet redesign.

---

# 1. Primary objective

Add TONE3000 integration to the NAM WAM GUI using the official OAuth 2.0 + PKCE **Select Flow**.

The NAM WAM should expose three conceptual model sources:

- Factory
- External
- TONE3000

TONE3000 integration belongs to the NAM plugin, not to the host.

The host must remain unaware of TONE3000-specific API details.

---

# 2. Architectural rule

The target architecture is:

```text
Host
  ├─ source/device management
  ├─ NAM -> Cabinet routing
  └─ Cabinet AUTO policy

NAM WAM
  ├─ existing NAM DSP
  ├─ Factory models
  ├─ External models
  └─ TONE3000 integration
       ├─ OAuth PKCE
       ├─ Select Flow
       ├─ tone/model metadata
       └─ model download/load

Cabinet WAM
  └─ unchanged

Do not move TONE3000 logic into the host.

Do not make the Cabinet WAM aware of TONE3000.

3. Preserve all current DSP/runtime invariants

Do not alter:

NeuralAmpModelerCore;
NAM inference;
A2 Lite/Full behavior;
NamProcessor._process();
AudioWorklet node count;
Cabinet DSP;
Level Match;
per-IR Trim;
Cabinet Output Gain;
AUTO routing semantics;
Factory/External identity;
state restoration behavior unless required to support TONE3000 cleanly.

No HTTP/API/auth logic belongs in the AudioWorklet.

All TONE3000 work must happen on the main thread / GUI side.

4. TONE3000 integration mode

Implement the official TONE3000 hosted selection flow rather than a custom search browser in this phase.

The intended UX:

NAM GUI
   ↓
Browse TONE3000
   ↓
OAuth + PKCE
   ↓
TONE3000 hosted selection UI
   ↓
user selects a tone
   ↓
return to application
   ↓
fetch selected tone/model metadata
   ↓
choose/load compatible A2 model
   ↓
existing NAM model loading pipeline

Do not implement /tones/search-based custom browsing unless it is strictly required for the official Select Flow.

5. Authentication

Use OAuth 2.0 with PKCE.

The browser/static application may use a TONE3000 publishable/client key.

Do not embed or require a secret API key.

Never place a secret key in:

JavaScript;
HTML;
manifests;
dist/;
source files committed to the repository.

If the official API requires a secret-only operation for some feature, stop and report that limitation rather than exposing a secret.

6. Configuration

Do not hardcode a personal TONE3000 client ID into reusable plugin source.

Introduce a clean configuration mechanism.

Prefer something like:

NamNode.configureTone3000({
  clientId,
  redirectUri
});

or equivalent plugin-level configuration.

The exact API may differ if a cleaner architecture fits the existing project.

Requirements:

NAM WAM remains reusable;
host/application can provide the public client ID;
static deployment still works;
no build-time server config required;
no secret config.

If no client ID is configured, TONE3000 UI should degrade gracefully.

Example:

TONE3000 integration not configured

rather than throwing.

7. Redirect handling

The application is statically hosted.

Support a redirect back into the same static application.

Example deployment:

https://example.org/audio/NAM_A2_WAM/

Do not require:

Express;
server callback routes;
PHP;
custom backend;
server-side session storage.

OAuth callback handling must work in the browser.

Preserve arbitrary subdirectory deployment.

No root-relative URL assumptions.

8. PKCE implementation

Implement proper PKCE:

generate code_verifier;
derive code_challenge;
use SHA-256;
use URL-safe Base64 encoding;
store only what is needed across the redirect.

Use browser Web Crypto.

Do not add heavy OAuth dependencies unless clearly justified.

Keep implementation small and auditable.

9. Temporary auth state

Use session-scoped browser storage for OAuth transaction state if appropriate.

Possible values:

code verifier;
OAuth state nonce;
pending operation;
token information if consistent with official guidance.

Prefer sessionStorage for this phase.

Do not introduce IndexedDB in Phase 4b.1.

Validate the returned OAuth state.

Reject mismatched/invalid state.

10. Token lifecycle

Implement only the token behavior required by the official API.

Handle:

access token;
expiry;
refresh token if officially supported/required.

Avoid unnecessary persistent credential storage.

If refresh support is implemented, keep it outside the AudioWorklet and encapsulated in a TONE3000 client/helper.

On auth failure:

show a useful GUI error;
do not break Factory/External browsing;
do not break NAM DSP.
11. Suggested source organization

Prefer keeping TONE3000 logic modular.

For example:

src/nam-wam/
  tone3000/
    Tone3000Client.js
    Tone3000Auth.js

or a similarly clean structure.

Avoid putting all OAuth/API logic directly into gui.js.

gui.js may orchestrate UI state but should not become the API implementation layer.

12. TONE3000 GUI

Extend the NAM GUI ergonomically.

Current model browsing should conceptually expose:

[ Factory ] [ External ] [ TONE3000 ]

or an equally clear structure.

For Phase 4b.1, the TONE3000 panel should remain intentionally simple.

Suggested UI:

TONE3000

[ Browse TONE3000 ]

status / sign-in state

Selected tone:
  title
  creator
  gear/type
  relevant metadata

Available A2 model:
  [ selector if multiple compatible models ]

[ Load Model ]

Do not build a large custom TONE3000 search UI.

13. Branding / attribution

Respect TONE3000 branding requirements.

At TONE3000 entry points, clearly show that the content comes from TONE3000.

Prefer wording such as:

Browse TONE3000

and visible attribution such as:

Powered by TONE3000

Do not present remote TONE3000 content as Factory assets.

Preserve creator/author attribution and license information when returned by the API.

Do not silently discard legally relevant metadata.

14. Compatible model filtering

The current plugin supports NAM A2.

When retrieving models for a selected tone, prefer requesting/filtering:

architecture = 2

using the official API semantics.

Do not present unsupported models as loadable.

If the selected tone has no compatible A2 model:

show a clear non-fatal message, e.g.

No compatible NAM A2 model is available for this tone.

Do not attempt to load A1/custom architectures through the A2 pipeline.

15. Model selection

If a selected tone exposes multiple compatible A2 models, do not arbitrarily choose one unless the API provides a clearly preferred/default model.

Expose a compact model selector.

Useful metadata may include:

model name;
architecture;
gear type;
sample rate;
version;
creator;
capture/model metadata;
license if supplied.

Keep Phase 4b.1 UI compact.

16. Model download

Download the selected .nam using the authenticated API flow required by TONE3000.

Do not assume model_url is anonymously fetchable.

Use the Bearer token where required.

Download must occur on the main thread.

After download:

obtain the exact model payload;
validate it through the existing NAM loading/metadata path;
feed it into the existing NAM WAM model loader.

Do not create a separate TONE3000 DSP loading path.

17. Reuse existing model pipeline

This is critical.

TONE3000 must ultimately enter the same validated model-loading path used by Factory/External models.

Conceptually:

TONE3000 download
    ↓
model JSON/text
    ↓
existing inspect/validate logic
    ↓
existing NamNode model load
    ↓
existing AudioWorklet model replacement

Do not duplicate:

model parsing;
A2 validation;
sample-rate validation;
DSP initialization;
model switching logic.
18. Online identity

Introduce a stable identity for TONE3000 assets.

Prefer an identity derived from immutable TONE3000 IDs rather than filename.

For example:

tone3000:<tone-id>:<model-id>

or the closest representation supported by the API.

Do not use display name or filename as identity.

The identity must be stable enough for:

selected-state display;
state save/restore metadata;
deduplication during a session.
19. Relationship with External identity

Do not convert a downloaded TONE3000 model into an external:<sha256> asset by default if this loses its TONE3000 provenance.

Preserve TONE3000 provenance.

It is acceptable to also calculate SHA-256 if useful for deduplication/reconciliation, but retain the TONE3000 identity and metadata.

Avoid duplicate entries if the exact same TONE3000 model is selected/downloaded again during the session.

20. State serialization

Extend NAM state cleanly so a loaded TONE3000 model can survive normal WAM state save/restore as far as practical.

Preserve the existing principle that state contains enough model data to restore DSP without requiring a network request if that is how current Factory/External state works.

If current state stores full model JSON, continue doing so.

Also preserve TONE3000 provenance metadata, e.g.:

source = TONE3000;
tone ID;
model ID;
tone title;
creator;
relevant attribution/license metadata.

Do not require re-authentication merely to restore already serialized model state.

21. AUTO Cabinet routing

After a TONE3000 NAM model loads, existing host AUTO routing must reevaluate exactly as for Factory/External model loads.

Do not add TONE3000-specific AUTO logic.

The host should continue to inspect the loaded NAM metadata.

Flow:

TONE3000 model load
    ↓
NAM metadata updated
    ↓
existing host model-change handling
    ↓
existing Cabinet AUTO reevaluation

Test this with both amp-only and full-rig metadata if available.

22. Error handling

All online failures must be non-fatal.

Handle gracefully:

network unavailable;
OAuth cancelled;
OAuth rejected;
state mismatch;
token exchange failure;
token expiry;
API rate limit;
tone retrieval failure;
model list failure;
download failure;
malformed NAM;
unsupported architecture;
sample-rate mismatch;
no A2 model available.

The NAM WAM must remain usable with Factory/External models after any TONE3000 error.

23. Static distribution

Phase 4b.1 must preserve static deployment.

After implementation:

npm run dist

must still produce:

dist/NAM_A2_WAM/

that requires only ordinary static HTTPS hosting.

No runtime backend.

No secret server config.

Ensure all new TONE3000 helper modules required by the plugin are copied into:

dist/NAM_A2_WAM/plugins/nam-wam/

or its appropriate subdirectories.

Update Phase 4a.3 packaging tests accordingly.

24. Development and production URLs

Avoid hardcoding localhost or VPS URLs.

Support configuration of redirectUri.

If useful, a sane default may be derived from:

window.location.origin + window.location.pathname

or another robust browser-relative mechanism.

Be careful with:

trailing slash;
index.html;
query parameters;
hash fragments;
nested deployment paths.

Prefer a stable canonical redirect URL.

Document how to register the redirect URI in TONE3000 settings.

25. URL callback cleanup

After processing the OAuth callback, remove transient OAuth query parameters from the visible URL using browser history APIs where safe.

For example:

history.replaceState(...)

Do not reload the application unnecessarily.

Do not destroy unrelated application URL state.

26. UI ergonomics

Take this opportunity to improve the NAM GUI modestly.

Goals:

clearer separation between model source and current model;
less visual clutter;
scalable browser layout;
obvious current loaded model;
readable metadata;
clear loading/error/status states;
preserve current controls.

Do not redesign the whole application.

Do not alter Cabinet GUI in this phase except if a shared visual helper requires a trivial non-functional change.

27. Current model panel

Prefer an explicit compact current model area.

Example:

Current Model

Fender Twin Reverb
Full
Amp
48 kHz
by <creator>

Source: TONE3000

Factory/External/TONE3000 should all use the same conceptual current-model panel where practical.

This avoids having source-specific UI define the authoritative current model.

28. Loading states

Online operations must visibly indicate progress.

Examples:

Connecting to TONE3000...
Waiting for TONE3000 selection...
Loading tone metadata...
Downloading model...
Loading NAM model...

Avoid leaving buttons apparently inactive with no feedback.

Prevent obvious duplicate download requests from repeated clicks while an operation is in progress.

29. No eager TONE3000 activity

Do not contact TONE3000 merely because the NAM WAM is instantiated.

No auth popup/redirect at startup.

No online API request unless the user explicitly opens/uses the TONE3000 functionality or an OAuth callback is being completed.

Factory/External use must remain fully offline-capable.

30. Privacy/network behavior

TONE3000 network access must be user initiated.

Do not send Factory or External model contents, filenames, hashes, or metadata to TONE3000 unless explicitly required by the official API for a requested operation.

No telemetry.

31. API isolation

Create a small API client abstraction.

GUI code should use semantic operations such as:

authorize()
completeAuthorization()
getTone(...)
getCompatibleModels(...)
downloadModel(...)

rather than scattering raw API endpoints throughout UI code.

Centralize:

base URL;
Authorization headers;
HTTP error handling;
token refresh;
API response parsing.
32. Do not over-abstract

Do not build a generic multi-provider cloud framework in this phase.

A small TONE3000-specific client is preferable.

Future provider abstraction can be introduced later if a second online provider is actually added.

33. Tests

Add automated tests where practical for:

PKCE
verifier generation;
challenge derivation;
URL-safe encoding;
OAuth state validation.
API client

Mock fetch and test:

Authorization header;
successful tone retrieval;
compatible model filtering;
download path;
401 handling;
rate/error responses.
GUI/static contracts
TONE3000 source tab/control exists;
no secret key embedded;
no TONE3000 request at plugin startup;
Factory/External still available;
current model source metadata can represent TONE3000.
Distribution
new helper modules packaged;
no source-tree paths;
static dist tests remain green.

Do not perform real TONE3000 API requests from automated unit tests.

34. Manual tests

Perform, if credentials/configuration are available:

open NAM WAM;
verify no TONE3000 network request occurs automatically;
click Browse TONE3000;
authenticate;
select a tone;
return to the static application;
retrieve metadata;
select an A2 model if multiple exist;
load it;
verify audio;
verify metadata;
verify Cabinet AUTO reevaluates;
save/restore WAM state;
verify restored audio works without forced network fetch;
select the same TONE3000 model again and check deduplication;
cancel OAuth and confirm Factory/External remain usable;
test expired/invalid auth gracefully.
35. Static VPS test

Run:

npm run dist

Deploy the generated static package.

Verify the OAuth redirect URI works under the real nested HTTPS deployment.

Example shape:

https://server.example/audio/NAM_A2_WAM/

No server route should be required beyond serving index.html.

Inspect DevTools Network and Console.

Verify:

no 404;
no secret;
no requests escaping the package except intentional TONE3000 API/OAuth requests;
WASM remains package-relative;
Factory assets still load;
External models still load.
36. Documentation

Update README with a concise TONE3000 section.

Document:

TONE3000 integration belongs to NAM WAM;
publishable/client ID requirement;
no secret API key;
redirect URI registration;
static HTTPS requirement;
how to configure client ID/redirect URI;
expected user Select Flow;
Factory/External remain available without TONE3000 config.

Do not include personal credentials.

37. Security review

Before completion, search the source and distribution for:

client_secret;
secret_key;
Authorization tokens accidentally serialized;
hardcoded access tokens;
refresh tokens in generated files;
personal redirect URLs unless intentionally documented as examples.

There must be no secret credential in source or dist.

38. Out of scope

Do NOT implement in Phase 4b.1:

custom full TONE3000 search browser;
general /tones/search UI;
favorites;
likes;
user profile;
downloads history;
trending/latest browser;
recommendations;
IndexedDB model library;
permanent online-model cache;
offline TONE3000 catalog;
automatic IR matching;
TONE3000 IR integration;
rig presets;
ToneStack;
EQ;
gate;
tuner;
delay;
reverb;
pedalboard;
Phase 4c;
Phase 5.

Do not modify NAM/Cabinet DSP.

39. Completion criteria

Phase 4b.1 is complete when:

TONE3000 is integrated inside the NAM WAM;
user can initiate official Select Flow;
OAuth uses PKCE;
no secret key is required;
callback works from static nested HTTPS deployment;
selected tone metadata is retrieved;
compatible A2 model(s) are identified;
user can load an A2 model;
the existing NAM loading path is reused;
loaded model metadata/provenance is preserved;
existing Cabinet AUTO reevaluates;
state save/restore remains functional;
Factory/External remain unchanged;
no TONE3000 network access occurs without user action except callback completion;
distribution remains static;
all previous regressions remain green.
40. Completion report

At the end report:

files created;
files modified;
TONE3000 auth architecture;
configuration mechanism;
PKCE implementation;
callback handling;
token storage/lifecycle;
API endpoints actually used;
A2 filtering behavior;
model identity scheme;
state serialization changes;
GUI changes;
AUTO routing validation;
static distribution changes;
automated test results;
manual OAuth/load results;
VPS/static deployment result;
security/secret scan;
remaining limitations;
recommended Phase 4b.2 scope.

Do not begin Phase 4b.2 automatically.