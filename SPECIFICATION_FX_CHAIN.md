# NeuralWAMp — Integrated FX Chain

Status: serial chain, ergonomics and first two-chain implementation available. Browser routing and deterministic audio checks pass; physical two-input listening validation remains pending. Preset phase 7.2 remains on hold.
Updated: 2026-09-23

Each lane ends with a non-interactive **→ Output** indicator immediately after its final insertion `+`. It remains after the last effect as cards are added, removed or reordered, in both independent and split layouts.

## 1. Objective and scope

Integrate the WAM effects validated in `examples/wam/fx-test/` into the main host. Replace the permanently expanded NAM and Cabinet editors with a compact, left-to-right processing chain. Reuse the existing plugin registry, descriptors, categories and artwork resolution.

The current implementation has one serial chain. This increment improves editing and prepares per-chain inputs and endpoints. Section 11 now specifies the next increment: two independent inputs or one input split from chain A into chain B. Single-chain operation remains available. This revision is specification-only; do not implement until the proposed interaction has been reviewed. Do not start task 7.2 (presets).

## 2. Default view

```text
       bypass                  bypass
[+] [NAM model photo] [+] [Current IR photo] [+]
```

- Initially load the same default NAM capture and Cabinet IR as today.
- The body of each NAM/Cabinet box contains the current model/IR photo and its selected name below it, without embedded knobs. Effect boxes likewise show the effect name below the thumbnail. Use 10 px text on at most two lines, truncating overflow; the full name remains available on hover. Reserve caption space inside the unchanged 161 × 161 px frame and keep the whole image visible with `object-fit: contain`. Update the caption when the model/IR changes, in both lanes.
- The body of an effect box contains its descriptor thumbnail. Missing/broken artwork uses the existing deterministic fallback.
- A small toolbar above each box provides Active/Bypassed in 10 px text and an SVG trash button on its right. Confirm effect removal with the instance name and loss-of-settings warning; cancelling leaves DSP, state and editor unchanged. The controls must not open the editor. NAM/Cabinet retain the existing permanent-core restriction: their trash buttons are disabled with an explanatory tooltip.
- Bypassed cards remain clickable but look visibly dimmed, with a clear bypass indicator; do not rely solely on color.
- Small square `+` buttons appear before the first node, between every pair of nodes and after the final node. Every successful insertion adds another insertion point.
- Reduce the square photo frames by 30% on each axis: 230 × 230 px → 161 × 161 px. Keep 12 px internal padding around images and `object-fit: contain`. Only the middle effect strip scrolls horizontally. Keyboard access and focus indicators are required.
- Input and output endpoint panels remain outside the scrolling strip and sticky in the rack. Both are 193 px tall and 161 px wide, matching the cards including their toolbars. Each has a device selector at the top (plus the input channel selector), a small illuminated analogue-style needle meter (maximum 98 × 63 px), and a vertical gain fader with a numeric dB value. The scale measures RMS dBFS from −60 to 0, with a smoothed needle and a one-second peak clip lamp; it is not a calibrated hardware VU meter. Input and output share the same layout and alignment.
- Each endpoint has a Reset button: input returns to the source's default trim (file −18 dB / live 0 dB), output to 0 dB. Reset updates both the sound and the displayed value. Both faders span −48 to +12 dB and support keyboard control. Graph edits preserve gain.
- Move device and channel selection to the input endpoint of chain A. Show the mono channel explicitly when only one channel is exposed. Never invent unavailable inputs or enable monitoring by changing a menu.
- Each frame has a signal-reactive halo driven by its own incoming audio RMS, including while bypassed. Analyse L/R independently so opposite-phase stereo does not cancel the measurement. Use bounded animation updates, decay and suspended-context silence. A luminous inner border and outer glow vary in opacity with measured RMS. Their colour moves continuously from green (at or below −30 dBFS RMS) to orange (at or above −6 dBFS RMS). Any input sample peak at or above full scale (0 dBFS) overrides the halo to bright red for one second, even if RMS is low; red is reserved for clipping. Reduced-motion mode removes interpolation, not the signal indication. Analysis branches never feed the output.
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
- Drop a card onto another card to swap their positions (including first onto second). Drop onto a + insertion point to move before that position; the final insertion point appends. Auto-scroll near the strip edges. Provide Alt + Left/Right on focused cards as a keyboard equivalent. Move existing instances, preserving GUI, settings and bypass; serialize edits, validate IDs before changing the graph, and use the same short audio transitions as insertion/removal.
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

ON HOLD by user instruction (2026-09-22). Do not begin this task during the ergonomics/routing work. Existing state foundations and isolation tests remain; no factory/user preset catalogue, browser or persistence is added here.

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

Arbitrary graph editing, multiple cross-links, B → A links, multiple physical capture devices, complete preset-management UI, remote plugin installation/trust UI, MIDI mapping, latency compensation, tail-preserving bypass and CPU-budget automation. Absolute HTTPS catalogue references remain supported by the registry but this increment targets bundled, tested plugins.

## 11. Two chains and one A → B junction

**Specification prepared and first implementation completed 2026-09-23.** This section supersedes the exploratory routing outline from 2026-09-22. The existing ergonomics, lazy editors, per-instance isolation and manual live-input activation remain requirements. Section 7.2 stays on hold.

### 11.1 Proposed scope and audio meaning

By default show only chain A. A single clickable **1 / 2 chains** toggle (two-row icon, accessible label **Show chain B** / **Hide chain B**) reveals the second row below A in **Independent inputs** mode. No separate mode selector: connecting an A → B route selects split mode; disconnecting returns to independent mode. The button exposes its expanded state to assistive technology. Re-showing B restores its previous routing (independent input or retained split) and enables its output when the selected source is available.

- **Independent inputs**: A and B each select one available physical channel of the same input device. The capture service opens that device once and shares its channel splitter. Each lane has independent input trim, effects, bypass and output gain. There is no audio edge between the lanes. Different physical input devices are outside this increment.
- **A → B split**: one input feeds A. At a selected insertion point in A, the signal continues through the rest of A AND branches into the beginning of B. B's physical input is disconnected, not mixed with the branch. B's effects are applied once to the tapped signal. Both lane outputs then reach a common output bus.
- **Single chain** remains the starting/default topology, with no attenuation or hidden B monitoring added to the current sound.

**User-confirmed interpretation of the intersection (2026-09-23):** a parallel split, consistent with the earlier scenario, not a silent redirection of the whole A signal into B. A continues after the junction. There is one A → B junction, with B's head as its destination; arbitrary destinations inside B, return routes and feedback are deferred. A serial transfer that stops A is not requested.

```text
Independent inputs
Input 1 → [A gain/meter] → [NAM A] → [Cab A] → … → [A output] ─┐
Input 2 → [B gain/meter] → [NAM B] → [Cab B] → … → [B output] ─┴→ Main out

One input, A → B split (example: after Cabinet A)
Input 1 → [A gain/meter] → [NAM A] → [Cab A] → ● → [Delay A] → [A output] ─┐
                                             │                         │
                                             └→ [B gain/meter] → … → [B output] ─┴→ Main out
```

### 11.2 Proposed UI: two rows and a cable between them

- Keep 161 px photo cards, compact Active/Bypassed/trash toolbar, signal-coloured halos, analogue-style meters, vertical gain faders and Reset. Endpoint panels remain 193 px high. A and B have identical geometry and clear row labels.
- Arrange the rack as three columns: fixed input panels where applicable, one shared horizontally scrolling effects viewport containing BOTH rows, and fixed output panels. Both rows scroll together so cable anchors remain unambiguous. A narrow gutter between rows carries the route cable; do not draw it over photos or editor controls.
- Keep the input device selector shared, labelled **Input device** in the rack header. Each lane head exposes **Input channel**, its gain/meter and monitoring status. In split mode B's entire input panel disappears (device/channel dialogue, gain, meter and Reset); its space stays empty. Put **From A — after [plugin]** on the junction/cable instead. Retain B's former physical selection and independent input trim for a return to independent mode.
- Output device selection is also shared in the rack header: both lanes feed one AudioContext destination. Lane output panels control their own gain, meter and mute; no per-row device menu implying unsupported independent hardware destinations.
- A compact common output strip below the rack shows the selected output and **Mix −6 dB** when two lanes are active, with a final post-sum clip indicator. Avoid a third large meter panel.
- **Show chain B** enables its output using the selected available source. First opening uses independent inputs; subsequent openings restore the retained independent input or split. **Hide B** disconnects both its source and its output from the audio graph, so A alone receives and outputs the signal. Keep B instances, settings and the logical junction for reopening. No live capture is started by this toggle. No new preset actions.
- New B starts with its own fresh NAM/Cabinet pair and lazy GUIs, preserving the current core-module affordances. Creating B must not change A's assets. In split mode the user can bypass B's NAM/Cabinet if the split already carries an amp/cab signal; do not guess a musical processing choice or automatically bypass NAM.

### 11.2.1 Required horizontal offset in split mode

The route defines both an audio branching point and the visible start of B. If the route is between A2 and A3, B's first existing card is horizontally aligned with A3. B's second card follows it to the right. No B cards are deleted, skipped, bypassed, duplicated or replaced: the entire B list shifts right without changing its order, instances or settings.

```text
Before linking — two independent chains
Input A → [ A1 ] → [ A2 ] → [ A3 ] → [ A4 ] → Output A
Input B → [ B1 ] → [ B2 ] → [ B3 ]          → Output B

After linking at the + between A2 and A3
Input A → [ A1 ] → [ A2 ] → ● → [ A3 ] → [ A4 ] → Output A
                           │
                           └──→ [ B1 ] → [ B2 ] → [ B3 ] → Output B
          < empty below A1 and A2 >
```

- Under the A prefix there is no B input dialogue/panel, card, insertion button, placeholder tile or visible lane background. Keep only invisible layout spacing. The route descends at the selected gap and enters B immediately before B1.
- Compute the offset from the actual rendered junction position, including card widths and gaps, rather than fixed pixel estimates or plugin numbering. An end-of-A junction starts B at the next card position; a pre-A1 junction aligns B1 with A1. Only logical marker position is state; the pixel offset is derived layout.
- The first B insertion button moves with B1. All B controls remain reachable through the shared horizontal scroll. B's fixed output panel remains at the right; the offset does not create an extra source or output path.
- Moving the junction or reordering/inserting/deleting A-prefix cards recalculates the offset and cable. B's own card order is unaffected. Preview shows this shifted layout; Cancel restores the previous view.
- Disconnecting the route restores B's input panel and left-aligned independent layout, retaining all B effects and independent input preferences.

### 11.3 Interaction at the “+” insertion points

1. Hovering near an A `+` (or focusing it with the keyboard) reveals a small second action **↳ Route to B**, next to **+ Add effect**. Use a generous hit area with a short hover delay (~200 ms). The menu stays open while moving into its actions. Hover only previews: no graph edits or sound changes.
2. Clicking `+` keeps insertion accessible and exposes the route action in the same small action menu. On touch, a tap opens it; no hover-only command. Enter/Space opens it; Escape cancels and returns focus. The lower-row `+` buttons only offer effect insertion.
3. Selecting **Route to B** displays a dashed, labelled cable preview from that A slot to the head of B. Offer routing only while B is shown; otherwise indicate **Show chain B first** beside the routing action. Showing B is handled by the dedicated clickable icon, not implicitly by a hover. A small popover says **Split here: continue A + feed B** and offers **Connect** / **Cancel**. This makes the actual audio effect reviewable before changing it.
4. On Connect, prepare all missing instances first, then atomically replace B's source binding. With B already live, say explicitly that its physical input will be replaced. Never automatically activate previously disabled live capture. Connecting a route explicitly enables B using the existing A signal. Failed preparation leaves the previous graph intact.
5. The connected route is a solid SVG cable with a junction dot, arrowhead toward B, and label **A → B**. Distinguish it by shape and text as well as colour. If its anchor scrolls offscreen, show an edge stub and **Show junction** action; retain the source description on the cable/junction label.
6. With a link present, another A slot offers **Route to B here (replace existing route)**. Committing it atomically removes the previous cable/audio connection and connects the new slot; never create two simultaneous A → B links. For example, routing at A3/A4 after routing at A2/A3 removes the A2/A3 junction and shifts B1 from under A3 to under A4. No preliminary manual deletion is required. Cancelling the replacement preview leaves the original route intact. Selecting the cable or junction opens **Move junction…** / **Remove route**. Do not implement cable dragging or arbitrary graph editing in this increment.
7. **Remove route** (disconnect) keeps both chains visible, removes only the link and the horizontal offset, aligns B1 under A1, and restores B's input panel and leaves B muted with its saved physical-input choice visible. The user explicitly enables B to listen to that input again. A keeps its full serial route. Cancelling any preview preserves signal, editor and focus state.

### 11.3.1 Explicit state transitions

| Current state | User action | Result |
| --- | --- | --- |
| A only | Click **1 / 2 chains** | Show B, independent inputs, B1 aligned under A1; retained B effects/settings are reused. |
| A + independent B | Connect route at A2/A3 | A continues; B takes its source there, hides its input panel, B1 aligns under A3. |
| A + B routed at A2/A3 | Connect another route at A3/A4 | Replace the previous route; one cable remains and B1 aligns under A4. |
| A + routed B | **Remove route** on cable/junction | Keep A and B visible, independent inputs; B1 returns under A1 and its input chooser reappears. |
| A + B, with or without route | Click **1 / 2 chains** | Hide and disconnect B input/output; suspend any split while retaining its marker; A continues alone. Keep B instances/settings. |
| A only after hiding B | Click **1 / 2 chains** again | B reappears with its effects/settings and previous routing; its output is enabled if the source is available. |

The same button toggles both ways; hiding is not deletion of B. Removing a route is a separate operation and must never hide B. UI visibility does not itself grant permission to start live capture; the explicit activation rules still apply.

### 11.4 Source management, transitions and summing

- A capture session is owned by the device service, not by either lane. Route selected splitter outputs into lane inputs. Changing A's channel does not stop B or reopen the same device. Changing the shared device probes its actual channel count and updates both menus.
- Default to channels 1 and 2 only if both actually exist. If the interface exposes mono, show that fact and leave B unassigned/muted; never silently duplicate input 1. Selecting the same channel twice is permitted explicitly and labelled as a shared physical source.
- In split mode, feed B through a unity-gain branch connection with no hidden independent-input trim. Preserve stereo from the tap through B's input; only NAM/Cabinet apply the established explicit mono downmix. A's source trim is applied once before the shared prefix. Save B's independent trim separately and restore it when returning to independent mode; use the visible B output fader to balance the branch. Physical live inputs reset to 0 dB; file input A to −18 dB.
- Existing file playback can feed A and therefore an A → B split for testing and musical use. Independent mode initially supports two live channels, not two independent file players. An existing file does not silently become B's physical input.
- The branch tap is upstream of A's lane output gain/mute: muting A's final output does not silence B. B lane mute at its output stops the audible branch without affecting A. Prefix bypass affects both descendants; suffix bypass affects only its own lane.
- Sum the two stereo lane outputs exactly once into a shared mix node, then the chosen destination. With two enabled lanes, apply −6 dB at the mix node by default to limit the level increase from correlated signals. Keep user lane gains intact; ramp only the explicit mix compensation when enabling/disabling a lane. One enabled lane uses 0 dB mix compensation. Show compensation in the UI; it is not a limiter or a guarantee against clipping after boosted effects.
- Visible input meters remain post-input-gain in independent mode; B has no input meter panel in split mode. Output meters remain post-lane-output-gain. The final clip indicator observes the compensated sum. Retain green → orange halos and the one-second red peak indication.
- Serialize topology and editing operations. Use short gain ramps and prepare/validate before commit. No duplicate dry routes, feedback, destroyed shared nodes, automatic source activation or output gain resets. On failure retain the working graph and report the lane/stage.

### 11.5 Stable junctions and editing rules

- Model the junction as a persistent routing marker in A's ordered path, not as an array index or a DOM coordinate. Insertions/reorders on either side retain its identity. Moving a junction is an explicit route action.
- Dropping a card on another card swaps them within the same lane; dropping onto `+` inserts it there, as today. Moving across the marker changes whether that effect is in the shared prefix; the drawn order is the audio order.
- Deleting a neighbouring effect keeps the marker at the surviving gap. Inserting at the marker offers **Before split (A + B)** or **After split (A only)** rather than choosing an ambiguous side. First-slot and end-slot junctions are valid, including an otherwise empty effects path.
- Cross-lane plugin dragging is deferred in this increment. Reject it clearly rather than silently copying, moving core modules or linking audio. Editors remain per instance and open lazily; no shared GUI or mutable WAM state.
- Cabinet AUTO must be evaluated against its actual upstream path. Resolve the nearest active NAM before that Cabinet (including A's prefix for Cabinet B); a NAM after the junction on A is not upstream of B. With no upstream NAM, AUTO leaves Cabinet active. Refresh after asset, bypass, order and route changes. Never allow one lane's unrelated NAM to change another Cabinet.

### 11.6 Controller and state foundations, without presets

- Introduce a rack-level controller owning lane A/B, their stable endpoints, one optional junction, a shared output bus and a serialized edit queue. Source bindings are explicit: physical channel, file source for A, or A-junction for B. Rendering consumes snapshots/events; it must not own audio routing.
- Generalize the current one-core-pair assumptions: IDs for all instances are globally unique within the rack, including NAM/Cabinet. Creating B instantiates fresh plugins; changing mode reuses them. Scope model/IR callbacks, defaults, GUI caches and Cabinet routing to their instances.
- Use a new topology state version containing lanes, ordered instance IDs, marker position/identity, source-binding kinds, gain/mute values, mix compensation policy and per-plugin state. Migrate version 1 into single lane A. No hardware IDs in portable musical state; runtime/device preferences keep the actual input/output device and per-lane channel choices separately.
- Validate allowed source bindings, instance ownership, one A → B edge at most, and acyclicity before touching the working graph. Missing plugins remain recoverable dry placeholders with state retained. Restore does not enable live capture. Keep existing diagnostic save/restore usable with two lanes.
- No factory presets, preset browser, user preset storage, sharing or preset migration UI in this increment. These remain task 7.2.

### 11.7 Implementation sequence after specification review

1. Refactor controller/source ownership and core-instance identity while preserving the single-chain behaviour and tests.
2. Implement independent lanes with one shared device stream, per-lane channel selection, explicit enable/mute and compensated output sum.
3. Render two equal-height rows with fixed endpoint columns, shared horizontal scrolling and small analogue meters/faders/reset controls.
4. Implement the persistent junction, prefix/suffix graph partition, source replacement and path-aware Cabinet AUTO.
5. Add `+` proximity/focus actions, preview/Connect/Cancel, SVG cable, move/disconnect and keyboard/touch equivalents.
6. Add topology state versioning and validate the full source/static distribution. Keep 7.2 untouched.

### 11.8 Acceptance criteria

- Default UI shows only A. Clicking the chain icon reveals B in independent mode; hiding/re-showing preserves its effects and restores the previous routing with B enabled if its source is available.
- Create a route at A2/A3, then at A3/A4: assert exactly one cross-lane audio edge and one cable, with the old junction absent. Remove that route: assert two visible independent chains, B1 under A1, and B input selection restored. Toggle **1 / 2 chains** twice from either two-chain mode: B is disconnected and reappears with its effects intact and previous source routing active.
- Route between A2/A3: B1 aligns with A3, B2 shifts right, and the area below A1/A2 contains no B input panel, card or insertion button. Move the junction, resize, scroll, edit A prefix and disconnect; verify layout and DSP agree without losing B instances.
- Independent-channel test: feed different deterministic signals to physical channels 1/2. A and B select and process the intended signal with no crosstalk or accidental duplicate monitoring. Switching A's channel leaves B's capture and DSP alive.
- Shared-input test: split before the first effect, in the middle, and after the last effect. B receives exactly the upstream prefix once; A suffix remains audible only in A. Stereo taps remain stereo until an explicit mono core adapter.
- Verify identical branches with the displayed −6 dB mix compensation, lane mutes, input/output resets and final clip indication. A output mute must leave B active.
- Hover/focus/tap previews and cancellation never change audio. Connect/move/disconnect preserve running plugin instances, parameters, bypass, GUIs and unrelated lanes; stale async results cannot replace a newer topology.
- Test marker-relative insertion, deletion of either neighbour, first/last movement, keyboard swaps and source labels after every edit. Ensure the cable stays anchored during resize and horizontal scrolling, including offscreen stubs.
- Two independent NAM/Cabinet pairs must retain separate models, IRs and AUTO decisions. Check B inheriting A-prefix metadata in split mode and losing that inheritance in independent mode.
- Missing channel, unavailable device, plugin instantiation failure, capture cancellation and worklet failure must be visible and recoverable without feedback or automatic live activation.
- Hide and re-enable B without losing settings or leaking captures/analysers/listeners. Empty paths and disabled lanes must have explicit, tested signal semantics.
- Round-trip the new topology and migrate old version-1 diagnostic state; restored hardware bindings never enable live capture. Test source mode changes without confusing source-specific reset defaults.
- Run unit tests, real browser signal tests, static distribution/subpath checks and a hardware listening check. Verify both endpoint columns stay visible, meters remain small, and keyboard/touch operation works. No preset work is part of acceptance.

### 11.9 First implementation delivered — 2026-09-23

- `FxRack` owns both lane controllers, the single junction, shared edit queue, lane mutes and compensated output sum. B is instantiated lazily with its own NAM/Cabinet pair. Hiding B retains instances, settings and the logical route, but disconnects its source and output. Reopening restores the previous routing and enables the available B source.
- `FxRackView` supplies the 1 / 2 chains button, fixed input/output columns, shared horizontal scrolling, shifted B row and SVG route. A's insertion slots expose a companion route button on hover/focus (always available on touch), with preview/Connect/Cancel. Choose another slot to replace the route; click the cable label for Remove route or Show junction. B's input panel is hidden in split mode, including preview.
- `SourceManager` shares one capture splitter across the two independently selected channels. A channel changes do not reopen capture or disconnect B. B remains unassigned when input 2 is unavailable. Showing B or creating a split enables its output when the source is available. Removing a route still returns to independent inputs muted; **Enable B** is available for manual control. A file player can feed both branches through a split.
- The junction retains a stable identity and an adjusted logical gap index through insertion, deletion and moves. Inserting exactly at the junction offers Before split (A + B) or After split (A only). Dragging between lanes is rejected with a message; within-lane swapping and slot insertion remain available.
- Cabinet AUTO resolves its actual upstream NAM, including A's shared prefix, and refreshes for route/order/model/bypass changes. NAM editor bypass changes notify the host. Each branch retains independent plugin state and editors.
- Diagnostic save/restore uses rack state version 2, with version 1 migration, duplicate-ID/junction/gain validation and rollback. It does not start capture. Device/channel preferences are runtime settings and are not embedded in portable diagnostic state. This is not preset management.

Validation performed:

- `npm test`: **119 tests passed**, including isolated physical-channel bindings, junction replacement/removal, marker edits, instance retention, AUTO dependencies, state round trips and unavailable-channel handling.
- Browser OfflineAudioContext validation (`examples/wam/fx-test/rack-validation.html`): **6 scenarios passed** with numerical output checks — independent inputs, middle split, replacement by end split, A muted with B still audible, route removal and B hidden. Signals use separate deterministic input channels and known processing gains, with the real rack/chain graph controllers.
- Browser UI on the static distribution under `/dist/NAM_A2_WAM/`: show B, connect, replace, remove, hide and re-show verified. Separate NAM/Cabinet pairs load; the B input panel disappears/restores and the row follows the junction.
- `npm run dist` and `git diff --check` passed. Both new controller/view modules and the browser audio-validation page are included in the distribution.
- Fixed an audio transition issue discovered by offline testing: scheduled fade-out values are cancelled before fade-in, so graph edits made while an audio context is suspended cannot leave it permanently silent after startup.

Remaining validation/refinement: listening through a physical multichannel interface, broad touch/narrow-screen testing, and a dedicated offscreen cable stub. The route label currently stays reachable during scrolling and offers Show junction. Moving the junction is done through the new target slot rather than a separate Move junction command. Independent mode uses two channels from one device, not two devices or two file players. Latency compensation and cross-lane effect dragging remain deferred. **Task 7.2 (presets) has not been started.**

## 12. Revision trail

- **2026-09-22:** serial FX chain, lazy editors and per-instance state foundations; preset phase 7.2 deferred.
- **2026-09-22–23:** compact cards, confirmed removal, drag/swap plus insertion slots, input-reactive green/orange/red halos; fixed endpoints refined to analogue-style meters, vertical faders and source-aware Reset. Cabinet editor artwork now fits without cropping.
- **2026-09-23:** user requests the next pre-preset phase. Detailed specification for independent inputs and one A → B parallel junction; proposed UI exposes routing near A's `+` buttons, two stacked lanes and a visible cable. Documentation only; implementation has not begun.

- **2026-09-23, user clarification:** default A only; a clickable icon reveals B in independent mode. An A2/A3 junction keeps A running, hides the entire B input panel and shifts all existing B cards right so B1 starts under A3. The area under A1/A2 stays empty. Split semantics confirmed; specification updated only.

- **2026-09-23, routing interactions clarified:** a new A → B route replaces the old one; the same 1 / 2 chains button hides and re-shows B without deleting its effects. Removing the route alone keeps both rows visible, returns B1 under A1 and restores independent input selection. Explicit transition table added; no implementation yet.

- **2026-09-23, implementation authorized and delivered:** first two-chain rack, independent channels and replaceable parallel A → B junction implemented. B hide/show retains instances; disconnect restores independent input UI. Diagnostic state v2, path-aware Cabinet AUTO and tests added. See §11.9 for validation and remaining hardware checks; presets remain deferred.

- **2026-09-23, toggle audio behavior revised:** switching to one chain disconnects B at both input and output, retaining plugins/settings and any logical split. Switching back restores that routing and enables B when its source is available; the first opening remains independent. Connecting a split also enables B. No capture starts automatically and unavailable physical channels are never substituted. Regression tests cover independent/split hide/show and hidden-split diagnostic restoration. Disconnection prevents input signal processing in B; generic third-party AudioWorklets may still run on silent buffers, so this does not promise zero CPU usage.
