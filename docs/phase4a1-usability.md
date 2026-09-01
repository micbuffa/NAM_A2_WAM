# Phase 4a.1 usability update

## Level Match definition

For an FIR `h[n]` driven by zero-mean, unit-variance uncorrelated samples, output variance is `sum(h[n]^2)`. Therefore its white-noise RMS gain is the L2 norm `sqrt(sum(h[n]^2))`, and the matching scalar is its reciprocal. In dB this is `-20 log10(L2)`. Multiplying the convolved output by one scalar changes magnitude uniformly at every frequency and does not change the IR's frequency-response shape.

Analysis happens after browser decoding/resampling and before transfer to the worklet. Silent/near-silent IRs (`energy <= 1e-12`) and non-finite samples use unity compensation and report invalid analysis. Valid compensation is clamped to `[-24,+24] dB`; raw values remain available for diagnosis. There is no fixed attenuation. Level Match defaults ON, Cabinet Output Gain remains an independent `-24..+12 dB` trim, and a 20 ms one-pole scalar transition prevents clicks. No energy analysis occurs in `_process()`.

The recursive inventory analyzed 36 `.wav`-named assets. Complete per-file original-rate and resampled-48-kHz energy, L2 norm, raw compensation, applied compensation, sample count, and clamp status are in [`examples/wam/ir-level-analysis.json`](../examples/wam/ir-level-analysis.json). None of the current assets reaches the clamp. At runtime-relevant 48 kHz, compensation spans `-4.823 dB` to `-19.651 dB`. The three production Twin IRs are:

| IR | Raw energy | Raw compensation | 48 kHz energy | Applied compensation |
|---|---:|---:|---:|---:|
| BALANCED | 6.506719 | -8.134 dB | 7.082111 | -8.502 dB |
| CLEAN | 5.597224 | -7.480 dB | 6.092198 | -7.848 dB |
| MIDS | 8.394175 | -9.240 dB | 9.136449 | -9.608 dB |

## Host AUTO routing

Cabinet routing is host policy and the Cabinet WAM remains NAM-independent. AUTO first checks case-insensitive exact `metadata.gear_type === "full-rig"`; only if absent does it check authored model name and filename for `full rig`, `full-rig`, `full_rig`, or `fullrig`. The generic word `full` does not match. ON and BYPASS always override detection. Successful model loads and NAM state restoration both trigger reevaluation; changing Lite/Full within the same capture retains the capture's top-level classification when that capture is restored/loaded.
