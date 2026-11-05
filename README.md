# NAM A2 WAM

## Studio: Direct WebNN and master playback volume

On `codex/studio-integration`, open **Studio → Separate instruments → Execution engine** (also available in **Options**). Direct WebNN CPU/GPU/NPU supports both the four-stem Demucs and six-stem Roformer models. These options are disabled when the browser does not expose WebNN; the Worker validates context and model compatibility before producing audio. No ONNX Runtime is imported by this native path. An unavailable native device fails explicitly. The older ONNX→WebNN path remains four-stem only and retains its per-block WASM reference checks.

WebGPU remains the quick-start default. The reference run on `multitracks` measured roughly110s initialization for direct six-stem WebNN, but faster retained processing. Prefer six stems when a dedicated guitar/piano track is wanted; four stems group guitar in Other. Reference times are device-specific; CPU/GPU/NPU are requested placement, not hardware attestation. Native Studio audio still requires a Canary/experimental-browser listening check; automated protocol tests and prior benchmark parity do not replace that check.

The **Master** slider beside Studio Play controls listening level (0–100%, default100%) for saved projects, progressive separation previews and Studio monitoring. It is session-level listening gain: it does not alter track faders, recorded DI, presets or exported mix files. A10ms ramp avoids abrupt gain steps.

Direct WebNN weights are **optional for the ordinary static build**. `npm run build`, `npm run dist` and `node tools/build-static-dist.mjs` work without the Git-ignored exports. Complete local exports are included automatically; absent/incomplete exports produce an availability index without weights and disable only the native **Direct WebNN** options in Studio. WebGPU, CPU/WASM and the separate ONNX→WebNN backend remain usable as supported by the browser. Model weights for those backends are downloaded explicitly through the model manager.

- `npm run dist -- --without-direct-webnn`: deliberately omit native exports, even if available locally.
- `npm run dist -- --require-direct-webnn`: release build requiring both complete pinned native exports; fails **before replacing the previous dist** if unavailable.
- For a CSS/UI-only rebuild using existing WASM/manifests: `node tools/build-static-dist.mjs --no-build --no-regenerate`.

To prepare native WebNN on a fresh checkout (explicit downloads, approximately 900 MB of generated constants afterwards):

```sh
npm run prepare:direct-webnn
python3.12 -m venv .venv-direct-webnn
. .venv-direct-webnn/bin/activate
python -m pip install onnx==1.20.0 onnxruntime==1.22.0 numpy
python tools/export-direct-webnn.py
npm run dist -- --require-direct-webnn
npm run test:direct-webnn:assets
```

`prepare:direct-webnn` retrieves the two pinned checkpoints from the URLs in `studio-models.json`, writes the exact paths expected by the exporter, and checks size/SHA-256 before installation. It reuses verified files, refuses to overwrite an existing mismatched checkpoint, and is **never run automatically by the build**. Generated graphs, index and weights must be deployed together. The browser still verifies hashes before inference. Existing checkpoint notices apply to converted constants; no new training is performed.

`web/bin/rack-sync` builds the distribution and copies it to Rails. If the local Ruby locale is US-ASCII, generate the template with `ruby -E UTF-8:UTF-8 web/lib/rack_view.rb`. Test the served rack at `http://localhost:3001/rack/`.

## Recording latency calibration

Manual recording compensation starts at **14 ms**, an unmeasured estimate.
Adjust **Recording settings → Manual compensation (ms)** to a known value
(including zero or decimals), or apply a loopback calibration. **Reset to
14 ms** and a device/routing change restore the default estimate; they never
label it as measured. Existing takes are unchanged.

In Studio, select a personal guitar/bass track, then open **Recording settings → Calibrate input latency**. Select the physical output (1/left or 2/right). The assistant physically disconnects microphone routes into both chains and app speaker outputs before opening input or connecting the cable; presets stay intact. Disable hardware direct monitoring, run the six probes, and explicitly **Apply compensation**. Close the assistant, remove the loopback cable and reconnect the instrument before re-enabling input. The input is disabled on close; playback stays paused.

**Speakers → microphone · acoustic test** uses chirps and reports an acoustic estimate (including propagation), which can be used as manual compensation. **Test signal level** is adjustable from -30 to -6 dBFS, default -18; no automatic volume escalation.

Measurements use normalized correlation in a Worker and retain bounded local profiles. Manual compensation/reset remain available. Reloaded profiles require **Use saved calibration**, after verifying the same hardware/buffer configuration. New takes store measurement provenance; existing audio is unchanged. Physical hardware qualification and the community calibration catalogue remain pending. See [RECORD_TRACKS_SPECIFICATION.md](RECORD_TRACKS_SPECIFICATION.md).

## Tuner

Open **Tuner** (or press **T**) after enabling live input. With two chains visible, **Tuner input** selects **Chain A** or **Chain B**, with its physical input channel shown. Analysis is taken before trim/effects and remains available while that chain is muted. If A feeds B, both selections analyse A’s raw input, explicitly marked as shared. Hiding B returns the tuner to A; unavailable physical channels are identified rather than silently replaced. No extra microphone permission is requested by opening the tuner.

## Serial effect chain

The main host shows the current NAM capture and Cabinet IR as photo cards. Click a `+` to choose a bundled effect at that position, then double-click its thumbnail/title or use **Insert module**. Click any photo to open its editor; **Replace** opens the catalog to replace that instance in place while preserving its input/output gains. Cancel or a failed load keeps the current module. Closing the editor preserves the running instance and its settings. Card controls and editor toolbars provide bypass. Cabinet AUTO still follows the selected NAM capture type.

NAM and Cabinet initialize their default assets without creating editors. Multiple instances keep independent WAM states. The **Session & diagnostics** save/restore controls now snapshot the whole chain in memory; factory/user preset management is a subsequent phase.

For a microphone-free real-browser test, open `examples/wam/fx-test/chain-validation.html` and click **Run headless and instance isolation tests**. The test renders audio into a muted measurement path and checks headless defaults, duplicate instances, state restoration and editor reuse. The same page is included under `dist/NAM_A2_WAM/fx-test/`.

Open-source WebAssembly/WAM audio effects prototype for guitar and bass. The project provides
a browser-based Web Audio host, a Neural Amp Modeler (NAM A2) plugin, a cabinet plugin based on
impulse responses (IRs), and TONE3000 Select Flow integration.

The repository contains the source code, the Factory assets required by the example host, and
the test suite. The `third_party/`, `dist/`, and build directories are not intended to be
committed.

## Features

- Web Audio/WAM host in [`examples/wam/`](examples/wam/).
- NAM A2 plugin in [`src/nam-wam/`](src/nam-wam/), with `.nam` model loading and safe replacement,
  a persistent Full/Lite rendering preference, rotary input/output gain, noise gate, three-band tone
  stack, six-band parametric EQ, bypass, and state restoration.
- Cabinet plugin in [`src/cabinet-wam/`](src/cabinet-wam/), with WAV IR loading, convolution,
  and level matching.
- Shared WASM/C++ backend in [`src/nam-wasm/`](src/nam-wasm/), built with
  NeuralAmpModelerCore.
- Shared assets and file browsing utilities in [`src/shared/`](src/shared/).
- TONE3000 model selection from the NAM panel through the Select Flow OAuth flow. Each user
  authenticates with their own TONE3000 account; the public `client_id` identifies the application
  and does not contain the author's session.
- A persistent Favorites library shared by Factory, External, and downloaded TONE3000 models.
  Favorites use IndexedDB; External favorites retain their model data and remain loadable after a
  browser restart.
- Automatic model-level compensation based on the loudness embedded in each NAM capture. It targets
  −18 dB, limits correction to ±12 dB, and leaves the manual Output gain control independent.

For `SlimmableContainer` captures, **Full** is the default network used for audio rendering. Open
**Preferences → A2 rendering mode** to select **Lite** when lower CPU usage is preferred. The current
model badge and details always report the network that is actually active.

Automatic model level is enabled by default and can be changed under **Preferences → Automatic
model level**. The correction currently applied to a capture is shown as a green `LEVEL ±x.x dB`
badge on the current-model card and in Model details. `LEVEL N/A` means that the file contains no
usable loudness metadata; such captures receive no automatic correction.

If a capture still sounds incorrectly matched, click **Calibrate level** on the current-model card.
This optional operation measures that model once with an internal low-level reference tone, applies
a static correction bounded to ±12 dB with peak protection, and resets the NAM state before normal
audio resumes. The reference tone is never routed to the output, and no adaptive gain runs while
playing. The badge changes to `MEASURED ±x.x dB`; click **Use metadata** to restore the default mode.
Measured values are remembered per capture and per Full/Lite variant in browser-local storage, so
reloading the same capture restores its calibration. Localhost and the deployed origin keep separate
calibration libraries.

The NAM faceplate follows the processing order used by the official TONE3000 desktop plugin:

```text
Input gain → Noise gate → optional PRE EQ → NAM → level correction → optional POST EQ
           → Bass/Middle/Treble → Output gain
```

Drag a rotary control vertically: upward increases its value and downward decreases it; hold Shift
for fine adjustment. Double-click restores its default value. Bass, Middle, and Treble are neutral
at `5`; the gate defaults to `−80 dB`. Click **EQ** to reveal the graphical six-band parametric
editor. Drag a point horizontally to change frequency and vertically to change gain; use the mouse
wheel for Q, or edit the selected band's numeric Frequency/Gain/Q fields. The plotted curve uses the
same RBJ coefficient equations as the audio processor. The EQ is disabled and POST NAM by default,
but can be moved before NAM. Its bands are low shelf at 100 Hz, four bells at 250 Hz, 650 Hz, 1.6 kHz
and 3.5 kHz, and high shelf at 8 kHz. Bypassed NAM and Cabinet modules use a red-tinted faceplate so
their inactive state remains immediately visible.

## Requirements

- Recent Node.js with npm.
- CMake 3.20 or newer and a C++20 compiler.
- Emscripten with `emcmake` available in the shell for the WASM build.
- The `third_party/NeuralAmpModelerCore` checkout. Third-party sources are intentionally ignored
  by Git.

## Dev container

[`.devcontainer/`](.devcontainer/) provides all of the above (Emscripten 6.0.9, CMake, Node 24,
ffmpeg, Python with numpy) plus Ruby 4.0.1 for the Rails app, without installing them on the host.

Prerequisites: a container runtime (Docker Desktop, OrbStack, Colima, Podman or Docker Engine on
Linux) and VS Code with the Dev Containers extension, a recent JetBrains IDE, or the
`@devcontainers/cli`. GitHub Codespaces also works and needs nothing locally.

Open the project and choose **Reopen in Container**. On first creation the container runs
`npm run setup` (fetches `third_party/` if it is missing and builds the WASM), then
`web/bin/setup --skip-server` (gems and database). Then, in the container terminal:

- `npm start` serves the static host on <http://127.0.0.1:8765/rack/>;
- `cd web && bin/rails server` serves the Rails app on <http://localhost:3000/rack/>.

Both ports are forwarded to the host browser, so audio devices work as usual. After changing
`.devcontainer/`, run **Dev Containers: Rebuild Container**.

Inside the container, `build-wasm/` and the gems are separate Docker volumes, so the container
never shares a CMake cache or native gems with the host. The servers listen on `0.0.0.0` there
through the `HOST` and `BINDING` environment variables; outside the container they keep their
localhost defaults. The rest of the repository is shared, including `web/storage/*.sqlite3` and
`web/tmp/pids/`: do not run Rails on the host and in the container at the same time.

## Run the host locally

Install dependencies, fetch third-party sources, build the WASM, then start the static server:

```sh
npm install
npm run setup
npm start
```

Then open <http://127.0.0.1:8765/rack/> (the same URL as the Rails app; the older
`/examples/wam/` path still works).

The isolated WAM effect registry and compatibility lab is available at
<http://127.0.0.1:8765/rack/fx-test/>. It discovers the bundled catalogue, categorizes
effects from descriptors and catalogue overrides, and validates plugin loading, GUI creation,
state round trips, bypass, and cleanup without changing the production NAM/Cabinet graph. See
[`docs/WAM_PLUGIN_REGISTRY.md`](docs/WAM_PLUGIN_REGISTRY.md).

The server automatically scans [`examples/wam/assets/audio/`](examples/wam/assets/audio/) to
discover `.wav`, `.mp3`, `.aac`, `.m4a`, `.ogg`, and `.flac` audio files. The host supports file
sources and live audio input, using the following signal chain:

```text
source → NAM A2 WAM → Cabinet WAM → audio output
```

The host requests a 48 kHz `AudioContext`, matching the sample rate used by the bundled and
TONE3000 NAM A2 models. If the browser or audio device cannot provide 48 kHz, the host displays a
diagnostic message and NAM model loading may be rejected by the core.

An automated validation page is available at
<http://127.0.0.1:8765/rack/index.html?auto=1>.

## Accounts, presets and sync (Rails app)

[`web/`](web/) is a Rails 8 + SQLite app that serves the same rack on one origin and adds
passwordless accounts (emailed magic link), server-side presets of the whole WAM chain,
synced NAM/IR favorites and preferences. Without an account the rack works as above (amps, cabinets,
pedals, Factory presets), but saving a preset asks to sign in first; the sound on screen is kept and
saved once signed in. Unsaved changes survive a reload as a draft in the browser (IndexedDB). Favorites
and preferences set as a guest stay in the browser, and the rack offers to import them after sign-in.
The static distribution, which has no accounts, keeps user presets in the browser.

```sh
npm run setup                 # once: third-party checkouts + WASM
cd web && bin/setup --skip-server
bin/rails server              # http://localhost:3000/rack/
```

In development Rails serves the rack straight from `examples/wam/` and `src/`: edit, reload, done.
`web/bin/rack-sync` is only needed to build a production image.

The page must be cross-origin isolated (`COOP: same-origin`, `COEP: require-corp`) because the
WAM SDK uses `SharedArrayBuffer`; the Rails app sends these headers on the page and every static
file. Installation, environment variables (SMTP via Brevo or Postmark), deployment with a
persistent SQLite volume and Litestream backups are documented in [`web/README.md`](web/README.md).

## TONE3000 authentication

The TONE3000 tab starts with an authentication step following the Select Flow guidelines. Click
**Continue to TONE3000**, sign in or create an account, then return to the host to browse and
select a model.

![NAM A2 WAM host](docs/screenshots/ImageNAM_A2_WAM.jpeg)

The public client ID and redirect URI are loaded from [`examples/wam/config.js`](examples/wam/config.js),
not embedded in `index.html`. The configuration derives the redirect URI from the page currently
being opened, so the same source host works locally and on Mainline:

```text
http://127.0.0.1:8765/rack/index.html
http://127.0.0.1:8765/examples/wam/index.html
```

For deployment, add the exact HTTPS host URL to the allowed redirect URIs in TONE3000. The
TONE3000 secret must never be placed in `index.html`, a JavaScript file, or this repository. The
public client ID may be distributed in browser code; the session and tokens belong to each user
in their own browser.

Implementation details are in [`Tone3000Auth.js`](src/nam-wam/tone3000/Tone3000Auth.js),
[`Tone3000Client.js`](src/nam-wam/tone3000/Tone3000Client.js), and the NAM GUI
([`gui.js`](src/nam-wam/gui.js)).

Maintainers can open the host with `?maintainer=1`, select the TONE3000 tab, and export an explicitly
selected NAM A2 or IR tone as a repository-ready ZIP containing `tone.json`, its local cover image,
selected captures, hashes, creator attribution, and license metadata. See
[`docs/FACTORY_LIBRARY.md`](docs/FACTORY_LIBRARY.md) before importing or redistributing any tone.

## Build the project

### Native C++ build

```sh
cmake -S . -B build-native -DCMAKE_BUILD_TYPE=Release
cmake --build build-native -j 8
ctest --test-dir build-native --output-on-failure
```

The native executables are `build-native/nam_native` and `build-native/cabinet_native`.

### WASM build

```sh
emcmake cmake -S . -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm -j 8
```

WASM artifacts are written to `build-wasm/dist/`. The host uses the static artifacts generated
in `dist/` by the following command:

```sh
npm run dist
```

This rebuilds the Factory manifests and produces a deployable static distribution.
The default product build keeps Play/Studio, their waveform dependencies and
the approved four/six-instrument separation runtimes, but excludes the standalone
source-separation laboratory and local model weights.
To include the research prototype from the current checkout, pass
`npm run dist -- --include-research`. The more recent research work remains on
branch `multitracks`; Studio integration is developed on `codex/studio-integration`.

The left column is the navigation: **Play**, **Studio**, **Audio devices** (a popup with the input
and output devices), **Tuner** (also the T key), and **Settings** / **Account** at the bottom (the audio engine status appears there only when the engine is offline); **Collapse** reduces it to an icon
rail. Play opens on its title, with **Enable live input** on the right; the guitar source choice (live input or a dry file and its player) is a developer tool: it appears in the left column, above Audio devices, on Play only and only with `FRETWORK_DEV_TOOLS=1` in `web/.env` (see `web/README.md`); otherwise the source stays live input.
**Studio** always opens on its project list (title, creator, creation date, tracks, BPM, duration);
click a row to open the project, **Delete** to remove one of yours, **New project** to start one.
Click Studio in the navigation to come back to the list.

Studio distinguishes personal parts from accompaniment audio. Choose **Track type**
when adding or importing audio: only personal guitar/bass parts use tone presets.
Existing projects retain their presets through the `legacy` migration origin.
Changing the instrument never converts an accompaniment into a personal DI.

After stopping a separation, **Keep instruments & arm** saves the partial
instruments as project tracks before arming the newly added guitar. A failed
save preserves the preview for retry. Ordinary Play auditions the recorded
track and its meter. Live monitoring resumes on pause, and remains available
during recording, only when its speaker toggle is explicitly enabled.

First recording increment: add an empty **personal guitar/bass** track, choose the
input/channel in Play, then **Arm track (microphone icon or R) → Record →
Stop recording → Save project**. Arming enables input metering without speaker
feedback; the speaker icon independently toggles monitoring, including during a
take. Record starts after one bar of count-in by default (Off/1/2 bars). The
metronome button optionally keeps clicks during the take. Click the tempo label
to edit quarter-note BPM and time signature (default 4/4). Imported audio offers
an approximate tempo suggestion, applied only on request. The current unsaved Play sound is copied by
default; the take stores raw mono DI plus a preset snapshot as a lossless WAV.
Up to two takes can remain in RAM (100 MiB each); Discard unsaved take allows a
retry. Manual latency compensation is available, initially uncalibrated.
Assisted loopback calibration is available (hardware qualification pending).
Select a personal guitar/bass track and its sound appears in the rack dock at the bottom of Studio, even while the
take is still in RAM and without pausing the project: playback, and explicit
input monitoring, go through the rack shown. **Apply to track** applies changed
sound locally, without a server save or a question; selecting another track,
switching to Play or **Save project** applies pending edits too, and an
unchanged visit creates no edit. **Revert** (↶ next to the name) reloads the
sound last applied to the track. Play gets its own rack back when you return. In Studio, **Save project** saves audio and the edited
sound, with an optional checkbox to also create a reusable Play preset. This
question appears only for a changed FX sound. Failed saves retain local edits;
preset creation retries reuse the same request token. Uploading a new take keeps
the original capture preset as provenance and preserves the retouched playback
sound. Changes remain in RAM until explicit Save project; no automatic server
save or durable local autosave is implemented.

Studio recording uses **arm** and **monitor** buttons in personal-track
headers (microphone/speaker by default). Arm with the microphone (or R), then use the red **Record** icon in the
shared transport. Record targets the armed track, even after selecting another
row. **Stop** stops playback or the take; during count-in it cancels the take.
The armed speaker remains available during capture, independently from arming.
The transport gear opens **Recording settings**, including current Play sound,
discarding a selected RAM take and calibration. There is no separate large
recording panel. Track density defaults **Compact**; choose **Comfortable** in
Project options. This browser-local preference changes layout only.

**Settings → Appearance → Track control style** offers Logic-like **I / R**,
Ableton-like **IN / record circle**, Reaper-like **speaker / microphone**
(default), or Cubase-like **speaker / outlined record circle**, with a live preview. These are inspired visual conventions, not full
DAW emulations: monitoring stays on/off, arm stays independent, and R keeps the
same shortcut. Changes apply immediately without replacing buttons, rebuilding
waveforms or touching audio; the preference persists locally and synchronizes
between tabs. Theme selection remains separate. Reduced-motion system preferences
disable decorative transitions in Studio controls and dialogs; audio, meters
and waveform progress continue updating. See [Studio validation](docs/STUDIO_UI_VALIDATION.md)
for the tested workflows and remaining physical/browser checks.

**Project options** opens source/history, model/backend, cache and mix export
settings in a dialog. **Recording settings** opens compensation/calibration.
Closing these dialogs preserves control values and does not stop audio or
separation. Progress/Stop remain in the Studio strip.
Record on an occupied personal track asks for confirmation and overwrites only the
compensated capture interval after successful capture. Audio before/after stays
byte-identical. Currently requires an existing mono Float32 DI WAV at the capture
sample rate; incompatible audio is safely refused. Before / After buttons compare
via Undo/Redo (Play auditions the displayed version; Save keeps it). Cancel/failure
keeps the previous WAV. With a valid A/B selection, **Loop off** punches only inside A/B and playback
continues past B. **Loop on** records repeated passes from A after one count-in;
Stop selects the latest complete pass. **Loop take** offers Original, retained
complete passes and the last incomplete pass (up to three complete passes plus
one fragment, bounded by100MiB). Choose then Play to audition. Only a fully successful project save closes the other RAM choices. Failed upload,
project update or preset export retains them for retry; already uploaded audio is
reused. Save keeps the selected version. Loop auditions share one
Undo command. No valid A/B range means free recording until Stop. Undo/Redo
works before and after Save in the open session, with two audio operations retained;
reloading clears the session history. Rails retains at most two inactive take
versions per project, without duplicating shared blobs. Run `bin/rails db:migrate`
when deploying this update. Processed DI mix export is also available; see
[Processed mix export](docs/PROCESSED_MIX_EXPORT.md). See
[RECORD_TRACKS_SPECIFICATION.md](RECORD_TRACKS_SPECIFICATION.md).

In **Studio**, import accompaniment audio, choose Demucs (4 instruments, guitar
in Other) or BS Roformer SW (6 instruments, dedicated guitar/piano), and click
**Separate instruments**. The default processes the entire song; short excerpts
are available in the main panel. WebGPU is preferred when initialized successfully;
CPU/WASM and cache checks are under **Change model / settings**; model notices remain in the distribution files.
The Stop button cancels computation and keeps any already available partial result.
Separated instruments appear directly in the Studio timeline, with playback, mute/solo, volume/pan and
A/B controls. There is no Project/Separation preview toggle. A visible status distinguishes processing and unsaved instruments; the original stays in reserve for a new separation. When the calculation finishes (or after Stop), **Save project** stores
the instruments as lossless Float32 stereo WAV files, their mix and model/backend
provenance in Rails. Reopen the project to listen without recomputing. **Saved
separations** selects a previous result; only the selected deck is downloaded and
decoded. Unsaved previews remain in RAM and are lost on reload. Interrupted uploads
can be retried with Save project while the preview remains open; after reload,
completed uploads can be published and unfinished uploads discarded. Limits are
512 MiB per stem, 2 GiB per project and 5 GiB per account for separation uploads.
Shared listeners can listen/remix locally but cannot save over the owner's mix.
Use **Use mix in Play** to render a persistent stereo MP3 (192 kbit/s) from the
saved deck. **Mix export range** defaults to the entire song; A/B-only is explicit.
The backing appears in Play / Play along without autoplay, with **Download MP3**
and **Open in Studio**. A message beside the export button explains when saved
audio is loading or a track failed; **Retry audio loading** retries only failed
files. Transient server/network failures get bounded retries, without polling.
Live guitar and listening levels are excluded; a common
attenuation prevents PCM clipping. Studio exports support separated instruments,
dry recordings and personal tracks through independent headless offline preset racks.
They retain the actual model rate when possible: a48kHz NAM can produce a48kHz MP3
without a44.1kHz round trip. Different track model rates are adapted only for the
final mix; incompatible NAM rates within one rack are refused. MP3 supports32,
44.1 and48kHz here. **Project options → Effect tail (seconds)** adds0–10s to
whole-song processed exports (2s default); A/B remains exact and is processed
with preceding DI history. Playback's Lite NAM variant is used, with the same
DI trim, routing, lane gains and pans. The original DI/preset is retained.
Missing plugins, unknown IR clocks requiring conversion and processor errors
stop export rather than substituting dry DI. Older IR presets may need their
impulse response reloaded in Play before a change of frequency.
See [processed export qualification](docs/PROCESSED_MIX_EXPORT.md) for limits.
See [Studio validation](docs/STUDIO_SEPARATION_VALIDATION.md).
Rails requires `bin/rails db:migrate` after this schema change; restart the server
to refresh its schema cache. A static deployment still has no account persistence.
`npm run build-static` is an alias for the same operation.

## Test

Run the complete JavaScript test suite:

```sh
npm test
```

The tests cover dynamic file discovery, the host, NAM-to-Cabinet routing, manifests, static
distribution, the AudioWorklet contract, and TONE3000 integration.

Direct WebNN unit tests use tiny synthetic graphs/weights, including loader identity
and integrity failures; no model download is needed for these tests. Three additional
checks validate the full generated models in source and distribution. `npm test`
reports them as **skipped** with instructions when their generated directory is
absent (these ~908 MB assets are Git-ignored), or when the dist explicitly advertises native WebNN as unavailable. A present but incomplete native export still fails its full-asset validation. The remaining distribution tests still require a prepared product dist.

Before deploying Direct WebNN, export the pinned checkpoints with
`python3 tools/export-direct-webnn.py` (dependencies/preparation described above),
build with `npm run dist -- --require-direct-webnn`, then run the mandatory full-asset checks:

```sh
npm run test:direct-webnn:assets
```

This command never skips missing models. CI/release jobs can also set
`REQUIRE_DIRECT_WEBNN_ASSETS=1` when running `npm test`. The strict distribution preflight (`--require-direct-webnn`) rejects missing or truncated native exports. The ordinary distribution explicitly disables native choices when they are absent; it does not advertise incomplete native support.

To compare native and WASM rendering for a reference model:

```sh
build-native/nam_native render \
  third_party/NeuralAmpModelerCore/example_models/A2.nam \
  /tmp/nam-native.f32
node tests/wasm_test.mjs \
  third_party/NeuralAmpModelerCore/example_models/A2.nam \
  /tmp/nam-wasm.f32
python3 tests/compare.py /tmp/nam-native.f32 /tmp/nam-wasm.f32
```

Regenerate asset analyses with:

```sh
node tools/analyze_models.mjs
node tools/analyze_ir_levels.mjs
```

## Modify the project

### Modify the host

- UI and styles: [`examples/wam/index.html`](examples/wam/index.html) and
  [`examples/wam/host.css`](examples/wam/host.css).
- Audio graph initialization and controls: [`examples/wam/main.js`](examples/wam/main.js).
- Audio source management: [`examples/wam/SourceManager.js`](examples/wam/SourceManager.js).
- NAM/Cabinet routing: [`examples/wam/CabinetRouting.js`](examples/wam/CabinetRouting.js).
- Local server and audio discovery: [`examples/wam/server.mjs`](examples/wam/server.mjs).

### Modify the plugins

- NAM: [`src/nam-wam/index.js`](src/nam-wam/index.js), [`NamNode.js`](src/nam-wam/NamNode.js),
  [`NamProcessor.js`](src/nam-wam/NamProcessor.js), and [`gui.js`](src/nam-wam/gui.js).
- Cabinet: [`src/cabinet-wam/index.js`](src/cabinet-wam/index.js),
  [`CabinetNode.js`](src/cabinet-wam/CabinetNode.js),
  [`CabinetProcessor.js`](src/cabinet-wam/CabinetProcessor.js), and [`gui.js`](src/cabinet-wam/gui.js).
- C++/WASM interface: [`src/nam-wasm/`](src/nam-wasm/).
- Bundled WAM pedals and amps ([`examples/wam/wamPlugins/`](examples/wam/wamPlugins/)): their editors share
  the TONELAB template [`utils/tonelab-pedal.js`](examples/wam/wamPlugins/utils/tonelab-pedal.js); each
  plugin's `createGui()` only lists its controls and its look (`skin`: picture, gradient, title font).

After changing a bundled plugin's look, refresh the catalogue and chain card pictures: with `npm start`
running, run `npm run thumbnails` (headless Chrome). It writes `<plugin>/tonelab-thumbnail.png` and the
`thumbnail` entries of `plugins.json`; add folder names to capture only those plugins, e.g.
`npm run thumbnails -- BigMuff temper`.

After changing code or assets, run `npm test`, then `npm run dist` if the deployed distribution
must be updated.

## Repository layout

```text
src/nam-wam/       NAM A2 plugin and TONE3000 integration
src/cabinet-wam/   Cabinet plugin and Factory IRs
src/nam-wasm/      C++ wrappers compiled to WASM
src/shared/        Shared utilities
examples/wam/      Web Audio/WAM host and demo audio files
tests/             Node.js tests, static contracts, and distribution tests
tools/             Builds, manifest generation, and asset analysis
docs/              Technical notes and integration phase reports
third_party/       External dependencies, not committed
dist/              Generated distribution, not committed
```

## Additional documentation

- [`docs/phase3d-model-analysis.md`](docs/phase3d-model-analysis.md) — NAM model and IR asset
  analysis.
- [`docs/phase4a-cabinet-wam.md`](docs/phase4a-cabinet-wam.md) — Cabinet WAM architecture.
- [`docs/phase4a1-usability.md`](docs/phase4a1-usability.md) — level matching and AUTO routing.
- [`docs/FACTORY_LIBRARY.md`](docs/FACTORY_LIBRARY.md) — rich NAM/IR Factory bundle format
  and maintainer-only TONE3000 import workflow.
- [`HANDOFF.md`](HANDOFF.md) — detailed project status and next steps.

## Git and files to commit

The `.gitignore` excludes builds, `dist/`, third-party dependencies, and out-of-scope prototypes.
To stage the code, host, plugins, and documentation:

```sh
git add .gitignore package.json CMakeLists.txt \
  src/nam-wam src/cabinet-wam src/nam-wasm src/shared \
  examples/wam tools tests HANDOFF.md docs README.md
```

Review the staged content before creating a commit:

```sh
git status --short
git diff --cached --stat
git diff --cached --name-only
```

Studio **Import audio** now offers **file / YouTube** through Rails; progress,
cancellation and source metadata are retained in the account. Play's **Import audio**
offers a local file or YouTube too; **Use in Play** loads the downloaded source
without separation or autoplay. YouTube originals stay in the private backing library.
**Download MP3** is available for every loaded backing, in the track view. Existing MP3s download directly; other formats are converted
locally to MP3 in a worker. Downloads contain the full source, without the live guitar,
loop cropping or playback settings. The track view also has **Separate instruments**
to create a Studio original from the selected backing. YouTube needs the updated Rails container, not just a static
dist. See [Rails deployment and import limits](web/README.md#studio-audio-imports-26-october-2026).
Advanced WebNN CPU/GPU/NPU is experimental for Demucs4 only, with strict per-block
WASM comparison and initial fallback. Native WebNN qualification is still pending;
WebGPU/WASM remain the normal engines.

### WebNN in integrated Studio

On `codex/studio-integration`, choose **Execution engine** in Studio’s **Separate instruments** dialog, also used by imports from Play / Play along. WebNN CPU/GPU/NPU is opt-in for Demucs4; SW6 stays on WebGPU/WASM. Choices are disabled with an explanation if the browser does not expose WebNN. Firefox experimental builds and Canary use the same API detection. Closing the dialog preserves the previous engine.

### Use a stopped or unsaved instrument mix in Play

After stopping separation once some audio is ready, click **Use mix in Play** without saving. The available audio is mixed using current volume/pan/mute/solo and encoded as a temporary MP3. Completed RAM previews and unsaved recorded-track mixer changes work too. **Return to Studio** preserves the current unsaved preview. Temporary mixes are session-only (two recent entries, one per project); use **Save Project** separately to keep the stems or **Download MP3** to keep the mix file.


### Studio appearance and compact UI roadmap

Settings → Appearance offers Dark (default), Studio Light, Warm Studio and Follow system. The choice is stored in this browser, applies to Play/Studio/host dialogs and does not modify projects or presets. Plugin interfaces may keep their own appearance.

[STUDIO_UI_SPECIFICATION.md](STUDIO_UI_SPECIFICATION.md) describes five incremental tasks: appearance and viewport layout (implemented), secondary dialogs, compact track/recording headers, then responsive and end-to-end qualification. Desktop Studio keeps the project bar and transport visible, with a shared scrolling track/ruler area. The panel icon beside the project name collapses the sidebar; Import audio and New project are now in the top project bar. Smaller or zoomed windows retain normal page scrolling for accessibility.
