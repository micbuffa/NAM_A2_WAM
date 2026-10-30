# Direct WebNN benchmark (experimental, 2026-10-30)

The diagnostic page now defaults to **Direct WebNN** for WebNN CPU/GPU/NPU requests. WASM and WebGPU retain ONNX Runtime1.30.0. An explicit **ONNX Runtime → WebNN** option keeps the old mediated path for A/B comparisons. Playback in the ordinary multitrack player remains the existing ORT implementation; this change is scoped to the research benchmark.

Direct path: **pre-exported WebNN recipe + raw typed weights → MLGraphBuilder → build → MLTensor write/dispatch/read**. The browser does not download/parse an ONNX file or import ONNX Runtime for that configuration. Audio normalization, FFT/iFFT, chunk overlap and output checks remain the same JavaScript DSP as the reference paths. The small existing neural-core data adapters are reused with a plain tensor container; their historical ONNX class name does not import a runtime. A browser's native WebNN implementation may itself use a native runtime internally; the application cannot remove or identify that implementation detail through these public API calls.

## Offline conversion

Start from the same pinned Demucs4 and BS Roformer SW6 checkpoints as the ORT benchmark. The export tool uses ONNX/ORT **offline only** for basic constant folding, shape inference and extraction, then lowers the remaining graph into explicit WebNN operator calls. It does not interpret ONNX at browser runtime or replace unsupported neural operations with JavaScript/WASM. Native compilation/support failures are retained as failures.

```sh
python3.12 -m venv /tmp/nam-direct-webnn-py312
/tmp/nam-direct-webnn-py312/bin/pip install onnx==1.20.0 onnxruntime==1.22.0 numpy
/tmp/nam-direct-webnn-py312/bin/python tools/export-direct-webnn.py
/tmp/nam-direct-webnn-py312/bin/python tests/phase6/direct_webnn_export_test.py
/tmp/nam-direct-webnn-py312/bin/python tools/validate-direct-webnn-lowering.py
npm test
npm run dist:webnn-benchmark
npm run build-static -- --no-regenerate --no-build
```

Exported assets are generated/ignored under `model-assets/direct-webnn/`: index, two graph recipes and two raw binaries. They must be deployed together with the new Worker/controller/module. Demucs recipe has1842 WebNN calls and209127360 weight bytes (~209MB decimal). Roformer has6483 calls and699046996 weight bytes (~699MB). These are expanded/static, float32 computational constants, not new trained checkpoints. Roformer source's compact half-weight storage is expanded by offline folding; fetch/hash costs and peak memory are consequently different. Same checkpoint values/math do not imply the same graph optimization strategy or wire size. Both full-host and standalone distributions include the assets. Existing model notices/licenses still apply.

## Measurements

Protocol `webnn-browser-diagnostics-v2` explicitly records `implementation` and configuration `webnnImplementation`. Old v1 metadata can still be displayed; old rows are labelled ORT and are not relabelled direct. The direct path has no runtime import/verification phase (dash in table), and records:

- graph recipe fetch/verification and raw weights fetch/hash;
- context creation;
- graph construction/constants, native `build()` compilation and tensor allocation, nested under the overall graph setup time;
- the same first/retained processing, native dispatch/read/write spans, DSP and audio output parity as other paths.

Do not add nested times. Hardware requests remain preferences/implementation-dependent; direct WebNN does not establish physical NPU use. No application neural fallback is provided; a native browser backend may still choose mixed CPU/accelerator execution internally.

The optional ORT→WebNN comparison uses its original checkpoint and normal ORT graph optimizations. Direct recipes use an offline basic-folded graph with explicit lowering, including lifting 1D convolutions/normalizations to2D and replacing the two specific attention einsums with matmul/transpose. A speed difference cannot automatically be attributed solely to JavaScript runtime overhead. Isolate graph construction from native build to investigate the earlier~80s startup.

## Numerical qualification and current limits

Offline verification reconstructs ONNX from the **lowered WebNN call recipe**, then runs original and reconstructed neural cores with seeded (`20261030`) random float32 input tensors at the exact full input shapes. Both models produced identical float32 outputs in this CPU verification (max absolute and relative RMS errors0). This checks lowering mathematics, including scalar gathers and empty slices, **not browser WebNN correctness**, audio perceptual quality or browser performance. Results are in `research/direct-webnn-lowering-validation.json`; its Python timings are not WebNN benchmarks.

The browser additionally compares final direct PCM with the campaign's WASM reference when present, using existing tolerance(max absolute.005 and relative RMS.01 or RMS1e-5). A failed direct parity check retains logs/trials but no speed score. A run without a WASM reference explicitly says numerical qualification was not checked. Repeated-output agreement alone is not reference agreement.

**Native Canary/experimental Firefox parity and performance remain to be collected.** The controllable local Chrome lacks WebNN. Unit tests with simulated native objects are API/lifecycle checks, not proof of hardware execution. Some browser builds may lack required methods (for example erf), disallow an operator's shape/type, reject the full graph, or exceed memory limits; the exact failing node/phase is shown, with no silent ORT replacement.

First native qualification: keep Demucs4 only, select WASM + WebNN GPU requested, Direct WebNN,6s, zero warmups and at least3 measured passes. Export JSON. Repeat for Roformer6 and requested CPU/NPU. Run ORT-mediated WebNN as a separate campaign on the identical input/build/settings. Use independent sessions and native profiler evidence before publishing speed or physical-device conclusions.

## First Canary159 report and constant-view revision

The raw export `benchmarks/direct-webnn-canary159-incomplete-2026-10-30.json` was captured with campaign status **running**: three Demucs configurations failed in native build with “Failed to get compiled graph devices”; Roformer CPU had built successfully (~23.6s) and its first processing pass was still active. No Roformer completion/error or direct processing speed is established by that snapshot.

The exact error is emitted in Chromium's Core ML `ReadComputePlan` when loading `MLComputePlan` reports an NSError: [Chromium implementation](https://github.com/chromium/chromium/blob/main/services/webnn/coreml/graph_impl_coreml.mm). This locates the native failure stage, not its underlying reason; native logs or an isolated graph are still needed. It does not prove an NPU is unavailable or that weights were corrupt. No native dispatch occurred in those failed Demucs configurations.

The earlier constant-view revision folded constant-only reshapes offline. Convolution filters reach WebNN directly as constant operands; that revision had1816 calls instead of1900. This candidate did not resolve the native Demucs failure. Its binary weights were unchanged; the later static-selection revision below additionally changes the Demucs weight binary and graph. Offline numerical conversion checks still match both original cores exactly. The Worker also checkpoints the last native write/dispatch/pending/completed read so future in-progress snapshots can identify readback waits. No automatic fallback or retry is added, and native failures remain failures. Native qualification remains pending.

## Isolating native Demucs compilation failures

Open `direct-webnn-isolation.html` alongside the benchmark. This compiler-only diagnostic loads the same integrity-checked Demucs recipe/weights, collects native operand descriptors without compiling, and runs a small add baseline, the original graph outputs, then dependency closures ending at selected intermediate operations. Each probe has a fresh context and destroys it after success/failure. A failed endpoint is additionally tested in isolation, replacing incoming dynamic edges by native inputs with the original descriptors. Native construction uses the same operator implementation as the audio benchmark.

Defaults scan indices 0…1815 with step128 (16 endpoints). Refine a suspicious interval with step1, maximum64 endpoints. This is a sparse search, not a monotonic binary search: later compiler rewrites and changed outputs can change outcomes. Neither the first sampled failure nor a failed single-operator probe proves an invalid operator implementation. Intermediate output type/rank or loss of constant propagation can itself affect compilation. No inference, audio parity, actual physical device verification, or speed score is claimed.

The export records model recipe/weight hashes, build identity where available, requested device, endpoint/operator/source label, dependency count, construction/build times, raw errors and progress events. Stop terminates the Worker and preserves partial results. After90s without progress, the campaign is labelled timeout, not native compiler failure. Worker termination cannot guarantee immediate cancellation of queued native browser work. This diagnostic is intended to provide a smaller reproducible graph for a browser implementer, not a workaround.

The completed Canary159 retest at2026-10-30T09:18:02.542Z confirms the1816-call constant-view candidate still fails for all three Demucs device requests. Native cause remains unresolved.

## Candidate revision: static scalar selections (30 October)

The native CPU refinement shows closure693 (Gather) compiles, while closure694 (the following reshape) fails; reshape694 compiles as an independent operator. Replace all26Demucs constant scalar gathers with a size-one slice followed by reshape. Demucs now has1842calls,209127360weight bytes. This is a compiler compatibility candidate, not a confirmed native fix. Roformer assets are byte-for-byte unchanged. Offline validation details are in research/direct-webnn-lowering-validation.json.

Rebuild both distributions; Demucs graph, weight binary and direct index must be deployed together because removing scalar constants changes offsets and weight hash. Do not use the earlier small diagnostics-only ZIP; it contains the previous graph. Old isolation endpoint indices belong to the1816-call recipe. Retest the original model in the main diagnostics page with Direct WebNN selected; export the JSON, including any failures.

## Declared input/output order

The static-selection candidate compiled and completed native dispatch/readback for all three requested devices in the Canary159 report10:10. It then failed in JS audio assembly because integer-like output name5073 was enumerated before output. Exported inputNames/outputNames arrays now retain the original model declarations, and direct sessions validate/preserve them. The neural operations and raw weights are unchanged; graph JSON and index hashes change. Native end-to-end audio/parity must still be retested.

## Paired implementation comparison

Choose “Compare both · Direct WebNN vs ONNX Runtime → WebNN”. Each selected WebNN backend runs a direct and an ORT session on the same prepared PCM; WASM/WebGPU baselines are not duplicated. IDs, table labels and CSV/JSON identify the implementation. With two or more independent sessions, pair order alternates direct-first then ORT-first, alongside the existing backend-order setting. Trials, excluded first passage, threads and audio preparation are identical. Default remains direct-only for existing workflows.

Keep WASM selected if numerical qualification against a WASM reference is needed. A campaign with only WebNN pairs compares timing, but does not invent a reference or certify parity between implementations. Session initialization includes different graph lowering/optimization strategies; do not interpret differences as isolated ONNX Runtime overhead. OS/driver/HTTP caches are not reset between jobs.

## Measured recommendations

The recommendation section compares successful candidates separately for four/six stems, with/without WebNN. Choose current/restored measurements or the explicitly labelled user CSV reference (30October). Expected song duration and initialized-session state affect the suggestion. The throughput winner is also shown. Times are projections excluding downloads/runtime imports/playback/memory limits, not new full-song measurements. WebNN availability does not force a WebNN backend. One-session reference rankings are provisional and machine-specific.

Reusable BenchmarkRecommendations.js also provides a prototype default policy: four stems generally, six for dedicated guitar; locally supported and measured candidates first, detected WebGPU then WASM if no local evidence. It is not wired to the production host. Never use the bundled reference as universal hardware ranking; invalidate local evidence when hardware/model/runtime changes.
