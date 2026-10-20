# WaveSurfer display renderer

WaveSurfer.js **7.12.4**, BSD-3-Clause. Unmodified renderer and its transitive dependencies from the npm tarball, revision `ba798b3d6ea05e6c11d3a27ca8ebc8cedcb3338c`. Local SHA-256 hashes: `integrity.json`; license: `LICENSE`.

- Source: https://github.com/katspaugh/wavesurfer.js/tree/7.12.4
- Package: https://registry.npmjs.org/wavesurfer.js/-/wavesurfer.js-7.12.4.tgz

Only the rendering layer is shipped. It receives small precomputed peak buffers and draws canvas waveforms. No WaveSurfer player, media element, decoder, transport or AudioContext is instantiated. Audio remains in our common Web Audio engine. This lower-level adapter is pinned and covered by tests; recheck its API before upgrading. The wavesurfer-multitrack super-plugin is not used: its independent players are unnecessary for our synchronized progressive engine.
