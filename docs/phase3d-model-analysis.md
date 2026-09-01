# Phase 3d — NAM model and IR asset analysis

This report is an investigation only. It does not change the WAM loader, DSP, routing, or state format, and it does not load cabinet IRs. The pinned NeuralAmpModelerCore revision inspected is `2563c0fd4cb1f9ce457d89a761738ea15097e1f3`. The machine-readable inventory is [`examples/wam/model-analysis.json`](../examples/wam/model-analysis.json); it can be regenerated with `node tools/analyze_models.mjs`.

## Scope and inventory

The supplied assets are now canonical in `src/nam-wam/models/` and `src/cabinet-wam/IRs/`. The analyzer walked both trees recursively before packaging.

| Item | Result |
|---|---:|
| `.nam` files | 54 |
| Successful JSON parses | 54 |
| Failed JSON parses | 0 |
| A2 models | 53 |
| `SlimmableContainer`, version 0.7.0 | 53 |
| Direct `WaveNet`, version 0.5.2 | 1 |
| Models declaring 48 kHz | 54 |
| IR assets | 36 WAV files |

Each A2 container has two embedded `WaveNet` models: A2 Lite (`layers[0].channels = 3`, 1,871 weights) and A2 Full (`channels = 8`, 12,146 weights). The lone non-A2 file is `MesaMk3.nam`, a direct WaveNet with 13,802 weights. The current WAM correctly rejects that non-A2 shape.

The JSON report records every relative path, parent directory, byte size, parse result, architecture, version, sample rate, summarized config and metadata, calibration/cabinet-related matches, and weight-array counts, dimensions, and hashes. It does not copy neural weights.

## Schema findings

The complete unique-key-path inventory, occurrence count, percentage, type, and representative values is in `model-analysis.json.schema`.

Present in all 30 models:

- `version`, `architecture`, `config`, `weights`, `sample_rate`, and `metadata`
- `metadata.date.{year,month,day,hour,minute,second}`
- `metadata.gain`, `metadata.loudness`
- `metadata.gear_make`, `metadata.gear_model`, `metadata.gear_type`, and `metadata.tone_type`

Present in 29 A2 containers:

- `config.submodels[]`, with `max_value` and a complete nested model
- nested `model.{version,architecture,config,weights,sample_rate,metadata}`
- nested A2 WaveNet layer, head, activation, receptive-field, and head-scale config

Common but not universal:

- `metadata.name` and `metadata.modeled_by`: 28 of 30
- explicit `metadata.input_level_dbu` and `metadata.output_level_dbu`: 3 of 30
- `metadata.training.*`: 3 of 30; `metadata.trainer`: 2 of 30

Rare paths are chiefly the direct WaveNet config in `MesaMk3.nam`, plus training validation/check/latency fields in a few newer captures. No unknown top-level keys were found. Some semantic meanings remain external to the schema: `metadata.gain` has no unit or definition in the pinned Core parser, while `metadata.loudness` is loaded but its exact measurement convention is not documented in the inspected code.

## Calibration and levels

All models contain `metadata.gain` (0.231923–0.930771) and `metadata.loudness` (-25.0248–-11.2694). The 29 containers also carry independent values in each nested submodel. These values are capture/model metadata, not evidence that the WAM should automatically gain-stage audio.

Only three files provide explicit electrical calibration:

| Model | `metadata.input_level_dbu` | `metadata.output_level_dbu` |
|---|---:|---:|
| `A1vsA2-JVM-OD1-OR-A2.nam` | 18.0 | 18.0 |
| `EVH5150III+M77-A1vsA2-ThisIsA2.nam` | 18.0 | 18.0 |
| `Fig A2 Wiz LeadBst LG DI.nam` | 11.8 | 8.7 |

The pinned Core defines these level values as dBu RMS corresponding to 0 dBFS peak for a 1 kHz sine (`NAM/dsp.h`, lines 110–149). `get_dsp.cpp` lines 240–258 read exactly `metadata.loudness`, `metadata.input_level_dbu`, and `metadata.output_level_dbu`; lines 209–226 call `SetLoudness`, `SetInputLevel`, and `SetOutputLevel`. `DSP::GetInputLevel()` and `GetOutputLevel()` return the stored values; they are not inferred from weights, loudness, or audio. Core does not consume `metadata.gain` in this loading path.

Core therefore exposes useful `Has/GetLoudness`, `Has/GetInputLevel`, and `Has/GetOutputLevel` information. The current WASM wrapper exports only expected sample rate and does not expose those getters. `NamNode.inspectMetadata()` currently surfaces only file name, architecture/subtype, version, expected sample rate, and modeler. Phase 3d deliberately leaves that unchanged.

## Cabinet and explicit-IR evidence

No analyzed `.nam` file contains an explicit impulse response. Specifically:

- no JSON path names an IR, FIR, impulse response, convolution, cabinet, speaker, or microphone;
- no separate coefficient array exists beyond neural `weights` arrays;
- none uses Core's `Linear` architecture.

Four files contain only semantic full-rig metadata: `metadata.gear_type = "full-rig"`. Two Fender Blues Deville files and two files in `Fender Twin Reverb Amp and Cab Captures/` have that value. `metadata.name`/filenames such as `Fender Twin Reverb Full Rig 212 Green 57` additionally describe a likely cabinet/speaker/microphone chain, but those components are not structured fields and the interpretation of “212 Green 57” is filename-derived.

The pinned Core supports a `Linear` architecture whose `weights` form a linear FIR model (`NAM/linear.cpp`, lines 424–453, and the Core documentation call it an impulse-response model). It also contains general convolution/ImpulseResponse DSP code. That is functionality available in Core, not data found in these captures and not functionality used by this WAM. A full-rig WaveNet can learn the combined amplifier/cabinet/microphone transfer behavior implicitly in its neural weights; there is no separable cabinet IR to extract or disable in these files.

## Amp-only versus full-rig detectability

Conclusion: **metadata-dependent, not reliably machine-detectable from an arbitrary `.nam` file alone**.

Within this collection, `metadata.gear_type` says `amp` for 26 files and `full-rig` for four, so it is useful when trusted. Filenames and names containing `Full Rig`, `Amp and Cab`, or `212 Green 57` are secondary heuristics. Neither source is guaranteed: metadata is author-entered, `gear_type = "amp"` does not prove a direct/load-box capture, and neural weights do not reveal a clean boundary between amp and cabinet response. There is no structured amp-only flag, cabinet bypass flag, load-box field, or cabinet/speaker/microphone object.

## Model families

### 1971 Fender Twin Reverb (22 captures)

All 22 are version 0.7.0, 48 kHz `SlimmableContainer` A2 models with the same Lite/Full topology and weight counts. Every capture has different Lite and Full neural-weight hashes. Across the flattened configurations, the only varying config value is each submodel's learned `head_scale`; architecture, layer shapes, dilations, activations, receptive field, and container thresholds are otherwise identical. File sizes range from 293,538 to 294,663 bytes.

The filenames explicitly encode volume, treble, mid, and bass (`V/T/M/B`) plus Bright/Norm/Vib input/channel labels. Those settings are not stored as dedicated metadata fields.

| Filename-derived setting group | Variants present |
|---|---|
| 80s Clean — V5 T8 M8 B8 | Bright, Norm |
| All on 10 — V10 T10 M10 B10 | Bright, Norm |
| All On 5 — V5 T5 M5 B5 | Bright, Norm |
| Big Clean — V4 T6 M5 B4 | Bright, Norm |
| Big n Bright — V5 T8 M4 B5 | Bright, Norm |
| Big n Thick — V5 T4 M8 B8 | Bright, Norm |
| Cranked — V10 T5 M5 B5 | Bright, Norm |
| Driven — V7 T6 M5 B4 | Norm, Vib |
| Mild Drive — V6 T7 M5 B5 | Bright, Norm |
| Sweet Spot — V5 T7 M5 B5 | Bright, Norm |
| V1 Pulled — V6 T5 M5 B5 | one capture |
| V1 Pulled + 12AX7 V6 — V6 T5 M5 B5 | one capture |

Explicit metadata is broadly common (`gear_type=amp`, `tone_type=blues`, and 1971 Fender Twin Reverb make/model), while `gain`, `loudness`, timestamps, names, and modeler strings vary. There are spelling/author-string inconsistencies (`Fendwe`, `Nathaniel`, and `Nathaniel Dahman`), another reason not to treat free text as a canonical catalog identity.

### Other repeated folders

`Fender Twin Reverb Amp and Cab Captures/` has two full-rig A2 containers. Both retain the same A2 Lite/Full topology but have distinct weights and per-model head scales; metadata/names distinguish the capture descriptions. `Fender Blues Deville/` has two A2 full-rig captures with distinct weights. The six root-level files are mixed models, not a demonstrated single family.

## A2 metadata useful to a future browser

The existing loader ignores information that could be displayed without affecting DSP: gear make/model/type, tone type, authored model name, capture date, modeler/trainer, declared sample rate, top-level and nested loudness/gain, optional input/output dBu calibration, training validation ESR/check results/latency, available A2 Lite/Full variants, file size, and folder/filename-derived collection grouping. Unknown future metadata should be preserved rather than normalized away.

Current WAM state stores the complete original model JSON text in `model.data`, so all metadata and unknown fields survive a save/restore today; its separate `_metadata` summary is only a UI/cache subset. A future state/catalog format should continue preserving the original model bytes/text (or an immutable asset identifier plus lossless metadata), especially optional calibration, training, and author fields.

## Separate IR asset inventory

The three production IR assets are directly under `src/cabinet-wam/IRs/` and use the naming convention `TWIN REVERB __ <voicing>.wav`.

| File | WAV format | Frames | Duration |
|---|---|---:|---:|
| `TWIN REVERB __ BALANCED.wav` | mono, 44.1 kHz, 32-bit integer PCM | 32,256 | 0.7314 s |
| `TWIN REVERB __ CLEAN.wav` | mono, 44.1 kHz, 32-bit integer PCM | 32,256 | 0.7314 s |
| `TWIN REVERB __ MIDS.wav` | mono, 44.1 kHz, 32-bit integer PCM | 36,864 | 0.8359 s |

Only RIFF/WAV headers were inspected; no convolution, resampling, response analysis, or graph change was performed.

## Required conclusions and Phase 4 consequences

1. **Do any supplied `.nam` files contain an explicit IR?** No. There is no explicit IR/FIR/convolution payload or Linear model among the 30 files.
2. **Can cabinet/speaker/microphone response be implicit?** Yes. A neural full-rig capture can learn the combined chain in its WaveNet weights, but that response is not separately identifiable or switchable from this JSON.
3. **Is metadata sufficient to tell amp-only from full-rig?** Only where author metadata is present and trusted. Four files say `full-rig`; 26 say `amp`, with no structured capture-chain detail.
4. **Can the distinction be automatic and reliable?** No, not for arbitrary files. The best available policy is metadata-dependent classification plus clearly labeled filename heuristics and an unknown state.
5. **What real calibration metadata exists?** All files have unit-unspecified `gain` and `loudness`; only three have explicit input/output dBu, at 18/18, 18/18, and 11.8/8.7 dBu.
6. **Does Core expose currently unused level data?** Yes. Core loads and exposes loudness and optional input/output dBu, while this project's wrapper and node do not expose them. Core does not load `metadata.gain` through the inspected metadata application path.
7. **Are the 22 Twin captures structurally identical?** They use the same architecture/topology and weight counts, but all have different weights and their learned `head_scale` config values vary. Filename settings and several metadata values also differ.
8. **What belongs in a future model browser?** Authored name, file/folder identity, make/model/type, tone, modeler/trainer/date, architecture/version/sample rate, A2 variants, loudness/gain, optional calibrated dBu, and training quality/latency fields—with provenance and an explicit unknown state.
9. **What should state preserve?** The complete original model content and unknown metadata, plus stable asset identity if introduced. Existing state already preserves the original text; future summaries must not replace that lossless copy.
10. **What follows for Phase 4 cabinet design?** Treat external IR selection as an independent, explicit processing choice. Do not assume a `.nam` lacks cabinet response, do not automatically add or bypass an IR solely from `gear_type` or a filename, and do not promise that a full-rig model's implicit cabinet can be removed. A future UI may warn or suggest based on trusted metadata, but must allow `unknown` and user override. The three 44.1 kHz IRs will require an explicit sample-rate policy before use in the 48 kHz graph.

These recommendations describe a future architecture only; no Phase 4 implementation was performed.
