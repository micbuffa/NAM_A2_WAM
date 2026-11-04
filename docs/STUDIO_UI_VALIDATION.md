# Studio UI qualification — 2 November 2026

Branch: `codex/studio-integration`. Synthetic browser tests use the actual UI/audio modules with generated signals, without touching user projects or opening a microphone. Rails tests use the isolated test database.

| Area | Evidence | Result |
| --- | --- | --- |
| Regression suites | 582 JS tests; 144 Rails tests, 1285 assertions | Pass, no failures/skips |
| Header conventions | Live Settings preview + real timeline: Logic I/R, Reaper speaker/microphone, Cubase speaker/outlined circle, Ableton IN/filled circle | Correct glyphs; labels/handlers retained; Reaper default |
| Themes/layout | Dark, Studio Light, Warm Studio at1280×719 CSS pixels | No horizontal overflow |
| Many tracks/keyboard |20 tracks; Tab beyond Delete Instrument20 | Focus reveals next control in lane scrollport; document scrollY stays0 |
| Narrow/zoom-equivalent layout |640×360 effective CSS viewport | Normal vertical flow, document width640; no horizontal overflow |
| Recording lifecycle | Real capture WAM/ringbuffer/Worker, synthetic DI | Silent arming/raw meter,4-beat count-in, backing/capture aligned, speaker usable while other controls locked |
| Incremental waveform |2.6-second synthetic capture |23 packets, stable canvas,0 ordinary row rerenders,1 initial full repaint |
| Playback meter | Synthetic live input louder than take | Played signal metered; live input excluded |
| Stop during count-in | Shared stopTransport | Idle,0 takes |
| Latency compensation | Native Worklet/Worker matched filter,11ms DelayNode at48kHz |528 frames detected,0-frame residual, aligned-take maximum error0; resources released |
| Mix |15 native OfflineAudioContext pan/mute/solo/master cases | Maximum error2.25e-8;48→44.1kHz resampling error8.29e-5 |
| MP3 | Native encoder Worker then decode |25077 bytes, stereo,1.0449s decoded duration for1s source (codec padding) |
| Master | Saved/preview audio ×1,.25,0 | All6 native gain checks pass |
| Track sound dock | Native fixture `track-sound-editor.html`, real editor/player/TrackTones/PresetsPanel with synthetic gain racks, “Run qualification” (14 checks) | Selection shows the track sound while playing (peak .1414 at gain 2, .2828 at gain 4, no pause); another selection applies the edit and the solo keeps it on its own rack; Revert; Play rack and preset restored; origin “· modified”; one Save, reusable preset only on request; capture gain 2, same DI, library preset .25 — 4 November 2026 |
| Persistence journey | New joined Rails integration test,37 assertions | Imported original retained,4 partial stems, linked Tone mix, DI+capture snapshot preserved, playback snapshot editable, reopen5 tracks,delete/restore same blobs |
| Export safety | Same joined journey | Server rejects project-local preset snapshots until WAM-rendered export qualified; previously only library/factory IDs checked |
| Reduced motion | Host and shared shadow CSS contracts | Decorative animations/transitions disabled by system preference; native OS preference not emulated in this run |

Native fixture pages are in `tests/phase7/fixtures/`: `studio-layout.html`, `recording-capture.html`, `recording-latency.html`, `studio-mix-validation.html`, `studio-master-volume.html`, `track-sound-editor.html`. Serve the repository root with the development server supporting audio worklets/shared memory; these pages are developer tools, not added to the production UI.

Reproduction: run `web/bin/rack-sync` before `npm test` so distribution assertions see the current build; run `docker exec nam-rails-main bin/rails test` for Rails. Source browser fixtures were served at `http://127.0.0.1:8765/`; product rack at `http://localhost:3001/rack/`. Four-style screenshot: `/tmp/studio-four-icon-styles.png`.

## Remaining qualification

UI task5 remains CURRENT. This run does not establish physical interface round-trip accuracy, a long recording under concurrent full-model GPU/CPU load, actual external YouTube retrieval, Firefox/WebNN performance or a comprehensive screen-reader/accessibility audit. Unit/API guards are covered; they do not substitute for those native/manual checks. No model performance conclusion follows from these UI/synthetic tests. Processed personal-track WAM mix export remains a separate pending feature (P5.4b).
