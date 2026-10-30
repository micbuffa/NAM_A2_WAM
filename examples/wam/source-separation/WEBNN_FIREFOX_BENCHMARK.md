> **2026-10-30 — Direct WebNN:** the benchmark now defaults to direct graph recipes/raw weights for WebNN, with no browser ONNX Runtime. WASM/WebGPU retain ORT; the previous ORT→WebNN mode remains selectable. Deploy the new `model-assets/direct-webnn/` assets too. Native parity/performance are pending. See [DIRECT_WEBNN_BENCHMARK.md](./DIRECT_WEBNN_BENCHMARK.md). Older protocol notes below describe the ORT-mediated baseline.

# Deployable WebNN benchmark — Firefox / Canary

Protocol **webnn-browser-diagnostics-v1**, 29 October 2026. This is a new prospective protocol; historical Canary/Falcon measurements remain unchanged. The experimental Firefox build is not available on the development machine. Firefox performance and backend support remain **to be measured by Paul**.

## Build and publish

**For performance tests AND personal-file multitrack listening**, publish the full
**`dist/NAM_A2_WAM/`** instead: host at its root, direct player at
`source-separation/`, this lab at `source-separation/webnn-diagnostics.html`.
The full dist includes `WEBNN_TESTING.md` with exact URLs/headers and the playback
procedure. The smaller standalone build described below contains measurements
only; publishing both folders is unnecessary when using the full host dist.

From branch `multitracks`, with Node.js available:

```sh
npm run dist:webnn-benchmark
```

Deploy the **contents of `dist/WebNN_Benchmark/`** into any directory on an HTTPS static server, for example `https://your-server/webnn-benchmark/`. Open its `index.html`. No Rails, accounts, YouTube service or application backend is required. This build is separate from the Guitar Studio distribution and does not overwrite it.

The build verifies model/runtime SHA-256 before copying. It includes both models (~527 MB), pinned ORT (~29 MB), DSP, music/credits, notices and `build-info.json` (revision, dirty state, deployed asset hashes). Preserve **all** files/directories. It serves all inference assets from the same origin, with no CDN dependency. The weights' existing personal/research notices are retained; this tool does not change their licensing.

Required local inputs (already prepared on the development machine):

- `third_party/nam-webnn-probe/runtime/`: ORT 1.30.0 from `python3 tools/prepare-webnn-lab.py`. Manifest `research/webnn-runtime.json`; the script validates npm SRI and extracts static files without running install scripts.
- `third_party/nam-webgpu-probe/htdemucs-core.onnx`: 174263526 bytes, SHA `da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748`. Same original model as catalogue `htdemucs_4s_onnx`; the pinned download URL is in `models.json`.
- `model-assets/bs_roformer_sw_6stem_fp16.onnx`: 352778874 bytes, SHA `d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444`, existing Roformer catalogue asset.

For multiple WASM threads, serve these response headers on **the page and assets**:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

`_headers` and `.htaccess` are supplied for hosts that support them; these files do not configure every web server automatically. On nginx, set the three `add_header … always;` directives in the benchmark location. Serve `.js/.mjs` as JavaScript and `.wasm` as `application/wasm`. Use HTTPS (localhost is permitted for local tests); **file:// is unsupported**. The page reports `crossOriginIsolated` and Worker capabilities. Requested multithreading without isolation is a recorded failure, not a silent single-thread test.

Local preview using the repository server:

```sh
PORT=8765 npm start
# http://127.0.0.1:8765/dist/WebNN_Benchmark/
```

The live source lab also exists at `/examples/wam/source-separation/webnn-diagnostics.html`, but **publish the built folder**, not a copy of source files relying on external repository paths.

## Suggested procedure for Paul

1. Open the published URL in the experimental Firefox build. Record exact build/commit, OS, CPU/GPU/RAM and experimental prefs in the three notes fields. Do not infer hardware from `deviceType` acceptance.
2. First select Demucs only, all five backends, one session, three measured passes, zero warmups, one WASM thread and six seconds of the included music. Run, then export JSON and CSV. Unsupported modes/errors remain in the report.
3. Run Roformer separately initially, then a repeated campaign with 3–5 independent sessions and rotating backend order. This rotation is partial counterbalancing, not a randomized Latin square. Keep device power/thermal conditions and other applications controlled; note exceptions.
4. Repeat with a personal musical file if useful. Input remains local. The report stores filename, original hash, decoded PCM hash and exact duration; keep these identical between comparable runs. Browser resamplers/decoders can differ; unequal PCM hashes invalidate an exact same-input claim.
5. Export **after each campaign**, before starting another one. Reload restores the latest metadata report but never auto-runs a calculation. No PCM is stored in localStorage/exported. Files themselves are not uploaded anywhere by this tool.

## Scope and measurements

Same ORT **1.30.0** bundle, same two model checkpoints and same input PCM for WASM, WebGPU, WebNN/CPU, /GPU and /NPU. No application-level fallback; a failure is not retried as another backend. ORT's possible **per-operator WASM fallback** for WebNN remains declared, with unknown coverage. A successful instrumented run with zero native dispatches gets `no-webnn-observed`, not a WebNN speed score. If instrumentation is unavailable, evidence is explicitly unverified.

Demucs uses the original 343980-frame /7.8s network context and upstream DSP, overlap0; short input is padded. Roformer uses 176400-frame /4s windows, one-second overlap and the existing assembler. The default is the **same monolithic graph strategy for all five paths**. Optional cooperative WebGPU uses nine graph partitions and queue drains/yields, matching production; it is a different pipeline and must be labelled separately. FP16 Roformer weights and Demucs's precision contracts are unchanged. No inference-size or precision optimization is hidden in this test.

Each configuration gets a fresh Worker and session. Inputs transfer once into the Worker. Explicit warmups, if requested, are measured/reported but excluded from scored passes. Pass0 and the median/min/max/mean/population-standard-deviation of subsequent passes are reported separately. New Worker does **not** imply cold disk/HTTP/OS/driver/native compilation caches. Initial ORT verification touches runtime assets before import, so this is not a cold-network launch measurement.

The exported per-configuration and per-pass fields distinguish:

- Main input fetch/read, SHA, decode/resample/preparation, and source fingerprints (campaign preparation).
- Worker startup (static JS module imports included), transferred input delivery estimate, full main job wall time.
- Model fetch/body and model hash; runtime verification/fetch and dynamic runtime import.
- WebGPU adapter/device setup **or** WebNN context creation; requested options, reported acceleration, public operator support limits when exposed.
- Session creation wall time, including ORT initialization and graph partition/compilation. Native `MLGraphBuilder.build()` spans/counts are separately logged when wrappable; these are nested, not additive.
- Full separation processing, awaited `session.run()` network **plus transfers/scheduling**, DSP STFT/iSTFT for Roformer, assembly, outside-session remainder. Demucs DSP is included in the remainder, not falsely reported as isolated FFT timing.
- First completed output PCM in the Worker. Demucs reports the completed excerpt, Roformer the first committed chunk; neither is a playback/first-sound latency.
- WebNN tensor creation, write submission, dispatch submission and awaited reads, with counts and a bounded trace (20,000 entries; aggregate counts/times continue after truncation).
- Length/finiteness checks and parity against first output / same-model WASM reference when present, outside the processing interval. These are numerical diagnostics, not perceptual quality/admission scores.
- Cleanup and total elapsed Worker time, warnings, error name/stack/phase, timeouts and explicit cancellation. Cancellation terminates the Worker; device teardown timing is then not measured.

**Do not sum nested intervals.** Dispatch returns after CPU submission; it does not signal graph completion. `readTensor()` waits for ordered output work and copies, so its wall time is not isolated transfer bandwidth or device kernel execution time. `session.run` includes those waits as well. Public API spans do not determine CPU utilization, power, physical NPU identity or all fallback operators. The WebNN standard describes this ordering: [W3C WebNN](https://www.w3.org/TR/webnn/#dom-mlcontext-dispatch).

Each Worker emits `performance.mark('webnnlab:<configuration>:<phase>')` around phases. To inspect native compilation/kernels/fallback further, Paul can take a **separate external Firefox Profiler capture** and write its URL/build settings in the notes. This tool does not silently enable privileged browser profiling or ORT debug tracing; such instrumentation can affect timings. ORT also documents optional profiling: [Performance diagnosis](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html). Run instrumented profiling separately from the main timing campaign.

## Result status

No Firefox measurements are included with this delivery. The 2026-10-25 Canary numbers belong to the previous protocol and audio. Do not import them as fresh Firefox results. `MODEL_EVALUATIONS.MD` records methodology before collecting the new reports. When Paul returns JSON, retain raw exports unchanged, hash them, identify machine/build/input, report per-session results and failures before aggregating.

### Reading the results and choosing audio (2026-10-29)

The highlighted panel at the top identifies the **audio actually measured**, its tested duration, frame count and sample rate. For new reports it also gives the full decoded source length. On a restored older report the source length may be unavailable; actual excerpt duration still comes from frames/sampleRate. The separate “Next run” line follows the source and duration controls, without relabelling existing results.

Choose included **Slow Motion Dream** (stereo music, CC BY 3.0, see music attribution), included **CleanChords.mp3** (the project's guitar DI test fixture, no ground truth separation), or a personal local audio file. Set the first 1–30 seconds; shorter files are tested only to their actual length. Files stay local; their names, hashes and measured metadata are included in exported reports. The standalone build bundles both test files.

Table timings are now **seconds (s)** with three decimals. RTF has no time unit. Raw JSON and CSV retain their explicitly named `Ms` fields and original precision for analysis. Hover or keyboard-focus a highlighted table header for its definition. “See log” opens failed/unsupported/timed-out/cancelled row details, including error, phase and available warnings/traces. Successful status buttons also open details.

Compare retained median for repeated processing on an already initialized session, and session creation plus first processing for startup cost (weights/runtime/context are additional). A small difference between two medians in a single session is not proof of superiority: repeat independent sessions under comparable thermal/power conditions. `ok` does not certify perceptual separation quality or physical NPU execution. An error before the first processing pass cannot be interpreted as a processing speed.

### Node static servers without `.mjs` MIME support (2026-10-29)

Generated distributions now package ONNX Runtime modules as **`.js`** (both ORT1.30 WebNN/benchmark and ORT1.22 player WebGPU). Internal lazy-loader filenames, worker imports and runtime validator allowlists are rewritten together. Source/vendor checkouts stay untouched. Original upstream bytes are verified before transformation; delivered runtime manifests contain recomputed SHA-256/byte counts and retain upstream hashes separately. Binary WASM and model weights are unchanged.

Replace the deployed distribution with the newly built folder, including runtime files, JavaScript, `research/webnn-runtime.json` and build-info together, then force-reload/disable cache. Renaming just `ort.all.min.mjs` manually is insufficient. A Node server that already serves `.js` correctly needs no `.mjs` configuration change. HTTPS/localhost and any required cross-origin isolation headers still apply.
