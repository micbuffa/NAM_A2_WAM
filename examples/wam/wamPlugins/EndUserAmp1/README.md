# WAM•FAUST TubeLab — IFC Amp1

Extracted on 2026-09-24 from `examples/other_wam_host/EndUserAmp1`, whose
`host/index.js` loads `../index.js`. Original authors: Michel Buffa & Jerome Lebrun.
The original WAM identifier and DSP parameter addresses are preserved; the public name is WAM•FAUST TubeLab.

The original README describes the preamp as `IFCPreampGuitarix.dsp`, generated
with faust2wam and given a custom interface for guitarists. The compiled plugin
contains preamp, tone stack, power amp, reverb and cabinet simulation. It has
one DSP input and two outputs. Its cabinet is enabled by default: bypass that
internal stage or an external Cabinet deliberately when chaining cabinets.
This generic Faust effect does not provide NAM metadata for Cabinet AUTO.

## Use

Load `index.js` as a WAM 2 module from an HTTP localhost or HTTPS static server.
The entire directory is self-contained; no old host, backing track, audio demo,
Faust compiler, external IR download, faust-ui or FFTW runtime is needed.
The thumbnail is a browser capture of this plugin's actual interface and is
referenced by `descriptor.json`. WAM state is the original flat parameter map.
The rack provides its own dry/wet bypass around the complete plugin.

## Provenance and local adaptations

`SOURCE_MANIFEST.json` records SHA-256 digests of the original files. The
`dsp-module.wasm`, `dsp-meta.json`, `sdk/index.js` and `faustwasm/index.js` are
unchanged. No DSP recompilation or default-value change was made.

Adapted files:

- `index.js`: lazy cached GUI, awaited initial state, explicit GUI cleanup and
  idempotent destruction of the composite audio node.
- `gui.js`: animation polling starts only while connected/visible; pauses when
  parked; resumes on reopening; stops permanently on destruction. Async stale
  results are discarded. Custom controls are namespaced and the layout wraps
  at narrow widths. Existing custom-element registration is reused across
  repeated instances/imports.
- `utils/webaudio-controls.js`: `ifc-webaudio-*` tags avoid collisions with other
  WAM versions; connected callbacks initialize once rather than redefining
  non-configurable slider properties on every editor reopening.
- `sdk-parammgr/index.js`: the processor no longer closes its port before
  replying to `destroy`. The node closes the endpoint after acknowledgement,
  allowing cleanup to complete instead of leaving an unresolved promise.
- `descriptor.json`: public name/description and thumbnail reference; original identifier retained.

The vendored files retain their existing copyright/license comments. In
particular WebAudio Controls carries its Apache-2.0 notice. DSP authorship and
library declarations remain in `dsp-meta.json`; this extraction does not
relicense the original DSP or SDKs.

## Validation

Run `examples/wam/fx-test/ifc-validation.html` for real AudioWorklet tests at
44.1/48 kHz, with muted speaker output and no microphone. It exercises two
instances, stereo downmix, master control, state, dry bypass, impulse and DI
sources, separate editors and repeated detach/show/delete cycles. The same
page is included in the static distribution. Listening on physical hardware
remains a separate user check.

## Factory presets

The plugin includes Default, Clean, Crunch, Disto / Hi gain, Jazzy and Jordan in its own editor. The five named sounds contain only the amplifier settings from the corresponding original host. Missing controls are filled from DSP defaults. Select a sound through the GUI or `audioNode.loadFactoryPreset(id)`; `getFactoryPresets()` lists stable IDs and names.

`getState()` returns flat DSP parameters plus `__wamFactoryPreset: {version: 1, id}`. `setState()` restores the saved values and selection without reapplying factory settings, preserving edited sounds. Legacy flat states remain supported. The editor shows Modified when controls differ from the selected preset. No host preset manager or local storage is required.
