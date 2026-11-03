# A/B punch and cycle takes — 3 November 2026

Branch: codex/studio-integration. Additive to partial DI overwrite and bounded history. No new schema migration. Existing mono Float32 DI at the current capture rate required for occupied tracks. Synthetic qualification only, physical interface/listening validation remains.

## Implemented contract

A valid A/B selection is honored even when Loop is off. Record before A starts the backing from the chosen playhead after count-in; raw input before the compensated A boundary is discarded. Capture ends at B plus the latency tail needed to align B, then finalizes automatically. Manual range Stop also drains the compensation tail before finalization, while transport pauses immediately. Backing/playhead continue past B. Starting inside A/B punches from that point; starting at/after B refuses. Manual Stop before A creates no take; inside A/B retains only that prefix. No valid range retains free-recording behavior.

Loop on starts at rounded A and schedules backing cycles from the same frame clock as continuous capture. Armed-track audio excluded each turn. Only one count-in; metronome repeats the same grid inside each cycle. RangeCapture splits the compensated stream in the Worker, retaining up to3complete clips plus final incomplete clip.100MiB clip budget dynamically lowers the complete-pass limit for long loops; excessive range rejected. One hour total capture cap protects frame counters, independent of retained audio length. Last complete selected by default; first incomplete usable if no completed pass.

Original / retained takes selector materializes only the selected full-track WAV via immutable Blob slices in the stopped capture Worker. Original and all auditions share one existing history command. Unrelated later edits hide shortcuts until Undo/Redo returns to that command. Save stores only the displayed track and closes the alternative clips; alternatives are not a persistent take collection. New capture, project/account clear or command eviction also releases the Worker. Resources still referenced by history stay within its30-command/two-audio-operation bound. No regions, comping, additive overdub or automatic splice fades.

## Software validation

Complete suite:617JS tests passed;157Rails tests/1395assertions passed, no failures/skips. Ten range-specific JS tests exercise frame-boundary splitting across arbitrary chunks, compensation/pre-roll, oldest-pass eviction, final partial pass, exact outside samples, producer stop inside a quantum, backing continuation/wrapping, one-command Original/alternative replay and disposal, asynchronous decoder seek retention, repeated metronome grid/count-in. Rails tests validate selected punch/cycle interval, frame/WAV consistency, invalid completeness and saved original restoration. Other DI, playback, history, quotas, ACL and failure regressions retained.

Native browser fixture: tests/phase7/fixtures/recording-capture.html served with COOP/COEP. Run A/B punch and Run loop takes; no microphone/account writes/audible output. Real capture WAM, SharedArrayBuffer ringbuffer, Worker, ProjectPlayer, StudioRecording and history. Base signal0.125, punch signal0.25, loop signals change by0.0625 each pass,10ms compensation.

Punch: transport starts0.2s, A0.5s/B1.0s; exact24000frames kept at48kHz; prefix/suffix error0; playback observed beyond1.0s. Loop: multiple0.5s passes; latest complete selected, three completed clips plus final partial retained; Original exact, earlier complete and final incomplete selectable; auditions leave two total audio commands including the original baseline capture. Signal inside and outside error0. Raw records docs/validation/range-recording-2026-11-03. Native frame counts may vary with Stop timing, but selection boundaries do not.

A discovered race clamped audition seeks to0while the new file decoded; ProjectPlayer now preserves the requested position during loading, with finite-value checks. No new resampling or second latency shift occurs.

## Deployment and remaining checks

Dist and Rails public/rack synchronized. Reload http://localhost:3001/rack/. Set A/B, select Loop mode, arm a personal track, Record. Choose a loop take and Play to compare before Save. On real hardware verify latency measurement, monitoring off/on, long-run stability, late scheduling under CPU load and audible splices; this report does not certify ADC/DAC alignment or listening quality.
