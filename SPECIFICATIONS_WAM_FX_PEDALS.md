# WAM FX Pedals and Routing — Specifications

This document defines the incremental plan for adding third-party Web Audio Module effects to the NeuralWAMp host. The first phase deliberately focuses on discovery, validation, compatibility reporting, and isolated testing. It does not yet alter the production NAM/Cabinet signal chain.

## Phase 1 — Creation of the WAM Plugin Registry and Tests

### 1. Objectives

Phase 1 shall provide a reliable registry for locally bundled and, later, remotely hosted WAM plugins. It shall answer the following questions before a plugin can be offered in the future pedalboard UI:

- Where is the plugin JavaScript entry point?
- Can its descriptor be found and parsed?
- Are its identifier, name, category, thumbnail, audio capabilities, and API version usable?
- Can the module be imported and instantiated in the current WAM host environment?
- Can its audio node be connected, process audio, bypassed by the test host, and destroyed without leaking graph connections?
- Can its GUI be created, shown, hidden, and removed safely?
- Can its state be saved and restored?
- If a plugin fails, can the host report a useful error without affecting other plugins?

The result of this phase shall be a tested plugin registry and a small dedicated test host. Production routing, dual lanes, drag-and-drop pedals, presets for complete chains, and remote-plugin installation are explicitly deferred.

### 2. Bundled directory layout

Bundled plugins live below the host directory:

```text
examples/wam/
└── wamPlugins/
    ├── plugins.json
    ├── AutoWahMB/
    ├── deathgate/
    ├── faustPingPongDelay/
    ├── tuner_machine/
    └── ...
```

Each plugin remains in its own directory so that module-relative imports, worklet modules, WebAssembly files, styles, images, and descriptor-relative thumbnails continue to resolve.

The static distribution shall preserve the same relative layout below:

```text
dist/NAM_A2_WAM/wamPlugins/
```

Only files required at runtime should eventually be copied to the distribution. Runtime trimming and SDK deduplication are optional optimizations and are not acceptance requirements for Phase 1.

### 3. `plugins.json` catalogue

`wamPlugins/plugins.json` is the source of authority. Runtime code must not depend on HTTP directory listings or recursively probe arbitrary server folders.

The catalogue accepts both a short string form and an extended object form:

```json
{
  "version": 1,
  "plugins": [
    "./deathgate/index.js",
    "./faustPingPongDelay/plugin/index.js",
    {
      "uri": "./tuner_machine/src/index.js",
      "descriptor": "./tuner_machine/src/descriptor.json",
      "role": "tuner",
      "category": "tuner"
    }
  ]
}
```

Rules:

- Relative URIs are resolved against the URL of `plugins.json`, never against the current page URL.
- Absolute `https:` URIs are valid catalogue syntax but remote execution is not required during Phase 1.
- Duplicate normalized entry-point URLs are rejected or collapsed deterministically.
- The object form may override incomplete descriptor metadata without modifying third-party sources.
- Unknown object properties are preserved where possible so the schema can be extended later.
- Invalid entries produce individual diagnostics and do not invalidate otherwise valid entries.

A development-time catalogue generator may search each immediate plugin directory for entry points in this order:

1. `<plugin>/index.js`
2. `<plugin>/src/index.js`
3. `<plugin>/plugin/index.js`

If zero or several plausible entry points remain, generation must fail for that plugin and request an explicit catalogue entry. Runtime loading never performs this search.

### 4. Descriptor discovery and URL resolution

The registry must obtain metadata before presenting the plugin in a menu. Descriptor resolution follows this order:

1. explicit `descriptor` URL in the catalogue entry;
2. `descriptor.json` beside the JavaScript entry point;
3. a descriptor exposed by an imported/instantiated WAM, only as a validation fallback.

Every descriptor-relative resource, especially `thumbnail`, is resolved against the descriptor URL:

```text
resolvedThumbnail = new URL(descriptor.thumbnail, descriptorURL)
```

The registry must tolerate incomplete legacy descriptors. Missing optional fields do not prevent catalogue display, but missing runtime-critical information is reported by validation.

Normalized registry records include at least:

- stable registry ID;
- entry-point URL;
- descriptor URL;
- WAM identifier, when present;
- name and vendor;
- description and version;
- WAM API version;
- normalized category;
- normalized lower-case tags;
- resolved thumbnail URL or a generated fallback;
- instrument/effect classification;
- declared audio and MIDI input/output capabilities;
- special role such as `tuner`;
- origin (`bundled` or `remote`);
- validation status and diagnostics.

### 5. Categories and tags

The initial normalized category vocabulary is:

- `tuner`
- `dynamics`
- `drive`
- `filter-wah`
- `modulation`
- `delay`
- `reverb`
- `stereo-utility`
- `amplifier`
- `cabinet`
- `other`

Category selection uses the following precedence:

1. catalogue `category` override;
2. descriptor `category`;
3. recognized descriptor keywords;
4. conservative inference from name and description;
5. `other`.

Generic implementation tags such as `faust`, `effect`, `audio`, and `guitar` must not become primary categories. Original keywords remain available as searchable tags.

The sample plugin set should initially normalize as follows:

| Plugin | Category |
| --- | --- |
| DeathGate | Dynamics |
| TS9 Overdrive | Drive |
| AutoWahMB / SweetWah | Filter / Wah |
| Chorus / StonePhaser | Modulation |
| Faust PingPongDelay | Delay |
| Grey Hole | Reverb |
| Stereo Enhancer | Stereo / Utility |
| TunerMachine | Tuner |

### 6. Compact presentation

The test host displays registry entries as compact cards containing:

- thumbnail or deterministic fallback artwork;
- plugin name;
- vendor;
- category;
- selected tags;
- compatibility/validation status;
- `Load` action;
- concise diagnostic action when validation fails.

Clicking a loaded plugin card or thumbnail opens its full GUI in a separate editor area or dialog. Closing the GUI hides/removes only the DOM representation; it must not destroy the running audio instance. The card must remain usable when `createGui()` fails.

Broken or absent thumbnail resources must never prevent plugin loading.

### 7. Dedicated mini test host

Phase 1 adds a development-only mini host, separate from the production NAM/Cabinet host. Its purpose is to validate one effect at a time with a transparent audio graph:

```text
Selected source → input meter → selected WAM → output meter → destination
                        └──────── bypass path ────────┘
```

The mini host provides:

- live input and test-file source selection;
- explicit Enable/Disable live-input control;
- plugin catalogue grouped by normalized category;
- search by name, vendor, category, and tags;
- load/unload of one plugin instance;
- host-level bypass implemented independently of plugin-specific parameters;
- input and output level meters;
- GUI show/hide control;
- state save/restore controls;
- parameter enumeration display;
- clear status and error console;
- a deterministic test signal suitable for automated validation;
- cleanup verification after unload.

The mini host must continue operating after an individual import, descriptor, instantiation, GUI, or state failure.

### 8. Tuner behavior

Plugins marked with `role: "tuner"` are presented separately from insert effects. The future production host will expose the tuner through a tuning-fork icon in the top bar.

The Phase 1 mini host validates the tuner using a parallel analysis branch rather than treating it as a tone-shaping pedal:

```text
source ──┬──→ normal monitored signal
         └──→ tuner instance/analyser
```

Opening and closing the tuner GUI must not start, stop, reconnect, or mute the main signal. Only one tuner instance is required per host.

### 9. Compatibility and security rules

The registry must treat descriptors as untrusted metadata and plugin modules as executable code.

- JSON parsing failures are isolated per entry.
- Descriptor text is rendered as text, never injected as HTML.
- Only `http:` is accepted for local development; deployed remote entries require `https:`.
- Remote modules will later require explicit user/admin trust, CORS-compatible module delivery, and accessible secondary assets, worklets, and WASM files.
- A successful descriptor fetch does not imply that a plugin can be imported or instantiated.
- Import and instantiation errors include the failing URL and stage while avoiding exposure of private state.
- The registry records WAM API-version differences and reports unsupported combinations.

Phase 1 does not promise compatibility with every historical WAM. It must distinguish `catalogued`, `descriptor-valid`, `importable`, `instantiable`, `GUI-valid`, `audio-valid`, and `state-valid` results.

### 10. Known sample-catalogue issues to cover

Tests and diagnostics must cover the issues already observed in the bundled sample set:

- descriptor fields and WAM API versions are inconsistent;
- several descriptors omit `identifier`, audio capabilities, or useful category tags;
- AutoWahMB has no descriptor thumbnail;
- TunerMachine declares `WasabiTuner.png`, while the current file is under `Gui/WasabiTuner.png`;
- DeathGate, Grey Hole, SweetWah, and Stereo Enhancer currently import SDK modules from paths that do not exist in their new location;
- several plugins contain private SDK copies while others depend on shared `wamPlugins/utils` files;
- a generic `faust` keyword is insufficient for musical categorization.

The mini host should expose these as actionable compatibility diagnostics rather than fail at page initialization.

### 11. Automated tests

#### Catalogue and registry unit tests

- parse string and object entries;
- resolve relative URLs against `plugins.json`;
- preserve absolute URLs;
- reject unsafe or malformed protocols;
- handle duplicate entries deterministically;
- isolate malformed records;
- resolve explicit and adjacent descriptors;
- normalize missing and inconsistent descriptor fields;
- normalize tags case-insensitively;
- apply category precedence and fallbacks;
- resolve thumbnails relative to the descriptor;
- provide fallback artwork when a thumbnail is missing or fails;
- recognize the tuner role;
- produce stable serializable registry records.

#### Plugin lifecycle integration tests

For every bundled catalogue entry that is expected to be compatible:

- fetch descriptor;
- dynamically import the entry module;
- create a plugin instance in an initialized WAM group;
- create and connect its audio node;
- process a deterministic signal without `NaN`, `Infinity`, processor errors, or silence when pass-through is expected;
- create and remove its GUI;
- enumerate parameters;
- save and restore state;
- disconnect and destroy the instance;
- verify that another plugin can subsequently be loaded.

Known incompatible samples may initially use explicit expected-failure assertions. Expected failures must name the exact incompatibility and must be removed when the plugin is repaired.

#### Mini-host browser tests

- all valid registry cards render;
- categories and search filter correctly;
- failed plugins show diagnostics without breaking other cards;
- loading a plugin updates the active card and editor;
- bypass compares processed and dry paths;
- GUI show/hide does not recreate the audio instance;
- unload removes GUI and audio connections;
- tuner opens from its dedicated control and leaves the main signal uninterrupted;
- live input remains disabled until explicitly enabled and is fully stopped when disabled.

#### Distribution tests

- `npm run dist` copies `plugins.json` and all referenced bundled runtime assets;
- every relative catalogue and descriptor URL resolves in `dist/NAM_A2_WAM/`;
- every declared thumbnail either resolves or intentionally uses fallback artwork;
- no catalogue entry accidentally points back into the source tree;
- the mini host can run from the static distribution without a development-only API.

### 12. Phase 1 deliverables

- versioned `wamPlugins/plugins.json`;
- registry loader and metadata normalizer;
- category/tag inference with catalogue overrides;
- compatibility validator with per-stage diagnostics;
- compact plugin-card component;
- dedicated WAM effect mini host;
- special tuner discovery and test presentation;
- unit, integration, browser, and static-distribution tests;
- short developer documentation explaining how to add and validate a bundled plugin.

### 13. Acceptance criteria

Phase 1 is complete when:

1. The registry loads entirely from `plugins.json` and does not require directory listing support.
2. A malformed or incompatible plugin cannot prevent other plugins from loading.
3. Every bundled sample has either a passing lifecycle test or an explicit, actionable expected-failure diagnostic.
4. Compatible effects can be loaded, heard, bypassed, inspected, state-restored, and unloaded in the mini host.
5. The tuner can be opened as a dedicated utility without interrupting the monitored signal.
6. Compact cards use descriptor thumbnails when valid and fallback artwork otherwise.
7. The generated static distribution contains a self-consistent plugin catalogue and all referenced bundled assets.
8. Existing NAM, Cabinet, TONE3000, live-input, and distribution tests continue to pass.

## Deferred phases

The following are intentionally outside Phase 1:

- inserting effects into the production NeuralWAMp host;
- dual processing lanes and movable split/merge points;
- drag-and-drop ordering;
- complete-chain presets;
- latency compensation;
- remote-plugin installation or persistent user catalogues;
- MIDI mapping across arbitrary effect chains;
- CPU budgeting and automatic A2 Full/Lite decisions for complex racks.

These features should be specified only after the Phase 1 registry demonstrates which bundled plugins are genuinely portable and compatible.
