# Recording replacement and take history — 3 November 2026

Branch: `codex/studio-integration`. Synthetic software validation; no physical microphone/interface recording or listening qualification claimed.

## Delivered workflow

Arm an empty or occupied personal guitar/bass track. Record asks for confirmation on an occupied track, before transport/capture changes. Successful capture overwrites only the compensated interval. Prefix and suffix samples stay byte-identical; duration is max(previous end, recorded end). Empty tracks retain the normal silence-padding placement. The old track voice is excluded from backing playback independently of monitoring. Refusing the dialog, cancelling count-in, or capture failure preserves the previous file and waveform.

One successful capture creates one audio history command. Undo/Redo restores exact immutable WAV and playback snapshot references, preserves mixer settings, and never reapplies latency compensation. Works for RAM takes and server-published takes in the open session, including two captures before saving only the latest. Server retry returns the same predecessor token after a lost upload response.

Session history: 30 commands, at most two audio operations across Undo and Redo. Evicted/abandoned RAM files and object URLs are released; no PCM copies are stored in the journal. Server history: at most two inactive recording revisions per project, each upload limited to100MiB, plus current files. Shared blobs count once in quota; pruning purges only unreferenced blobs. The current version and other tracks sharing its audio remain safe. No persistent Undo journal, reload recovery interface, global historical-archive retention policy or24h expiry delivered.

## Automated validation

- Complete JavaScript suite: **607 tests passed**, no failures/skips.
- Complete Rails suite: **155 tests,1378 assertions passed**, no failures/errors/skips.
- Nine dedicated JS replacement tests: exact RAM file restoration, late/failed inverse, predecessor tokens through unpublished takes, same-track token scoping, cancellation/stale/double confirmation, target voice excluded, aborted waveform recovery, two-operation resource release, empty-track history eviction warning.
- Five dedicated Rails tests: shorter replacement and exact blob/snapshot inverse, initial empty restoration, two-revision eviction, upload failure safety, idempotent lost-response retry, shared-blob quota/purge protection. Existing recording tests cover Float32 WAV metadata, compensation, quotas and permissions. Cross-account mutation denied, divergent state409, expired version409.

## Native browser capture

Run source server with COOP/COEP, then `tests/phase7/fixtures/recording-capture.html`. Click **Run replacement and Undo/Redo**. Real capture WAM, ring buffer, Worker, project player, waveform and StudioHistory; synthetic input, no account writes or audible output. Fixture injects confirmation answers, so the result validates confirmation branching rather than visual dialog interaction.

Result in `validation/recording-replacement-2026-11-03/native-result.json`: replacement/refusal/count-in/old-voice exclusion/Undo/Redo all pass. First file125408frames, replacement24288frames, replacement sample error0, two audio operations. Source saved audio unchanged.

Original lifecycle regression in `lifecycle-result.json`: silent arming, input meter, timestamp alignment, four count-in beats, incremental waveform, playback-only metering and ready transport pass.23peak packets, stable canvas, zero ordinary renders during capture, one final full repaint. Exact capture frame count may vary with UI scheduling.

## Deployment and remaining validation

Run `bin/rails db:migrate` for recording_revisions and recording_version_id. Applied in local nam-rails-main. Static dist and Rails public/rack rebuilt/synced. Reload http://localhost:3001/rack/ before testing. Owner project required for saving; monitoring remains an independent speaker toggle.

Still required: real interface/headphones recording, hardware disconnection, audible DI/preset parity and measured round-trip alignment. Reload resets the session history; this is not a take browser or regions/punch/loop recording system.

## Partial-overwrite update

Six additional JS tests cover exact compensated prefix/suffix, overwrite at zero, extension/gap silence, negative crop applied once, malformed/different-rate/nonfinite DI rejection, complete final envelope and comparison position/history guards. Two additional Rails tests cover partial interval/length validation, playback preset retention and persisted Undo/Redo. The legacy complete-replacement API contract remains accepted for earlier clients; Studio now emits edit.mode=overwrite and base/start/end frame metadata.

Native updated fixture at0.5s overwrites about0.5s of a2.6s DI: identical final duration, new-signal error0 and preserved-prefix/suffix error0. Uses real Worker/Worklet/ringbuffer plus comparison helpers. Evidence partial-overwrite-result.json. No physical input or audible comparison claimed.

Before/After use the same bounded session history, when a selected-track recording command is adjacent to the cursor. They pause playback; press Play to audition. A later unrelated edit may hide these shortcuts; ordinary Undo/Redo remains available. No new permanent takes browser. Partial overwrite requires the existing mono Float32 DI format at the current capture rate; no implicit conversion or junction crossfade. Whole-track playback preset remains common to both preserved and overwritten parts.
