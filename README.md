# NAM A2 WebAssembly WAM prototype (Phase 3)

Phase 1 and Phase 2 are retained. Phase 3 adds a WAM v2 plugin and dedicated host. Automated
real-time rendering, NAM inference, state replacement, and performance validation now pass;
the remaining exit checks require manual listening and real audio hardware. No Phase 4 work
or AudioWorklet messaging replacement was started.

Upstream is pinned by the nested checkout at commit
`2563c0fd4cb1f9ce457d89a761738ea15097e1f3` (2026-08-27 checkout), including its pinned
Eigen and AudioDSPTools submodules.

## Build and validate

```sh
git -C third_party/NeuralAmpModelerCore submodule update --init --depth 1
cmake -S . -B build-native -DCMAKE_BUILD_TYPE=Release
cmake --build build-native -j 8
ctest --test-dir build-native --output-on-failure

emcmake cmake -S . -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm -j 8

build-native/nam_native render third_party/NeuralAmpModelerCore/example_models/A2.nam /tmp/nam-native.f32
node tests/wasm_test.mjs third_party/NeuralAmpModelerCore/example_models/A2.nam /tmp/nam-wasm.f32
python3 tests/compare.py /tmp/nam-native.f32 /tmp/nam-wasm.f32
build-native/nam_native bench third_party/NeuralAmpModelerCore/example_models/A2.nam
```

The generated artifacts are `build-wasm/dist/nam.js` and `nam.wasm`. The JS is only an
offline Node harness at this phase; the C exports and fixed input/output buffers are the
boundary intended for the later custom AudioWorklet loader.

The Phase 2 standalone artifact is `build-wasm/dist/nam-simd.wasm` (595,964 bytes). Run the
browser prototype from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/examples/audio-worklet/`. Add `?auto=1` to run the generated
signal benchmark and Full → Lite → Full replacement test automatically.

## Current results

Measured locally on the current Apple Silicon macOS host, Release builds, official
`example_models/A2.nam`, default A2-Full submodel, 128 frames:

| Runtime | SR | SIMD | avg µs/q | p95 µs/q | max µs/q | deadline margin |
|---|---:|---:|---:|---:|---:|---:|
| native AppleClang | 44.1k | host | 83.61 | 92.08 | 143.88 | 34.72x |
| native AppleClang | 48k | host | 83.42 | 91.08 | 126.50 | 31.97x |
| native AppleClang | 96k | host | 83.72 | 92.21 | 141.08 | 15.93x |
| WASM Node/V8 | 44.1k | yes | 266.04 | 291.00 | 339.96 | 10.91x |
| WASM Node/V8 | 48k | yes | 263.61 | 287.67 | 325.96 | 10.12x |
| WASM Node/V8 | 96k | yes | 266.58 | 290.13 | 333.58 | 5.00x |

These are command-line measurements, not Chrome AudioWorklet measurements. Browser jitter
and AudioWorklet scheduling remain Phase 2 work. The offline 48,000-sample comparison reports:

```text
max_abs_error=1.81607902e-07
rms_error=2.43448265e-08
relative_rms_error=3.43258997e-07
```

## Engineering decisions

- The wrapper exposes an opaque `NamModel` and eight C functions. JavaScript passes raw
  UTF-8 `.nam` bytes once; C++ parses JSON and calls the current `nam::get_dsp(json,
  options)` overload. No virtual C++ hierarchy crosses the WASM boundary.
- Loading from memory bypasses `validate_nam_file(path)` and all runtime filesystem access.
  nlohmann/json remains in C++, avoiding duplicated schema/weight parsing in JavaScript.
- The official `A2.nam` is a `SlimmableContainer` containing A2-Lite (3 channels) and
  A2-Full (8 channels); core defaults to the last/full model. `NAM_ENABLE_A2_FAST` selects
  `A2FastModel<3>` or `<8>` for exact matching shapes. The generic WaveNet remains the
  fallback upstream, but this wrapper rejects non-A2 shapes.
- All NAM translation units are linked as object files because factory registration uses
  static initializers that ordinary static-archive dead stripping removes. This is the
  reproducible minimum at the integration level; trimming further needs explicit upstream
  registrars or careful dependency/link analysis and is not worth fragile factory behavior.
- `NAM_SAMPLE_FLOAT` matches Web Audio `Float32Array`. Model construction is done with
  constructor prewarm suppressed, then `Reset(contextRate, 128)` allocates working/ring
  buffers and prewarms before the model becomes usable. Later resets use the fast-path's
  cached prewarm state.
- The A2 fast path sizes all vectors in `SetMaxBufferSize`; its `process()` uses the fixed
  buffers and stack/pointer views without resize/allocation. Core's own allocation-tracking
  tests also cover A2 fast processing. The wrapper performs no allocation, logging, locks,
  JSON, or exception handling in successful `nam_process()` calls.
- Core stores expected and external sample rates but A2 `Reset()` does not reject mismatch,
  resample, or retime the receptive field. Therefore the current prototype exposes expected
  rate and deliberately performs no hidden SRC. Production loading should reject mismatch
  until an explicit non-RT resampling architecture is selected.
- WASM uses `-msimd128`, exceptions and RTTI at their Emscripten defaults (exceptions are
  needed at model-load boundaries; RTTI is used by some core paths), no filesystem, no
  threads, and no BigInt. Eigen compiles unchanged with SIMD; no alignment/vectorization
  disabling macros were needed. The build currently allows memory growth for model loading,
  so clients must acquire typed-array views after load. Fixed-memory sizing is deferred until
  multiple A2 sizes are characterized.

## Phase 2 architecture

- The main thread fetches the standalone WASM bytes and transfers them to the processor.
  `AudioWorkletGlobalScope` calls `WebAssembly.instantiate()` with seven tiny WASI stubs and
  `emscripten_notify_memory_growth`; there is no Emscripten JS glue, filesystem, worker, or
  Node dependency in the browser path.
- Local `.nam` bytes are transferred over the node port. The port handler mutes/passes through,
  allocates temporary model-data memory, constructs and prewarms a candidate, checks its
  expected sample rate, publishes the new handle and refreshed typed-array views, then destroys
  the old handle. An instantiated model cannot be prepared on the main thread and transferred:
  its C++ heap/object graph is bound to the worklet's `WebAssembly.Memory`. Therefore model
  construction in the worklet message handler is the simplest correct Phase 2 choice, with its
  measured render-thread stall accepted explicitly.
- `process()` holds preallocated 128-float input/output views and a preallocated 32,768-entry
  timing ring. It performs no allocation, promises, messages, logging, JSON, model management,
  `_malloc`, or `_free`. Statistics sorting and `postMessage` happen only in the port handler
  when polled by the main thread.
- WebAssembly exceptions (`-fwasm-exceptions`) are enabled because Emscripten's default turned
  caught C++ model-load errors into an `unreachable` trap in the standalone artifact. Invalid
  A2 input now returns `0` from `nam_load_model`; this affects loading only, not steady-state DSP.
- The prototype requires explicit mono input (`channelCountMode: explicit`, discrete mono) and
  produces mono output. It does not silently downmix stereo in this phase.

## Actual Chrome AudioWorklet results

Measured 2026-08-27 on an Apple M3 Max MacBook Pro (14 cores, 36 GB), Chrome
151.0.7922.174 headless, real `AudioContext`/AudioWorklet render thread, 48 kHz, 128 frames,
SIMD standalone WASM, generated 220 Hz input. `baseLatency` was 5.333 ms and reported
`outputLatency` was 0 in headless mode. The nominal quantum deadline was 2.667 ms.

`performance.now()` is absent from this Chrome AudioWorkletGlobalScope. Measurements therefore
use `Date.now()`, whose 1 ms resolution gives meaningful long-run averages and maxima but
quantizes p50/p95/p99. The percentile values below must not be read as sub-millisecond precision.

| Mode/model | Quanta | avg ms | p50 ms | p95 ms | p99 ms | max ms | avg deadline use | misses |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bypass/pass-through | 2,044 | 0.0015 | 0 | 0 | 0 | 1 | 0.055% | 0 |
| Two WASM copies, DSP off | 2,072 | 0.0072 | 0 | 0 | 0 | 1 | 0.271% | 0 |
| A2 Full | 8,014 | 0.4637 | 0 | 1 | 1 | 2 | 17.39% | 0 |
| A2 Lite | 2,074 | 0.1591 | 0 | 1 | 1 | 1 | 5.97% | 0 |
| A2 Full after replacement | 2,082 | 0.5850 | 1 | 1 | 2 | 2 | 21.94% | 0 |

The directly observed incremental copy cost was approximately 0.0058 ms per quantum
(copy-mode average minus bypass average), or 0.22% of the deadline. A 64-pair amplified copy
calibration produced a 0.0063 ms total average; timer quantization makes a finer copy estimate
unreliable, but both measurements establish that copying is negligible relative to inference.

The uninterrupted Full segment covered 8,014 quanta (~21.4 seconds). Across the final run there
were zero NAM failures, zero non-finite samples, zero measured deadline misses, and no maxima
above 2 ms. Chrome exposes no useful hardware-underrun counter here, so these are measured
processing deadline misses, not a claim about physical-device underruns. Headless output was not
audibly monitored.

Model loading and replacement results:

| Load | load + reset/prewarm | WASM memory after load | growth |
|---|---:|---:|---:|
| A2 Full | 34 ms | 16,908,288 bytes | 0 |
| A2 Lite | 6 ms | 16,908,288 bytes | 0 |
| A2 Full again | 32 ms | 16,908,288 bytes | 0 |

Full → Lite → Full completed without a crash, stale views, processing failures, or NaN/Inf.
The synthetic mismatched-rate A2 model was explicitly rejected while the prior model remained
available. The load durations are also the approximate worklet-thread interruption because
construction occurs synchronously in the message handler.

## Phase 2 conclusion and Phase 3 recommendation

All Phase 2 exit criteria are met within the stated headless Chrome measurement limitation.
The available A2-Full margin is sufficient on this target: average deadline use was 17.4%, the
worst measured quantum used 75%, and no deadline misses occurred in 8,014 consecutive Full
quanta. Scalar-vs-SIMD comparison remains optional and was not allowed to delay validation.

For Phase 3, retain the standalone loader and safe replacement protocol. Prefer a fixed 32 MiB
WASM memory initially: both tested models fit without growth in the 16.125 MiB current memory,
while 32 MiB leaves conservative room for model bytes, temporary JSON/weight allocations, and
future metadata without stale-view risk. Revalidate this against representative third-party A2
files before making 32 MiB a hard production limit. This was the Phase 2 handoff recommendation;
the implementation and measured Phase 3 status follow below.

## Phase 3 WAM and host

The plugin entry point is `src/nam-wam/index.js`. It uses the pinned WAM SDK source at
`third_party/wam-examples/packages/sdk` (SDK commit
`d425ee7ec6e75e800f61ae6943390b97fbca4c23`, package 0.0.12, API declaration
2.0.0-alpha.6). The parent `wam-examples` checkout is
`2179e501f389e3dc995926706a5e45ef87e560a3`. The separately pinned API repository reports
alpha.5, so the descriptor follows the SDK actually used at runtime (alpha.6).

`NamProcessor` extends the SDK's `WamProcessor` and owns NAM inference in its single
`AudioWorkletNode`. The WAM exposes sample-accurate `inputGain` (-24 to +24 dB), `outputGain`
(-24 to +12 dB), and boolean `bypass`; local model loading and safe replacement; sample-rate
rejection; metadata; self-contained model/parameter state; and a host-synchronized GUI. The
production path has no unconditional per-quantum timing, finite scan, allocation, logging, or
messaging. Memory growth remains enabled because only the bundled Lite and Full models were
available as representative data; every WASM view is refreshed after model loading/growth.

Run the dedicated host with `npm start`, then open
`http://127.0.0.1:8765/examples/wam/`. Put supported dry guitar files (`.wav`, `.mp3`, `.aac`,
`.m4a`, `.ogg`, or `.flac`) in `examples/wam/assets/audio/`; the server scans that directory on
every discovery request, so filenames are never hardcoded. The included dry reference is the
upstream 48 kHz, 24-bit mono file.

For live input, click **Grant permission / enable live input**, select the desired labeled input,
and verify switching changes the active interface/channel. Capture requests mono audio with echo
cancellation, noise suppression, and automatic gain control disabled. Switching devices stops
the old stream; file mode stops all live tracks. In file mode verify Play, Pause, Stop, seek, and
Loop. Only one source is connected at a time. Load Full, exercise gains and bypass from plugin and
host controls, save state, load Lite, restore state, and confirm Full plus parameters return. A
mismatched-rate model must be rejected while the previous model stays active.

Automated host validation is at
`http://127.0.0.1:8765/examples/wam/index.html?auto=1`. `npm test` currently reports 7 passed,
0 failed, covering dynamic add/remove discovery, permission and exact-device constraints, track
cleanup, exclusive switching, and the production processor contract.

### Phase 3 measured status

The Phase 3b render failure was caused by constructing `TextDecoder` unconditionally in
`NamProcessor`. `TextDecoder` is not exposed in this Chrome AudioWorkletGlobalScope, so the
subclass constructor stopped at that instruction before its remaining state was initialized.
The pinned SDK lifecycle and `_initialize()` override were correct: `WamNode._initialize()`
posts `initialize/processor`, the processor message handler invokes the virtual override, and
sets `_initialized` only after it returns. The minimal fix guards `TextDecoder` and uses a
byte-string fallback for error messages. `registerProcessor()` exceptions are not suppressed.

After the fix, the oscillator probe proved that the pinned `WamProcessor.process()` callback
reached `NamProcessor._process()`, with input and output present. The final production path no
longer contains the Phase 3b render/base/input/output counters or its diagnostic `process()`
override. Optional benchmark timing remains inactive unless explicitly started.

Measured 2026-08-28 on the same Apple M3 Max in separate fresh headless Chrome 151 contexts,
48 kHz, 128 frames, SIMD A2-Full, generated 220 Hz input. Timing uses `Date.now()` and is
therefore quantized to 1 ms:

| Check | Actual result |
|---|---:|
| A2 Full load/reset/prewarm | 34 ms |
| A2 Lite replacement and Full state restore | succeeded |
| mismatched-rate model | rejected; prior model retained |
| WASM memory after loads | 16,908,288 bytes; 0 growth |
| dynamically discovered bundled files | 1 |
| Phase 3 A2-Full diagnostic | 4,040 NAM calls; 0 failures |

Final standalone-versus-WAM comparison:

| Path | A2-Full quanta | avg ms | p50 ms | p95 ms | p99 ms | max ms | deadline use | failures/misses |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Phase 2 standalone | 8,030 | 0.3818 | 0 | 1 | 1 | 2 | 14.32% | 0 / 0 |
| Phase 3 WAM | 4,040 | 0.3527 | 0 | 1 | 1 | 1 | 13.23% | 0 / 0 |

The observed WAM-minus-standalone average was -0.0291 ms (-7.62%). Given the coarse 1 ms
worklet timer and separate runs, this should be interpreted as no measurable WAM overhead, not
as evidence that the WAM wrapper accelerates NAM. Both paths remained well inside the 2.667 ms
quantum deadline. The WAM run also validated model replacement, state restoration, mismatch
rejection, and a single `AudioWorkletNode`.

### Remaining manual real-audio validation

Automated and synthetic-signal validation is complete. Before signing off the audible/device
portion of Phase 3, perform these checks in a headed browser with the intended audio interface:

1. Play the bundled dry guitar reference through A2-Full and confirm audible processed output
   without clicks, dropouts, NaN-like bursts, or unexpected level changes.
2. Verify hard bypass by ear and exercise input/output gain from both the plugin GUI and host
   controls, confirming that each control changes DSP as labeled.
3. Exercise Play, Pause, Stop, seek, and Loop and confirm that only the selected file source is
   connected.
4. Grant microphone permission, select the intended interface/channel, and confirm live guitar
   input with echo cancellation, noise suppression, and AGC disabled.
5. Switch input devices while live and confirm the old stream stops; switch between live and file
   modes and confirm there is no doubled or orphaned source.
6. While listening, load Full, change parameters, save state, load Lite, restore state, and confirm
   Full plus the saved parameters return without a crash or stale audio.

### Static distribution

Build a self-contained package for ordinary static hosting with:

```bash
npm run dist
```

This regenerates the Factory manifests, builds WASM, and writes `dist/NAM_A2_WAM/`.
Deploy that directory beneath any HTTP(S) URL; its entry point is `index.html` and plugins are
under `plugins/nam-wam/` and `plugins/cabinet-wam/`. No Node server or Factory discovery API is
required at runtime. `--no-regenerate` and `--no-build` are available for development checks.

### TONE3000 Select Flow (Phase 4b.1)

The NAM WAM optionally integrates the official TONE3000 hosted Select Flow. It uses OAuth 2.0
with PKCE, a publishable/client ID, and no secret key. TONE3000 logic remains inside the NAM
plugin; Factory and External models continue to work offline and do not trigger network access.

Configure a deployment before creating the NAM plugin instance:

```js
NamPlugin.configureTone3000({
  clientId: 'YOUR_PUBLISHABLE_KEY',
  redirectUri: 'https://example.org/audio/NAM_A2_WAM/'
});
```

The example host reads the same values from `window.NAM_A2_WAM_CONFIG.tone3000`. Register the
exact HTTPS redirect URI, including its nested path and trailing slash, in TONE3000 settings.
When configured, `Browse TONE3000` redirects to TONE3000's hosted picker with `format=nam` and
`architecture=2`. The callback retrieves tone metadata, lists compatible A2 models, downloads
the selected model with its Bearer token, and passes it through the existing NAM loading path.
OAuth transaction state and PKCE verifier are session-scoped; access/refresh tokens remain in
memory for the current page session. TONE3000 provenance is retained in WAM state using an
identity of the form `tone3000:<tone-id>:<model-id>`.

The Select Flow opens in a new tab so the NAM host remains visible and reactive while TONE3000 is
open. The callback page broadcasts its same-origin callback URL to the host (and also uses the
opener when available); the host performs state validation and token exchange, then closes the
tab when possible. If new tabs are blocked, the GUI reports that they must be allowed.

The application must be served over HTTPS in production. If no client ID is configured, the
TONE3000 panel displays a non-fatal configuration message and Factory/External remain available.
# NAM_A2_WAM
