## 2026-10-26 — Commit/push requested: Studio workflow and A/B anchors

User authorized committing and pushing the current branch `codex/studio-integration`. Snapshot includes saved-deck restoration/model/count fixes, compact contextual workflow, duration in the two-model chooser (whole song default), unified save buttons, accessible draggable A/B loop anchors, regression tests and specification updates. Final validation:421JS tests,115Rails tests/899assertions, no failures/skips; dist and Rails rack-sync rebuilt; native Chrome drag/keyboard checks passed. No merge or branch switch requested. Earlier notes stating no commit requested describe earlier turns. Git log/upstream identify the resulting snapshot.

## 2026-10-26 — Studio loop anchors A/B

User requested easier loop selection. Added independent draggable A/B handles in ProjectTimeline ruler, persistent across ruler redraws. Snaps nearest bar; Alt precise; preserves opposite end, clamps within timeline, minimum50ms, grab-offset prevents jumps. Live visual preview, commit through existing onLoop/setLoop at pointerup, cancel/capture loss restore, unrelated pointers ignored, clicking a handle never seeks. Keyboard slider semantics: arrows (bar or Alt0.1s),Home/End; enables loop. With no region, handles at timeline endpoints. Removed aria-hidden on entire ruler, kept decorative marks hidden. Ruler visible on mobile; staggered tabs keep short-loop handles reachable. New4tests cover numerical boundaries and real event routing with fake DOM. Validation:421JS tests pass,115Rails/899assertions pass. Real Chrome native drag B6→10 preserves A2; drag A2→0 preserves B10; Alt+Right moves A by0.1s. Short test loop restored to2–4s, screenshot in /tmp/studio-loop-anchors.jpg. Static dist and Rails rack-sync rebuilt. Rails markup test updated for dynamic duration chooser (no stale static field). Branch remains codex/studio-integration; no commit requested.

## 2026-10-26 — Duration alongside the two model choices

User requested excerpt length directly in the model chooser. Added Duration to separate (whole song default EACH opening, or first5/10/30/60s), captured before closing on model click. Removed the duplicate duration field from Options and the render-time dependency on that DOM field. Tests cover whole-song0, explicit30s, reset on reopen, close without starting and account-change guard. Remaining separation/export behavior unchanged. Validation:417JS tests pass; browser confirms Entire song selected by default and excerpt selection/cancel. Static distribution and Rails rack-sync rebuilt. No native separation launched during this dialog-only browser check.

## 2026-10-26 — Compact contextual Studio workflow

Follow-up user screenshot showed the permanent configuration panel remained too complex. Reduced it to a toolbar: during separation only Stop + progress (and original/instruments once playable), no disabled Separate/export clutter; after completion a save hint for RAM instruments, then Use mix in Tone when persisted/loaded. Separate again reopens two-model chooser. Source, excerpt duration (whole song default), saved history, export range and technical settings are collapsed under Options. This supersedes previous main-screen duration placement. Explicit scoped [hidden] CSS also covers custom tl-buttons. Ready export explanation hidden; error/retry guidance retained. No audio/ACL/persistence changes. New state test covers separating → RAM/save → ready export and failed load/read-only. Validation:417JS tests pass,114Rails/899assertions pass. Real Chrome short Demucs4 GPU separation on existing validation project showed Stop without Separate/export during calculation, then save hint/no premature export after completion. No saved stems overwritten. Static dist + rack-sync rebuilt. Previous restore/model/count fixes still part of uncommitted work; current branch unchanged.

## 2026-10-26 — Restore saved deck and simplify model choice

User steered work to restoration/UI fixes before WAM rendering. Working on `codex/studio-integration`; no commit/push requested for these edits. Restore model from active saved batch, including catalogue-init race. Project API/list/header count the active saved deck, never all archived stems/mixes; all historical audio retained. Picker summary updates discard stale embedded track lists. Import local / completed YouTube Open in Studio / Tone Separate instruments now prompt two minimal choices (4 fast / 6 guitar+piano); choosing starts separation, closing keeps imported original. Opening saved project never prompts or runs inference. Technical settings/cache collapsed; experimental WebNN remains opt-in, SW chooses GPU/WASM if previous preference was WebNN. Tone Save renamed Save Preset; Studio Save project uses same primary variant.

Browser checked fresh agent tab at localhost:3001/rack: saved test project restores6 (including Guitar70/pan−35) despite previous4 selection; Wonderwall picker now4 rather than10; two-button model dialog verified. Existing user tabs not reloaded. Static dist + Rails rack-sync rebuilt. Final checks:416JS pass,114Rails/899assertions pass,0failures/0skips; git diff --check clean. Tone Save Preset visible and both save buttons confirmed variant=primary. P5.4b WAM rendering still next product task, unstarted. WebNN qualification status unchanged.

## 2026-10-26 — Git snapshot requested; next product task P5.4b

User requested commit+push of the CURRENT branch, no merge or branch switch. Snapshot scope: all accumulated Studio integration and validation work below on `codex/studio-integration`, based on main f7ffec6. Remote origin is https://github.com/micbuffa/NAM_A2_WAM.git. No upstream existed before this first push. Model weights, corpus, local databases, build output and local runtimes remain ignored; pinned MIT WebNN runtime (~28MB WASM) is intentional vendored code, not model weights. Latest complete checks before snapshot:412JS tests pass,114Rails tests/893assertions last validated. Staged diff-check has one upstream trailing-space line in the byte-pinned LAME LICENSE; preserve its upstream bytes/hash. All other staged files pass diff-check. Main untouched by this operation. See Git log/branch upstream for resulting commit/push status; older “uncommitted” notes are historical snapshots.

**Next PRODUCT task proposed: P5.4b — qualify/render WAM inserts on personal recorded tracks for mix export to Tone.** Start with a minimal NAM+cabinet render versus a reference, then effects/tails and explicit unsupported-plugin behavior, tests before enabling treated exports. Current dry-export refusal for preset-bearing tracks must stay until qualified. No WAM implementation started in this turn. WebNN native experiment ran but did not pass strict bass parity, remains experimental; numerical diagnosis/repetitions/direct production reference still a separate open research task, not a prerequisite to advancing WAM rendering. No thresholds relaxed.

## 2026-10-26 — Native Canary user report received [WebNN executes; admission rejected]

User finished manual qualification and supplied `/Users/michelbuffa/Downloads/studio-webnn-2026-10-26T15-22-35.648Z.json`. **Native evidence now exists; older “no native execution” sections are historical.** Chrome/Canary158 report started15:20:40.390Z. Five configurations,6s, one fresh Worker/session each, visible/no visibility transitions. Same music/model SHA and exactly same PCM hash as earlier Chrome155 control. User launched the run; automation connector still only exposes Chrome155. Do not ask user to reconnect/restart again merely to interpret this data.

Raw BYTE-IDENTICAL archived `docs/evaluations/studio-webnn-canary-2026-10-26.json`,12843bytes,SHA2568593224f323094e182414c0cd043256188e9ebd4871335741c70a6eaa2bfb53b. Separate assessment JSON has source SHA, post-execution code capture and caveats. Ten of11 earlier code hashes match; HTML only gained visible UA. Post-receipt instrumentation fix described below is NOT part of user run. MODEL_EVALUATIONS.MD§24.7 detailed findings, spec§12.17/currenttaskstatus and validation journal updated.

Observed: productionWASMwall11.3842s/session.7053s/DSP10.6254s/firstPCM11.3675s. ProductionWebGPUwall4.3019s/session.6655s/DSP3.5539s/firstPCM4.285s,Applemetal-3,1630profiledkernels. WebNNCPUwall24.1003s/session7.2152s/candidate5.4322s/reference10.9158s; GPUwall33.1428s/session12.5124s/candidate9.2654s/reference10.6617s; NPUwall25.5803s/session12.4223s/candidate1.9575s/reference10.7116s. All three native preferences: dispatch1, validatedBlocks0,publishedFrames0,strictParityfalse,statuserror due ONLY bass gate. All global and other roles pass. BassrelativeCPU.0010062288719/GPU&NPU.0010160326475 vs threshold.001. No tolerance changes. WebGPUcontrol also fails bassstrict.0010157744583 (same metrics as Chrome155); historicGPUadmission criteria not retroactively replaced. GPU/NPUparity stats identical, NOT proof of identical PCM or physicalNPU. RejectedcandidatePCM not exported => direct WebNN-vs-production1.22 parity not available (WebNN compares WASM1.30). Rawerrorsare proper numericalrefusals, not failed API/context creation. No successfulnativeaudio result published; Studio would use its prepublicationfallback but this report's diagnostic deliberately does not fallback.

One trial/order fixed, physicalhardwareunknown, caches/thermal/otherapps uncontrolled. Native “NPU”1.9575s is not proof of NeuralEngine speed. Totals include validationWASM, not firstplay latency. TimerUImax180.3ms/sample990 for dedicatedbench, not hostscroll/playback qualification. No native cancellation or listening in this report. P5.6 remains CURRENT: native trial obtained but admission refused; investigate numeric gap/repeat/crossruntime proof before production eligibility. DefaultWebGPU/WASM unchanged; SW6WebNNstill barred. WAMrendering remains separate.

Found validationMs=0 on parity rejection (throw skipped measurement assignment). Fixed with finally AFTER archiving raw; do not alter old numbers or claim zero-cost validation. Host rebuilt/synced. Added two meaningful regression tests using received report and SHA to ensure observednative dispatch never counts as admitted when bassfails. **412JS tests all pass,0skip/failure**. No Railscodechange/no Rails rerun (prior114tests893assertions unchanged). Branchcodex/studio-integration, all changes uncommitted, no commit/push requested. Loopback diagnostic server8779 remains running session46690; userCanaryreport may still be displayed, don't reload their tab. ProductuserRAMtabs likewise untouched.

## 2026-10-26 — Canary connection follow-up [still pending]

User replied “c’est fait” to opening Canary/connecting the extension. Rechecked inventory: still only one extension provider, Chrome profile michel, instance19fb1403-b746-49ef-aeeb-fd5c25247ce6. New diagnostic tab956010717 explicitly reports Chrome155 in UA; no native trial launched from that browser. Explicit createBrowserTab("Google Chrome Canary",...) says browser unavailable. One documented CUA reset/re-discovery still returned Chrome1/IAB3/MCPApps2, no additional Canary provider. Browser-use troubleshooting documentation read; no shell/CDP workaround. Do not claim user’s connection is working or that native measurements ran. Harness now prints UA visibly before Run (presentation change only; previous source hashes describe the prior run). Existing raw measurements unchanged. Server8779 remains running. Current CUA binding after reset is reconnectedBrowser (IAB3); obtain Chrome1 or the newly advertised Canary by current inventory when resuming. No old user tab reloaded, no new model benchmark run in this follow-up.

## 2026-10-26 — P5.6 qualification continued [CURRENT — Canary connection required]

User approved resuming WebNN qualification, then WAM rendering only afterwards. Still `codex/studio-integration`, uncommitted, no Git publication requested. Canary not in connector; `cua.getApp('/Applications/Google Chrome Canary.app')` timed out after20s and reset CUA. Async question sent asking user to open Canary/connect Codex extension; no answer yet. **Do not claim native qualification complete.** No alternate CDP/headless/browser-policy workaround used.

Completed useful work: WebNNAdmission.js now requires a dispatch increment for EACH block (cumulative proof previously insufficient), strict global/per-role audio parity unchanged. contextGuard observes MLContext.lost promptly; explicit tests. Worker timings distinguish context/session/reference session/candidate DSP+inference/reference DSP/parity/first validated PCM; diagnostic parity failures retained. Studio reports validation phase. Added runtime asset allowlist entry; product rebuilt via nam-rails-main/bin/rack-sync. No Rails code changed this turn.

Banc expanded at `tests/phase7/fixtures/studio-webnn-validation.html`: fixed verified Slow Motion Dream6s/1s; complete five-engine matrix or single engine plus WASMreference,1/3fresh Worker/session trials; no automatic fallback; production1.22reference compared off UI; session/first actual PCM receipt/total/candidate/reference timing; visibility and UI100ms heartbeat; Stop/180sdeadline/exportJSON. Server narrow loopback allowlist, no DB paths or symlink escape. Native WebNN still Demucs4 only; SW6 remains gated.

Actual Chrome155 control (not Canary): initial smoke overlapped a static rebuild so its timing is EXCLUDED; retained JSON. Second six-second run had no build/tests concurrent, visible tab, no visibility transition. WASMwall36.2396s / firstPCM36.1393s / session4.6161s / DSP+inference31.4332s. WebGPUwall7.7806s / firstPCM7.6862s / session3.2366s / DSP+inference4.3415s. One trial each, other apps/cache/thermal uncontrolled: exploratory, not a general ranking. GPUglobalrelative0.0006516433 / maxAbs0.0007771626; bassrelative0.0010157745 exceeds fixed1e-3 gate. Retain failure; no tolerance relaxation or audible-equivalence claim. WASMfirst row compares to itself and only defines reference. WebNNcpu/gpu/npu all error 'WebNN unavailable in this browser Worker', not native runs and not fallback successes. UI100ms timer maxgap2201.1ms over entire launch including174MBcopies/hash: no phase attribution or claim Studio GUI is fluid. Separate manual Stop during wasm:inference accepted; no measured cancel latency and no native cancel validation.

**410 Node tests pass,0skip/failure** after measurements; dist/public built and diff-check clean. Rails not rerun (no Rails change; prior114/893 still last result). Machine read via sysctl: AppleM3Max,36GiB,14physical/logical; macOS14.4.1/23E224. UA genericIntelMac is not CPU identification. Scientific doc MODEL_EVALUATIONS.MD restored unchanged historical§1–23 from multitracks with explicit provenance, then new§24. Raw initial/clean/cancel JSON and pre-clean-run11file source hashes in docs/evaluations/. Spec§12.16 and validation journal updated. No local weights shipped.

CUA reset reassigned IDs: Chrome extension is NOW browser1; IAB3; MCPApps2. `qualificationBrowser` bound Chrome1; `qualificationTab` id956010708, localhost8779diagnostic, latest state stopped after cancellation test. Existing user tabs/unsaved previews untouched. Screenshot of completed matrix `/tmp/studio-webnn-qualification.png`. Server `node tools/serve-studio-webnn-validation.mjs` RUNNING session46690, loopback8779; keep available while awaiting Canary connection. Stop later with exec write_stdin if no longer needed. Last requested async connection may arrive as steering. Native getApp timeout is not an auto-review rejection. Remaining P5.6: native matrix/repetitions, production parity, actual progressive playback/native stop, phase-specific GUI measurements. WAMrenderingP5.4b remains separate; no implementation started.

## 2026-10-26 — Tone→Studio + Rails YouTube [DONE]; WebNN integration [CURRENT qualification]

Branch remains **codex/studio-integration**. All previous P5.1–P5.4 and current changes remain uncommitted; no commit/push requested. User explicitly authorized the three announced tasks without further permission: Tone backing→Studio, Rails YouTube, advanced experimental WebNN. WAM insert rendering P5.4b was explicitly excluded from this batch; it remains TODO. Older “next P5.4b then P5.5/P5.6” lines below are historical.

- **Tone→Studio DONE:** expanded Play along **Separate instruments** imports selected file/bundled backing/authorized studio mix as new private original. Account API `POST /api/projects/from_backing`; BackingProjectImport resolves IDs server-side, never fetches arbitrary URLs, reuses saved mix blobs. Local File retained by BackingTrackEngine for one upload. Navigation protects RAM/dirty edits and rejects late cross-account responses. Import does not auto-start separation.
- **YouTube Rails DONE:** Studio Import audio offers file / YouTube. AudioImportWatcher polls ONLY active jobs, stops on terminal/close/account change and reconnects on dialog reopen. Explicit Open in Studio avoids replacing ongoing work. Private `/api/audio_imports` CRUD/capabilities, ActiveJob YoutubeImportJob, YoutubeDownloader subprocess/process-group controls. Canonical HTTPS single-video URL, no live, ≤30min/100MiB, one active/account and three globally on current SQLite. Temp cleanup on normal exits; deadlines/disk/output bounds; cancel rechecked before publication; quota and atomic project/original publication. Global stale active tasks expire after20min. Original stores/displays URL/videoId/title/duration/import time. Dockerfile pins yt-dlp[default]2026.10.21, Node24, FFmpeg/Pythonvenv, SolidQueue in Puma. Existing dev container installed dependencies; prod image changes not built/deployed here. Dev async does not survive server restart; production queue persists, interrupted running downloads require retry. No cookies, browser credentials, proxy or CAPTCHA bypass.
- **WebNN integrated; native qualification CURRENT:** advanced CPU/GPU/NPU preferences, Demucs4 only. Isolated ORT1.30/MIT worker/assets SHA-pinned; ORT1.22 production unchanged. Every block compared with ORT1.30 WASM (global+each role, RMSrelative≤1e-3/maxAbs≤.005, low-role floor1e-5), finite/aligned, actual WebNN dispatch count>0. Evidence checked before publication and persisted; client declaration is not server attestation. Added reference inference is intentionally slower, and does NOT establish parity against ORT1.22 or physical NPU execution. SW6 explicitly barred. Initial failure safely falls back to production WASM; after publication stop rather than splice. Default remains WebGPU/WASM. Real Chrome NPU selection fell back to WASM and produced playable4stems5s. **No native WebNN CPU/GPU/NPU success or performance claim.** Canary absent from browser connector inventory, native getApp timed out after120s. Do not mark P5.6 fully DONE. Resume native tests with `node tools/serve-studio-webnn-validation.mjs` (127.0.0.1:8779, allowlisted assets+local pinned weights only) and `tests/phase7/fixtures/studio-webnn-validation.html`. Temporary server has been stopped. Need supported Canary control, production-reference parity and preparation/first-audio/throughput measurements.

Migration20261026180000 additive Track.import_metadata + AudioImport table, applied in container, existing tracks preserved. Rails container restarted after migration. No journal mode change or host-side live SQLite access. **406 Node tests PASS;114 Rails tests/893 assertions PASS**, zero skips/failures; `git diff --check` clean. New tests cover Tone blob/private/local/quota/error/stale-account flow, YouTube strict URL/CSRF/owner isolation/reconnect/cancel/failure/quota/temp cleanup/subprocess stderr+closed-pipe timeout/disk limits/live/overlong/missing audio, WebNN strict quiet-role detection/evidence/fallback boundaries/runtime hashes/manifest admission. Product rebuilt and synced with bin/rack-sync.

Real Chrome/Rails validations:
1. Tone mixstudio-17 (testproject4)→new testproject10/original27; same existing blob, no reupload; playback and separation controls ready.
2. YouTube9rPbKNMjuzI (user’s public demo),136s metadata,3268845byte MP3, decoded136.176s; AudioImport1 ready→testproject9/original26. Reopened dialog after reload, result opened. Five-second4stem WebGPU separation played and saved; all4 persisted and reloaded. Original provenance displayed. Video is speech/demo, not a model-quality sample; no perceptual score inferred.
3. AudioImport2 cancelled during metadata/download; no second project published.
4. Demucs4 WebNN-NPU choice in regular Chrome safely fell back to WASM,4playable stems5s; this was an agent-only unsaved test preview on project10 and was intentionally discarded afterwards. Native hardware qualification not performed.

Latest browser deliverable tab956010678 at http://localhost:3001/rack/, project9 Original/project, paused, saved4stem batch available in Instruments. Screenshot `/tmp/studio-import-audio.png`. User's unsaved preview tab956010637 and saved project7 tab956010674 were not reloaded/touched. Keep avoiding destructive navigation in those tabs. No outgoing mail or external publication. README, web/README deployment instructions, spec§12.14/12.15 and validation journal updated. Future tasks remain P5.4b WAM rendering, native P5.6 qualification, permission designP5.7 and recordingP5.8.

# NAM A2 WAM — Next-session handoff


## 2026-10-26 — Fix disabled Use mix in Tone after Save [DONE]

User saved project7 (Oasis, a new project distinct from earlier id5) but export stayed disabled. Actual Chrome tab956010674 showed Saved instruments4, Bass not loaded, Play/export disabled. Rails logs: publish200, GET track21/Bass500 due SQLite3::IOException on PRAGMA journal_mode=wal. Other3 audio files200. This was an audio reload failure after successful publication, not missing stems. Restarted ONLY nam-rails-main to reset connections; Rails runner inside container reported PRAGMA quick_check=ok and all4 stems present (1764044 bytes each). No database/file changes, no separation recomputed.

ProjectPlayer now records per-channel loading/error, retries transient network/5xx/408/429 at most3 attempts (250/500ms delays), emits state changes on failure, and exposes retryFailed. Explicit Retry audio loading reloads only failed files, preserving ready buffers/mix and ignoring retries from old project generations. No polling, no automatic retry of404 or decode corruption. StudioPlayer forwards retry. Inline studioExportHelp explains unsaved preview, in-progress separation/save, loaded N/M, named errors, unsupported presets/monitoring, Tone startup and Ready. Export remains safely disabled until every audio file and Tone are ready. Main explicitly rerenders export once onUseMix is connected, avoiding a separate startup race.

Validation: **397 Node tests;100 Rails tests/778 assertions**, all pass; dist/public rebuilt. New tests: bounded500 recovery, persistent failure+manual retry only Bass, invalidated old-project retry and inline availability states. Chrome reloaded ONLY the fully saved project7 tab674; all4 tracks load, Play and Use mix in Tone enabled, inline Ready instructions visible. No mix generated from user's project: left ready for user to click Use mix in Tone, then Play in Tone. Current saved separation is5s; Entire song export means the entire saved5s deck. User tab637 still contains their unrelated full-song preview in RAM; DO NOT reload it. Screenshot /tmp/studio-use-mix-ready.png.

Operational precaution: while Rails is running, inspect/backup SQLite only INSIDE the Docker container, not with host Python/sqlite against the live bind-mounted DB/WAL/SHM. Cross-OS access to SQLite WAL sidecars is a potential cause of the observed I/O issue; exact initiating cause not proven. Never delete WAL/SHM manually or overwrite live DB from backups. No journal mode change made. Next feature remains P5.4b WAM rendering qualification; integration branch unchanged/uncommitted.

## 2026-10-26 — P5.4 accompaniment mix to Tone [DONE; WAM qualification separate]

Still `codex/studio-integration`, all P5.1–P5.4 uncommitted, no commit/push requested. Product export now works for saved stems and recorded tracks WITHOUT presets. **Next: P5.4b qualify WAM insert rendering**, then P5.5 YouTube Rails and P5.6 advanced WebNN. Never export a DI dry while claiming the preset was rendered: both client and server reject preset-bearing sources. Monitoring must be off. No recording added.

Use mix in Tone + range selector in Studio separation panel (whole song default, explicit A/B). Requires saved instruments; ordinary dirty mix saved first. StudioMixExporter builds isolated native OfflineAudioContext graph at44.1k with exact Studio gain/pan/mute/solo, native48k resampling; no live/input/rack/listening controls attached. Snapshot source checksum/settings. LAME MP3stereo192k in classic Worker,1s packet copies, peak analysis and shared attenuation only if above−1dBFS. Silence never boosted. Working PCM ceiling512MiB is not a universal memory admission. Upload failure retains MP3/token in page and retry unchanged mix avoids rendering/duplicate file; changed snapshot rerenders.

Rails additive migration20261026160000 (two Track columns+unique index, no FK rebuild), applied with pre-migration backup `web/tmp/before-studio-p5.4.sqlite3`, all existing data retained, FK check clean. Track.origin=mix, mix_manifest and render_token. Generated files immutable via generic Track API, excluded from every Studio deck to avoid doubling. Mix manifest records source IDs/checksums/mix, separationId, full/loop range, frame count, format/bitrate, peak/attenuation. API POST /api/projects/:id/mixes owner-only, exact MPEG1LayerIII192k44.1kstereo frame contract, quotas100MiB/file+2GiB/project+5GiB/owner, storage-before-attach, atomic/idempotent publication. GET /api/backing_tracks metadata of visible projects only; existing private audio/ranges; shared users listen only; strangers404. Mixes cascade with project.

StudioBackingLibrary merges bundled+private metadata; account epoch prevents stale catalogue replies. Sign-out clears private entries and their active audio. PlayAlongMemory accepts studio-N IDs (preferences sanitizer extended). Tone load pauses both players before loading, no autoplay, library expanded; Open in Studio respects project navigation cancellation; Download MP3. Source IDs17/18 in local test project4 are agent-created backing exports5s/full and4s/A-B, preserved. Labels include duration/time to distinguish versions; newer loop exports named Loop. Do not modify user projects5/6.

Validation: **393 Node tests;100 Rails tests/776 assertions**, all pass. Native Chrome test15 pan/mute/solo cases max error2.2446375813611752e-8; native48→44.1k sinus resampling max8.281430078460605e-5; real Worker MP3decoded stereo1.044897959s for1s input (encoder padding), RMSratio≈2. Rails/Chrome exported real6stem5s mix, playback, reload persisted selection without autoplay, Open in Studio, A/B4s export and actual Download MP3 (97175bytes,ffprobe4.048958s). No subjective/model-quality score added. Tests include exact graph/snapshot/ranges, real pinned encoder, packet copies/retry/metadata and private rights/quota/storage failure. Native harness `tests/phase7/fixtures/studio-mix-validation.html`, served during validation on127.0.0.1:8779. Synthetic Rails MP3fixture documented beside file.

Browser: user tab956010637 has their UNSAVED full-song Demucs preview on project5. **Do not reload/discard it.** Created dedicated validation tab956010663 (localhost3001) for test project4; left on Tone with persistent backing paused. Native diagnostic tab956010660 is disposable. Product rebuilt via `docker exec nam-rails-main bin/rack-sync`. Screenshot `/tmp/studio-p5.4-tone.png`. README/spec§12.12/validation journal current. Container `nam-rails-main`, port3001; never stop unrelated containers. No local weights/corpus in commits.

## 2026-10-26 — P5.3 persistent Studio separations [DONE]

Current branch `codex/studio-integration`; P5.1–P5.3 remain uncommitted (no commit/push requested). **Next: P5.4, persistent mix export to Tone.** The older P5.2 RAM-only statements below are historical and superseded.

Removed the requested model-license link from GUI only; all model notices/licenses retained. Save project now uploads completed/explicitly stopped preview instruments to private Rails storage. Lossless stereo Float32 WAV 44.1 kHz, Worker interlacing one chunk at a time. Separation/SeparationPart staging, source checksum/creator/model hashes/backend/excerpt/partial provenance, per-stem SHA256/peaks/mix. Idempotent token and role uploads; publish all Tracks in one transaction; retry skips existing audio and updates only mix/peaks. Ready history never overwritten. Original/stem audio immutable through generic track editing. Save errors retain RAM/token for retry; after reload a fully uploaded stage can Finish saving, incomplete stage can be discarded. Two unfinished stages maximum. Limits separation uploads:512MiB/stem,2GiB/project,5GiB/account; original imports100MiB each. Account lock serializes staging/upload/publication. Published history and audio private, existing shared listeners read only, unrelated users404. No new collaboration roles or recordings.

Saved separations selects batch; reopen restores active batch and saved volume/pan/mute/solo without model inference. Only selected deck loaded, all stems decoded before Play. Persisted envelope avoids full PCM rescans in UI. Original+personal deck and stems remain exclusive; combined personal/stems mix is not added here. Save freezes source/model/navigation/mix edits until publication; playback remains possible.

Migrations `20261026140000` and `20261026141000` applied. IMPORTANT: first draft of SQLite FK migration rebuilt projects inside an outer transaction, cascading deletion of five existing Track rows. Detected during browser validation; stopped Rails and restored ONLY the missing Track rows from pre-migration backup, preserving all projects/audio/attachments/settings. Foreign-key check clean, five rows restored. Migration now `disable_ddl_transaction!` so SQLite can disable FK checking during table rebuild. New migration preservation test (outside test fixture transaction) plus actual Rails migrator rehearsal on a copy of pre-migration DB passed with all five tracks/DI metadata. Backups ignored: `web/tmp/before-studio-p5.3.sqlite3`, `before-p5.3-track-recovery.sqlite3`, rehearsal `p5.3-migration-rehearsal.sqlite3`. Never overwrite live DB with these snapshots. No user audio deleted.

Final validation: **386 Node tests;96 Rails tests/715 assertions**, all pass. Chrome local project4: saved Demucs4 5s and SW6 5s, original preserved, reload and playback verified; saved Bass volume57, SW Guitar pan−35. History selection and mixer persistence checked in browser. This is functional/audio-file validation, no new perceptual study. Details `docs/STUDIO_SEPARATION_VALIDATION.md`. Local Rails remains http://localhost:3001/rack/ in `nam-rails-main`; rebuild `docker exec nam-rails-main bin/rack-sync`. Restart after schema migration, not routine edits. Do not stop other containers. Local weights/research corpus ignored, never stage them.

## 2026-10-26 — P5.2 separation integrated into Studio [DONE]

Still on `codex/studio-integration`, uncommitted together with P5.1 (no commit/push requested). **Next: P5.3**, atomic Rails persistence of original/stems and separation provenance. Do not merge the prototype's host UI or backend wholesale. P5.4 mix-to-Tone, P5.5 YouTube Rails, P5.6 advanced WebNN and later collaboration/recording remain TODO.

Studio now has source/model/excerpt selectors, Separate/Stop, progress, actual backend, Original/project vs Instruments and collapsed engine/cache/license settings. Only Demucs 4 ONNX and BS Roformer SW 6; whole song default. Validated GPU device preferred, WASM fallback before publication. Stems are ephemeral negative IDs in an alternate view, NOT added to `project.tracks` or the Rails API. Account Save does not persist stems or their mix; header explicitly says Instruments in RAM. Personal parts/racks stay in the original project; preview plays stems only. One AudioContext/output; decks never sum. Do not claim recordings or full-project contribution mix support yet.

Runtime imported selectively from multitracks checkpoint467f07f: stream transport/ringbuf, producer peaks, overlap, ONNX4 and cooperative SW6 with 18 stages. Stage plan moved from research/ to runtime `roformer-stage-plan.json` (hash-bound to SW weights). Onnx quality worker has optional keepAlive session reuse (identity checked in runner); SW prepared session reused on subsequent separation. Explicit Stop/model/backend/project change terminates workers; epochs reject late decode/cache/messages. PCM validation stays in Workers, producer peaks repaint at most4Hz; transport RAF uses audio time/fixed duration, Pause remains available while buffering. Stop retains any already produced partial audio. Replacing preview or leaving it through project/import/new-project navigation requires an explicit UI choice.

`StudioRuntimeAssets.js` is the product build allowlist. No benchmark pages, local corpus or weights in default dist. Weights fetched on demand with pinned size/SHA256 and model IndexedDB cache. SW now downloads from pinned Hugging Face URL; observed redirect `us.aws.cdn.hf.co` explicitly allowed (first real attempt exposed its absence). No blanket redirect permission. Metadata/notices preserved. Local .onnx files must never be committed. Generic standalone research prototype remains on multitracks; optional include-research profile is not a replacement for that branch's newer host.

Final validation: **378 Node tests**, **88 Rails tests /572 assertions**, all passed. New tests cover orchestration, 4/6stereo contracts, worker cancellation, stale messages, partial stop, buffering/Pause, source exclusivity, gain/pan/solo, original DI live-routing notifications, cache/source identities, real twelve-channel Worker ring/transfer backpressure, independent SW DSP reconstruction, cooperative lifecycle and product assets/markup. CUA Chrome tested both models on WebGPU and CPU/WASM with CC-BY slow-motion-dream.mp3 first5s; whole song on GPU4/GPU6; progressive ready before last Demucs segment; solo Guitar, A/B, fader Bass, original/result switching; CPU SW stopped after first audio and partial playback confirmed. Project-switch warning/Cancel preserves current preview. No new instrumented performance benchmark or perceptual rating. Protocol and source/code hashes: `docs/STUDIO_SEPARATION_VALIDATION.md`.

Browser left on `http://localhost:3001/rack/`, Chrome tab956010613, project **Studio P5.2 — real audio validation** (id4): original persisted via actual UI upload, completed whole-song six-stem WebGPU preview IN RAM. Reload loses only that preview. The user's existing project id3 was not changed. Test P5.1 project id2 also retained. Models cached on localhost3001. No model currently running. Source/dist served by `nam-rails-main`, final assets rebuilt with `docker exec nam-rails-main bin/rack-sync`. Normal dev source edits take effect on reload; no need to restart Rails unless schema changes. Preserve unrelated containers. Spec §12 is current.



## 2026-10-26 — P5.1 Studio integration complete

Work is on `codex/studio-integration`, created from updated `origin/main` `f7ffec6b`; do not replace the contributor's Tone/Studio/account UI with the prototype. Research is preserved on pushed branch `multitracks` (`467f07f`). P5 integration decisions and task sequence are in §12 of SPECIFICATION_SOURCE_SEPARATION_MULTITRACK.md. **Next: P5.2**, bring Demucs 4 ONNX and BS Roformer SW 6 into the existing Studio, module by module; GPU preferred, visible WASM fallback, WebNN advanced/experimental. Separation is NOT integrated into Studio yet.

Delivered: immutable Track.origin (`personal`, `original`, `stem`, `mix`, `legacy`); old rows migrate to legacy with presets/audio retained. API, tone racks, live-track selection, timeline and inspector allow presets/monitoring only for personal/legacy guitar/bass. Generic creation permits personal/original only; generated stem/mix metadata and contribution authors remain P5.3/P5.7. Upload/add dialogs expose Track type, full-song import defaults to accompaniment. No recording or collaboration-role expansion yet.

Distribution defaults to product: source-separation/ contains only CompactWaveform.js and WaveSurfer dependencies/licenses; research pages/runtime and local weights excluded. Optional `--include-research` retains the historical prototype of the checked-out branch. `web/bin/rack-sync` rebuilt dist/public assets. Local model weights/corpus/runtime caches are ignored and must not be committed.

Validation: 348 Node tests; 87 Rails tests, 544 assertions, all passed. New coverage: migration preserves DI preset IDs, original/stem presets rejected including Guitar/Bass, origin cannot be changed, monitoring disabled, tone rack/live-input eligibility, product dist excludes laboratory. Chrome verified account, Tone, project creation, personal inspector with presets and guitar accompaniment without presets. Test project **Studio P5.1 — validation** contains two empty tracks; the user's preexisting project was not modified.

Local Rails container `nam-rails-main`, http://localhost:3001/rack/, shared checkout `/workspaces/WAM_NAM2_PROTO/web`, port3001 only. Dev DB backed up to ignored `web/tmp/before-studio-p5.1.sqlite3` before migration. `db:migrate` completed; container restarted to refresh Rails schema cache. Tests: `docker exec -e RAILS_ENV=test nam-rails-main bin/rails test`; assets: `docker exec nam-rails-main bin/rack-sync`. Dev email is letter_opener (local files, not real email); user has signed in. Do not stop unrelated container on port3000. System Node is broken; use bundled runtime in ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin, or Node in container.


## 2026-10-20 — Source separation checkpoint; development moving to multitracks

Prototype: `examples/wam/source-separation/`, URL `http://127.0.0.1:8765/examples/wam/source-separation/`; static build `dist/NAM_A2_WAM/source-separation/`. Specification: `SPECIFICATION_SOURCE_SEPARATION_MULTITRACK.md`. P1–P3, P4.1 (shared host mixer) and P4.2 (A/B loops) are delivered. 306 tests pass; source and dist verified in Chrome with real music; dist rebuilt with `npm run dist -- --no-regenerate --no-build`.

WebGPU-capable machines prefer the validated ONNX four-stem model; guitar is in Other. Explicit CPU choices remain valid, with CPU fallback before the first published block. No automatic weight download. 6s and FT remain CPU/WASM: six-stem GPU diagnostic produces audio but fails numeric agreement on real music (7.317% RMS). See `examples/wam/source-separation/SIX_STEMS_GPU.md`; do not enable this experimental graph in the catalogue.

A/B regions are editable via handles, keyboard, numeric inputs and position buttons; shared across stems and mix view, zoom independent. Progressive playback waits for unpublished B. Available selected windows loop natively; one window per track is cached. If B arrives during playback, the first return retains the existing 30 ms scheduling latency. Original/instrument switching copies compatible regions in seconds; an original region outside a shorter excerpt remains on the original deck.

User requests this checkpoint on main then further development on branch `multitracks` to protect the main UI. Next: shade areas outside A/B, then P4.3 reversible common-gain audio normalization. P4.4 (actual Tracks host integration and state restore) remains pending: the prototype currently reuses the host mixer but is not the main host's multitrack player. Preserve one AudioContext, one destination, one shared clock; never sum original and separated output. Unit tests for each feature, full suite before user testing. Keep HANDOFF current.

Unrelated pre-existing local changes excluded from this checkpoint: `examples/other_wam_host/`, `src/nam-wam/models-manifest.json`, `src/nam-wam/models/tone3000/madhatteramplab/`. Do not remove or accidentally stage them.


## 2026-10-09 — Guitar-reference calibration

Calibrate level now measures the bundled 8–20 s Funky-Guitar excerpt in an isolated Worker/WASM instance, without interrupting or injecting audio into the live graph. Fixed −18 dB reference trim plus NAM input gain; −24 dBFS RMS target, −1 dBFS reference peak ceiling, ±36 dB measured correction (metadata still ±12 dB). Results replace metadata correction, retain per-capture/variant WAM state and cancel on supersession/model changes. Inline progress/errors/limits. Real WASM validation: Bogner m689735 −4.19 dB and Deluxe Room m383454 +27.00 dB both reach −24 dBFS on the excerpt without peak limiting. 149 Node tests passed; static distribution rebuilt. Resumed validation: browser Worker completed on Deluxe Room (+27.0 dB) and rebuilt distribution Bogner m689735 (−4.2 dB); metadata reset clears measured status. Corrected details target display to use the measured target. Final 149 tests passed and distribution rebuilt.

## 2026-10-09 — Button contrast and guitar-sample level comparison

Back to rack now explicitly retains light background/dark text on hover and keyboard focus. Distribution rebuilt. Real WASM render of the full bundled Funky-Guitar.mp3 at −18 dB trim confirms a 19.98 dB RMS difference between Bogner m689735 and Deluxe Room m383454 after metadata normalization. This CAN be compensated using output correction measured on that sample; reference-sine calibration is insufficient. See docs/model-level-comparison-2026-10-09.md for peaks, protocol and balanced-gain example. No DSP policy or user settings changed.

## 2026-10-09 — Finish model selection and diagnose unequal levels

Added Back to rack below grouped Factory/Favorites capture lists (enabled on the loaded model) and below generic/downloaded lists. Uses the same host return event as TONE3000 success. Calibration copy now explains reference-level normalization and clean/driven differences. Real WASM probe comparison reproduced a 24.49 dB gap at low input between first Bogner and Deluxe Room captures, versus 0.84 dB at reference input; see docs/model-level-comparison-2026-10-09.md. No DSP/gain policy change. Validation: 147 Node tests passed; distribution rebuilt.

## 2026-10-08 — Rack capture selector and TONE3000 return

Successful TONE3000 capture loading requests closing its own host editor and returns to the rack. Failed loads keep the editor open. NAM cards now have a capture dropdown between previous/next arrows below the photo; Factory discovery works without creating a GUI, while an existing editor supplies its remote TONE3000 collection. Capture selection stays instance-local, with loading/boundary disabling. Rack rows reserve the selector height to keep cards aligned. Validation: 147 Node tests passed (including mocked TONE3000 success/failure navigation), browser verified Factory next/dropdown selection and card layout; distribution rebuilt. Live authenticated TONE3000 callback not exercised.

## 2026-10-08 — Highlight only the loaded model and capture

Factory cards now mark the loaded model with an accent border and Current model badge. Capture highlights follow the loaded asset identity, not each card’s preview index. TONE3000 uses the same loaded-only capture rule. Regression tests cover inactive cards, switching loaded identity and failed loads. Validation: 147 Node tests passed; distribution rebuilt.

## 2026-10-08 — Direct amp calibration and simpler model navigation

Amp settings now contains automatic model-level normalization, calibration, metadata reset and correction display. A collapsed Model details disclosure combines artwork/capture navigation and metadata. Change amp model opens the catalogue directly, with Back to amp settings; the overview/models/details tab bar is removed. Preferences retains A2 rendering mode. Validation: 146 Node tests passed; in-app browser verified measured calibration, metadata reset, catalogue/return navigation and details expansion; compact viewport visually inspected. Distribution rebuilt.

## 2026-10-08 — Stable per-chain volume

Removed the automatic −6 dB mix attenuation when both lanes are enabled. The shared mix now stays at unity for independent inputs and splits, so showing, enabling or muting one lane does not alter the other lane’s contribution. Updated the specification and regression coverage for visibility, mute, UI mode, source loss, routing and state restoration. Validation: 146 Node tests passed; static distribution rebuilt. Physical guitar listening remains untested.

## 2026-10-07 — Model-only navigation

Preferences and Help are standalone buttons beside Change amp model in Amp settings, not model-browser tabs. Models navigation now contains Model overview, Models and Model details only. Overview keeps model artwork/captures/calibration and omits audio meters/gain/flow; Amp settings is reached with Back to amp settings. Global views retain that return action and accessible pressed buttons. Validation: 145 Node tests and 8 Chrome checks passed; desktop screenshot inspected. Distribution rebuilt.

## 2026-10-07 — Backing-track loading progress

Added a transfer progress bar and an explicit engine loading state. Play is greyed out/disabled through download, decode and peak analysis, including when a previous buffer exists; engine play() also guards pending loads. Unknown sizes and audio preparation use indeterminate progress. Superseded downloads cannot update current progress. Errors hide the bar and retain the previous playable buffer. Existing playback continuation behavior is preserved. Validation: 145 Node tests and 6 browser checks with throttled transfer/decode and network failure passed. Distribution rebuilt.

## 2026-10-07 — Gate in Amp settings and model CTA

Moved the single NAM noise-gate control (enable + threshold) from Main artwork to Amp settings before the tone-stack knobs. Existing WAM parameter/automation bindings are unchanged. Change model is now Change amp model, centered below the model name with a larger accent-colored button. Help updated. Validation: 145 Node tests and 9 Chrome checks including gate enable/threshold parameters and model-browser navigation; desktop screenshot inspected. Distribution rebuilt.

## 2026-10-07 — Audio toolbar placement

Enable/Disable live input now shares the device-selection toolbar. Change audio source appears only in full mode; switching to beginner closes the sidebar. The 1 / 2 chains toggle bolds only the current count, with an accessible label describing current and target counts; updates also follow state restoration.

## 2026-10-07 — Hide route action at connected junction

The small route action is hidden at the active A→B junction (and at the preview junction), including on hover/focus. Other insertion points retain the 700 ms hover grace. Moving/removing the route restores the old action; the existing route label remains the edit/remove control. Focus moves to the adjacent + when its route action becomes hidden.

## 2026-10-07 — Main-host tuner popup

- Added top-bar Tuner with SVG tuning fork, available in both UI modes. `TunerView.js` lazily instantiates the catalogue tuner on a silent parallel tap of chain A input (after source trim, before effects). No microphone activation, backing-track analysis or insert-menu entry.
- Existing tuner GUI mounts after dialog visibility and powers on automatically. Close/Escape cancels pitch animation, disconnects/destroys the instance, and restores focus. Async opening is guarded against close/reopen; errors appear in the dialog. Static build now includes TunerView.js.
- Validation: 145 Node tests; 10 Chrome checks passed without exceptions, including detection of synthetic 220 Hz as A, nonzero canvas dimensions, silent output branch, unchanged rack, close/reopen and cancellation during loading. Physical instrument/microphone not exercised. Desktop screenshot inspected. Distribution rebuilt.
- Compact inline tuner UI remains deferred as requested.

## 2026-10-07 — Detail editor header

Removed the host-level Bypass ON/OFF button from all detailed card editors. The header retains Replace, Remove and Close. Card-level bypass and plugin-native controls remain available.

## 2026-10-07 — Direct live-input shortcut

- The existing Enable live input toggle moved from the sidebar to the rack header. It remains enabled in file-source mode and immediately selects Live input, stops the dry player and activates the selected input. It becomes Disable live input while monitoring. Busy clicks are disabled; capture errors open the sidebar to expose the status.
- The adjacent panel icon now has the visible label Change audio source, retaining its expand/collapse behavior.
- Validation: 145 Node tests and 10 Chrome checks passed, including file-to-live, stop, and permission failure using a simulated MediaStream (no physical microphone). Distribution rebuilt.

## 2026-10-07 — Beginner/full UI and compact NAM editor

- Host sidebar starts fully collapsed, toggled by the accessible panel icon in the rack header; Escape from inside closes it. Source selection and diagnostics remain there; live-input activation is now directly in the rack header.
- Host defaults to beginner on every page load. Header toggle enables full mode. Beginner hides B and every dual-chain routing control. `FxRack.activeB` gates B’s physical/tap input, output connection and mix contribution, independently of the saved `visible`/mute/routing configuration. Returning to full restores the previous layout without recreating B. UI mode is not serialized; restoring a two-chain state while beginner keeps B disconnected. Core rack defaults to full for existing API consumers; host explicitly selects beginner before creating the view.
- NAM GUI opens Amp settings when a model is loaded, with model name and Change model. Management UI is retained behind Change model; Back to amp settings returns to the compact view. Every reopening resets to amp (or Models if empty). Spectrum monitoring follows the active view. Other WAM GUIs unchanged.
- Validation: 145 Node tests passed, including B isolation, restore under beginner, split recovery, independent-input mute preservation. 13 desktop Chrome interaction checks and 14 checks against the rebuilt distribution at 390 px passed with no exceptions or horizontal page overflow. Desktop and narrow screenshots inspected. Static distribution rebuilt. No live TONE3000 authentication or physical audio listening tested in this change.
- Scope/spec: `SPECIFICATION_FX_CHAIN.md`, section Interface simplifiée. Presets 7.2 remains deferred.

## 2026-10-06 — TONE3000 accordion correction after screenshot

The screenshot showed the generic `.modelBrowser` asset-tree group “Downloaded on this device”, not only the separate `.tone3000Downloads` section. `buildAssetTree` automatically expands ancestors of the selected model on every render, which defeated the previous fix. NAM now overrides this specific group's open state in the TONE3000 source, resets it when presenting a new remote selection, and preserves explicit manual reopening through rerenders. Search can still expand matching results; Factory/Favorites behavior is unchanged. Validation: 143 Node tests and 13 browser checks with a mocked callback, seeded downloaded model and repeated browser renders; no browser exceptions. Distribution rebuilt.

## 2026-10-06 — Accordion, route-hover grace and TONE3000 return

- Backing player now has a full-width accordion heading. Collapsing hides transport, status and library/waveform controls; audio playback continues. This supersedes the previous compact transport layout.
- Chain A route buttons remain clickable for 700 ms after pointer/focus leaves their slot. Reentry cancels the timer; keyboard focus and touch visibility remain supported. Single-chain mode still hides routing actions.
- NAM's “Downloaded on this device” section is now a native details/summary accordion. A successful TONE3000 selection closes it and brings the selected-tone card into view; it remains manually reopenable. Error/cancel callbacks do not close it.
- Validation: 143 Node tests passed, static distribution rebuilt, 9 browser interaction checks passed without exceptions. TONE3000 callback was mocked; no authenticated live flow was exercised.


## 2026-10-05 — Backing track player (latest handoff)

- Implemented the approved `ADD_BACKING_TRACK_PLAYER.md`: reusable `<backing-track-player>`, independent engine/library and final guitar/backing mixer in `examples/wam/backing-track-player/`.
- 29 original MP3s copied unchanged into `examples/wam/assets/backingTracks/` (~170.5 MB compressed). Only selected media is fetched/decoded. Run `npm run backing-tracks` after additions/deletions, then `npm run dist`; `npm run backing-tracks -- --check` is read-only. Provenance hashes in the component's `SOURCE_MANIFEST.json`.
- Panel below rack: searchable library, waveform, local import/drop, play/pause/stop, A–B loops, 70–130% pitch-preserving speed, non-destructive normalization, volume/mute, global guitar pan, balance and mix meter. Compact mode keeps playback. CSS responds to component width, tested at 360 px.
- `BackingTrackMix` replaces the direct rack-to-destination connection. Accompaniment bypasses all guitar effects; the existing AudioContext/output-device selection serves both. Per-chain pans/gains stay independent. Guitar mix gain is unity when accompaniment is stopped/paused.
- Session state keeps the existing rack format plus optional `backingTrack`. Restore never autoplays or activates input. Missing local media asks for reselecting the same file; pending settings then restore by filename/size/mtime identity. Local media is not persisted or uploaded.
- Validation: **143 Node tests**, **60 real-audio browser checks** at 44.1/48 kHz plus **9 host UI/session checks**, no browser exceptions. Desktop/narrow UI inspected; distribution rebuilt. Reproducible page: `backing-track-player/validation.html`; numeric results in `VALIDATION.json`.
- Still manual: physical interface listening, musical stretching artifacts and CPU/latency profiling. Native A–B loops do not have a dedicated endpoint crossfade. Backend, multitrack, ML separation and rack preset phase 7.2 remain out of scope.
- Active branch remains **New-UI**. Prior implementation was committed/pushed as `be152ca`, merged/pushed to main as `7613551`, then New-UI reactivated. This backing-player work is uncommitted. Reference folders `examples/other_wam_host/` and `examples/WAP_amp_sims/` remain untouched and untracked.


## Current handoff — 2026-09-24

### Per-plugin meters, gains and Replace — latest update

- Every existing-size card now has 4 px input/output meters; the detailed editor has 5 px meters flanking the GUI. Input is measured after input trim, output after output gain; existing input-driven halos remain. Output analysers are disposed with their entries.
- Click each editor-side gain icon to reveal its −48…+12 dB slider and Reset (0 dB). Gains are smoothed, instance-local and saved as `inputDb` / `outputDb` in chain entries. Legacy entries restore unity. These are host wrapper controls, separate from plugin-internal preset state.
- Replace opens the existing catalogue over the editor and opens the new GUI immediately after success. It preserves slot ID, position, gains and split location. Loading is completed before retiring the old plugin; failed instantiation leaves the original intact. New plugin settings start from defaults.
- Latest validation: **137 Node tests passed**, static distribution rebuilt, **22 browser checks passed** for metering, measured gain, reset, replacement, split preservation and rack save/restore. Desktop editor screenshot inspected; physical-interface listening remains pending.
- Details: section 15 of `SPECIFICATION_FX_CHAIN.md`. Rack preset phase 7.2 is still on hold.

### Added WAM catalogue — preceding update

- `npm run wam-plugins` scans plugin root / `plugin/` / `src/` entry points and updates `plugins.json`, preserving manual metadata and external/core entries. Deleted internal entrypoints are removed; `-- --check` is read-only. Guide: `examples/wam/wamPlugins/HOW_TO_ADD_WAM_PLUGINS.md`.
- 17 additions, 31 catalogue entries / 30 active. VintageAmp60s remains disabled (`enabled: false`): its supplied WASM traps at 44.1/48 kHz even without a GUI. The 16 other additions passed import, GUI, state round trip and finite/non-silent audio checks in both source and relocated distribution; no browser errors in the active distribution test.
- Validation at this checkpoint: 135 Node tests passed; distribution rebuilt. Existing uncommitted user input folders remain untouched.


This section supersedes older milestone, Git, test-count and scope notes below. Earlier sections are retained as historical records; the host now supports editable two-chain routing, not just the original fixed NAM → Cabinet graph.

### Confirmed amplifier integration

- User confirmed the names **WAM•FAUST TubeLab** for EndUserAmp1 (gold/anthracite, 30 parameters) and **WAM•FAUST ShredLab** for EndUserAmp2 (petrol blue/copper, 47 parameters). These are no longer provisional names.
- Autonomous runtime copies live in `examples/wam/wamPlugins/EndUserAmp1/` and `examples/wam/wamPlugins/EndUserAmp2/`. Each includes descriptor-referenced GUI artwork, source hashes in `SOURCE_MANIFEST.json`, and browser measurements in `VALIDATION.json`. ShredLab also requires `ampProfiles.js`.
- The original files under `examples/other_wam_host/` remain unchanged. This untracked source tree is user-supplied input, not part of the extracted packages; do not add the whole tree when committing the integration. Adapting the other host is still a separate task.
- Both plugins model preamp, tone stack, power amp, cabinet and reverb. DSP binaries, parameter addresses and default DSP values are preserved. The “grey box” classification has not been verified from modeling/calibration sources.
- TubeLab retains its original WAM identifier; ShredLab uses `fr.grame.faust.ifc2026.amp2` to avoid the originals' duplicate identifier. Controls and GUI classes are isolated between variants and other WAMs.
- Both use the generic effect wrapper, not the NAM-specific API. Their internal cabinets do not trigger NAM metadata-based Cabinet AUTO. They can be inserted, removed and repeated in either rack chain.
- Runtime fixes include awaited initial state, lazy GUI loading, visibility-aware polling, safe detach/reattach, idempotent destruction and ParamMgr destruction acknowledgement before port closure. ShredLab no longer writes a default profile when opening its editor; explicit profile selection still works and restored DSP state drives the displayed profile.
- The `+` menu places amplifiers and cabinets/speakers side by side at the top, with effect pedals below. The laboratory also lists these categories first. WAM URI buttons copy each plugin's resolved entry URI.

### Validation and next checks

- Last implementation validation: **133 Node tests passed**, `npm run dist` succeeded, and **130 browser checks passed** (65 per amp at 44.1/48 kHz, including factory presets) against the relocated static distribution, with no browser errors.
- Reproduce browser checks with `examples/wam/fx-test/ifc-validation.html?variant=1` or `?variant=2`; the same page ships in `dist/NAM_A2_WAM/fx-test/`. Coverage includes real DSP signal processing, stereo input handling, independent instances, parameter/state restoration, bypass and GUI lifecycle. The Node integration test is `tests/phase4b/ifc-integration.test.mjs`.
- Rack checks covered both variants together, catalogue insertion, artwork/URI, editor reopening without state changes, ShredLab profiles, and B fed from a split after TubeLab in A. Narrow ShredLab layout was inspected at 360 px.
- Audio validation used muted Chromium without microphone capture. Live guitar listening, physical device switching and hardware latency/CPU checks remain pending. No deployment of the new integration is claimed.
- **Do not start rack preset phase 7.2.** ShredLab's internal model/profile controls are part of the plugin and are separate from rack preset management.
- Current specifications: [AMP_SIM_IFC2026_INTEGRATION.md](AMP_SIM_IFC2026_INTEGRATION.md) and [SPECIFICATION_FX_CHAIN.md](SPECIFICATION_FX_CHAIN.md).

### Internal factory presets — 2026-09-24 follow-up

- Both WAM editors now offer Default, Clean, Crunch, Disto / Hi gain, Jazzy and Jordan. Only `state.amp` was extracted from the corresponding original host; pedal states are excluded. ShredLab's seven missing Post EQ controls use DSP defaults, so all presets fully determine the sound.
- Portable package files: `factory-presets.js` and `preset-state.js`. Audio-node APIs: `getFactoryPresets()`, `loadFactoryPreset(id)`, `getFactoryPresetStatus()`.
- WAM state remains flat parameter values plus `__wamFactoryPreset: {version: 1, id}`. Restore exact saved controls, not the factory snapshot: edited presets retain their selection and “Modified” indication. Legacy parameter-only states still restore and display “Current settings”. No GUI is required for loading/restoration; opening an editor never applies a preset.
- Validation after this addition: 133 Node tests and 130 browser checks passed; static distribution rebuilt. Regression coverage is in `tests/phase4b/ifc-presets.test.mjs` and the extended browser validation page. This is plugin-local functionality explicitly requested by the user; rack preset phase 7.2 remains on hold.

### Git checkpoint

- Previous rack work was committed as `77163b8`, merged with updated main, and pushed to `origin/main` as `0a2feab` before the amplifier integration.
- Active branch: **New-UI**, returned to the merge result. The new amplifier integration, catalogue changes and latest documentation are currently uncommitted; they were not included in that earlier main push.

## 2026-09-22 — Serial FX chain (spec through 7.1)

- Main host now displays model/IR photo cards, insertion buttons and categorized bundled effects. `FxChain.js` owns serial routing, per-instance dry/wet bypass, insertion/removal, missing-plugin placeholders and versioned full-chain state. `FxChainView.js` owns reusable lazy editors and card state/artwork.
- NAM/Cabinet default assets load without GUI creation, supplied state takes precedence, and worklet registration is cached per AudioContext/module for multiple instances. GUI initialization hydrates node state rather than overwriting it from global preferences. Measured calibration history is now per NAM instance and serialized, keyed by model content and variant.
- Core nodes expose metadata snapshots; Cabinet routing mode is nonvisual and serialized. Host AUTO works before any editor exists. Shared source trim/device selection remain outside chain state.
- TONE3000 callback sessions have per-instance ownership and a nonvisual fallback. Cached editors retain selection/maintainer workflows. A real authenticated external callback still needs manual testing; mocked ownership/deduplication tests pass.
- Session & diagnostics save/restore now covers the full chain in memory. No factory/user preset UI or IndexedDB preset storage yet (section 7.2).
- Browser validation: `examples/wam/fx-test/chain-validation.html` (also in dist). Runs muted real DSP, headless defaults, repeated NAM/Cabinet and effect instances, distinct restored settings, all nine insert effects, reusable editors and first-open state invariance. No microphone is used.
- `skills-lock.json` remains unrelated and untracked. No commit/push requested for this implementation.
- Validation: 109 Node tests passed. The in-app browser completed the real-audio headless test for all nine insert effects, repeated-instance state restore and first-editor-open invariance. Main distribution startup and NAM modal were visually checked. Physical audio-interface switching and authenticated TONE3000 callbacks were not retested in this phase.

## 2026-09-22 — Cabinet Settings tab

- Cabinet routing/status, Level Match, IR Trim and Output Gain now live in a separate Settings tab. Main remains the default tab and retains the current IR artwork, metadata chips and active/bypassed indicator.
- Host Source trim is independent: it adjusts audio before NAM, defaults to 0 dB for live input and -18 dB for files, with separate in-session values. Cabinet IR Trim is a per-IR level adjustment instead.

## 2026-09-22 — Cabinet AUTO during default model loading

- Register the host NAM model listener before creating the NAM GUI, which autoloads the default factory capture. Previously this event was missed and AUTO used null metadata, leaving the Cabinet active for an amp+cab capture.
- `amp_cab`, `amp-cab` and `full-rig` already qualify for automatic Cabinet bypass. Manual ON remains an explicit override.
- Regression tests cover startup GUI autoload and switching back to an amp-only capture.

Updated: 2026-09-04

## Current milestone

Phase 4b.2 — GUI/UX Redesign for Host + NAM + Cabinet WAMs is implemented and validated locally.

Phases 1 through 4b.1 remain in place. Phase 4b.2 changed presentation and host/GUI coordination only; the NAM and Cabinet DSP architectures, audio graph, gain semantics, model loading, IR processing, Level Match, and Cabinet AUTO policy were not redesigned.

The generated deployment artifact is:

`dist/NAM_A2_WAM/`

The next session should start by reviewing or deploying this artifact, not by reconstructing the Phase 4b.2 work.

## Phase 4b.2 implementation

### Host

- `examples/wam/index.html` now uses an EndUserAmp2-inspired application shell: fixed/sticky dark sidebar and a dark rack workspace.
- `examples/wam/host.css` owns all host layout and responsive styling.
- Host-owned controls remain in the sidebar: source/device selection, source trim, player, output device, save/restore, and diagnostics.
- NAM and Cabinet plugin controls are not duplicated in the host.
- The desktop rack presents NAM and Cabinet side by side; the modules stack at narrower widths.
- The signal-chain map remains Input -> NAM -> Cabinet -> Output.
- `examples/wam/main.js` still connects `sourceTrim -> NAM -> Cabinet -> destination`.

### NAM WAM GUI

- `src/nam-wam/gui.js` is now a compact, container-friendly rack module.
- It shows the current model, source, A2 subtype/mode metadata, narrow input/output meters, exact input/output gain values, and bypass.
- Model sources are Factory, Favorites, External, and TONE3000.
- Model browser and model details are native collapsible drawers, closed by default.
- Browser results scroll inside the module instead of expanding the page indefinitely.
- External `.nam` loading and Factory selection use the existing model-loading path.
- TONE3000 Select Flow and its callback relay architecture are preserved.
- The important Phase 4b.1 callback fix remains: the relayed callback URL is passed to `completeAuthorization(location)`.
- The first URL returned in the TONE3000 `tone.images` metadata is displayed in the selected-tone panel and in the current-model block after loading.
- The normalized image URL is stored in model provenance, so save/restore can redisplay it without another TONE3000 metadata request; missing or failed images fall back to the text-only layout.
- Clicking the TONE3000 source tab now checks for an in-memory OAuth access token. Without one, it shows a TONE3000 partnership/authentication splash with the official local full logo and a Continue button; the existing Select Flow starts only after Continue.

### Cabinet WAM GUI

- `src/cabinet-wam/gui.js` is now a matching compact rack module.
- It shows the current IR, source, sample rate/details, Level Match, compensation, per-IR Trim, output gain, and bypass.
- AUTO / ON / BYPASS routing is visible in the Cabinet module, while the host remains responsible for applying the policy.
- Routing status explicitly reports whether Cabinet is active or bypassed and why.
- Factory/External IR browser and details are collapsible and closed by default.
- External `.wav` data is retained safely for in-session reload/state behavior.

### Host/plugin coordination

- `examples/wam/main.js` listens for the cancelable `cabinet-routing-mode` event and applies the existing host-owned AUTO/ON/BYPASS policy.
- Cabinet receives a display-only routing status through `setRoutingStatus()`.
- AUTO still detects full-rig captures from trusted NAM metadata and constrained fallback labels.
- Host duplicate NAM gain/bypass controls and the old host Cabinet mode selector were removed.

## Responsive and accessibility behavior

- Desktop: sidebar plus two-column rack.
- Medium widths: NAM and Cabinet stack in the rack while the sidebar remains available.
- Small widths: sidebar becomes the top section and the rack follows without horizontal clipping.
- Plugin styles are scoped to their custom elements; there are no plugin-level `body`, `position: fixed`, or `100vw` assumptions.
- Interactive controls have labels, visible focus treatment, button semantics, and `aria-pressed` source tabs.
- Escape closes open model/IR drawers.

## Files modified

- `examples/wam/index.html`
- `examples/wam/config.js`
- `examples/wam/main.js`
- `src/nam-wam/gui.js`
- `src/nam-wam/NamNode.js`
- `src/nam-wam/models-manifest.json`
- `src/nam-wam/tone3000/Tone3000Auth.js`
- `src/nam-wam/tone3000/Tone3000Client.js`
- `src/cabinet-wam/gui.js`
- `src/cabinet-wam/irs-manifest.json`
- `src/shared/assetBrowser.js`
- `tools/generate-factory-manifests.mjs`
- `tools/build-static-dist.mjs`
- `tests/phase4a3/distribution.test.mjs`
- `tests/phase4a2/manifest.test.mjs`
- `tests/phase4b/tone3000.test.mjs`
- `README.md`
- `HANDOFF.md`

## Files created

- `examples/wam/host.css`
- `src/nam-wam/tone3000/Tone3000Downloads.js`
- `src/nam-wam/tone3000/FactoryBundle.js`
- `docs/FACTORY_LIBRARY.md`
- `tests/phase4b/gui-redesign.test.mjs`

The generated files under `dist/NAM_A2_WAM/` were rebuilt from these sources.

## Automated validation

- `node --check` passes for the modified JavaScript modules and the new GUI contract test.
- `npm run dist` succeeds.
- Distribution contains 63 NAM models and 43 Cabinet IRs.
- `npm test` passes 60/60 tests.
- The distribution contract now requires `host.css`.
- Phase 4b GUI contract tests check host ownership, scoped plugin CSS, drawers, source tabs, AUTO controls, TONE3000 callback forwarding, and forbidden viewport/global CSS assumptions.

## Browser validation completed

Source host tested at:

`http://127.0.0.1:8765/examples/wam/index.html?phase4b2=1`

Static distribution tested at:

`http://127.0.0.1:8765/dist/NAM_A2_WAM/?phase4b2=1`

Validated manually:

- no console errors or warnings on startup;
- desktop, 900 px, and 640 px responsive layouts;
- Factory NAM and Factory IR loading;
- Factory, External, and TONE3000 source panels;
- supported External NAM loading;
- External WAV IR loading and displayed sample details;
- file-source selection and enabled player;
- Cabinet manual ON and BYPASS;
- Cabinet AUTO active for amp-only NAM metadata;
- Cabinet AUTO bypassed for full-rig NAM metadata;
- save/change/restore returned to the saved model and IR in the static build.

## TONE3000 status

Follow-up implementation on 2026-09-02: the browser host now follows the two-stage architecture used by the official TONE3000 plugin. The first authentication action uses a no-prompt OAuth/PKCE login and returns to the WAM page; after authentication, the TONE3000 source panel exposes an in-plugin catalog with Trending, Latest, Downloaded, Favorites, and Created streams, gear filters, cards, and pagination. Selecting a card resolves the tone metadata and compatible NAM A2 models in the existing model-selection panel. The Browse TONE3000 button continues to use the official `prompt=select_tone` flow for the full external catalog.

The example host configuration is now in `examples/wam/config.js`. Its public client ID is shared by the local and Mainline deployments, while `redirectUri` is derived from the page URL at runtime. Consequently, `examples/wam/index.html` does not need environment-specific edits; the generated static distribution contains the same `config.js` mechanism.

`Tone3000Client` now persists the browser access/refresh token in local storage, provides the catalog stream methods, and keeps the Window-bound fetch behavior. Model downloads remain JavaScript-side in this WAM host because there is no JUCE/native token bridge; the official plugin instead passes the token to native C++ and downloads/caches the model off the audio thread. The WAM still keeps all network and DOM work outside audio processing.

The example host now explicitly requests a 48 kHz `AudioContext`, matching the sample rate of the
bundled and TONE3000 NAM A2 models. If the browser returns another rate, the host reports it in
the status area because the NAM core rejects mismatched models.

OAuth callback follow-up on 2026-09-03: a same-tab Select Flow return now explicitly restores the
TONE3000 source tab, opens the model drawer, and automatically loads the first compatible A2 model.
Previously the callback metadata was resolved after reload while the GUI remained on the closed
Factory view, making the successful callback appear inert.

Audio-session follow-up on 2026-09-03: login and Select Flow now open in a named popup and relay the
callback through same-origin storage/BroadcastChannel messaging. This keeps the main host page,
AudioContext, live-input stream, and selected input/output devices alive while TONE3000 is open.
Same-tab callback handling remains as a fallback for embedded browsers that collapse popups.

TONE3000 AUTO-routing follow-up on 2026-09-03: selected-tone provenance now retains the canonical
API `gear` value. Cabinet AUTO treats `amp-cab` (and deprecated `full-rig`) as including a speaker
capture and bypasses the external Cabinet, while `amp` keeps Cabinet active. This provenance is
also serialized with WAM state, so routing remains correct after state restoration.

Cabinet default/status follow-up on 2026-09-03: a fresh session automatically loads the Factory IR
`tone3000/outmodedelectronics/Celestion Vintage 30 - 2002 Mesa Boogie 4x12 - SM57--t45023/captures/V30 LL 4FB 4x12 SM57 0.50in 0--m239290.wav`; restored sessions retain their saved IR instead. The Current IR panel,
activity badge, and routing-status message are green when convolution is active and red when the
loaded IR is bypassed.

The Phase 4b.1 integration and callback fix are preserved. Phase 4b.2 verified that the TONE3000 source panel, button, status, and callback contract are present without introducing startup requests.

### Local TONE3000 downloads and Factory metadata — 2026-09-03

- Models downloaded after an explicit user selection are now stored in the browser's IndexedDB by `src/nam-wam/tone3000/Tone3000Downloads.js`.
- Only the selected NAM file and its attribution metadata are stored. Catalog feeds and expiring download URLs are not cached, in accordance with the TONE3000 API terms.
- The TONE3000 panel has a persistent "Downloaded on this device" section available even while signed out. Each entry can be loaded or deleted, and a guarded "Delete all" action clears every local TONE3000 download.
- Deleting a download removes its persistent copy. If it is the model currently running in the AudioWorklet, that in-memory model remains active until another model is loaded.
- IndexedDB storage is browser-profile and origin scoped. Localhost and `https://mainline.i3s.unice.fr` therefore have separate download libraries.
- Stored records preserve tone/model identity, filename, model data, title, creator, gear, format, license, image URL, and download date. The app does not store the temporary `model_url`.
- The Factory manifest now preserves gain, loudness, input/output dBu, trainer, and capture date in addition to gear/type/creator metadata.
- Factory browsing now uses metadata-rich cards, and the current-model/details panels show the same available attribution and capture information.
- Factory `.nam` files contain no reliable image URL or TONE3000 tone ID. Manifest generation therefore supports local sidecar images named after the `.nam` file (`.jpg`, `.jpeg`, `.png`, `.webp`) or `cover.*` in its folder. When none exists, the GUI displays an explicitly generated metadata tile rather than guessing a remote image.
- `NamNode` now respects `provenance.source`, allowing Factory provenance to carry artwork/metadata without being mislabeled as TONE3000. Cabinet AUTO reasons also report the correct provenance source.
- Browser validation loaded `A1vsA2-JVM-OD1-OR-A2.nam` and confirmed Factory source, A2 subtype, 48 kHz sample rate, creator, gear type, trainer, date, and input/output levels.
- `npm run dist` rebuilt `dist/NAM_A2_WAM/`; the distribution includes the IndexedDB module and regenerated 58-model Factory manifest.
- Factory browser follow-up: after selecting a model inside a nested folder, every ancestor accordion on the selected path remains open and the selected card stays highlighted. This avoids reopening the same folder to audition adjacent captures.
- Factory cards now display the original filename as a separate monospace line because filenames often encode channel, gain, EQ, microphone, and cabinet settings.
- `docs/FACTORY_LIBRARY.md` defines the implemented rich bundle format for NAM and IR collections (`tone.json`, local cover image, stable tone/model IDs, creator/license metadata, and hashes).
- Opening the host with `?maintainer=1` reveals a Factory maintainer panel in the TONE3000 tab. It can launch an explicit NAM A2 or IR Select Flow, list the files in the selected tone, download only checked files, retain the first tone image, generate hashes and `tone.json`, and export a repository-ready ZIP without temporary model URLs or OAuth tokens.
- `tools/generate-factory-manifests.mjs` now reads the nearest `tone.json` for both `.nam` and `.wav`, validates its schema, file membership and SHA-256 hashes, rejects duplicate provider identities, and merges provenance/artwork into manifest version 2. Existing loose Factory files remain compatible.
- Factory NAM and Cabinet IR cards consume the richer manifest fields and show filenames, tone title, creator, license, image, and technical metadata when available.
- Rich TONE3000 Factory bundles keep their collision-safe `tone3000/creator/tone/captures` layout on disk, while the GUI renders one compact card per tone: one image/title/attribution header plus a scrollable list of capture filenames. There is no surrounding tone accordion. Legacy loose assets retain their physical folder grouping.
- Factory asset URLs now percent-encode every path segment before fetching models, IRs, or cover images. This fixes TONE3000 filenames containing URL-reserved characters such as `#` or `?`; previously `BLEND #1` was interpreted as a URL fragment and the request path was truncated. Traversal and empty path segments are rejected. All 184 current TONE3000 Factory NAM files were independently parsed and loaded by the WASM engine, and a real `BLEND #1` capture was then loaded successfully through the browser GUI.
- NAM Factory manifests now assign every capture a `guitar`, `bass`, or `pedal` category. An explicit `tone.category` in rich bundles has priority, followed by TONE3000 bass tags, pedal gear metadata, strict pedal filename prefixes, and the legacy exact `Bass` directory; otherwise captures default to guitar. The maintainer exporter writes a derived category into new NAM bundles, and `docs/FACTORY_LIBRARY.md` documents manual correction for ambiguous sets. The Factory GUI provides counted `All`, `Guitar`, `Bass`, and `Pedals` pills. Current generated counts are 242 total: 219 guitar, 23 bass, and 0 dedicated pedal captures. Browser validation confirmed that `Bass 23` shows the Ampeg and Hartke collections and excludes guitar packs.
- The maintainer workflow does not bypass TONE3000 restrictions: whole-tone API ZIPs remain partner-only, and any exported content must be checked for redistribution permission before it is committed or deployed.

### A2 rendering preference and cross-source favorites — 2026-09-04

- A `SlimmableContainer` previously rendered its last submodel by Core default, which is A2 Full. The old `A2 Lite + Full` label described file contents and did not mean both networks were evaluated.
- The WASM wrapper now exports `nam_set_slimmable_size`. The AudioWorklet can switch the current container between Full (`1.0`) and Lite (`0.0`) without re-downloading or reparsing the model.
- Preferences exposes Full (default/higher fidelity) and Lite (lower CPU). The choice persists per origin in local storage, is included in WAM state version 2, and the current-model badge/details report the network actually active.
- The NAM source tabs now include Favorites. Stars can add or remove individual Factory, External, or downloaded TONE3000 model captures.
- Favorites are stored per origin in a dedicated IndexedDB database. Complete data is retained for External and TONE3000 favorites, so they remain loadable after a browser restart; Factory favorites retain their stable manifest identity.
- Browser validation confirmed Full loading, live switching to Lite, favorite add/remove, and persistence across reload. The temporary validation favorite and Lite preference were removed/reset afterward.

### Automatic NAM model level — 2026-09-04

- NAM capture loudness metadata now drives an independent output compensation stage after model inference. The target is −18 dB and correction is clamped to ±12 dB to avoid unsafe boosts from unusual or corrupt metadata.
- Automatic model level is enabled by default, persists per browser origin, is included in WAM state, and can be disabled under Preferences without changing the user's manual Output gain.
- Gain transitions are smoothed sample by sample in the AudioWorklet, including preference changes, to avoid abrupt discontinuities. Loading a new model initializes its correction immediately before audio resumes.
- Model details report both the capture loudness and the applied correction. Missing or non-finite loudness values result in 0 dB compensation.
- Browser validation measured the intended metadata-derived corrections: Fender Super Reverb SM57 (`-23.4 dB`) receives `+5.4 dB`; Full Rig Peavey 5150 Maxon Mesa OS SM57 (`-15.7 dB`) receives `-2.3 dB`. Disabling the preference displayed `Auto level: off`, and it was restored afterward.
- `tests/phase4a/model-level.test.mjs` covers representative Fender/Peavey values, disabled mode, invalid metadata, and the ±12 dB bounds.
- Follow-up: the current-model card now carries a permanent green `LEVEL ±x.x dB` badge with a tooltip containing model loudness, target, and applied NAM correction. Disabled or unavailable correction is displayed in red as `LEVEL OFF` or `LEVEL N/A`.
- A missing loudness value previously became numeric zero through JavaScript's `Number(null)`, accidentally requesting the maximum `-12 dB` attenuation. Missing/non-numeric metadata is now strictly treated as unavailable and applies `0 dB`.
- `SlimmableContainer` models now read loudness from the active Full/Lite submodel first, falling back to container metadata. Switching Full/Lite also recalculates and applies the matching correction.
- Loudness-metadata limitation confirmed with a native controlled render: the same 997 Hz, 0.15-peak reference produced `-28.13 dBFS RMS` through `Fender Super Reverb_ EQ Flat, Volume 3, sm57 and AKG 414.nam` but `-18.14 dBFS RMS` through the Peavey 5150 Maxon SM57 capture. Their metadata reports `-20.25 dB` and `-15.66 dB`; after metadata normalization to `-18 dB`, the measured outputs would still differ by about `5.4 dB`.
- The official `tone-3000/tone3000-plugin` implementation was checked at `plugin/src/Processor.cpp`: it also applies `targetLoudness - modelLoudness`, clamped to ±12 dB, with a default target of `-18 dB`. The current WAM behavior therefore matches the official algorithm; remaining perceptual/output mismatch comes from trainer-defined loudness metadata and source-dependent model response.
- The recommended non-pumping calibration is now implemented as an optional **Calibrate level** button. It renders a private 997 Hz reference at 0.15 peak through the active model, discards a 4096-frame warmup, measures the following 16384 frames, derives a static correction toward `-18 dBFS RMS`, clamps it to ±12 dB, and also limits predicted peak to `-1 dBFS`.
- Calibration runs only on explicit user action. The probe is not copied to the WAM output, NAM is reset both before and after measurement, and no adaptive gain runs during normal playing. **Use metadata** restores the default metadata-derived correction.
- The badge reports `MEASURED ±x.x dB`; Model details includes measured probe RMS and whether safety limiting occurred. The measured calibration is carried in WAM state version 3 for state restoration.
- Measurements are also stored per stable model identity and Full/Lite variant in origin-scoped local storage. Selecting the same capture restores its measured static gain; **Use metadata** deletes that stored measurement. Browser validation confirmed restoration after a full page reload, then removed the temporary validation entry.
- Browser validation produced `MEASURED +10.1 dB` from `-28.1 dBFS` for the problematic Fender capture, versus `MEASURED +0.1 dB` from `-18.1 dBFS` for the Peavey Maxon SM57 capture. Returning to metadata restored the Peavey `LEVEL -2.3 dB` state.
- Unit/contract coverage includes measured correction limits, peak protection, explicit calibration routing, model reset, and GUI controls. The full suite passes 60/60 tests.

### Official-style NAM tone controls — 2026-09-04

- NAM Input Gain and Output Gain are now rotary controls. Every rotary control keeps a native range input for keyboard/accessibility support; double-click restores its declared default (0 dB for both gain knobs).
- Added the official plugin's input Noise Gate, with threshold `-100..0 dB` (default `-80 dB`), detector sidechain HP/LP filtering, fast attack, 25 ms detector decay, 5 dB hysteresis, 50 ms hold, 100 ms gain release, and cubic downward expansion to a `-80 dB` floor.
- Added the global post-NAM Bass/Middle/Treble stack with official mappings: low shelf 150 Hz at ±20 dB, bell 425 Hz at ±15 dB, and high shelf 1.8 kHz at ±10 dB. Knob value 5 is flat.
- Added a hidden-by-default six-band parametric EQ drawer. The EQ itself defaults disabled and POST NAM; users can select PRE NAM. Defaults mirror `BlockEq`: low shelf 100 Hz, bells at 250/650/1600/3500 Hz, high shelf 8 kHz, each with frequency, ±15 dB gain, and Q controls.
- Exact WAM routing is `Input Gain -> Noise Gate -> optional PRE EQ -> NAM -> model-level normalization -> optional POST EQ -> Tone Stack -> Output Gain`. Whole-plugin bypass remains a coherent dry bypass.
- NAM and Cabinet faceplates now receive a prominent red-tinted state when bypassed, in addition to their existing checkboxes/status text.
- Headless browser validation initially confirmed the rotary controls, EQ reveal behavior, Input Gain double-click reset to 0 dB, WAM parameter synchronization, and the NAM bypass faceplate class. DSP and contract tests cover gate attenuation, tone/EQ shaping, routing, GUI controls, and Cabinet bypass styling.

### Vertical knobs and graphical EQ — 2026-09-04

- The six faceplate knobs now own pointer gestures instead of using the browser's horizontal range behavior. Vertical upward drag increases the value, downward drag decreases it, horizontal-only movement leaves it unchanged, Shift gives 8x finer control, keyboard range behavior remains available, and double-click still restores the declared default.
- The 18 EQ knobs were replaced by one interactive logarithmic SVG response graph with six draggable band nodes. Horizontal movement changes frequency, vertical movement changes gain, the wheel changes Q, Shift enables fine movement, and double-click neutralizes the selected band's gain.
- The selected band exposes exact numeric Frequency, Gain, and Q fields. The six bands remain ordered in frequency while dragging, and Reset EQ restores all official defaults.
- The plotted combined response uses the same RBJ coefficient and magnitude-response equations as the official `eqMath.ts`/`BlockEq.cpp`, at the active AudioContext sample rate. It therefore visualizes the actual EQ transfer function rather than a decorative approximation.
- EQ updates are batched into one WAM parameter call per gesture event and complete parameter synchronizations redraw the graph only once, avoiding redundant UI-thread response calculations during a drag.
- Chrome validation confirmed six knobs and six EQ nodes, zero change after a 100 px horizontal-only knob drag, Input Gain change from 0 to +18 dB after a 45 px upward drag, synchronized WAM values, graphical band movement from 250 Hz/0 dB to approximately 499 Hz/+3.6 dB, updated numeric readout, and a changed response path.
- The full suite passes 63/63 tests after the interaction redesign.

### TONE3000 C++/WAM DSP parity measurement — 2026-09-04

- A native reference executable was built against the official `tone-3000/tone3000-plugin` commit `1572f20a9a9a0a22e902aade9292a7e86c98b7e1` and its declared JUCE 9.0.1 revision `e18f7f506c0b96f2c738a0bcd7fe6467a5005ad8`.
- The reference compiled `BlockEq.cpp` and `NoiseGate.h` directly from the official repository. The tone-stack reference instantiated JUCE's actual `makeLowShelf`, `makePeakFilter`, and `makeHighShelf` filters using the exact code and order from `Processor.cpp`.
- Each comparison processed 96,000 identical 32-bit input samples at 48 kHz. The tone test used deliberately non-neutral `Bass 8.3 / Middle 2.1 / Treble 7.4`; all six parametric-EQ bands used non-zero, mixed boost/cut settings; the gate input crossed a `-38 dB` threshold repeatedly to exercise open, hold, and release behavior.
- Tone stack: correlation `0.9999996746`, output-level difference `+0.00345 dB`, peak difference `+0.00318 dB`, RMS null/error `-74.87 dBFS`, and error-to-signal SNR `60.92 dB`.
- Six-band EQ: correlation `0.9999999590`, output-level difference `-0.00101 dB`, peak difference `-0.00086 dB`, RMS null/error `-91.66 dBFS`, and error-to-signal SNR `70.20 dB`.
- Noise gate: correlation `0.99999999999994`, output-level difference `+0.0000026 dB`, peak difference `+0.0000027 dB`, RMS null/error `-155.89 dBFS`, and error-to-signal SNR `129.27 dB`.
- Conclusion: the gate is effectively numerically identical. EQ and tone-stack level/peak differences are a few thousandths of a dB or less; their residual null is consistent with C++ `float` filter coefficients/state versus JavaScript `double` arithmetic and is not a material tonal discrepancy. No DSP correction was warranted from this test.

Follow-up completed on 2026-08-31: selected TONE3000 tone images are now supported through the documented `Tone.images` array. Both image placements are present in the rebuilt static distribution and remain hidden until a valid image URL is available.

New-UI branch follow-up on 2026-09-14:

- The NAM `Models & sources` drawer opens by default on Factory with the Guitar category selected. Other categories remain available.
- TONE3000 no longer requires a separate `Load selected model` button: choosing a tone loads its first compatible A2 capture, and changing the model selector loads the newly chosen capture. Downloaded models load when their row is selected; Delete remains a separate control.
- Multi-capture Factory groups, including legacy folders, now use one image/metadata card. The capture filename is shown beneath the image, with previous/next arrows that load the adjacent capture; arrows are disabled at the first and last entries. The artwork itself loads the currently shown capture, and the star toggles its favorite state.
- The Factory card now places a larger, uncropped image and its arrows on the left, with a separately scrollable, clickable filename list and tone metadata on the right. Clicking a filename loads that capture immediately, highlights it, and synchronizes the arrows, counter, filename, and favorite star. The browser preserves its scroll position when a capture loads.
- The top Current model panel uses a larger, contained photo on the left, with the full model title, source/mode/level badges, and calibration controls to the right. This keeps long filenames readable and avoids cropping the artwork.
- The Current model photo and details share one top row with the IN and OUT meters at the edges. The Noise gate controls sit immediately left of the photo; `noiseEnabled` starts off for new instances and remains a standard WAM parameter restored from saved state.
- The small Noise gate threshold knob sits above its checkbox to the left of the photo and dims/disables when the gate is off. Matching small input/output gain knobs now sit directly below their respective IN/OUT meters; the accordion holds Bass, Middle, Treble, Tone and EQ. New instances start with EQ enabled (`eqEnabled=1`), while saved WAM state still overrides the default. When EQ is bypassed its signal-flow stage, button, and graph visibly indicate the bypass.
- Factory and the selected TONE3000 tone now share the two-column capture card: title/metadata above the uncropped image with adjacent previous/next arrows, and a separately scrollable `Captures disponibles` button list on the right. The TONE3000 list replaces the old dropdown; selecting an entry loads it immediately and keeps arrows, counter, and loaded highlight synchronized.
- The main photo/meter frame adds a smoothed green-to-amber-to-red neon border driven by the output RMS/peak meter callback. It decays to the idle border at silence and never adds audio-processing work to the AudioWorklet.
- The selected TONE3000 detail view now offers `Back to TONE3000 main view` beside Browse. Returning keeps the existing catalog cards, feed, filter and page without refetching. Both Factory and TONE3000 capture-list headers show the actual singular/plural count (`1 capture disponible`, `N captures disponibles`).
- `docs/screenshots/ImageNAM_A2_WAM.jpeg` is copied into `src/nam-wam/` and referenced as the plugin descriptor `thumbnail`. The static distribution includes an identical copy.

Graphical-EQ/spectrum follow-up completed on 2026-09-04:

- The NAM GUI now uses a compact top-level tab bar instead of stacking four accordions. `Main` is selected by default and contains the signal-flow strip, meters, gain/noise controls, current-model artwork, and status. The other tabs are `Models`, `Amp settings`, `Model details`, and `Preferences`; only the selected panel occupies vertical space. Left/right arrows plus Home/End provide keyboard tab navigation.
- A sixth `Help` tab explains NeuralWAMp's AudioWorklet/WAM architecture, signal path, each functional tab, vertical-drag/double-click knob gestures, hover metadata cards, WAM state, browser-local favorites/downloads, and the separate Cabinet WAM. It starts with a six-step **Getting started with your guitar** guide covering Live input, input/output device selection and browser fallback, enabling live audio, Factory/TONE3000 capture loading and persistence, Amp settings, and the optional high-gain noise gate, and links to the public GitHub repository. Its compact two-column cards become one column on narrow layouts and the content scrolls within the panel.
- The module header and signal-flow row were compacted further: the header uses 7 px vertical padding with a 78 × 25 px logo and smaller identity/bypass typography, while the processing-chain pills use 4 px row padding, 7 px labels, smaller dots, arrows, and gaps.
- In the default `Main` tab, the compact signal-flow row is placed below the complete current-model/meter frame rather than above it, giving the processing order a continuous full-width reading line.
- Model artwork now exposes a delayed rich tooltip after one second of hover. The shared tooltip covers the current model, Factory cards, TONE3000 catalog/selection/download images, and follows the capture selected with card arrows. It presents the available filename, architecture/rendering modes, sample rate, creator, NAM format/loudness, source, gear/capture/tone metadata, date, license/provider, and Tone ID; it disappears on pointer exit or tab changes.
- Opening a TONE3000 popup or completing its callback automatically selects the `Models` tab. The real-time spectrum analyzer is enabled only while `Amp settings` is the active tab and is disabled when another tab is selected.

- The NAM plugin's user-facing name is now `NeuralWAMp` (descriptor, GUI heading, and TONE3000 partnership copy). Its stable WAM identifier remains `org.webaudiomodules.nam-a2` for compatibility.
- The temporary square `N` badge in the module header has been replaced by the native `neuralwamp-logo.svg` lockup: a neural audio waveform and nodes paired with an emphasized `WAM` monogram. The same paths are embedded inline in the GUI, avoiding broken-image behavior caused by strict MIME/CSP handling while retaining the standalone asset for reuse. The SVG remains sharp at any display density, has an accessible label, and shifts toward the bypass color treatment when the WAM is disabled. The development server also serves SVG and model artwork with explicit image MIME types.
- The header uses three equal edge columns around a flexible center: the logo occupies the left 94 px, Bypass the right 94 px, and the identity block is centered independently between them. Its lines are ordered `NeuralWAMp`, `NAM A2 neural amplifier`, then `by @micbuffa`.
- The module heading now credits `by @micbuffa` with a link to the author's GitHub profile. A compact, accessible signal-flow strip sits directly below the heading and reflects the active DSP order. PRE shows `Input -> Gate -> EQ PRE -> Amp sim NAM -> Tone stack -> Output`; POST moves `EQ POST` after the amp. Gate, EQ, and tone-stack pills visibly dim and strike through when their corresponding stages are disabled. The strip fits the normal 509 px module width and remains horizontally scrollable on narrower containers.
- The six filter responses now have stable per-band colors; the selected response is emphasized while the exact combined transfer curve remains white.
- The graph now compares three real spectra: a dashed blue-gray `Input` trace at the EQ insertion point, an orange `Filtered` trace immediately after the EQ, and a green `Final output` trace after NAM, EQ, tone stack, and output gain. In PRE mode the first two are captured before NAM inference; in POST mode they are captured after NAM inference. The third trace makes Bass/Middle/Treble changes visible while preserving a direct input-versus-EQ comparison. All three use a 2048-point Hann-windowed FFT, 64 logarithmic bins from 20 Hz to 20 kHz, a `-100..0 dBFS` range, and fast-attack/slow-release smoothing.
- FFT storage, the Hann window, bit reversal, and twiddle tables are allocated/precomputed in the AudioWorklet constructor. Analysis runs at about 30 Hz only while the `Amp settings` tab is visible, and it does not add another `AudioWorkletNode`.
- The left vertical labels show EQ gain in dB; the right labels show analyzer level in dBFS. The selected-band readout and accessible label explicitly identify `Low shelf`, `Bell`, or `High shelf`.
- Gate, EQ, and tone-stack processing now remain active when no NAM capture is loaded. Previously, the no-model pass-through branch bypassed all tone shaping, which made a correctly enabled EQ inaudible and left its spectrum unchanged.
- PRE and POST routing are now explicit in the processing loop and covered independently. PRE filters the gate output before it is copied to the NAM WASM input; POST filters the normalized NAM output. Browser validation with a real Factory Peavey 5150 capture confirmed that the two PRE spectra diverge under a +12 dB bell boost and reported no console errors.
- The host sidebar now keeps the audio player completely hidden while `Live input` is selected and reveals it immediately below the Source selector only for a discovered audio-file source. Input and output device selectors are adjacent, with Output directly below Input; the separate Player and Output cards were removed. The former `Automated validation output` drawer is labelled `Automated test results` and explains that its JSON diagnostic report is produced only by the `?auto=1` validation run.
- Live-input selection follow-up on 2026-09-16: **Enable live input** no longer opens a preliminary unconstrained `getUserMedia()` stream on the operating-system default microphone when a concrete input is already selected. The chosen device is requested directly with `deviceId: {exact: ...}`; concurrent device changes are serialized so a late default-microphone permission response cannot replace a newer Scarlett/USB request. The returned track settings are checked against the requested physical device, and the host status reports the label of the track Chrome actually opened.
- Multichannel-interface follow-up on 2026-09-16: live capture no longer relies on Web Audio's implicit multichannel-to-mono downmix. A `ChannelSplitterNode` routes exactly one chosen interface channel into the mono WAM chain, with physical Input 1 selected by default and an Input channel selector shown when Chrome reports multiple channels. This prevents Scarlett 2i2 4th Gen loopback channels 3–4 from being mixed back into the processed output and creating a digital feedback loop.
- Live monitoring is now an explicit two-state control: green **Enable live input** starts the selected device/channel, while red **Disable live input** disconnects the source node and stops all `MediaStreamTrack`s. Merely changing an input device/channel no longer opens monitoring while the control is disabled, and switching back from file playback leaves live monitoring off until the user enables it.
- Feedback investigation note (2026-09-16): USB id `1235:8210` identifies a Scarlett 2i2 3rd Gen, which does not expose Focusrite loopback channels, so loopback is not the explanation for that report. A 10-second zero-input render of the default Bogner Uberschall capture remained at a tiny constant model bias (about `-82.9 dBFS`, peak `0.0000715`) rather than self-oscillating. The next physical test should compare the NAM input meter with the guitar volume at zero and then press **Disable live input**: if the tone stops immediately, it is present in the captured interface signal/acoustic setup; if input is silent while output remains loud, investigate the live browser graph further.
- The six NeuralWAMp top-level tabs now keep their natural button widths and distribute the remaining space evenly with flex `space-between`. This makes the visible edge-to-edge gaps between `Main`, `Models`, `Amp settings`, `Model details`, `Preferences`, and `Help` regular and avoids an oversized active background around short labels. Below 620 px, the bar switches to left-aligned horizontal scrolling.
- `NamNode` state is now version 4. All 29 WAM parameters (gain, bypass, gate threshold/enabled, bass/middle/treble/tone enabled, EQ enabled/PRE-POST, and frequency/gain/Q for all six bands) continue through the SDK's standard `parameterValues` state round trip. The host's `?auto=1` validation now changes every one of these values before restoring the saved state and checks them all.
- Automated coverage includes spectrum enable/disable behavior, 1 kHz FFT-bin detection across all three traces, comparative input/filtered spectra, visible spectrum change after a +12 dB band boost, final-output response to tone-stack changes, independent audible PRE routing, audible EQ with no NAM loaded, full parameter registration/state wiring, and GUI contracts. The complete suite passes 72/72.

Image rendering follow-up: TONE3000 images use `object-fit: contain` and intrinsic dimensions (preview capped at 320 px high), so the complete source image is visible instead of being cropped into a 160 px `cover` banner.

Cross-browser OAuth/API follow-up on 2026-09-01: `Tone3000Client` now binds the native browser `fetch` function to `window`. This fixes `Can only call Window.fetch on instances of Window` on strict WebKit/Safari-style implementations after a remote user completes Select Flow. A behavioral regression test verifies the Window receiver; the full suite now passes 43/43 and `dist/NAM_A2_WAM/` was rebuilt.

Deployed-image follow-up on 2026-09-01: the VPS sends `Cross-Origin-Embedder-Policy: require-corp`, while TONE3000 image storage sends `Access-Control-Allow-Origin: *` but no `Cross-Origin-Resource-Policy`. Images therefore worked on localhost but were blocked in the deployed page when requested in no-CORS image mode. Both TONE3000 `<img>` elements now use `crossorigin="anonymous"`, selecting CORS mode and making them compatible with the existing COEP header. Contract tests cover the attribute; the suite passes 43/43 and the static distribution was rebuilt.

Design-guideline follow-up on 2026-09-01: the TONE3000 source tab now presents the required partnership splash before authentication, using the official `TONE3000-logo.svg` asset packaged inside the NAM plugin. The Continue action then opens the existing PKCE Select Flow; no OAuth request is made merely by opening the tab.

A fresh authenticated end-to-end Select Flow was not repeated during the Phase 4b.2 visual pass. It still requires:

- the publishable client ID injected as deployment configuration;
- exact registered redirect URIs;
- a normal browser session with the TONE3000 login/selection flow.

Do not put the TONE3000 secret key in client-side code. The publishable key is deployment configuration, not a secret.

## NeuralWAMp Cabinet library redesign — 2026-09-15

- The Cabinet WAM is now presented as **NeuralWAMp Cabinet**, with its own SVG speaker logo and the same compact visual family as the amp WAM.
- Its top-level views are Main, IRs, IR details, and Help. The Main view keeps routing, bypass, Level Match, IR Trim, output gain, current artwork, provenance chips, and activity status together.
- The IR browser now exposes Factory, Favorites, External, and TONE3000 sources. Selecting an IR loads it immediately; grouped Factory/TONE3000 bundles use an artwork-and-capture-list card with previous/next controls.
- IR categories are `speaker`, `space`, `outboard`, `experimental`, and `other`. Rich bundles prefer canonical TONE3000 gear metadata (`cab`, `space`, `outboard`, `experimental`), with conservative filename/tag fallbacks for legacy loose WAV files.
- Factory manifest generation writes the category for every IR. Speaker/cabinet detection has priority over the word `reverb` for names such as Fender Twin Reverb.
- Favorites and explicitly downloaded TONE3000 WAV files persist per browser profile and origin in IndexedDB. Downloaded files can be removed individually or cleared; a favorite keeps its own complete snapshot.
- TONE3000 browsing uses the official `/tones/search` catalog with `format=ir`, optional gear filtering, pagination, sorting, detail selection, authenticated per-file downloads, local persistence, and full provenance/artwork display.
- Amp and Cabinet share the same OAuth token storage but tag each popup flow with an owner, so only the initiating WAM consumes the callback. Both clients reload shared tokens when their TONE3000 source opens.
- `?maintainer=1` reveals the Cabinet Factory maintainer. It selects one IR tone, lets the maintainer choose its WAV files, fetches artwork/metadata, and creates a repository-ready local ZIP using the existing rich `tone.json` format. It does not use the partner-only whole-tone ZIP endpoint.
- Cabinet state now includes the selected IR provenance metadata, preserving source/category/details after restoration. Existing convolution, Level Match, per-IR Trim, output gain, and AUTO routing semantics are unchanged.
- TONE3000 actions are rendered above the local downloaded-IR cards, so Browse/Continue remains visible for `All` and `Cabinets / speakers`. With `?maintainer=1`, the maintainer box is the first block in the TONE3000 panel; after a tone is selected it shows the WAV checkboxes and then reveals **Download selected Factory IR bundle (.zip)** in that same box.

## WAM FX plugin registry — Phase 1 completed 2026-09-16

- A reusable registry now loads `examples/wam/wamPlugins/plugins.json`, resolves relative and absolute plugin URIs, validates allowed URL protocols, imports each WAM independently, normalizes its descriptor, infers categories from descriptor tags, and records every compatibility stage without letting one broken plugin block the others.
- Ten bundled WAMs are registered: DeathGate, TS9, AutoWah, SweetWah, Chorus, StonePhaser, PingPongDelay, GreyHole, StereoEnhancer, and TunerMachine. Compatibility fixes were limited to relocated SDK, GUI dependency, dynamic-module, and thumbnail paths.
- The compact `wam-plugin-card` component displays descriptor artwork, identity, category, tags, and validation state with a generated fallback thumbnail when needed.
- The standalone test host is available during development at `http://127.0.0.1:8765/examples/wam/fx-test/` and in a static build at `dist/NAM_A2_WAM/fx-test/`. It provides test-tone, live-input, and local-file sources; input/output meters; plugin loading and host-level bypass; GUI open/close; parameter inspection; state save/restore; diagnostics; and sequential validation of the complete catalogue.
- TunerMachine runs on a parallel analysis branch connected through a zero-gain sink, so opening the tuner does not replace or mute the main effect route. Its GUI is available from the tuner control in the test host header.
- The distribution builder copies the registry, card component, test host, catalogue, and bundled plugins, rewrites the development-only SDK path, and verifies required files and forbidden source references.
- Registry authoring, catalogue fields, category rules, remote URI constraints, and compatibility stages are documented in `docs/WAM_PLUGIN_REGISTRY.md`.
- Validation completed successfully in both the development host and the generated static distribution: all ten real plugins reached descriptor, import, instantiation, GUI, audio, and state validation. The full automated suite passes 91/91.
- This phase deliberately does not modify the production guitar signal chain. It establishes the registry and compatibility laboratory that the later routing/pedalboard phases will consume.
- Every catalogue card is now directly clickable (and keyboard accessible). It loads the effect and opens its real plugin GUI in a modal window. The window header carries the plugin title, a synchronized host-level `BYPASS ON/OFF` control with explicit color states, and a close control; closing the window keeps the effect loaded and audible. Clicking the loaded card reopens its GUI without reinstantiating it. The tuner uses the same window but omits the unrelated effect-bypass control.
- Effects now start with host bypass OFF whenever a new catalogue plugin is loaded. GUI elements are mounted only after the modal becomes layout-visible; this is required by plugins such as TunerMachine that size their canvas in `connectedCallback()`, and restores the complete tuner scale, centered needle, and pivot instead of a clipped red fragment.

## Critical invariants — do not regress

Audio preferences (2026-09-22): explicit input device/channel and successful output selections persist under `neuralwamp.audio-devices.v1` in localStorage. Startup resolves saved IDs against enumerated hardware, resets the channel for a replacement input, clamps it after probing, and restores an available output with system-default fallback. Missing devices do not erase stored preferences, so reconnecting them for a later session can restore the user's choices. Monitoring is never enabled by restoration. Storage failures and invalid JSON are tolerated. Device identity remains browser/origin-dependent.

Initial input follow-up (2026-09-22): after host initialization the initially selected device is now probed without monitoring, using the same channel-discovery function as a manual selection. The channel menu shows a disabled “Detecting channels…” placeholder until the result arrives, instead of implying a mono device. Failure displays “Channels unavailable” and the capture error; normal live activation re-enables the selector. Automated `?auto=1` runs skip the initial microphone probe.

UI follow-up (2026-09-21): choosing an input device with monitoring disabled now briefly opens a capture to negotiate its channel count, stops all tracks, and updates the channel menu without an audio connection. The NAM Main view now includes previous/next capture arrows around its photo, the selected filename and position beneath it, and boundary/loading disabled states. Navigation groups Factory and locally stored captures by tone identity and uses the active TONE3000 tone list for remote captures.

AudioBox follow-up (2026-09-21): capture now requests exact stereo when opening the selected device, rather than relying on an ideal constraint or reported capability maximum. Only an explicit channelCount overconstraint permits fallback on the same device; device/permission failures propagate. Stereo renegotiation is also attempted when capability data is missing or reports mono. The UI reports requested versus supplied channels and the negotiation error when capture remains mono. This is covered by simulated browser tests; physical AudioBox verification remains pending.

Device handling follow-up (2026-09-21): the main host clears stale channel choices on input changes and reports the actual negotiated channel count. SourceManager retries an exact stereo constraint when a mono stream exposes stereo capabilities, while retaining selected-channel-only routing. Output selections are serialized; devicechange errors are caught and interrupted audio attempts system-default sink selection followed by resume. A bounded recovery attempt exposes a Recover audio button if needed. If Chrome has permanently closed the context, the UI explicitly requests a page reload; automatic graph reconstruction is not implemented. Removing the selected input stops monitoring instead of opening an unrelated microphone. Tests pass 96/96, including mocked stereo renegotiation, mono devices, ordered sink changes, interrupted recovery and terminal closure. Actual PreSonus hardware hot-unplug verification is still needed.

### NAM

- A2 inference remains directly in the existing WAM AudioWorklet.
- Exactly one production AudioWorkletNode belongs to the NAM WAM.
- Preserve the WAM SDK `_process()` architecture and existing gain semantics.
- Keep catalog/network/DOM work outside the real-time process path.

### Cabinet

- Cabinet remains a separate reusable WAM.
- Exactly one production AudioWorkletNode belongs to Cabinet.
- Production convolution remains NeuralAmpModelerCore `nam::Linear`, not Web Audio `ConvolverNode`.
- IR decode/resampling and analysis stay outside the AudioWorklet.
- Level Match remains L2-based; per-IR Trim and Cabinet Output Gain remain independent.

### AUTO routing

- AUTO belongs to the host; Cabinet must remain NAM-independent.
- Manual ON/BYPASS overrides remain authoritative.
- Trusted detection is case-insensitive `metadata.gear_type === "full-rig"`, with only constrained full-rig label fallbacks.
- Model selection and state restoration must reevaluate AUTO.

## Intentional Phase 4b.2 limitations

- No Cabinet meter was invented because Cabinet currently exposes no corresponding meter signal; adding one would be DSP/API work.
- No new host master-output gain was added because the current graph has no master gain node and adding one would alter gain staging. Existing source trim and plugin output gains remain available.
- Real microphone permission, physical input/output switching, and listening tests were not exercised by the automated browser pass.
- The workspace is now a Git repository on branch `main`; no initial commit has been created yet. `.gitignore` excludes generated output, `dist`, third-party trees, unrelated prototypes, and local agent/editor metadata.

## Recommended next actions

1. Deploy the rebuilt `dist/NAM_A2_WAM/` to the VPS and hard-refresh the deployed page.
2. Verify the Phase 4b.2 layout and responsive behavior in Chrome/Firefox/Safari on the deployment URL.
3. Run the real TONE3000 Select Flow using the configured publishable client ID and exact redirect URI; verify callback, selected model download, cancellation, token refresh/error handling, and AUTO reevaluation.
4. Test live guitar, microphone/device switching, audible gain behavior, bypass, Level Match, clicks/dropouts, and rapid model/IR changes.
5. Before EndUserAmp2 integration, decide explicitly whether a Cabinet meter or a true host master gain requires new plugin/DSP APIs.
6. Integrate the reusable WAM modules into EndUserAmp2 only after the standalone static package remains stable.

## Explicitly out of scope unless requested

- Replacing the official TONE3000 API and OAuth flow with a custom catalog backend.
- Additional effects, pedalboard, tuner, delay, or reverb.
- Cabinet DSP redesign or extra AudioWorkletNodes.
- Service-worker/offline catalog mirroring. Only explicitly downloaded TONE3000 model files are persisted locally.
- Server-side credential handling in this static client.

## Phase 4b.3 limitations and validation notes

- The integrated catalog is implemented against the official TONE3000 endpoints, but a fresh authenticated live catalog test still requires the deployment client ID, registered redirect URI, and a normal browser session.
- The browser host does not reproduce the official JUCE native model cache; it downloads the selected model in the page, persists that requested file in IndexedDB, and passes its text to `NamNode.loadModelText`.
- TONE3000's full Select Flow opens in a popup and relays the callback to the unchanged host page; same-tab handling remains as a fallback. The post-login catalog itself is rendered inside the WAM GUI.
- Run `npm test` and `npm run dist` after changes. The new contract coverage checks the no-prompt login URL, official catalog endpoint/query shapes, Bearer authorization, and catalog GUI controls.
