# Processed mix export — 3 November 2026

Branch `codex/studio-integration`; P5.4b CURRENT (working export, broader qualification pending).

## User workflow

Stop recording/separation, turn off track input monitoring, then select **Use mix in Tone**. A clean saved project creates a persistent MP3; unsaved audio/FX changes use a session-only MP3 without forcing Save. DI and preset snapshots remain editable and unchanged. **Project options → Effect tail (seconds)** defaults2,range0–10, whole-song processed mixes only. A/B keeps its exact length. Tone does not autoplay.

## Frequency policy

An offline context never opens the sound card. `AudioContext.sampleRate` supplies the actual host clock as preference, rather than guessing from the device name. Active NAM `.model.data.sample_rate` overrides that preference for its track; absent/-1 is unconstrained. Distinct active NAM rates in one rack are rejected. Separate tracks can use distinct clocks. A common model clock is retained for the final MP3 when supported (32/44.1/48kHz). Otherwise the supported host clock is used; a host/model clock outside these encoder rates maps to48kHz output. Native AudioBufferSourceNode adaptation handles source DI; an explicit native resampling pass is used only where a rendered track differs from the final mix clock. PCM is never relabelled with a different rate.

Cabinet IR states contain decoded samples. Newly loaded IRs now save `ir.sampleRate`. An IR is adapted only when its known source rate differs from its offline rack clock. Legacy snapshots can use the original recording clock; when both are unknown and a clock change is required, export asks to reload the IR rather than guessing. Conversion occurs in a cloned state and never overwrites the saved impulse/preset.

## Rendering and storage

`OfflinePresetRack` uses the existing FxChain/FxRack graph nodes: one independent group/context, no GUI or device, explicit plugin state, no missing-plugin dry fallback. Static lane controls start settled instead of using live switching ramps. DI uses snapshot live trim, matching TrackTones; library presets retain the existing file-trim policy. NAM Lite matches normal Studio playback (live monitoring may use Full). Cabinet automatic/on/bypass routing and junctions retain their ordinary meanings. Bypassed plugins are pass-through without model initialization. Independent physical A/B inputs cannot be reconstructed from a mono DI and are refused.

Each track renders from project zero, including DI preceding A, then the requested interval is extracted. This preserves linear playback history, not the steady state of many repeated A/B turns. A zero-valued ConstantSource keeps legacy Faust DSP alive after the DI ends, letting delays/reverbs run during the requested tail. Tails are user-bounded, not an automatic decay-duration estimator. Each processed track is accumulated into one final stereo Float32 buffer in32768-frame blocks, yielding UI time; successive track renders are released. Working-buffer limit512MiB, no additional per-track timeline copies or persistent audio history.

The MP3 Worker receives one-second packets at the actual output rate and applies the existing common -1dBFS peak attenuation only if necessary. Server validation matches actual MPEG sample-rate header to manifest, stores render provenance, validates the current track snapshot/revision or library-preset revision and preserves idempotent retry. Existing44.1kHz backings remain readable. This metadata is client-render provenance, not server-side proof that DSP ran; the server does not independently rerender audio. Missing plugins, processor errors, incompatible clocks and stale sounds refuse publication.

## Validation

592 JavaScript tests pass;148 Rails tests /1311 assertions pass. New tests cover rate planning, real pinned encoder headers at32/44.1/48, chunk addressing vs output clocks, worker packet sizes, no dry fallback, account invalidation, per-track rates, exact A/B crop, tail keepalive, buffer limits, IR clocks and server provenance/header/duration checks. Generated32/48kHz MP3 fixtures contain only a synthetic440Hz sine.

Native source and packaged-dist fixture: `tests/phase7/fixtures/processed-mix-validation.html` (add `?dist` for the built artifact), served from repository root. No mic, speakers, private project or real account writes. Uses actual NAM factory `[AMP] UBER--m689732.nam`, cabinet factory IR and PingPongDelay; generated1s DI,0.5s active220Hz sine. Compares against an independently restored ordinary FxRack/TrackTones-style graph, not the export factory itself.

| Check | Result |
| --- | --- |
| Host preference44.1kHz with48kHz NAM |48kHz rack and MP3, no44.1kHz round trip |
| Full processed render |72000 frames at48kHz for1s +0.5s tail |
| Ordinary single-lane rack vs export | Max sample error0 after initial2048 switching-ramp frames |
| Routed dual-lane rack vs export | Max sample error0 after initial8192 settling frames; junction,pans and different output gains |
| A/B0.25–0.75s |24000 frames, no tail; max error0 vs matching full-render interval |
| Different track clocks | Controlled native GainNodes at44.1/48kHz, mix48kHz; maximum amplitude error2.40e-6; this isolates conversion, not a44.1kHz NAM quality comparison |
| Cabinet IR | Known44.1kHz synthetic IR adapted for48kHz NAM; original state unchanged; unknown legacy conversion refused |
| Delay after DI ends | Tail peak0.015; would be0 without zero-input keepalive |
| MP3 |48kHz header,36864bytes; decoded1.536s for1.5s PCM (encoder padding) |
| Invalidation | Rack released; no stale publication |

Source and distribution JSON evidence is stored in `docs/validation/wam-offline-2026-11-03/processed-source.json` and `processed-dist.json`. The broader34-plugin initial compatibility matrix is in WAM_OFFLINE_RENDERING_VALIDATION.md.

## Remaining qualification

Broader real presets, long songs, remote WAMs, more browsers and physical live monitoring vs Full NAM are not certified by these synthetic tests. Existing isolated-vs-repeated mixed-rate anomalies from the initial catalogue fixture remain documented; their cause is not established. No realtime fallback or dry substitution is enabled. No physical-device reconfiguration, YouTube download or separation-model benchmark was part of this change.
