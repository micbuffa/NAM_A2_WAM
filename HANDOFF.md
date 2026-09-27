# NAM A2 WAM — Next-session handoff

## 2026-09-22 — Serial FX chain (spec through 7.1)

- Main host now displays model/IR photo cards, insertion buttons and categorized bundled effects. `FxChain.js` owns serial routing, per-instance dry/wet bypass, insertion/removal, missing-plugin placeholders and versioned full-chain state. `FxChainView.js` owns reusable lazy editors and card state/artwork.
- NAM/Cabinet default assets load without GUI creation, supplied state takes precedence, and worklet registration is cached per AudioContext/module for multiple instances. GUI initialization hydrates node state rather than overwriting it from global preferences. Measured calibration history is now per NAM instance and serialized, keyed by model content and variant.
- Core nodes expose metadata snapshots; Cabinet routing mode is nonvisual and serialized. Host AUTO works before any editor exists. Shared source trim/device selection remain outside chain state.
- TONE3000 callback sessions have per-instance ownership and a nonvisual fallback. Cached editors retain selection/maintainer workflows. A real authenticated external callback still needs manual testing; mocked ownership/deduplication tests pass.
- Session & diagnostics save/restore now covers the full chain in memory. No factory/user preset UI or IndexedDB preset storage yet (section 7.2).
- Browser validation: `examples/wam/fx-test/chain-validation.html` (also in dist). Runs muted real DSP, headless defaults, repeated NAM/Cabinet and effect instances, distinct restored settings, all nine insert effects, reusable editors and first-open state invariance. No microphone is used.
- `skills-lock.json` remains unrelated and untracked. No commit/push requested for this implementation.
- Validation: 109 Node tests passed. The in-app browser completed the real-audio headless test for all nine insert effects, repeated-instance state restore and first-editor-open invariance. Main distribution startup and NAM modal were visually checked. Physical audio-interface switching and authenticated TONE3000 callbacks were not retested in this phase.

## 2026-09-22 — Cabinet Settings tab

- Cabinet routing/status, Level Match, IR Trim and Output Gain now live in a separate Settings tab. Main remains the default tab and retains the current IR artwork, metadata chips and active/bypassed indicator.
- Host Source trim is independent: it adjusts audio before NAM, defaults to 0 dB for live input and -18 dB for files, with separate in-session values. Cabinet IR Trim is a per-IR level adjustment instead.

## 2026-09-22 — Cabinet AUTO during default model loading

- Register the host NAM model listener before creating the NAM GUI, which autoloads the default factory capture. Previously this event was missed and AUTO used null metadata, leaving the Cabinet active for an amp+cab capture.
- `amp_cab`, `amp-cab` and `full-rig` already qualify for automatic Cabinet bypass. Manual ON remains an explicit override.
- Regression tests cover startup GUI autoload and switching back to an amp-only capture.

Updated: 2026-09-04

## Current milestone

Phase 4b.2 — GUI/UX Redesign for Host + NAM + Cabinet WAMs is implemented and validated locally.

Phases 1 through 4b.1 remain in place. Phase 4b.2 changed presentation and host/GUI coordination only; the NAM and Cabinet DSP architectures, audio graph, gain semantics, model loading, IR processing, Level Match, and Cabinet AUTO policy were not redesigned.

The generated deployment artifact is:

`dist/NAM_A2_WAM/`

The next session should start by reviewing or deploying this artifact, not by reconstructing the Phase 4b.2 work.

## Phase 4b.2 implementation

### Host

- `examples/wam/index.html` now uses an EndUserAmp2-inspired application shell: fixed/sticky dark sidebar and a dark rack workspace.
- `examples/wam/host.css` owns all host layout and responsive styling.
- Host-owned controls remain in the sidebar: source/device selection, source trim, player, output device, save/restore, and diagnostics.
- NAM and Cabinet plugin controls are not duplicated in the host.
- The desktop rack presents NAM and Cabinet side by side; the modules stack at narrower widths.
- The signal-chain map remains Input -> NAM -> Cabinet -> Output.
- `examples/wam/main.js` still connects `sourceTrim -> NAM -> Cabinet -> destination`.

### NAM WAM GUI

- `src/nam-wam/gui.js` is now a compact, container-friendly rack module.
- It shows the current model, source, A2 subtype/mode metadata, narrow input/output meters, exact input/output gain values, and bypass.
- Model sources are Factory, Favorites, External, and TONE3000.
- Model browser and model details are native collapsible drawers, closed by default.
- Browser results scroll inside the module instead of expanding the page indefinitely.
- External `.nam` loading and Factory selection use the existing model-loading path.
- TONE3000 Select Flow and its callback relay architecture are preserved.
- The important Phase 4b.1 callback fix remains: the relayed callback URL is passed to `completeAuthorization(location)`.
- The first URL returned in the TONE3000 `tone.images` metadata is displayed in the selected-tone panel and in the current-model block after loading.
- The normalized image URL is stored in model provenance, so save/restore can redisplay it without another TONE3000 metadata request; missing or failed images fall back to the text-only layout.
- Clicking the TONE3000 source tab now checks for an in-memory OAuth access token. Without one, it shows a TONE3000 partnership/authentication splash with the official local full logo and a Continue button; the existing Select Flow starts only after Continue.

### Cabinet WAM GUI

- `src/cabinet-wam/gui.js` is now a matching compact rack module.
- It shows the current IR, source, sample rate/details, Level Match, compensation, per-IR Trim, output gain, and bypass.
- AUTO / ON / BYPASS routing is visible in the Cabinet module, while the host remains responsible for applying the policy.
- Routing status explicitly reports whether Cabinet is active or bypassed and why.
- Factory/External IR browser and details are collapsible and closed by default.
- External `.wav` data is retained safely for in-session reload/state behavior.

### Host/plugin coordination

- `examples/wam/main.js` listens for the cancelable `cabinet-routing-mode` event and applies the existing host-owned AUTO/ON/BYPASS policy.
- Cabinet receives a display-only routing status through `setRoutingStatus()`.
- AUTO still detects full-rig captures from trusted NAM metadata and constrained fallback labels.
- Host duplicate NAM gain/bypass controls and the old host Cabinet mode selector were removed.

## Responsive and accessibility behavior

- Desktop: sidebar plus two-column rack.
- Medium widths: NAM and Cabinet stack in the rack while the sidebar remains available.
- Small widths: sidebar becomes the top section and the rack follows without horizontal clipping.
- Plugin styles are scoped to their custom elements; there are no plugin-level `body`, `position: fixed`, or `100vw` assumptions.
- Interactive controls have labels, visible focus treatment, button semantics, and `aria-pressed` source tabs.
- Escape closes open model/IR drawers.

## Files modified

- `examples/wam/index.html`
- `examples/wam/config.js`
- `examples/wam/main.js`
- `src/nam-wam/gui.js`
- `src/nam-wam/NamNode.js`
- `src/nam-wam/models-manifest.json`
- `src/nam-wam/tone3000/Tone3000Auth.js`
- `src/nam-wam/tone3000/Tone3000Client.js`
- `src/cabinet-wam/gui.js`
- `src/cabinet-wam/irs-manifest.json`
- `src/shared/assetBrowser.js`
- `tools/generate-factory-manifests.mjs`
- `tools/build-static-dist.mjs`
- `tests/phase4a3/distribution.test.mjs`
- `tests/phase4a2/manifest.test.mjs`
- `tests/phase4b/tone3000.test.mjs`
- `README.md`
- `HANDOFF.md`

## Files created

- `examples/wam/host.css`
- `src/nam-wam/tone3000/Tone3000Downloads.js`
- `src/nam-wam/tone3000/FactoryBundle.js`
- `docs/FACTORY_LIBRARY.md`
- `tests/phase4b/gui-redesign.test.mjs`

The generated files under `dist/NAM_A2_WAM/` were rebuilt from these sources.

## Automated validation

- `node --check` passes for the modified JavaScript modules and the new GUI contract test.
- `npm run dist` succeeds.
- Distribution contains 63 NAM models and 43 Cabinet IRs.
- `npm test` passes 60/60 tests.
- The distribution contract now requires `host.css`.
- Phase 4b GUI contract tests check host ownership, scoped plugin CSS, drawers, source tabs, AUTO controls, TONE3000 callback forwarding, and forbidden viewport/global CSS assumptions.

## Browser validation completed

Source host tested at:

`http://127.0.0.1:8765/examples/wam/index.html?phase4b2=1`

Static distribution tested at:

`http://127.0.0.1:8765/dist/NAM_A2_WAM/?phase4b2=1`

Validated manually:

- no console errors or warnings on startup;
- desktop, 900 px, and 640 px responsive layouts;
- Factory NAM and Factory IR loading;
- Factory, External, and TONE3000 source panels;
- supported External NAM loading;
- External WAV IR loading and displayed sample details;
- file-source selection and enabled player;
- Cabinet manual ON and BYPASS;
- Cabinet AUTO active for amp-only NAM metadata;
- Cabinet AUTO bypassed for full-rig NAM metadata;
- save/change/restore returned to the saved model and IR in the static build.

## TONE3000 status

Follow-up implementation on 2026-09-02: the browser host now follows the two-stage architecture used by the official TONE3000 plugin. The first authentication action uses a no-prompt OAuth/PKCE login and returns to the WAM page; after authentication, the TONE3000 source panel exposes an in-plugin catalog with Trending, Latest, Downloaded, Favorites, and Created streams, gear filters, cards, and pagination. Selecting a card resolves the tone metadata and compatible NAM A2 models in the existing model-selection panel. The Browse TONE3000 button continues to use the official `prompt=select_tone` flow for the full external catalog.

The example host configuration is now in `examples/wam/config.js`. Its public client ID is shared by the local and Mainline deployments, while `redirectUri` is derived from the page URL at runtime. Consequently, `examples/wam/index.html` does not need environment-specific edits; the generated static distribution contains the same `config.js` mechanism.

`Tone3000Client` now persists the browser access/refresh token in local storage, provides the catalog stream methods, and keeps the Window-bound fetch behavior. Model downloads remain JavaScript-side in this WAM host because there is no JUCE/native token bridge; the official plugin instead passes the token to native C++ and downloads/caches the model off the audio thread. The WAM still keeps all network and DOM work outside audio processing.

The example host now explicitly requests a 48 kHz `AudioContext`, matching the sample rate of the
bundled and TONE3000 NAM A2 models. If the browser returns another rate, the host reports it in
the status area because the NAM core rejects mismatched models.

OAuth callback follow-up on 2026-09-03: a same-tab Select Flow return now explicitly restores the
TONE3000 source tab, opens the model drawer, and automatically loads the first compatible A2 model.
Previously the callback metadata was resolved after reload while the GUI remained on the closed
Factory view, making the successful callback appear inert.

Audio-session follow-up on 2026-09-03: login and Select Flow now open in a named popup and relay the
callback through same-origin storage/BroadcastChannel messaging. This keeps the main host page,
AudioContext, live-input stream, and selected input/output devices alive while TONE3000 is open.
Same-tab callback handling remains as a fallback for embedded browsers that collapse popups.

TONE3000 AUTO-routing follow-up on 2026-09-03: selected-tone provenance now retains the canonical
API `gear` value. Cabinet AUTO treats `amp-cab` (and deprecated `full-rig`) as including a speaker
capture and bypasses the external Cabinet, while `amp` keeps Cabinet active. This provenance is
also serialized with WAM state, so routing remains correct after state restoration.

Cabinet default/status follow-up on 2026-09-03: a fresh session automatically loads the Factory IR
`tone3000/outmodedelectronics/Celestion Vintage 30 - 2002 Mesa Boogie 4x12 - SM57--t45023/captures/V30 LL 4FB 4x12 SM57 0.50in 0--m239290.wav`; restored sessions retain their saved IR instead. The Current IR panel,
activity badge, and routing-status message are green when convolution is active and red when the
loaded IR is bypassed.

The Phase 4b.1 integration and callback fix are preserved. Phase 4b.2 verified that the TONE3000 source panel, button, status, and callback contract are present without introducing startup requests.

### Local TONE3000 downloads and Factory metadata — 2026-09-03

- Models downloaded after an explicit user selection are now stored in the browser's IndexedDB by `src/nam-wam/tone3000/Tone3000Downloads.js`.
- Only the selected NAM file and its attribution metadata are stored. Catalog feeds and expiring download URLs are not cached, in accordance with the TONE3000 API terms.
- The TONE3000 panel has a persistent "Downloaded on this device" section available even while signed out. Each entry can be loaded or deleted, and a guarded "Delete all" action clears every local TONE3000 download.
- Deleting a download removes its persistent copy. If it is the model currently running in the AudioWorklet, that in-memory model remains active until another model is loaded.
- IndexedDB storage is browser-profile and origin scoped. Localhost and `https://mainline.i3s.unice.fr` therefore have separate download libraries.
- Stored records preserve tone/model identity, filename, model data, title, creator, gear, format, license, image URL, and download date. The app does not store the temporary `model_url`.
- The Factory manifest now preserves gain, loudness, input/output dBu, trainer, and capture date in addition to gear/type/creator metadata.
- Factory browsing now uses metadata-rich cards, and the current-model/details panels show the same available attribution and capture information.
- Factory `.nam` files contain no reliable image URL or TONE3000 tone ID. Manifest generation therefore supports local sidecar images named after the `.nam` file (`.jpg`, `.jpeg`, `.png`, `.webp`) or `cover.*` in its folder. When none exists, the GUI displays an explicitly generated metadata tile rather than guessing a remote image.
- `NamNode` now respects `provenance.source`, allowing Factory provenance to carry artwork/metadata without being mislabeled as TONE3000. Cabinet AUTO reasons also report the correct provenance source.
- Browser validation loaded `A1vsA2-JVM-OD1-OR-A2.nam` and confirmed Factory source, A2 subtype, 48 kHz sample rate, creator, gear type, trainer, date, and input/output levels.
- `npm run dist` rebuilt `dist/NAM_A2_WAM/`; the distribution includes the IndexedDB module and regenerated 58-model Factory manifest.
- Factory browser follow-up: after selecting a model inside a nested folder, every ancestor accordion on the selected path remains open and the selected card stays highlighted. This avoids reopening the same folder to audition adjacent captures.
- Factory cards now display the original filename as a separate monospace line because filenames often encode channel, gain, EQ, microphone, and cabinet settings.
- `docs/FACTORY_LIBRARY.md` defines the implemented rich bundle format for NAM and IR collections (`tone.json`, local cover image, stable tone/model IDs, creator/license metadata, and hashes).
- Opening the host with `?maintainer=1` reveals a Factory maintainer panel in the TONE3000 tab. It can launch an explicit NAM A2 or IR Select Flow, list the files in the selected tone, download only checked files, retain the first tone image, generate hashes and `tone.json`, and export a repository-ready ZIP without temporary model URLs or OAuth tokens.
- `tools/generate-factory-manifests.mjs` now reads the nearest `tone.json` for both `.nam` and `.wav`, validates its schema, file membership and SHA-256 hashes, rejects duplicate provider identities, and merges provenance/artwork into manifest version 2. Existing loose Factory files remain compatible.
- Factory NAM and Cabinet IR cards consume the richer manifest fields and show filenames, tone title, creator, license, image, and technical metadata when available.
- Rich TONE3000 Factory bundles keep their collision-safe `tone3000/creator/tone/captures` layout on disk, while the GUI renders one compact card per tone: one image/title/attribution header plus a scrollable list of capture filenames. There is no surrounding tone accordion. Legacy loose assets retain their physical folder grouping.
- Factory asset URLs now percent-encode every path segment before fetching models, IRs, or cover images. This fixes TONE3000 filenames containing URL-reserved characters such as `#` or `?`; previously `BLEND #1` was interpreted as a URL fragment and the request path was truncated. Traversal and empty path segments are rejected. All 184 current TONE3000 Factory NAM files were independently parsed and loaded by the WASM engine, and a real `BLEND #1` capture was then loaded successfully through the browser GUI.
- NAM Factory manifests now assign every capture a `guitar`, `bass`, or `pedal` category. An explicit `tone.category` in rich bundles has priority, followed by TONE3000 bass tags, pedal gear metadata, strict pedal filename prefixes, and the legacy exact `Bass` directory; otherwise captures default to guitar. The maintainer exporter writes a derived category into new NAM bundles, and `docs/FACTORY_LIBRARY.md` documents manual correction for ambiguous sets. The Factory GUI provides counted `All`, `Guitar`, `Bass`, and `Pedals` pills. Current generated counts are 242 total: 219 guitar, 23 bass, and 0 dedicated pedal captures. Browser validation confirmed that `Bass 23` shows the Ampeg and Hartke collections and excludes guitar packs.
- The maintainer workflow does not bypass TONE3000 restrictions: whole-tone API ZIPs remain partner-only, and any exported content must be checked for redistribution permission before it is committed or deployed.

### A2 rendering preference and cross-source favorites — 2026-09-04

- A `SlimmableContainer` previously rendered its last submodel by Core default, which is A2 Full. The old `A2 Lite + Full` label described file contents and did not mean both networks were evaluated.
- The WASM wrapper now exports `nam_set_slimmable_size`. The AudioWorklet can switch the current container between Full (`1.0`) and Lite (`0.0`) without re-downloading or reparsing the model.
- Preferences exposes Full (default/higher fidelity) and Lite (lower CPU). The choice persists per origin in local storage, is included in WAM state version 2, and the current-model badge/details report the network actually active.
- The NAM source tabs now include Favorites. Stars can add or remove individual Factory, External, or downloaded TONE3000 model captures.
- Favorites are stored per origin in a dedicated IndexedDB database. Complete data is retained for External and TONE3000 favorites, so they remain loadable after a browser restart; Factory favorites retain their stable manifest identity.
- Browser validation confirmed Full loading, live switching to Lite, favorite add/remove, and persistence across reload. The temporary validation favorite and Lite preference were removed/reset afterward.

### Automatic NAM model level — 2026-09-04

- NAM capture loudness metadata now drives an independent output compensation stage after model inference. The target is −18 dB and correction is clamped to ±12 dB to avoid unsafe boosts from unusual or corrupt metadata.
- Automatic model level is enabled by default, persists per browser origin, is included in WAM state, and can be disabled under Preferences without changing the user's manual Output gain.
- Gain transitions are smoothed sample by sample in the AudioWorklet, including preference changes, to avoid abrupt discontinuities. Loading a new model initializes its correction immediately before audio resumes.
- Model details report both the capture loudness and the applied correction. Missing or non-finite loudness values result in 0 dB compensation.
- Browser validation measured the intended metadata-derived corrections: Fender Super Reverb SM57 (`-23.4 dB`) receives `+5.4 dB`; Full Rig Peavey 5150 Maxon Mesa OS SM57 (`-15.7 dB`) receives `-2.3 dB`. Disabling the preference displayed `Auto level: off`, and it was restored afterward.
- `tests/phase4a/model-level.test.mjs` covers representative Fender/Peavey values, disabled mode, invalid metadata, and the ±12 dB bounds.
- Follow-up: the current-model card now carries a permanent green `LEVEL ±x.x dB` badge with a tooltip containing model loudness, target, and applied NAM correction. Disabled or unavailable correction is displayed in red as `LEVEL OFF` or `LEVEL N/A`.
- A missing loudness value previously became numeric zero through JavaScript's `Number(null)`, accidentally requesting the maximum `-12 dB` attenuation. Missing/non-numeric metadata is now strictly treated as unavailable and applies `0 dB`.
- `SlimmableContainer` models now read loudness from the active Full/Lite submodel first, falling back to container metadata. Switching Full/Lite also recalculates and applies the matching correction.
- Loudness-metadata limitation confirmed with a native controlled render: the same 997 Hz, 0.15-peak reference produced `-28.13 dBFS RMS` through `Fender Super Reverb_ EQ Flat, Volume 3, sm57 and AKG 414.nam` but `-18.14 dBFS RMS` through the Peavey 5150 Maxon SM57 capture. Their metadata reports `-20.25 dB` and `-15.66 dB`; after metadata normalization to `-18 dB`, the measured outputs would still differ by about `5.4 dB`.
- The official `tone-3000/tone3000-plugin` implementation was checked at `plugin/src/Processor.cpp`: it also applies `targetLoudness - modelLoudness`, clamped to ±12 dB, with a default target of `-18 dB`. The current WAM behavior therefore matches the official algorithm; remaining perceptual/output mismatch comes from trainer-defined loudness metadata and source-dependent model response.
- The recommended non-pumping calibration is now implemented as an optional **Calibrate level** button. It renders a private 997 Hz reference at 0.15 peak through the active model, discards a 4096-frame warmup, measures the following 16384 frames, derives a static correction toward `-18 dBFS RMS`, clamps it to ±12 dB, and also limits predicted peak to `-1 dBFS`.
- Calibration runs only on explicit user action. The probe is not copied to the WAM output, NAM is reset both before and after measurement, and no adaptive gain runs during normal playing. **Use metadata** restores the default metadata-derived correction.
- The badge reports `MEASURED ±x.x dB`; Model details includes measured probe RMS and whether safety limiting occurred. The measured calibration is carried in WAM state version 3 for state restoration.
- Measurements are also stored per stable model identity and Full/Lite variant in origin-scoped local storage. Selecting the same capture restores its measured static gain; **Use metadata** deletes that stored measurement. Browser validation confirmed restoration after a full page reload, then removed the temporary validation entry.
- Browser validation produced `MEASURED +10.1 dB` from `-28.1 dBFS` for the problematic Fender capture, versus `MEASURED +0.1 dB` from `-18.1 dBFS` for the Peavey Maxon SM57 capture. Returning to metadata restored the Peavey `LEVEL -2.3 dB` state.
- Unit/contract coverage includes measured correction limits, peak protection, explicit calibration routing, model reset, and GUI controls. The full suite passes 60/60 tests.

### Official-style NAM tone controls — 2026-09-04

- NAM Input Gain and Output Gain are now rotary controls. Every rotary control keeps a native range input for keyboard/accessibility support; double-click restores its declared default (0 dB for both gain knobs).
- Added the official plugin's input Noise Gate, with threshold `-100..0 dB` (default `-80 dB`), detector sidechain HP/LP filtering, fast attack, 25 ms detector decay, 5 dB hysteresis, 50 ms hold, 100 ms gain release, and cubic downward expansion to a `-80 dB` floor.
- Added the global post-NAM Bass/Middle/Treble stack with official mappings: low shelf 150 Hz at ±20 dB, bell 425 Hz at ±15 dB, and high shelf 1.8 kHz at ±10 dB. Knob value 5 is flat.
- Added a hidden-by-default six-band parametric EQ drawer. The EQ itself defaults disabled and POST NAM; users can select PRE NAM. Defaults mirror `BlockEq`: low shelf 100 Hz, bells at 250/650/1600/3500 Hz, high shelf 8 kHz, each with frequency, ±15 dB gain, and Q controls.
- Exact WAM routing is `Input Gain -> Noise Gate -> optional PRE EQ -> NAM -> model-level normalization -> optional POST EQ -> Tone Stack -> Output Gain`. Whole-plugin bypass remains a coherent dry bypass.
- NAM and Cabinet faceplates now receive a prominent red-tinted state when bypassed, in addition to their existing checkboxes/status text.
- Headless browser validation initially confirmed the rotary controls, EQ reveal behavior, Input Gain double-click reset to 0 dB, WAM parameter synchronization, and the NAM bypass faceplate class. DSP and contract tests cover gate attenuation, tone/EQ shaping, routing, GUI controls, and Cabinet bypass styling.

### Vertical knobs and graphical EQ — 2026-09-04

- The six faceplate knobs now own pointer gestures instead of using the browser's horizontal range behavior. Vertical upward drag increases the value, downward drag decreases it, horizontal-only movement leaves it unchanged, Shift gives 8x finer control, keyboard range behavior remains available, and double-click still restores the declared default.
- The 18 EQ knobs were replaced by one interactive logarithmic SVG response graph with six draggable band nodes. Horizontal movement changes frequency, vertical movement changes gain, the wheel changes Q, Shift enables fine movement, and double-click neutralizes the selected band's gain.
- The selected band exposes exact numeric Frequency, Gain, and Q fields. The six bands remain ordered in frequency while dragging, and Reset EQ restores all official defaults.
- The plotted combined response uses the same RBJ coefficient and magnitude-response equations as the official `eqMath.ts`/`BlockEq.cpp`, at the active AudioContext sample rate. It therefore visualizes the actual EQ transfer function rather than a decorative approximation.
- EQ updates are batched into one WAM parameter call per gesture event and complete parameter synchronizations redraw the graph only once, avoiding redundant UI-thread response calculations during a drag.
- Chrome validation confirmed six knobs and six EQ nodes, zero change after a 100 px horizontal-only knob drag, Input Gain change from 0 to +18 dB after a 45 px upward drag, synchronized WAM values, graphical band movement from 250 Hz/0 dB to approximately 499 Hz/+3.6 dB, updated numeric readout, and a changed response path.
- The full suite passes 63/63 tests after the interaction redesign.

### TONE3000 C++/WAM DSP parity measurement — 2026-09-04

- A native reference executable was built against the official `tone-3000/tone3000-plugin` commit `1572f20a9a9a0a22e902aade9292a7e86c98b7e1` and its declared JUCE 9.0.1 revision `e18f7f506c0b96f2c738a0bcd7fe6467a5005ad8`.
- The reference compiled `BlockEq.cpp` and `NoiseGate.h` directly from the official repository. The tone-stack reference instantiated JUCE's actual `makeLowShelf`, `makePeakFilter`, and `makeHighShelf` filters using the exact code and order from `Processor.cpp`.
- Each comparison processed 96,000 identical 32-bit input samples at 48 kHz. The tone test used deliberately non-neutral `Bass 8.3 / Middle 2.1 / Treble 7.4`; all six parametric-EQ bands used non-zero, mixed boost/cut settings; the gate input crossed a `-38 dB` threshold repeatedly to exercise open, hold, and release behavior.
- Tone stack: correlation `0.9999996746`, output-level difference `+0.00345 dB`, peak difference `+0.00318 dB`, RMS null/error `-74.87 dBFS`, and error-to-signal SNR `60.92 dB`.
- Six-band EQ: correlation `0.9999999590`, output-level difference `-0.00101 dB`, peak difference `-0.00086 dB`, RMS null/error `-91.66 dBFS`, and error-to-signal SNR `70.20 dB`.
- Noise gate: correlation `0.99999999999994`, output-level difference `+0.0000026 dB`, peak difference `+0.0000027 dB`, RMS null/error `-155.89 dBFS`, and error-to-signal SNR `129.27 dB`.
- Conclusion: the gate is effectively numerically identical. EQ and tone-stack level/peak differences are a few thousandths of a dB or less; their residual null is consistent with C++ `float` filter coefficients/state versus JavaScript `double` arithmetic and is not a material tonal discrepancy. No DSP correction was warranted from this test.

Follow-up completed on 2026-08-31: selected TONE3000 tone images are now supported through the documented `Tone.images` array. Both image placements are present in the rebuilt static distribution and remain hidden until a valid image URL is available.

New-UI branch follow-up on 2026-09-14:

- The NAM `Models & sources` drawer opens by default on Factory with the Guitar category selected. Other categories remain available.
- TONE3000 no longer requires a separate `Load selected model` button: choosing a tone loads its first compatible A2 capture, and changing the model selector loads the newly chosen capture. Downloaded models load when their row is selected; Delete remains a separate control.
- Multi-capture Factory groups, including legacy folders, now use one image/metadata card. The capture filename is shown beneath the image, with previous/next arrows that load the adjacent capture; arrows are disabled at the first and last entries. The artwork itself loads the currently shown capture, and the star toggles its favorite state.
- The Factory card now places a larger, uncropped image and its arrows on the left, with a separately scrollable, clickable filename list and tone metadata on the right. Clicking a filename loads that capture immediately, highlights it, and synchronizes the arrows, counter, filename, and favorite star. The browser preserves its scroll position when a capture loads.
- The top Current model panel uses a larger, contained photo on the left, with the full model title, source/mode/level badges, and calibration controls to the right. This keeps long filenames readable and avoids cropping the artwork.
- The Current model photo and details share one top row with the IN and OUT meters at the edges. The Noise gate controls sit immediately left of the photo; `noiseEnabled` starts off for new instances and remains a standard WAM parameter restored from saved state.
- The small Noise gate threshold knob sits above its checkbox to the left of the photo and dims/disables when the gate is off. Matching small input/output gain knobs now sit directly below their respective IN/OUT meters; the accordion holds Bass, Middle, Treble, Tone and EQ. New instances start with EQ enabled (`eqEnabled=1`), while saved WAM state still overrides the default. When EQ is bypassed its signal-flow stage, button, and graph visibly indicate the bypass.
- Factory and the selected TONE3000 tone now share the two-column capture card: title/metadata above the uncropped image with adjacent previous/next arrows, and a separately scrollable `Captures disponibles` button list on the right. The TONE3000 list replaces the old dropdown; selecting an entry loads it immediately and keeps arrows, counter, and loaded highlight synchronized.
- The main photo/meter frame adds a smoothed green-to-amber-to-red neon border driven by the output RMS/peak meter callback. It decays to the idle border at silence and never adds audio-processing work to the AudioWorklet.
- The selected TONE3000 detail view now offers `Back to TONE3000 main view` beside Browse. Returning keeps the existing catalog cards, feed, filter and page without refetching. Both Factory and TONE3000 capture-list headers show the actual singular/plural count (`1 capture disponible`, `N captures disponibles`).
- `docs/screenshots/ImageNAM_A2_WAM.jpeg` is copied into `src/nam-wam/` and referenced as the plugin descriptor `thumbnail`. The static distribution includes an identical copy.

Graphical-EQ/spectrum follow-up completed on 2026-09-04:

- The NAM GUI now uses a compact top-level tab bar instead of stacking four accordions. `Main` is selected by default and contains the signal-flow strip, meters, gain/noise controls, current-model artwork, and status. The other tabs are `Models`, `Amp settings`, `Model details`, and `Preferences`; only the selected panel occupies vertical space. Left/right arrows plus Home/End provide keyboard tab navigation.
- A sixth `Help` tab explains NeuralWAMp's AudioWorklet/WAM architecture, signal path, each functional tab, vertical-drag/double-click knob gestures, hover metadata cards, WAM state, browser-local favorites/downloads, and the separate Cabinet WAM. It starts with a six-step **Getting started with your guitar** guide covering Live input, input/output device selection and browser fallback, enabling live audio, Factory/TONE3000 capture loading and persistence, Amp settings, and the optional high-gain noise gate, and links to the public GitHub repository. Its compact two-column cards become one column on narrow layouts and the content scrolls within the panel.
- The module header and signal-flow row were compacted further: the header uses 7 px vertical padding with a 78 × 25 px logo and smaller identity/bypass typography, while the processing-chain pills use 4 px row padding, 7 px labels, smaller dots, arrows, and gaps.
- In the default `Main` tab, the compact signal-flow row is placed below the complete current-model/meter frame rather than above it, giving the processing order a continuous full-width reading line.
- Model artwork now exposes a delayed rich tooltip after one second of hover. The shared tooltip covers the current model, Factory cards, TONE3000 catalog/selection/download images, and follows the capture selected with card arrows. It presents the available filename, architecture/rendering modes, sample rate, creator, NAM format/loudness, source, gear/capture/tone metadata, date, license/provider, and Tone ID; it disappears on pointer exit or tab changes.
- Opening a TONE3000 popup or completing its callback automatically selects the `Models` tab. The real-time spectrum analyzer is enabled only while `Amp settings` is the active tab and is disabled when another tab is selected.

- The NAM plugin's user-facing name is now `NeuralWAMp` (descriptor, GUI heading, and TONE3000 partnership copy). Its stable WAM identifier remains `org.webaudiomodules.nam-a2` for compatibility.
- The temporary square `N` badge in the module header has been replaced by the native `neuralwamp-logo.svg` lockup: a neural audio waveform and nodes paired with an emphasized `WAM` monogram. The same paths are embedded inline in the GUI, avoiding broken-image behavior caused by strict MIME/CSP handling while retaining the standalone asset for reuse. The SVG remains sharp at any display density, has an accessible label, and shifts toward the bypass color treatment when the WAM is disabled. The development server also serves SVG and model artwork with explicit image MIME types.
- The header uses three equal edge columns around a flexible center: the logo occupies the left 94 px, Bypass the right 94 px, and the identity block is centered independently between them. Its lines are ordered `NeuralWAMp`, `NAM A2 neural amplifier`, then `by @micbuffa`.
- The module heading now credits `by @micbuffa` with a link to the author's GitHub profile. A compact, accessible signal-flow strip sits directly below the heading and reflects the active DSP order. PRE shows `Input -> Gate -> EQ PRE -> Amp sim NAM -> Tone stack -> Output`; POST moves `EQ POST` after the amp. Gate, EQ, and tone-stack pills visibly dim and strike through when their corresponding stages are disabled. The strip fits the normal 509 px module width and remains horizontally scrollable on narrower containers.
- The six filter responses now have stable per-band colors; the selected response is emphasized while the exact combined transfer curve remains white.
- The graph now compares three real spectra: a dashed blue-gray `Input` trace at the EQ insertion point, an orange `Filtered` trace immediately after the EQ, and a green `Final output` trace after NAM, EQ, tone stack, and output gain. In PRE mode the first two are captured before NAM inference; in POST mode they are captured after NAM inference. The third trace makes Bass/Middle/Treble changes visible while preserving a direct input-versus-EQ comparison. All three use a 2048-point Hann-windowed FFT, 64 logarithmic bins from 20 Hz to 20 kHz, a `-100..0 dBFS` range, and fast-attack/slow-release smoothing.
- FFT storage, the Hann window, bit reversal, and twiddle tables are allocated/precomputed in the AudioWorklet constructor. Analysis runs at about 30 Hz only while the `Amp settings` tab is visible, and it does not add another `AudioWorkletNode`.
- The left vertical labels show EQ gain in dB; the right labels show analyzer level in dBFS. The selected-band readout and accessible label explicitly identify `Low shelf`, `Bell`, or `High shelf`.
- Gate, EQ, and tone-stack processing now remain active when no NAM capture is loaded. Previously, the no-model pass-through branch bypassed all tone shaping, which made a correctly enabled EQ inaudible and left its spectrum unchanged.
- PRE and POST routing are now explicit in the processing loop and covered independently. PRE filters the gate output before it is copied to the NAM WASM input; POST filters the normalized NAM output. Browser validation with a real Factory Peavey 5150 capture confirmed that the two PRE spectra diverge under a +12 dB bell boost and reported no console errors.
- The host sidebar now keeps the audio player completely hidden while `Live input` is selected and reveals it immediately below the Source selector only for a discovered audio-file source. Input and output device selectors are adjacent, with Output directly below Input; the separate Player and Output cards were removed. The former `Automated validation output` drawer is labelled `Automated test results` and explains that its JSON diagnostic report is produced only by the `?auto=1` validation run.
- Live-input selection follow-up on 2026-09-16: **Enable live input** no longer opens a preliminary unconstrained `getUserMedia()` stream on the operating-system default microphone when a concrete input is already selected. The chosen device is requested directly with `deviceId: {exact: ...}`; concurrent device changes are serialized so a late default-microphone permission response cannot replace a newer Scarlett/USB request. The returned track settings are checked against the requested physical device, and the host status reports the label of the track Chrome actually opened.
- Multichannel-interface follow-up on 2026-09-16: live capture no longer relies on Web Audio's implicit multichannel-to-mono downmix. A `ChannelSplitterNode` routes exactly one chosen interface channel into the mono WAM chain, with physical Input 1 selected by default and an Input channel selector shown when Chrome reports multiple channels. This prevents Scarlett 2i2 4th Gen loopback channels 3–4 from being mixed back into the processed output and creating a digital feedback loop.
- Live monitoring is now an explicit two-state control: green **Enable live input** starts the selected device/channel, while red **Disable live input** disconnects the source node and stops all `MediaStreamTrack`s. Merely changing an input device/channel no longer opens monitoring while the control is disabled, and switching back from file playback leaves live monitoring off until the user enables it.
- Feedback investigation note (2026-09-16): USB id `1235:8210` identifies a Scarlett 2i2 3rd Gen, which does not expose Focusrite loopback channels, so loopback is not the explanation for that report. A 10-second zero-input render of the default Bogner Uberschall capture remained at a tiny constant model bias (about `-82.9 dBFS`, peak `0.0000715`) rather than self-oscillating. The next physical test should compare the NAM input meter with the guitar volume at zero and then press **Disable live input**: if the tone stops immediately, it is present in the captured interface signal/acoustic setup; if input is silent while output remains loud, investigate the live browser graph further.
- The six NeuralWAMp top-level tabs now keep their natural button widths and distribute the remaining space evenly with flex `space-between`. This makes the visible edge-to-edge gaps between `Main`, `Models`, `Amp settings`, `Model details`, `Preferences`, and `Help` regular and avoids an oversized active background around short labels. Below 620 px, the bar switches to left-aligned horizontal scrolling.
- `NamNode` state is now version 4. All 29 WAM parameters (gain, bypass, gate threshold/enabled, bass/middle/treble/tone enabled, EQ enabled/PRE-POST, and frequency/gain/Q for all six bands) continue through the SDK's standard `parameterValues` state round trip. The host's `?auto=1` validation now changes every one of these values before restoring the saved state and checks them all.
- Automated coverage includes spectrum enable/disable behavior, 1 kHz FFT-bin detection across all three traces, comparative input/filtered spectra, visible spectrum change after a +12 dB band boost, final-output response to tone-stack changes, independent audible PRE routing, audible EQ with no NAM loaded, full parameter registration/state wiring, and GUI contracts. The complete suite passes 72/72.

Image rendering follow-up: TONE3000 images use `object-fit: contain` and intrinsic dimensions (preview capped at 320 px high), so the complete source image is visible instead of being cropped into a 160 px `cover` banner.

Cross-browser OAuth/API follow-up on 2026-09-01: `Tone3000Client` now binds the native browser `fetch` function to `window`. This fixes `Can only call Window.fetch on instances of Window` on strict WebKit/Safari-style implementations after a remote user completes Select Flow. A behavioral regression test verifies the Window receiver; the full suite now passes 43/43 and `dist/NAM_A2_WAM/` was rebuilt.

Deployed-image follow-up on 2026-09-01: the VPS sends `Cross-Origin-Embedder-Policy: require-corp`, while TONE3000 image storage sends `Access-Control-Allow-Origin: *` but no `Cross-Origin-Resource-Policy`. Images therefore worked on localhost but were blocked in the deployed page when requested in no-CORS image mode. Both TONE3000 `<img>` elements now use `crossorigin="anonymous"`, selecting CORS mode and making them compatible with the existing COEP header. Contract tests cover the attribute; the suite passes 43/43 and the static distribution was rebuilt.

Design-guideline follow-up on 2026-09-01: the TONE3000 source tab now presents the required partnership splash before authentication, using the official `TONE3000-logo.svg` asset packaged inside the NAM plugin. The Continue action then opens the existing PKCE Select Flow; no OAuth request is made merely by opening the tab.

A fresh authenticated end-to-end Select Flow was not repeated during the Phase 4b.2 visual pass. It still requires:

- the publishable client ID injected as deployment configuration;
- exact registered redirect URIs;
- a normal browser session with the TONE3000 login/selection flow.

Do not put the TONE3000 secret key in client-side code. The publishable key is deployment configuration, not a secret.

## NeuralWAMp Cabinet library redesign — 2026-09-15

- The Cabinet WAM is now presented as **NeuralWAMp Cabinet**, with its own SVG speaker logo and the same compact visual family as the amp WAM.
- Its top-level views are Main, IRs, IR details, and Help. The Main view keeps routing, bypass, Level Match, IR Trim, output gain, current artwork, provenance chips, and activity status together.
- The IR browser now exposes Factory, Favorites, External, and TONE3000 sources. Selecting an IR loads it immediately; grouped Factory/TONE3000 bundles use an artwork-and-capture-list card with previous/next controls.
- IR categories are `speaker`, `space`, `outboard`, `experimental`, and `other`. Rich bundles prefer canonical TONE3000 gear metadata (`cab`, `space`, `outboard`, `experimental`), with conservative filename/tag fallbacks for legacy loose WAV files.
- Factory manifest generation writes the category for every IR. Speaker/cabinet detection has priority over the word `reverb` for names such as Fender Twin Reverb.
- Favorites and explicitly downloaded TONE3000 WAV files persist per browser profile and origin in IndexedDB. Downloaded files can be removed individually or cleared; a favorite keeps its own complete snapshot.
- TONE3000 browsing uses the official `/tones/search` catalog with `format=ir`, optional gear filtering, pagination, sorting, detail selection, authenticated per-file downloads, local persistence, and full provenance/artwork display.
- Amp and Cabinet share the same OAuth token storage but tag each popup flow with an owner, so only the initiating WAM consumes the callback. Both clients reload shared tokens when their TONE3000 source opens.
- `?maintainer=1` reveals the Cabinet Factory maintainer. It selects one IR tone, lets the maintainer choose its WAV files, fetches artwork/metadata, and creates a repository-ready local ZIP using the existing rich `tone.json` format. It does not use the partner-only whole-tone ZIP endpoint.
- Cabinet state now includes the selected IR provenance metadata, preserving source/category/details after restoration. Existing convolution, Level Match, per-IR Trim, output gain, and AUTO routing semantics are unchanged.
- TONE3000 actions are rendered above the local downloaded-IR cards, so Browse/Continue remains visible for `All` and `Cabinets / speakers`. With `?maintainer=1`, the maintainer box is the first block in the TONE3000 panel; after a tone is selected it shows the WAV checkboxes and then reveals **Download selected Factory IR bundle (.zip)** in that same box.

## WAM FX plugin registry — Phase 1 completed 2026-09-16

- A reusable registry now loads `examples/wam/wamPlugins/plugins.json`, resolves relative and absolute plugin URIs, validates allowed URL protocols, imports each WAM independently, normalizes its descriptor, infers categories from descriptor tags, and records every compatibility stage without letting one broken plugin block the others.
- Ten bundled WAMs are registered: DeathGate, TS9, AutoWah, SweetWah, Chorus, StonePhaser, PingPongDelay, GreyHole, StereoEnhancer, and TunerMachine. Compatibility fixes were limited to relocated SDK, GUI dependency, dynamic-module, and thumbnail paths.
- The compact `wam-plugin-card` component displays descriptor artwork, identity, category, tags, and validation state with a generated fallback thumbnail when needed.
- The standalone test host is available during development at `http://127.0.0.1:8765/examples/wam/fx-test/` and in a static build at `dist/NAM_A2_WAM/fx-test/`. It provides test-tone, live-input, and local-file sources; input/output meters; plugin loading and host-level bypass; GUI open/close; parameter inspection; state save/restore; diagnostics; and sequential validation of the complete catalogue.
- TunerMachine runs on a parallel analysis branch connected through a zero-gain sink, so opening the tuner does not replace or mute the main effect route. Its GUI is available from the tuner control in the test host header.
- The distribution builder copies the registry, card component, test host, catalogue, and bundled plugins, rewrites the development-only SDK path, and verifies required files and forbidden source references.
- Registry authoring, catalogue fields, category rules, remote URI constraints, and compatibility stages are documented in `docs/WAM_PLUGIN_REGISTRY.md`.
- Validation completed successfully in both the development host and the generated static distribution: all ten real plugins reached descriptor, import, instantiation, GUI, audio, and state validation. The full automated suite passes 91/91.
- This phase deliberately does not modify the production guitar signal chain. It establishes the registry and compatibility laboratory that the later routing/pedalboard phases will consume.
- Every catalogue card is now directly clickable (and keyboard accessible). It loads the effect and opens its real plugin GUI in a modal window. The window header carries the plugin title, a synchronized host-level `BYPASS ON/OFF` control with explicit color states, and a close control; closing the window keeps the effect loaded and audible. Clicking the loaded card reopens its GUI without reinstantiating it. The tuner uses the same window but omits the unrelated effect-bypass control.
- Effects now start with host bypass OFF whenever a new catalogue plugin is loaded. GUI elements are mounted only after the modal becomes layout-visible; this is required by plugins such as TunerMachine that size their canvas in `connectedCallback()`, and restores the complete tuner scale, centered needle, and pivot instead of a clipped red fragment.

## Critical invariants — do not regress

Audio preferences (2026-09-22): explicit input device/channel and successful output selections persist under `neuralwamp.audio-devices.v1` in localStorage. Startup resolves saved IDs against enumerated hardware, resets the channel for a replacement input, clamps it after probing, and restores an available output with system-default fallback. Missing devices do not erase stored preferences, so reconnecting them for a later session can restore the user's choices. Monitoring is never enabled by restoration. Storage failures and invalid JSON are tolerated. Device identity remains browser/origin-dependent.

Initial input follow-up (2026-09-22): after host initialization the initially selected device is now probed without monitoring, using the same channel-discovery function as a manual selection. The channel menu shows a disabled “Detecting channels…” placeholder until the result arrives, instead of implying a mono device. Failure displays “Channels unavailable” and the capture error; normal live activation re-enables the selector. Automated `?auto=1` runs skip the initial microphone probe.

UI follow-up (2026-09-21): choosing an input device with monitoring disabled now briefly opens a capture to negotiate its channel count, stops all tracks, and updates the channel menu without an audio connection. The NAM Main view now includes previous/next capture arrows around its photo, the selected filename and position beneath it, and boundary/loading disabled states. Navigation groups Factory and locally stored captures by tone identity and uses the active TONE3000 tone list for remote captures.

AudioBox follow-up (2026-09-21): capture now requests exact stereo when opening the selected device, rather than relying on an ideal constraint or reported capability maximum. Only an explicit channelCount overconstraint permits fallback on the same device; device/permission failures propagate. Stereo renegotiation is also attempted when capability data is missing or reports mono. The UI reports requested versus supplied channels and the negotiation error when capture remains mono. This is covered by simulated browser tests; physical AudioBox verification remains pending.

Device handling follow-up (2026-09-21): the main host clears stale channel choices on input changes and reports the actual negotiated channel count. SourceManager retries an exact stereo constraint when a mono stream exposes stereo capabilities, while retaining selected-channel-only routing. Output selections are serialized; devicechange errors are caught and interrupted audio attempts system-default sink selection followed by resume. A bounded recovery attempt exposes a Recover audio button if needed. If Chrome has permanently closed the context, the UI explicitly requests a page reload; automatic graph reconstruction is not implemented. Removing the selected input stops monitoring instead of opening an unrelated microphone. Tests pass 96/96, including mocked stereo renegotiation, mono devices, ordered sink changes, interrupted recovery and terminal closure. Actual PreSonus hardware hot-unplug verification is still needed.

### NAM

- A2 inference remains directly in the existing WAM AudioWorklet.
- Exactly one production AudioWorkletNode belongs to the NAM WAM.
- Preserve the WAM SDK `_process()` architecture and existing gain semantics.
- Keep catalog/network/DOM work outside the real-time process path.

### Cabinet

- Cabinet remains a separate reusable WAM.
- Exactly one production AudioWorkletNode belongs to Cabinet.
- Production convolution remains NeuralAmpModelerCore `nam::Linear`, not Web Audio `ConvolverNode`.
- IR decode/resampling and analysis stay outside the AudioWorklet.
- Level Match remains L2-based; per-IR Trim and Cabinet Output Gain remain independent.

### AUTO routing

- AUTO belongs to the host; Cabinet must remain NAM-independent.
- Manual ON/BYPASS overrides remain authoritative.
- Trusted detection is case-insensitive `metadata.gear_type === "full-rig"`, with only constrained full-rig label fallbacks.
- Model selection and state restoration must reevaluate AUTO.

## Intentional Phase 4b.2 limitations

- No Cabinet meter was invented because Cabinet currently exposes no corresponding meter signal; adding one would be DSP/API work.
- No new host master-output gain was added because the current graph has no master gain node and adding one would alter gain staging. Existing source trim and plugin output gains remain available.
- Real microphone permission, physical input/output switching, and listening tests were not exercised by the automated browser pass.
- The workspace is now a Git repository on branch `main`; no initial commit has been created yet. `.gitignore` excludes generated output, `dist`, third-party trees, unrelated prototypes, and local agent/editor metadata.

## Recommended next actions

1. Deploy the rebuilt `dist/NAM_A2_WAM/` to the VPS and hard-refresh the deployed page.
2. Verify the Phase 4b.2 layout and responsive behavior in Chrome/Firefox/Safari on the deployment URL.
3. Run the real TONE3000 Select Flow using the configured publishable client ID and exact redirect URI; verify callback, selected model download, cancellation, token refresh/error handling, and AUTO reevaluation.
4. Test live guitar, microphone/device switching, audible gain behavior, bypass, Level Match, clicks/dropouts, and rapid model/IR changes.
5. Before EndUserAmp2 integration, decide explicitly whether a Cabinet meter or a true host master gain requires new plugin/DSP APIs.
6. Integrate the reusable WAM modules into EndUserAmp2 only after the standalone static package remains stable.

## Explicitly out of scope unless requested

- Replacing the official TONE3000 API and OAuth flow with a custom catalog backend.
- Additional effects, pedalboard, tuner, delay, or reverb.
- Cabinet DSP redesign or extra AudioWorkletNodes.
- Service-worker/offline catalog mirroring. Only explicitly downloaded TONE3000 model files are persisted locally.
- Server-side credential handling in this static client.

## Phase 4b.3 limitations and validation notes

- The integrated catalog is implemented against the official TONE3000 endpoints, but a fresh authenticated live catalog test still requires the deployment client ID, registered redirect URI, and a normal browser session.
- The browser host does not reproduce the official JUCE native model cache; it downloads the selected model in the page, persists that requested file in IndexedDB, and passes its text to `NamNode.loadModelText`.
- TONE3000's full Select Flow opens in a popup and relays the callback to the unchanged host page; same-tab handling remains as a fallback. The post-login catalog itself is rendered inside the WAM GUI.
- Run `npm test` and `npm run dist` after changes. The new contract coverage checks the no-prompt login URL, official catalog endpoint/query shapes, Bearer authorization, and catalog GUI controls.
