# NeuralWAMp — Integrated FX Chain

Status: specification only; implementation has not started.
Date: 2026-09-22

## 1. Objective and scope

Integrate the WAM effects validated in `examples/wam/fx-test/` into the main host. Replace the permanently expanded NAM and Cabinet editors with a compact, left-to-right processing chain. Reuse the existing plugin registry, descriptors, categories and artwork resolution.

This first increment has one serial chain. The previously discussed two-lane routing with a single split/merge region remains a later phase. No audio-processing implementation is part of this specification commit.

## 2. Default view

```text
       bypass                  bypass
[+] [NAM model photo] [+] [Current IR photo] [+]
```

- Initially load the same default NAM capture and Cabinet IR as today.
- The body of each NAM/Cabinet box contains only the current model/IR photo, without embedded knobs, metadata or filenames. Keep the whole image visible with `object-fit: contain`.
- The body of an effect box contains its descriptor thumbnail. Missing/broken artwork uses the existing deterministic fallback.
- A small toolbar above each box provides bypass, with an accessible plugin name/tooltip. The bypass control must not open the editor.
- Bypassed cards remain clickable but look visibly dimmed, with a clear bypass indicator; do not rely solely on color.
- Small square `+` buttons appear before the first node, between every pair of nodes and after the final node. Every successful insertion adds another insertion point.
- Preserve readable box sizes on narrow screens using horizontal scrolling rather than shrinking all boxes indefinitely. Keyboard access and focus indicators are required.
- Update NAM/Cabinet artwork immediately after a model or IR change, including changes from TONE3000, factory navigation or restored state.

## 3. Inserting effects

Clicking `+` opens a categorized menu anchored to that insertion point. Categories come from the normalized registry: Dynamics, Drive, Filter/Wah, Modulation, Delay, Reverb, Stereo/Utility and Other. Hide empty categories. Show names and thumbnails; search by name/tags is desirable.

`wamPlugins/plugins.json` remains authoritative. Resolve relative URLs from the catalogue location and reuse descriptor-relative thumbnail resolution. Do not scan folders at runtime or hardcode a second catalogue.

Selecting an effect creates a fresh instance at that position. For example:

```text
Source → Overdrive → NAM → Cabinet → Chorus → Delay → Output
```

- New effects start active (bypass OFF).
- Disable duplicate submission while an insertion is loading. Show loading/error state at the selected slot.
- Instantiate successfully before changing the working chain; on failure retain the previous graph and report the failing plugin/stage.
- Give every instance a unique ID distinct from its catalogue ID. Repeated instances are allowed only where the plugin supports them; report incompatibility without damaging the existing instance.
- Offer removal of inserted effects in their editor toolbar, with safe graph reconnection and cleanup. NAM and Cabinet remain fixed core nodes in this first version; they can be bypassed but not deleted.
- Reordering/drag-and-drop is deferred; users choose placement with the insertion buttons.
- Keep the tuner out of insert menus. Its existing special analysis role is preserved; a dedicated top-bar tuner action is a follow-up, not a blocker for this increment.

## 4. Plugin editor

Clicking any box opens that running instance's full WAM GUI in an overlay/dialog. Initially allow one visible editor at a time.

The host toolbar above the GUI contains the plugin title, bypass control and close `×`; inserted effects also have a Remove action. Escape closes the editor, and focus returns to its originating box. Constrain oversized GUIs with scrolling without altering their internal canvas dimensions.

Closing or switching editors must not destroy the audio instance, reset parameters, change bypass, restart live input or rebuild the AudioContext. Reuse the GUI when feasible; if a GUI is disposed, use the WAM GUI lifecycle and recreate it from the same live instance. GUI creation failures leave audio and card bypass usable.

NAM and Cabinet keep their existing tabs and functions inside their editors. Preserve GUI initialization required for default assets, OAuth callbacks and host routing even when no editor is visible. The tuner lab's canvas issue is a regression case: mount/show editors in a lifecycle compatible with layout-dependent rendering.

## 5. Bypass semantics

- Third-party effects use a host-controlled dry/wet bypass wrapper, independent of vendor-specific parameter names. Switching uses short gain ramps to reduce clicks; never leave an unintended permanent parallel dry path.
- Closing a GUI is not bypass. A plugin's own internal bypass, if exposed, may still affect its output; do not guess at vendor-specific mappings.
- NAM uses its existing bypass parameter, synchronized between card and GUI.
- Cabinet uses its existing parameter and routing policy. AUTO bypasses amp+cab/full-rig captures; ON and BYPASS are explicit overrides. A manual card toggle selects ON or BYPASS through the same routing controller. AUTO can be restored in Cabinet Settings.
- Card appearance reflects the effective Cabinet bypass, including automatic changes after a NAM model load. Expose the routing mode/reason in a tooltip or accessible description.
- Initial effect bypass cuts the wet output, including tails; tail-preserving bypass and latency compensation are deferred and must not be implied.

## 6. Audio architecture and safety

Introduce a host-owned chain controller and ordered instance model, separate from the UI. Use the existing AudioContext and WAM group. The source manager feeds a stable chain input instead of connecting directly to NAM; the chain terminates at a stable output connected to the selected destination.

- Remove the old direct NAM → Cabinet → destination route when activating the controller: no duplicate monitoring, loops or feedback connections.
- Serialize graph edits and discard obsolete async insertion results. Build only valid acyclic serial routes, with short transitions to reduce discontinuities. AudioWorklet failure should expose a recoverable error and a dry bypass where possible.
- Preserve input device/channel selection, explicit live Enable/Disable, source trim, output-device recovery and audio-file playback.
- Preserve stereo after stereo-producing effects. NAM/Cabinet currently process mono: define an explicit stereo-to-mono adapter when required before these nodes, using a documented L/R average; do not silently select only the left channel. Their mono output can feed later stereo effects.
- Host bypass must preserve the appropriate channel layout. No latency-compensated wet/dry mixing is promised.
- Destroy only removed instances and their GUIs; release graph connections and listeners. Keep the core instances alive across editor visibility changes.
- Do not automatically enable live monitoring or raise output levels while inserting effects.

## 7. State

Define a versioned serializable chain state containing ordered unique instance IDs, plugin references, host bypass and each plugin's WAM state. Include core NAM/Cabinet states and Cabinet routing mode. Store bundled plugin references relative to the catalogue where possible for local/mainline portability.

Keep audio-device preferences separate from musical chain state. Never restore live monitoring automatically. GUI visibility is not DSP state. Prepare save/restore APIs and tests in this phase; a complete preset browser, automatic persistence of potentially large model/IR blobs and preset sharing are deferred.

Restore failures must identify missing/incompatible plugins without corrupting the remaining chain. A recoverable placeholder retains unavailable state and behaves as dry bypass. Do not silently discard user settings.

## 8. Suggested implementation sequence

1. Extract/reuse registry cards and the working editor lifecycle from the FX lab without changing the lab's isolated behavior.
2. Introduce a serial chain controller with tests for insertion, removal, bypass, cleanup and failure rollback.
3. Connect the existing source, NAM and Cabinet through that controller, preserving AUTO and device management.
4. Add the compact chain strip, synchronized artwork, insertion menus and shared editor dialog.
5. Add state round-trip coverage, distribution checks and browser/audio validation.

## 9. Acceptance and validation

- Initial UI has exactly the two core photo boxes and three insertion buttons; default assets and Cabinet AUTO work before opening an editor.
- Effects can be inserted before NAM, between NAM/Cabinet, or after Cabinet, in the displayed audio order.
- Menus use catalogue categories; missing thumbnails and one incompatible plugin do not break other entries.
- New effects are active; bypass is synchronized with the editor toolbar. Closing/reopening editors preserves sound and settings.
- Opening NAM/Cabinet editors preserves factory, favorites, external and TONE3000 loading and updates chain images.
- Test graph connectivity and cleanup with mocks; test real bundled effects with deterministic audio, including a stereo delay after Cabinet and explicit downmix before NAM.
- Test repeated instances, rapid insertions, removal while an editor is open, failed imports/GUI creation and state restore.
- Check no duplicate audio path, NaN/Infinity, unexpected gain jumps or automatic live-input activation. Listening/hardware checks are required beyond unit tests.
- Test keyboard navigation, Escape/focus return, narrow screens and layout-dependent plugin canvases.
- Run `npm test` and `npm run dist`; verify the main host and `/fx-test/` from both source and static distribution, including deployment under a subpath.

## 10. Explicitly deferred

Two lanes, split/merge routing, arbitrary graph editing, drag-and-drop, complete preset-management UI, remote plugin installation/trust UI, MIDI mapping, latency compensation, tail-preserving bypass and CPU-budget automation. Absolute HTTPS catalogue references remain supported by the registry but this increment targets bundled, tested plugins.
