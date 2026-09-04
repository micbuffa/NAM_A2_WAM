> execute what is in SPECIFICATION.md

> Read the updated SPECIFICATION.md. Phase 1 is complete and validated. Implement Phase 2 only, strictly following the specification and its exit criteria. Do not start Phase 3 or WAM integration. Update the README with the actual measured results and stop when Phase 2 is complete.

> Read the updated SPECIFICATION.md. Phase 1 and Phase 2 are complete and validated. Implement Phase 3 only, strictly following all Phase 3 requirements and exit criteria, including host input-device selection and dynamically discovered dry guitar test files. Do not begin Phase 4. Stop and report when Phase 3 is complete.

Continue Phase 3 diagnosis only. Do not begin Phase 4 and do not redesign the plugin.

I have manually reviewed the Phase 3 WAM sources.

Important findings:

1. NamProcessor already correctly implements the SDK DSP hook:

   _process(startSample, endSample, inputs, outputs)

   Do NOT replace it with process().

2. NamNode already explicitly configures:

   numberOfInputs: 1
   numberOfOutputs: 1
   outputChannelCount: [1]
   channelCount: 1
   channelCountMode: 'explicit'
   channelInterpretation: 'discrete'

   So do not redesign AudioWorklet topology unless evidence shows it is wrong.

3. Focus first on the exact pinned SDK lifecycle.

Inspect these exact pinned files:

third_party/wam-examples/packages/sdk/src/WamProcessor.js
third_party/wam-examples/packages/sdk/src/WamNode.js

Trace exactly:

NamNode constructor
-> AudioWorkletProcessor construction
-> WamProcessor constructor
-> NamProcessor._initialize()
-> WamNode._initialize()
-> WamProcessor.process()
-> NamProcessor._process()

Determine exactly when _initialize() is invoked and whether the NamProcessor override:

_initialize() {
    super._initialize();
    ... initialize WASM ...
}

is compatible with the pinned SDK lifecycle.

Do not guess. Read the pinned SDK source.

4. Add a separate diagnostic counter at the FIRST instruction of
NamProcessor._process():

++this._renderQuanta;

This counter must increment regardless of:

- input presence
- bypass
- model readiness
- loading
- diagnostic pass-through
- NAM execution

Expose it through the existing status diagnostic.

We need to distinguish:

A) WamProcessor.process() is never called
B) WamProcessor.process() runs but NamProcessor._process() is not called
C) NamProcessor._process() runs but has no input
D) NamProcessor._process() runs but bypass/readiness prevents nam_process()
E) nam_process() actually runs

Report separate counters/states for these conditions where practical.

5. Temporarily make _process() unconditional pass-through:

_process(startSample, endSample, inputs, outputs) {
    ++this._renderQuanta;

    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];

    if (!output) return;

    for (let i = startSample; i < endSample; ++i)
        output[i] = input ? input[i] : 0;
}

Do NOT initialize or call NAM for this first probe if that makes diagnosis simpler.

Run:

OscillatorNode -> NAM WAM -> destination

Verify whether _renderQuanta increases.

6. If _renderQuanta remains zero, instrument the PINNED
WamProcessor.process() temporarily or subclass it only for diagnosis to
determine whether the base process() callback itself is invoked.

Do not permanently modify the SDK.

7. Inspect the exact implementation of WamProcessor.process().

Determine all conditions under which it calls _process(), including any
dependency on:

_initialized
_destroyed
parameter interpolators
event processing
startSample/endSample
inputs/outputs

Report the relevant source lines.

8. Inspect NamProcessor._initialize() against the pinned SDK lifecycle.

Determine whether overriding _initialize() is safe and whether
super._initialize() must occur before or after WASM setup.

Check especially whether WamProcessor constructor or WamNode._initialize()
can invoke this method before processorOptions/WASM state is ready.

9. During diagnosis remove the silent registration catch:

try {
    scope.registerProcessor(moduleId, NamProcessor);
} catch (error) {
    /* already registered */
}

Do not silently treat every registerProcessor exception as duplicate
registration.

Surface the actual exception.

10. Keep Phase 2 unchanged as the control.

At the end report ONLY:

- whether WamProcessor.process() is called
- whether NamProcessor._process() is called
- render quantum count
- whether input is present
- whether output is present
- exact pinned SDK lifecycle discovered
- exact root cause if found
- minimal fix
- pass-through test result
- NAM processing result after the fix

Do not begin Phase 4.

> The Phase 3b root cause is fixed and NAM rendering is now validated. Before declaring Phase 3 complete, perform cleanup and final validation only:

Remove the Phase 3b-only unconditional render/base/input/output diagnostic counters and the diagnostic-only process() override from the production path. Preserve optional benchmark diagnostics only where they do not affect normal processing.
Run the final Phase 2 standalone vs Phase 3 WAM A2-Full performance comparison at 48 kHz and report the actual numbers.
Re-run all Phase 1/2/3 automated tests.
Update README.md: replace the obsolete “0 quanta / 0 NAM calls” section, document the TextDecoder root cause/fix, the successful render/NAM-call results, and the final performance comparison.
Do not begin Phase 4.

Stop and report the remaining manual real-audio tests I need to perform myself.

Continue the NAM A2 WAM project with **Phase 3c only**.

Phase 1, Phase 2, Phase 3, and Phase 3 cleanup are validated. Do not regress them. Do not start Phase 4.

Current validated Phase 3 reference at 48 kHz / 128 frames / A2-Full:

* Phase 2 standalone: 8030 quanta, average 0.3818 ms, p95 1 ms, max 2 ms, 0 failures/misses.
* Phase 3 WAM: 4040 quanta, average 0.3527 ms, p95 1 ms, max 1 ms, 0 failures/misses.
* No measurable WAM overhead.
* All Phase 1/2/3 automated tests currently pass.

The goals of Phase 3c are:

1. practical source gain staging,
2. real input/output dBFS meters,
3. output audio-device selection in the host,
4. preservation of the validated real-time DSP architecture.

Do not redesign working code beyond what is required.

## 1. Source gain staging

Problem: normalized clean DI audio files drive clean NAM A2 models far too hard unless WAM inputGain is reduced substantially.

Do not compensate silently inside the NAM DSP.

Introduce a host-side GainNode before the WAM:

source -> sourceTrim GainNode -> NAM WAM -> AudioContext destination

`sourceTrim` is a host control, not a WAM parameter.

Range:

-48 dB .. +12 dB

step:

0.5 dB

Defaults:

* file source: -18 dB
* live input: 0 dB

Remember separate file/live trim values during the host session.

Do not normalize files and do not add AGC, compressor, limiter, or automatic gain adjustment.

Display the numerical value, e.g.:

Source trim: -18.0 dB

Keep the existing WAM parameters:

* inputGain
* outputGain
* bypass

Keep WAM inputGain default at 0 dB.

If useful for heavily normalized DI files, extend inputGain range from -24..+24 dB to:

-48 .. +24 dB

but first verify WAM state/automation compatibility.

Keep outputGain at -24 .. +12 dB.

## 2. WAM level meters

Add two real audio meters to the WAM GUI:

IN
OUT

These must measure signal amplitude, not simply display the gain parameter values.

Use dBFS.

Signal path / measurement points:

source
-> sourceTrim
-> WAM
-> inputGain
-> INPUT METER
-> NAM
-> outputGain
-> OUTPUT METER
-> WAM output

Therefore:

* changing sourceTrim must change the input meter,
* changing inputGain must change the input meter,
* changing outputGain must change the output meter.

In bypass mode, meter the actual bypass signal passing through the equivalent input/output points.

For both meters calculate:

* peak
* RMS

Convert amplitude to dBFS with:

20 * log10(amplitude)

Use approximately -72 dBFS as display floor.

Silence may display "-∞" while the graphic meter rests at the floor.

Show at least peak numerically, e.g.:

IN   -18.4 dBFS
OUT   -6.7 dBFS

A useful display scale is:

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

Implement sensible meter ballistics:

* fast peak attack,
* slower peak decay,
* smoothed RMS,
* optionally short peak hold.

GUI refresh should be approximately 20–30 Hz.

Do not update DOM at AudioWorklet quantum rate.

## 3. Clip indicators

Add IN and OUT clip indicators.

A clip occurs when:

abs(sample) >= 1.0

Do not add a limiter.

Latch the visual clip indication for approximately 1–2 seconds in the GUI/main thread.

No timers should be added to the AudioWorklet for this.

## 4. Real-time constraints

Do not compromise the validated Phase 3 real-time path.

Inside NamProcessor._process():

* no object allocations,
* no new arrays,
* no promises,
* no logging,
* no JSON,
* no string creation,
* no per-quantum postMessage.

Meter calculation may use scalar numeric accumulators:

peak = max(abs(sample))
sumSquares += sample * sample

Accumulate over multiple quanta.

Report meter data to the main thread only around 20–30 Hz.

A message may look conceptually like:

{
type: 'nam-meter',
inputPeak,
inputRms,
outputPeak,
outputRms
}

Reuse the existing WAM processor/node communication.

Do not create another AudioWorkletNode.

There must still be exactly one AudioWorkletNode for the NAM WAM.

Metering must not alter the DSP output.

## 5. Output audio-device selection

Add output-device selection to the Phase 3 host.

UI approximately:

Audio output:
[ System default                    v ]

Enumerate `audiooutput` devices using navigator.mediaDevices.enumerateDevices().

Use the current AudioContext.

Preferred implementation when supported:

await audioContext.setSinkId(deviceId)

Changing output device must NOT:

* recreate AudioContext,
* recreate the NAM WAM,
* reload the NAM model,
* alter source routing.

The graph must remain:

source -> sourceTrim -> NAM WAM -> audioContext.destination

Only the AudioContext output sink changes.

Default option:

System default

Handle browser permissions correctly.

Where necessary and supported, use:

navigator.mediaDevices.selectAudioOutput()

from an explicit user gesture, for example:

Choose / authorize output device

Do not request output-device permission automatically at page load.

Feature detect both:

audioContext.setSinkId
navigator.mediaDevices.selectAudioOutput

If unsupported:

* continue using system default,
* disable/hide unsupported controls,
* show a concise explanation,
* do not break normal audio.

Do not implement a complicated MediaStream/HTMLAudioElement fallback during Phase 3c unless absolutely required by the Chrome validation environment.

## 6. Device hotplug

Extend/reuse the existing devicechange handling.

On device changes:

* refresh input list,
* refresh output list,
* retain currently selected devices if still present,
* if selected output disappears, safely return to system default,
* do not reload/recreate the WAM,
* do not leave doubled or orphaned sources.

## 7. Host UI

Keep styling functional and simple.

Host audio section should approximately become:

AUDIO SOURCE

Source:
[ Live input / file ]

Input device:
[ ... ]

Source trim:
[-18.0 dB -----------]

AUDIO OUTPUT

Output device:
[ System default             v ]
[ Choose / authorize output ]

Plugin GUI should approximately show:

NAM A2

Model: ...

INPUT                      OUTPUT
[meter]                    [meter]
-18.4 dBFS                 -7.2 dBFS

Input Gain                 Output Gain
[...]                      [...]

Bypass

Do not spend Phase 3c on elaborate visual design.

## 8. Automated tests

Add tests for sourceTrim:

* file source defaults to -18 dB,
* live source defaults to 0 dB,
* file and live trim values are remembered separately,
* source switching still leaves only one active source.

Add deterministic meter tests:

* meter reports are generated,
* known test signal gives approximately correct peak level,
* inputGain changes input meter,
* outputGain changes output meter,
* bypass produces coherent meter values,
* silence reaches meter floor,
* no NaN/Infinity is reported.

Use realistic tolerances.

Do not make browser tests depend on exact timer timing.

Output-device tests should cover, mocking APIs when necessary:

* audiooutput enumeration,
* selecting an output invokes AudioContext.setSinkId with correct device ID,
* System default works,
* disappearing selected output falls back safely,
* lack of setSinkId support does not break audio.

All previous tests must continue to pass.

## 9. Performance regression test

After implementation, rerun the real Chrome A2-Full benchmark at:

48 kHz
128 frames

Reference Phase 3:

average: 0.3527 ms
p95: 1 ms
maximum: 1 ms
NAM failures: 0
deadline misses: 0

Because Date.now() timing resolution is coarse, do not interpret tiny differences as actual speedups/regressions.

Phase 3c passes if:

* 0 NAM failures,
* 0 deadline misses,
* no meaningful performance regression,
* no rendering instability caused by metering.

If metering creates measurable overhead, optimize meter accumulation/reporting before considering any DSP architecture change.

## 10. Manual tests to leave for me

Do not claim these manual tests have been performed.

At the end list them explicitly:

1. clean dry guitar through clean A2-Full,
2. gain staging using file sourceTrim around -18 dB,
3. input meter while changing sourceTrim/inputGain,
4. output meter while changing outputGain,
5. clip indicators,
6. live guitar through intended audio interface/channel,
7. input device switching,
8. output device switching while audio is running,
9. File -> Live -> File switching,
10. bypass,
11. Full -> Lite -> saved Full-state restore while listening,
12. absence of clicks/dropouts/doubled audio except the known model-load interruption.

## Phase boundary

Do not start:

* cabinet IR,
* Tone3000 integration,
* model browser,
* Phase 4 GUI work,
* unrelated refactoring.

At completion report only:

1. files changed,
2. sourceTrim architecture,
3. exact input/output meter measurement points,
4. meter reporting frequency,
5. output-device implementation and APIs used,
6. feature-detection/fallback behavior,
7. automated test results,
8. Phase 3c benchmark results,
9. remaining manual tests.

Keep the implementation minimal and preserve the validated Phase 1–3 architecture.

> Continue the NAM A2 WAM project with **Phase 3d only**.

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


> Phase 4a implementation constraint

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

> mplement a small Phase 4a.1 usability update. Do not redesign either WAM.

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