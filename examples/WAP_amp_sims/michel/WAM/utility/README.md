# Wasabi Ampsim Utility — WAM v2

This module ports the original Utility WAP by Michel Buffa / Wimmics. It loads the existing DeathGate WAM as a private headless child in the host's WAM group and AudioContext. No child editor is created and no new gate DSP is compiled.

Audio: input → L/R splitter → independent channel activation → stereo merger → input gain → DeathGate → output. DeathGate sums L+R and duplicates its mono result to both output channels, exactly as the WAP did. A mono source enters the splitter's left channel; enabling only R therefore silences it.

Public WAM parameters:

| ID | Range | Default |
|---|---|---|
| `inputGain` | 0.01–2, linear | 1 |
| `noiseGate` | −120–0 dB | −120 |
| `leftInput` | 0/1 | 1 |
| `rightInput` | 0/1 | 1 |

Control callbacks run at the ParamMgr's nominal 30 Hz; they are not sample-accurate. Background browser throttling may reduce this cadence. Scheduled and normalized WAM automation is supported. State version 1 stores `parameterValues` and `gateState`; the parent's `noiseGate` wins over the child snapshot. The hidden DeathGate dead zone remains at −100 dB unless restored from a state. Plain original WAP parameter saves can also be loaded.

The editor preserves the 232×272 panel, texture, Jambalaya knobs and Metalfont. Its input meter taps before gain/selection and masks disabled inputs; its output meter taps after the gate. Analyzer taps and animation frames are released when the editor closes. There is no internal bypass or microphone/device handling; the host provides those functions.

From repository root:

```sh
npm run dist:wasabi-amps
npm run install:wasabi-amps
npm run dist
```

The historical command names now include Utility alongside the three amplifiers. `dist/wasabi-amps/utility/index.js` is the standalone entry URI. The entire `utility/` folder can be deployed by itself; it embeds the existing DeathGate WAM and required runtime dependencies under `vendor/`. Install copies this folder into `examples/wam/wamPlugins/ampsimutility/`, in category `amplifier`. The final command also rebuilds `dist/NAM_A2_WAM/`.

Run `../utility-validation.html` and `../utility-validation.html?dist` through the development HTTP server. They exercise source and standalone modules against the unchanged WAP and a reference graph using the same WAM gate, at 44.1 and 48 kHz. Results are saved in `../UTILITY_VALIDATION.json` and `../UTILITY_VALIDATION_DIST.json` after execution. Equivalence is established for this finite signal/settings matrix, not every possible input.

Original UI assets are copied without modification. Gate attribution, DSP license notice/source and runtime licenses travel with the vendored child. WebAudioControls retains its Apache-2.0 copyright/license header. `MANIFEST.json` in the distribution records all shipped file hashes.
