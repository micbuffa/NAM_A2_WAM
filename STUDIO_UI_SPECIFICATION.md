# Studio UI — compact workspace and appearance

Branch: `codex/studio-integration`. Scope: the guitar/bass studio, its Tone round trip and shared host UI. No DAW regions, new audio engine or change to separation/recording algorithms.

## Goals and layout

Studio should use the available viewport rather than grow into a long document. Keep the musical task visible: project, transport, tracks and active operation. Secondary configuration belongs in accessible dialogs. Retain existing capabilities and keyboard shortcuts.

```mermaid
flowchart TB
  A[Host bar: Tone / Studio · account · settings] --> B[Project bar: name · Undo / Redo · Import · Add · Save]
  B --> C[Transport: Play / Stop · Record · Master · time · Loop A/B]
  C --> D[Track viewport: compact headers · waveform lanes · ruler]
  B --> E[Import / separation dialog: file or YouTube · destination · model / backend · duration]
  E --> F[Slim progress strip · Stop separation]
  F --> D
  A --> G[Settings: audio · appearance · recording calibration · advanced]
  D --> H[Per-track Input / Monitor / Arm / FX]
```

Desktop target: 1280×720 and larger at 100% zoom; comfortable at 1440×900. Header and transport remain visible. Track area consumes remaining height with internal vertical scrolling when necessary; horizontal scrolling is reserved for timeline zoom. Never shrink indefinitely to show arbitrary track counts. At small viewports, high zoom or large text, prioritise access and readable controls over strict no-scroll. Dialogs may scroll internally. No page-wide overflow hiding that makes controls inaccessible.

## Task 1 [DONE] — shared appearance foundation

Offer Dark (existing default), Studio Light (soft grey/white, teal accent), Warm Studio (ivory/sand, blue accent) and Follow system (Dark or Studio Light). Selection in Settings → Appearance applies immediately to Tone, Studio and host dialogs and is stored locally, separate from projects/presets/history. No account write. Follow system responds to OS changes only when selected. Invalid/unavailable storage falls back safely to Dark; same-browser tabs observe preference changes. Restore before body paint to avoid a flash of the wrong palette.

Use semantic design tokens inherited through host web-component shadow roots. Use dark readable waveforms on light clips, visible playhead/loop borders, distinct recording red and meter states. Redraw cached waveform envelopes once when appearance changes; never restart transport, re-decode PCM, recreate audio graphs or dirty the project. Third-party WAM GUIs may retain their own styling. Plugin pedal artwork and recording colours retain their meaning.

Acceptance: all four modes selectable by keyboard; persisted reload; live system-mode changes; storage-denied fallback; light/warm host dialogs, controls, waveforms and Tone shell remain readable. Tests cover preference lifecycle, UI wiring, packaging and token contrast. Browser QA covers actual Rails Settings and Studio/Tone rendering. This task does not yet implement the compact layout.

## Task 2 [TODO] — viewport workspace and compact project/transport bars

Separate fixed host/project/transport bars from the flexible track viewport. Combine project operations into one row, preserve master and A/B controls, reduce default gaps. Collapsible sidebar with project library remains discoverable and remembers local preference. Let narrow widths wrap or collapse labels with accessible names. Keep import, Save and transport available without page scrolling on target desktop sizes.

Tests: viewport geometry for empty / 4 / 6 / many tracks, expanded/collapsed sidebar, zoom and keyboard focus; transport/recording operation unchanged. Verify no lost or hidden controls at 200% zoom.

## Task 3 [TODO] — dialogs for separation and secondary configuration

Move remaining bulky separation options to the existing import/separation workflow; retain model/backend/duration and advanced choices. Default full song. Keep a slim visible progress/status strip with Stop while separation runs, even with dialog closed. Reopening shows the current operation. Audio devices and calibration remain reachable from Settings; retain confirmation and monitoring-isolation behaviour.

Tests: all import sources, current/new project, direct WebNN eligibility, cancel/change model, partial mix, pending recording guards and focus return. Closing configuration must not cancel audio or separation implicitly.

## Task 4 [TODO] — compact track headers and recording controls

Move selected-track Input/Monitor/Arm into appropriate personal-track headers; use the shared transport Record/Stop. Remove redundant large recording panel only after parity. Track headers retain name, meter, volume, pan, Mute/Solo, FX, delete and accessible overflow actions. Provide comfortable/compact density and track height where useful. Accompaniment/stems never acquire editable personal-part presets accidentally.

Tests: arm eligibility, live vs playback meters, monitor safety, recording waveform append, delete confirmation/undo, FX round trip, empty/saved/read-only tracks. No additional PCM copies or change to latency compensation.

## Task 5 [TODO] — responsive/accessibility and end-to-end qualification

Keyboard, focus rings, tooltips, reduced motion and contrast across themes. Verify Studio ↔ Tone, save/restore, file/YouTube import, separation/Stop/partial mix, recording/calibration and FX editing. Test target desktop sizes and smaller screens, no focus traps outside dialogs, recording and separation under load. Rebuild dist and sync Rails; update README and HANDOFF with exact tests and remaining hardware/browser qualifications.

## Validation record — Task 1

Results are recorded in HANDOFF after the final regression run. Native WebNN inference and physical audio latency are outside this visual task; no new performance claim follows from UI tests.
