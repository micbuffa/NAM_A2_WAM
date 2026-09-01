# NAM A2 WAM — Next-session handoff

Updated: 2026-08-31

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
- Model sources are Factory, External, and TONE3000.
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
- `examples/wam/main.js`
- `src/nam-wam/gui.js`
- `src/cabinet-wam/gui.js`
- `tools/build-static-dist.mjs`
- `tests/phase4a3/distribution.test.mjs`
- `HANDOFF.md`

## Files created

- `examples/wam/host.css`
- `tests/phase4b/gui-redesign.test.mjs`

The generated files under `dist/NAM_A2_WAM/` were rebuilt from these sources.

## Automated validation

- `node --check` passes for the modified JavaScript modules and the new GUI contract test.
- `npm run dist` succeeds.
- Distribution contains 58 NAM models and 43 Cabinet IRs.
- `npm test` passes 42/42 tests.
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

The Phase 4b.1 integration and callback fix are preserved. Phase 4b.2 verified that the TONE3000 source panel, button, status, and callback contract are present without introducing startup requests.

Follow-up completed on 2026-08-31: selected TONE3000 tone images are now supported through the documented `Tone.images` array. Both image placements are present in the rebuilt static distribution and remain hidden until a valid image URL is available.

Image rendering follow-up: TONE3000 images use `object-fit: contain` and intrinsic dimensions (preview capped at 320 px high), so the complete source image is visible instead of being cropped into a 160 px `cover` banner.

Cross-browser OAuth/API follow-up on 2026-09-01: `Tone3000Client` now binds the native browser `fetch` function to `window`. This fixes `Can only call Window.fetch on instances of Window` on strict WebKit/Safari-style implementations after a remote user completes Select Flow. A behavioral regression test verifies the Window receiver; the full suite now passes 43/43 and `dist/NAM_A2_WAM/` was rebuilt.

Deployed-image follow-up on 2026-09-01: the VPS sends `Cross-Origin-Embedder-Policy: require-corp`, while TONE3000 image storage sends `Access-Control-Allow-Origin: *` but no `Cross-Origin-Resource-Policy`. Images therefore worked on localhost but were blocked in the deployed page when requested in no-CORS image mode. Both TONE3000 `<img>` elements now use `crossorigin="anonymous"`, selecting CORS mode and making them compatible with the existing COEP header. Contract tests cover the attribute; the suite passes 43/43 and the static distribution was rebuilt.

Design-guideline follow-up on 2026-09-01: the TONE3000 source tab now presents the required partnership splash before authentication, using the official `TONE3000-logo.svg` asset packaged inside the NAM plugin. The Continue action then opens the existing PKCE Select Flow; no OAuth request is made merely by opening the tab.

A fresh authenticated end-to-end Select Flow was not repeated during the Phase 4b.2 visual pass. It still requires:

- the publishable client ID injected as deployment configuration;
- exact registered redirect URIs;
- a normal browser session with the TONE3000 login/selection flow.

Do not put the TONE3000 secret key in client-side code. The publishable key is deployment configuration, not a secret.

## Critical invariants — do not regress

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

- No synthetic Lite/Full selector was added: the GUI displays the model subtype/mode metadata because no existing supported DSP parameter exposes a safe GUI-only switch.
- No Cabinet meter was invented because Cabinet currently exposes no corresponding meter signal; adding one would be DSP/API work.
- No new host master-output gain was added because the current graph has no master gain node and adding one would alter gain staging. Existing source trim and plugin output gains remain available.
- Real microphone permission, physical input/output switching, and listening tests were not exercised by the automated browser pass.
- The workspace is now a Git repository on branch `main`; no initial commit has been created yet. `.gitignore` excludes generated output, `dist`, third-party trees, unrelated prototypes, and local agent/editor metadata.

## Recommended next actions

1. Deploy the rebuilt `dist/NAM_A2_WAM/` to the VPS and hard-refresh the deployed page.
2. Verify the Phase 4b.2 layout and responsive behavior in Chrome/Firefox/Safari on the deployment URL.
3. Run the real TONE3000 Select Flow using the configured publishable client ID and exact redirect URI; verify callback, selected model download, cancellation, token refresh/error handling, and AUTO reevaluation.
4. Test live guitar, microphone/device switching, audible gain behavior, bypass, Level Match, clicks/dropouts, and rapid model/IR changes.
5. Before EndUserAmp2 integration, decide explicitly whether Lite/Full switching, a Cabinet meter, or a true host master gain require new plugin/DSP APIs; do not fake these in CSS or host glue.
6. Integrate the reusable WAM modules into EndUserAmp2 only after the standalone static package remains stable.

## Explicitly out of scope unless requested

- Full custom TONE3000 API browsing/search/favorites.
- Effects, pedalboard, EQ, tuner, delay, or reverb.
- Cabinet DSP redesign or extra AudioWorkletNodes.
- Permanent external asset database or service worker.
- Server-side credential handling in this static client.
