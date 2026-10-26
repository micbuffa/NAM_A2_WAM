# Synthetic MP3 test fixture

`studio-mix.mp3` is generated locally, with no recorded music: stereo, 4410 frames
at 44.1 kHz, both channels equal to `0.2 * sin(2*pi*440*i/44100)`.
Encoded using `MixMp3Core` and the pinned `vendor/lamejs/lame.min.js`, stereo
192 kbit/s; 3134 bytes. Tests use it for private upload/download byte equality,
format and persistence. Encoder padding is expected. Upstream encoder notices
are retained in its vendor directory. No user audio is included.
