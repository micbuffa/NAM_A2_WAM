# Model level comparison — 2026-10-09

The screenshot shows a shared A → B tap before the first effect, bypassed cabinets and input trim −18 dB. Capture filenames are truncated, so the exact selected files cannot be established from the screenshot alone.

Measured the Factory Bogner `[AMP] UBER--m689732.nam` and Deluxe Reverb `Fender DRRI Clean Room Only Full Rig--m383454.nam` with the built WASM wrapper at 48 kHz, A2 Full, 997 Hz sine. Reset before each run, 4096 warm-up frames, 16384 measured frames. No EQ, gate, cabinet or manual gain. Metadata normalization applied numerically to raw RMS.

| Capture | Metadata correction | Output at −19.49 dBFS input | Output at −46.70 dBFS input |
| --- | ---: | ---: | ---: |
| Bogner m689732 | +1.36 dB | −20.23 dBFS | −20.37 dBFS |
| Deluxe Room m383454 | +10.07 dB | −19.39 dBFS | −44.86 dBFS |

The weak-input gap is 24.49 dB on this sine probe, versus 0.84 dB at the reference input. These are diagnostic signals, not perceived-loudness measurements of the user's guitar recording. The distorted amp compresses strongly while the clean capture retains input dynamics. Metadata normalization is working; a fixed correction cannot equalize two different nonlinear transfer functions at all input levels.

The existing measured calibration uses the same reference probe amplitude (0.15 peak), not the current guitar signal. It would apply +3.59 dB to this Bogner and +11.46 dB to this Deluxe: it does not remove their low-input mismatch. Neither metadata nor measured normalization calibrates the physical audio-interface input.

Balance using per-chain output volume to preserve drive, including reducing the louder chain. Raising input trim changes drive and therefore tone. No automatic input gain or dynamic loudness matching was introduced.

## Follow-up: actual Funky-Guitar.mp3

Rendered the full 69.528-second bundled file through the real WASM engine at 48 kHz, averaging stereo as 0.5 × (L + R), matching NamProcessor. Applied −18 dB source trim and metadata normalization; no other processing. These are full-file RMS and sample-peak measurements, not LUFS or a reproduction of the entire live rack.

| Capture | Output RMS | Output peak |
| --- | ---: | ---: |
| [AMP] UBER--m689732.nam | -18.13 dBFS | -4.37 dBFS |
| [AMP] UBER--m689735.nam | -18.39 dBFS | -4.32 dBFS |
| Fender DRRI Clean Room Only Full Rig--m383454.nam | -38.37 dBFS | -17.00 dBFS |
| Fender DRRI Clean SM57 + Royer R-121 (No Room) Full Rig--m383455.nam | -37.45 dBFS | -13.69 dBFS |

The selected Bogner m689735 differs from Deluxe Room m383454 by 19.98 dB RMS. Sample-based output calibration CAN compensate this difference for this file/input level. For this pair, chain A output −10 dB and chain B output +10 dB give nearly equal RMS with no individual output clipping in this measurement. Merely boosting Deluxe by 19.98 dB would exceed full scale on peaks (about +2.98 dBFS). A common lower target avoids that. Other captures, guitar phrases and input levels need their own measurements. No user gain settings were changed.
