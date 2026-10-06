# WAM•FAUST ShredLab — IFC Amp2

Extracted on 2026-09-24 from `examples/other_wam_host/EndUserAmp2`.
Original authors: Michel Buffa & Jerome Lebrun; original plugin version 0.3.
This is the advanced preamp-v6 variant, with 47 parameters, component-oriented
preamp controls, tube selection, sag/bias, tone stack, power amp, cabinet and reverb.
Its signal path is one DSP input and two outputs. The WASM binary is unchanged.

The self-contained package is loaded through `index.js`. No old host, backing
tracks, Faust compiler or external asset server is required. `ampProfiles.js`
is required by the editor for its existing model choices; these are plugin
settings, not the deferred rack preset-management feature.

## Compatibility changes

- Distinct identifier `fr.grame.faust.ifc2026.amp2`: the supplied variants had
  the same identifier despite different DSPs. Separate AudioWorklet registration
  is necessary for both to coexist correctly in one host.
- Lazy GUI and awaited initial state; idempotent composite-node cleanup.
- Visibility-aware GUI polling, stopped after detach/delete; `ifc2-webaudio-*`
  controls initialized once to avoid collisions and reopen errors.
- ParamMgr destroy acknowledgement repaired before the port is closed.
- Removed delayed constructor writes that applied a profile and every knob
  value on opening. DSP state is now authoritative. Explicit model selection
  still applies `AMP_PROFILES`; labels are inferred from current parameters,
  so reopening does not reset the sound or mislabel restored settings.
- Blue-petrol/copper interface, responsive wrapping and an actual GUI screenshot
  for the descriptor thumbnail. Public name: WAM•FAUST ShredLab.

DSP parameter IDs, binary and defaults remain unchanged. `SOURCE_MANIFEST.json`
records the original hashes. SDK/Faust/controls copyright and license comments
are retained; WebAudio Controls includes its Apache-2.0 notice, and DSP authors
and library metadata remain in `dsp-meta.json`. This copy does not relicense them.

The plugin includes a cabinet stage. With an external cabinet, choose explicitly
which stage to bypass; it does not claim NAM metadata for the rack's AUTO policy.

Run `examples/wam/fx-test/ifc-validation.html?variant=2` for numerical browser
validation at 44.1 and 48 kHz (silent output, no microphone). Physical listening
remains a separate check. See the repository integration specification for results.

## Factory presets

The plugin includes Default, Clean, Crunch, Disto / Hi gain, Jazzy and Jordan in its own editor. The five named sounds contain only the amplifier settings from the corresponding original host. Missing controls are filled from DSP defaults. Select a sound through the GUI or `audioNode.loadFactoryPreset(id)`; `getFactoryPresets()` lists stable IDs and names.

`getState()` returns flat DSP parameters plus `__wamFactoryPreset: {version: 1, id}`. `setState()` restores the saved values and selection without reapplying factory settings, preserving edited sounds. Legacy flat states remain supported. The editor shows Modified when controls differ from the selected preset. No host preset manager or local storage is required.
