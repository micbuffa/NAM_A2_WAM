# Loop take recovery and reopening — 3 November 2026

Branch: codex/studio-integration. Follow-up to A/B recording, using its existing bounded clips and one-command history. No schema change, new recording mode or additional permanent audio versions.

## Problems corrected

1. LoopReview previously performed Undo before allocating a replacement WAV. Allocation/replay failures could leave Original displayed, mutate the redo target or report success incorrectly. Preparation now precedes mutation; both candidate WAVs remain rooted until replay succeeds. Failure restores the previous descriptor/selection and replays it where possible. An Undo failure releases the newly prepared object URL. Context guards reject late Worker replies and preserve a newer project's saving lock.
2. StudioRecording.save closed the retained Worker immediately after audio upload. If the subsequent project metadata update or reusable-preset export failed, the alternatives were lost despite Save reporting failure. Closing now belongs to successful completion of ProjectsWorkspace.save and checks project/epoch/review identity. Already uploaded audio is reused on retry. Retained takes remain available after intermediate failure, including choosing another pass and saving it against the restored baseline.

## Automated checks

Seven frontend regressions call the real StudioRecording, LoopReview, RecordingHistory, StudioHistory and ProjectsWorkspace.save methods with controlled Worker/API failures: Worker error, WAV allocation error, failed Undo, failed redo rollback, stale project reply, failed metadata save after upload, failed upload, failed reusable-preset export, successful retry without duplicate upload, and selecting a different pass after partial save. No microphone or account writes.

Rails integration publishes a selected incomplete cycle with a concrete Float32 WAV, saves project metadata, fetches the project again, then restores the original and selected version. Assertions compare exact WAV bytes in the preserved prefix/suffix and overwritten interval, selected take metadata, snapshot, volume37/pan−12 and recording version IDs. This tests server persistence and inverse operations, not physical recording or a perceptual listening assessment.

Complete checks: **624 JavaScript tests pass;158 Rails tests /1415assertions pass**, no failures/errors/skips. Source distribution and Rails rack rebuilt/synced. Previous native capture evidence remains in validation/range-recording-2026-11-03; no new hardware or browser performance measurements claimed by this follow-up.

## Remaining work

Physical loopback/real guitar, several interfaces/rates, long-duration capture and CPU-load/browser/preset qualification remain open. Community calibration catalogue remains unimplemented. Reload does not restore the session's temporary alternate passes or Undo journal; the chosen audio, sound and mix are persisted. This follow-up does not add regions, comping or unlimited takes.
