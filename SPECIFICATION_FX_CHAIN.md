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
- Give every instance a unique ID distinct from its catalogue ID. Multiple instances of the same WAM are a required host capability, with independent parameters, state, bypass and editors. A third-party plugin's own incompatibility must be reported as such; never impose one global instance per plugin or damage an existing instance.
- Offer removal of inserted effects in their editor toolbar, with safe graph reconnection and cleanup. NAM and Cabinet remain fixed core nodes in this first version; they can be bypassed but not deleted.
- Reordering/drag-and-drop is deferred; users choose placement with the insertion buttons.
- Keep the tuner out of insert menus. Its existing special analysis role is preserved; a dedicated top-bar tuner action is a follow-up, not a blocker for this increment.

## 4. Plugin editor

Clicking any box opens that running instance's full WAM GUI in an overlay/dialog. Initially allow one visible editor at a time.

The host toolbar above the GUI contains the plugin title, bypass control and close `×`; inserted effects also have a Remove action. Escape closes the editor, and focus returns to its originating box. Constrain oversized GUIs with scrolling without altering their internal canvas dimensions.

Create no GUI during plugin insertion, default initialization or project/preset restoration. Call `createGui()` only on the first editor request for that instance, then cache and reuse that same GUI on subsequent openings. Coalesce concurrent open requests into one creation promise per instance. Closing or switching editors hides the editor without destroying it, resetting parameters, changing bypass, restarting live input or rebuilding the AudioContext. Destroy the GUI through the WAM lifecycle only when removing/destroying its instance or explicitly recovering a broken editor. GUI creation failures leave audio and card bypass usable and allow a later retry.

NAM and Cabinet keep their existing tabs and functions inside their editors. Move default-asset loading, state restoration, routing decisions and callback handling out of GUI initialization. A hidden, eagerly created GUI is not an acceptable substitute for headless operation. The tuner lab's canvas issue is a regression case: mount/show editors in a lifecycle compatible with layout-dependent rendering.

### 4.1 Headless operation is a prerequisite

Code inspection on 2026-09-22 found that both `createAudioNode(initialState)` implementations initialize audio nodes and can call `setState` without creating a GUI. However, default NAM capture loading currently lives in `src/nam-wam/gui.js`, and default Cabinet IR loading lives in `src/cabinet-wam/gui.js`. The example host also reads routing mode from the Cabinet GUI. Thus the existing default-startup workflow is not yet GUI-independent; this finding is not a claim of validated headless audio rendering.

The implementation must establish the following contract before integrating the chain UI:

- A fresh NAM/Cabinet instance with no restored asset loads its default model/IR through a non-visual initialization service. This must work in another WAM host, not just via this example host's DOM.
- Supplied state wins over defaults. Initialization and restoration are awaited, ordered and idempotent; a delayed default fetch cannot overwrite a restored model or IR.
- All audio parameters, model/IR loading, metadata, asset artwork and state APIs remain usable without an editor. Expose current snapshots and change notifications instead of reading GUI DOM or private visual state.
- Cabinet routing mode belongs to serializable non-visual state. The host owns the NAM-to-Cabinet AUTO policy and applies it headlessly; a standalone Cabinet has no implicit knowledge of an unrelated NAM instance.
- First GUI creation hydrates from the running instance. It must not reload a default, reapply stale preferences or overwrite automated/restored values.
- Hidden editors must remain synchronized on reopening, with no duplicate listeners or accumulating animation loops. Pause purely visual work when hidden without pausing DSP.
- Model selection callbacks must target their originating instance explicitly, including when its GUI is absent or closed.

Headless here means audio instances without WAM editor creation in a browser host, not a promise of Node.js/server-side Web Audio support.

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

### 7.1 Per-instance isolation

- Persist state under project/preset identity plus chain-instance identity, never under plugin name, module ID, entry URL or catalogue ID alone. Two delays referencing the same module must retain different settings.
- Keep serialized chain IDs stable within a saved project. Allocate fresh runtime WAM instance IDs on restoration and map saved IDs to them. Duplicating a node creates a new chain ID and an independent deep copy of its state.
- Do not share mutable state objects, bypass wrappers, pending requests, GUI caches or automation routing between instances. Async load/save results must be checked against their target instance and lifecycle generation.
- Shared immutable code, compiled WASM and content-addressed model/IR bytes may be cached globally. Mutable playback state, calibration, model variant, gains and IR trim remain instance-specific.
- Library favorites/download caches and account authentication may be shared conveniences; they must not implicitly overwrite running instance settings or saved presets. Deleting shared assets must respect preset references or report missing assets explicitly.
- Saving a preset captures each instance's complete WAM state and host-owned controls. Restoring it must not consult one plugin-wide "last used state" in preference to the saved instance data.

### 7.2 Next phase — Factory and user presets

Preset management is explicitly the next development phase after the serial chain, not a backend prerequisite. Its state foundations and isolation tests are required now.

- Provide a host-side `presets.js` exporting the ready-to-play factory preset catalogue, copied into the static distribution. Each record has a stable preset ID, schema version, name, optional description/tags/artwork and a complete chain state or bundled state reference.
- Factory presets use portable bundled plugin/model/IR references, not developer-specific absolute URLs, expiring download URLs, local database keys or credentials. Referenced assets must ship with the distribution, with redistribution rights verified.
- Factory presets are read-only templates. Editing one changes the current project; saving creates a user preset, without modifying the shipped definition. Instantiating a template creates independent runtime instances.
- Store user presets locally at first, preferably in IndexedDB for structured states and model/IR binary assets. localStorage may hold small preferences/index metadata; do not put large model/IR payloads there by default. Keep the storage adapter separate so a backend can be added later.
- User preset management will include create/save, rename, load and delete, with explicit overwrite behavior. Deleting one preset must not delete assets still referenced by another.
- Clearly explain that browser storage is scoped to the origin/profile and can be cleared or evicted; it is not cross-device backup. Localhost and mainline do not automatically share presets. Export/import is a desirable follow-up for portability.
- Define version migration, missing-plugin/asset diagnostics and recoverable restore behavior. No preset contains API tokens or device IDs, and loading one never implicitly enables live input.

## 8. Suggested implementation sequence

1. Decouple NAM/Cabinet initialization, defaults, metadata and state from GUI creation; validate headless startup and restore first.
2. Extract/reuse registry cards and the working editor lifecycle from the FX lab, adapting it to per-instance lazy GUI caching without changing the lab's isolated behavior.
3. Introduce a serial chain controller with tests for insertion, removal, bypass, cleanup and failure rollback.
4. Connect the existing source, NAM and Cabinet through that controller, preserving AUTO and device management.
5. Add the compact chain strip, synchronized artwork, insertion menus and shared editor dialog.
6. Add multi-instance state round-trip coverage, distribution checks and browser/audio validation, ready for the subsequent factory/user preset phase.

## 9. Acceptance and validation

- Initial UI has exactly the two core photo boxes and three insertion buttons; default assets and Cabinet AUTO work before opening an editor.
- Effects can be inserted before NAM, between NAM/Cabinet, or after Cabinet, in the displayed audio order.
- Menus use catalogue categories; missing thumbnails and one incompatible plugin do not break other entries.
- New effects are active; bypass is synchronized with the editor toolbar. Closing/reopening editors preserves sound and settings.
- Opening NAM/Cabinet editors preserves factory, favorites, external and TONE3000 loading and updates chain images.
- Test graph connectivity and cleanup with mocks; test real bundled effects with deterministic audio, including a stereo delay after Cabinet and explicit downmix before NAM.
- Test repeated instances, rapid insertions, removal while an editor is open, failed imports/GUI creation and state restore.
- Run real NAM and Cabinet audio tests without ever calling `createGui()`: fresh defaults, supplied state, parameter changes, asset changes, serialization and destruction. Confirm default assets and processed non-silent audio, not merely successful node construction.
- Spy on GUI creation: zero calls at startup/insertion/restore, one at first opening per instance, no additional call on close/reopen. Confirm first opening leaves the audio state and loaded assets unchanged.
- Create two instances of the same effect with different settings and bypass. Save, mutate, restore, reopen both editors and verify each retains its own values. Delete one and confirm the other's DSP, stored state and editor still work. Apply the same isolation checks to multiple NAM/Cabinet instances, even though the first chain UI exposes only one of each.
- Test concurrent restoration/default fetches and rapid editor open/close so stale operations cannot replace a restored asset or cross instance boundaries.
- In the subsequent preset phase, test two presets containing repeated plugin types, factory-to-user save, local database round trips, missing assets, schema migration and asset reference retention after deletion.
- Check no duplicate audio path, NaN/Infinity, unexpected gain jumps or automatic live-input activation. Listening/hardware checks are required beyond unit tests.
- Test keyboard navigation, Escape/focus return, narrow screens and layout-dependent plugin canvases.
- Run `npm test` and `npm run dist`; verify the main host and `/fx-test/` from both source and static distribution, including deployment under a subpath.

## 10. Explicitly deferred

Two lanes, split/merge routing, arbitrary graph editing, drag-and-drop, complete preset-management UI, remote plugin installation/trust UI, MIDI mapping, latency compensation, tail-preserving bypass and CPU-budget automation. Absolute HTTPS catalogue references remain supported by the registry but this increment targets bundled, tested plugins.
