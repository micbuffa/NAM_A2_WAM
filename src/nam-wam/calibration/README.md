# Guitar calibration reference

`funky-guitar-reference.wav` is a 12-second excerpt (8–20 seconds) of the existing `examples/wam/assets/audio/Funky-Guitar.mp3`, decoded at 48 kHz, left channel, PCM16. The left channel matches the NAM node's mono/discrete input. It is bundled inside the plugin so calibration also works in other WAM hosts and in the static distribution.

Regenerate with:

```sh
ffmpeg -y -ss 8 -t 12 -i examples/wam/assets/audio/Funky-Guitar.mp3 -af 'pan=mono|c0=c0' -ar 48000 -c:a pcm_s16le src/nam-wam/calibration/funky-guitar-reference.wav
```

On explicit calibration, the browser decodes/resamples this reference at the AudioContext sample rate. A dedicated Worker loads an independent WASM model instance, warms it for one second, and measures all 12 seconds with −18 dB reference input trim plus the plugin's current input gain. It bypasses host effects, gate, EQ and tone stack. No reference audio is played or injected into the live graph.

The fixed output correction targets −24 dBFS RMS, constrained to ±36 dB and a −1 dBFS sample-peak ceiling on the reference. Limits are reported. This replaces the metadata correction; it is not added to it. Metadata normalization remains ±12 dB at its existing target. Calibration is saved in WAM state per capture/variant, with reference and measurement information. Changing capture/variant or normalization while measuring cancels the result; changes to plugin input gain require recalibration. This is reference matching, not a compressor or a guarantee against clipping with other audio or subsequent effects.
