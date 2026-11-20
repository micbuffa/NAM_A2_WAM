# Audio routing

## Rack and outputs

- Chain A and chain B process ordered WAM instances. B can take an independent
  channel from the selected live input or tap one junction in A. The tap sees
  the effects before the junction, including when A's output is muted.
- Hiding B disconnects its input and output while retaining its instances and
  configuration. Changing the split or replacing a plugin preserves the
  remaining chain and must avoid duplicate graph connections.
- Play Along joins the mix after the rack, outside the guitar effects. Play
  and Studio keep separate output paths. In Studio, track monitoring owns the
  audible live input. See the [recording contract](../RECORD_TRACKS_SPECIFICATION.md).
- Restoring a preset, device preference or diagnostic state does not enable
  live monitoring or start playback. Device preferences are separate from
  portable rack state. If the selected input disappears, stop monitoring
  without opening another microphone. Rack restore supports version 1 snapshots.

## NAM and Cabinet

NAM runs A2 inference in its WAM AudioWorklet. Cabinet is a separate reusable
WAM with its own AudioWorklet and uses NeuralAmpModelerCore FFT convolution
(`nam::Linear`). Decode, resampling and IR analysis belong outside the render
callback. Per-IR trim, level matching and Cabinet output gain are separate
controls. Keep catalog, network and DOM work outside audio rendering.

Cabinet AUTO belongs to the host. Manual ON and BYPASS take precedence. In
AUTO, use the applicable upstream NAM on the actual route, including A's
prefix for a cabinet in split B. Tone provenance takes priority over model
metadata. Explicit amp metadata leaves Cabinet active. Full-rig or amp-cab
metadata bypasses it. The model-name fallback looks for a full-rig label.
Reevaluate after model, bypass or topology changes and after restore.

## Verification

- [Rack and split behavior](../tests/phase4b/fx-chain.test.mjs), including
  muting A, hiding B, replacement, AUTO and legacy snapshots.
- [Device preferences](../tests/phase3/audio-device-preferences.test.mjs)
  and [Play Along mix](../tests/phase7/play-along.test.mjs).
- [Browser routing bench](../examples/wam/fx-test/rack-validation.html).
  Physical interface switching, hot-unplug and live listening still require
  hardware checks when this routing changes.
