# WAM offline rendering qualification — 3 November 2026

Baseline: `6d4f9e5`, branch `codex/studio-integration`. This records the initial P5.4b feasibility checkpoint. The subsequent implementation and its validation are described in [Processed mix export](PROCESSED_MIX_EXPORT.md).

## Conclusion

All **34 enabled bundled plugins** rendered finite, non-silent audio in a native `OfflineAudioContext` at **48 kHz**, then rendered again after `getState()` → fresh instance → `setState()`. A separate **NAM → cabinet** chain also passed. The two renders were sample-identical for all35 cases in this run (repeat-difference RMS0). No real-time fallback is demonstrated as necessary for this catalogue. This does not qualify every possible preset, external WAM, browser, automation or realtime-vs-offline parity.

## Method

Developer fixture: `tests/phase7/fixtures/wam-offline-validation.html` and its script. Serve the repository root using `node examples/wam/server.mjs`; open `http://127.0.0.1:8765/tests/phase7/fixtures/wam-offline-validation.html`. Select All enabled catalogue plugins and48kHz. Reload the page before testing another sample rate to isolate runs. No microphone, physical output connection or account writes. Browser user agent is recorded in each JSON file.

The fixture follows the host catalogue `examples/wam/wamPlugins/plugins.json`; VintageAmp60s is already disabled because of its known WASM trap and is excluded. Each instance loads through its actual WAM `createInstance` without GUI. Each context renders2s stereo Float32 audio: an impulse plus0.5s of synthetic110/164.81/220Hz components followed by1.5s silence. It records finite output,peak,RMS,tail RMS after1s,loaded model/IR names and repeat-difference RMS. A12s deadline labels stalled operations. State restoration uses the same create-then-set sequence as WamPluginRegistry. Passing requires non-silent finite output on both renders; equality is recorded separately, not used as a universal assumption about stochastic plugins.

NAM uses factory `[AMP] UBER--m689732.nam`; cabinet uses `V30 LL 4FB 4x12 SM57 0.50in 0--m239290.wav`. The chain peak exceeds1 in float format (~1.932); this is not clipped by the offline renderer. Output attenuation/encoding remains a separate export concern.

## Results

| Case |48kHz |44.1kHz, fresh page |
| --- | --- | --- |
| `./deathgate/index.js` | pass | pass |
| `./TS9_OverdriveFaustGenerated/index.js` | pass | pass |
| `./AutoWahMB/index.js` | pass | pass |
| `./sweetWah/index.js` | pass | pass |
| `./WAMChorusMB/index.js` | pass | pass |
| `./StonePhaserStereo/index.js` | pass | pass |
| `./faustPingPongDelay/plugin/index.js` | pass | pass |
| `./greyhole/index.js` | pass | pass |
| `./StereoEnhancer/index.js` | pass | pass |
| `./tuner_machine/src/index.js` | pass | pass |
| `../../../src/nam-wam/index.js` | pass | Model sample-rate mismatch: model=48000 Hz, context=44100 Hz |
| `../../../src/cabinet-wam/index.js` | pass | pass |
| `./EndUserAmp1/index.js` | pass | pass |
| `./EndUserAmp2/index.js` | pass | pass |
| `./BigMuff/index.js` | pass | pass |
| `./CompressorGuitarix/index.js` | pass | pass |
| `./DualPitchShifter/index.js` | pass | pass |
| `./kbverb/index.js` | pass | pass |
| `./Kpp_fuzz/index.js` | pass | pass |
| `./kppdistorder/index.js` | pass | pass |
| `./Octaver/index.js` | pass | pass |
| `./OscTube/index.js` | pass | pass |
| `./OverdriveRix/index.js` | pass | pass |
| `./OwlDirty/index.js` | pass | pass |
| `./OwlShimmer/index.js` | pass | pass |
| `./SmoothDelay/index.js` | pass | pass |
| `./StereoFreqShifter/index.js` | pass | pass |
| `./temper/index.js` | pass | pass |
| `./ThruZeroFlanger/index.js` | pass | pass |
| `./WeirdPhaser/index.js` | pass | pass |
| `./bluesmachine/index.js` | pass | pass |
| `./cleanmachine/index.js` | pass | pass |
| `./metalmachine/index.js` | pass | pass |
| `./ampsimutility/index.js` | pass | pass |
| `NAM → cabinet (chain)` | pass | Model sample-rate mismatch: model=48000 Hz, context=44100 Hz |

At44.1kHz,33/34 individual plugins pass on a fresh page. NAM and the additional chain reject the48kHz default NAM model with an explicit sample-rate mismatch. This is a model-rate constraint, not proof that NAM cannot render offline.

A preceding44.1kHz run in the same page after the48kHz suite passed30/35 cases: NAM rejected the rate, the combined chain timed out during initialization, and StereoFreqShifter/ThruZeroFlanger/ampsimutility produced silence on their restored render. These anomalies did not reproduce in the isolated fresh-page44.1kHz run. Both raw records are retained; their cause is not established and they must not be presented as resolved. Future renderer qualification should explicitly exercise repeated exports and fresh isolated contexts.

Raw measurements: [48kHz](validation/wam-offline-2026-11-03/catalogue-48000.json), [44.1kHz after48kHz](validation/wam-offline-2026-11-03/catalogue-44100-after-48000.json), [44.1kHz fresh page](validation/wam-offline-2026-11-03/catalogue-44100-fresh-page.json). These are audio compatibility measurements, not performance benchmarks.

## Consequences for P5.4b

1. Build a separate headless offline rack from each personal-track snapshot, leaving live Tone and monitoring untouched. Prefer offline rendering for the current catalogue.

2. Remove the hardcoded44.1kHz render assumption for NAM: render at the model-compatible rate (48kHz in this test), then explicitly resample the final mix to the encoder rate. Existing MP3 encoding assumes44.1kHz. Handle differing model-rate requirements explicitly; do not just label48kHz samples as44.1kHz. Initialization must restore a compatible saved model before attempting an incompatible default asset.

3. Preserve actual routing, DI live-trim policy, preset state and NAM Full/Lite choice explicitly. TrackTones currently selects Full for the live track and Lite for other playback tracks; matching playback and opting for highest-quality export are distinct policies.

4. Settle parameter/graph initialization before rendering, account for effect tails and define A/B preroll. The1.5s silence here exposes tails but does not qualify long delays or reverbs.

5. Compare processed offline output against the same saved-preset playback, including repeated export and sample-rate changes. Keep client/server export guards until the complete renderer,provenance/retry and encoding path is validated. Never export dry DI as a silent substitute.

Regression at the initial feasibility checkpoint:582 JavaScript tests passed; only the qualification fixture/report changed then. See PROCESSED_MIX_EXPORT.md for the subsequent product implementation and current results.
