# NAM A2 WAM

Open-source WebAssembly/WAM audio effects prototype for guitar and bass. The project provides
a browser-based Web Audio host, a Neural Amp Modeler (NAM A2) plugin, a cabinet plugin based on
impulse responses (IRs), and TONE3000 Select Flow integration.

The repository contains the source code, the Factory assets required by the example host, and
the test suite. The `third_party/`, `dist/`, and build directories are not intended to be
committed.

## Features

- Web Audio/WAM host in [`examples/wam/`](examples/wam/).
- NAM A2 plugin in [`src/nam-wam/`](src/nam-wam/), with `.nam` model loading and safe replacement,
  Lite/Full modes, bypass, input/output gain, and state restoration.
- Cabinet plugin in [`src/cabinet-wam/`](src/cabinet-wam/), with WAV IR loading, convolution,
  and level matching.
- Shared WASM/C++ backend in [`src/nam-wasm/`](src/nam-wasm/), built with
  NeuralAmpModelerCore.
- Shared assets and file browsing utilities in [`src/shared/`](src/shared/).
- TONE3000 model selection from the NAM panel through the Select Flow OAuth flow. Each user
  authenticates with their own TONE3000 account; the public `client_id` identifies the application
  and does not contain the author's session.

## Requirements

- Recent Node.js with npm.
- CMake 3.20 or newer and a C++20 compiler.
- Emscripten with `emcmake` available in the shell for the WASM build.
- The `third_party/NeuralAmpModelerCore` checkout. Third-party sources are intentionally ignored
  by Git.

Initialize the NAM Core submodule if necessary:

```sh
git -C third_party/NeuralAmpModelerCore submodule update --init --depth 1
```

## Run the host locally

Install the JavaScript dependencies and start the static server:

```sh
npm install
npm start
```

Then open <http://127.0.0.1:8765/examples/wam/index.html>.

The server automatically scans [`examples/wam/assets/audio/`](examples/wam/assets/audio/) to
discover `.wav`, `.mp3`, `.aac`, `.m4a`, `.ogg`, and `.flac` audio files. The host supports file
sources and live audio input, using the following signal chain:

```text
source → NAM A2 WAM → Cabinet WAM → audio output
```

An automated validation page is available at
<http://127.0.0.1:8765/examples/wam/index.html?auto=1>.

## TONE3000 authentication

The TONE3000 tab starts with an authentication step following the Select Flow guidelines. Click
**Continue to TONE3000**, sign in or create an account, then return to the host to browse and
select a model.

![NAM A2 WAM host](docs/screenshots/ImageNAM_A2_WAM.jpeg)

The public client ID and redirect URI configuration are exposed in the plugin GUI. For local
development, use:

```text
http://127.0.0.1:8765/examples/wam/index.html
```

For deployment, also add the exact HTTPS host URL to the allowed redirect URIs in TONE3000. The
TONE3000 secret must never be placed in `index.html`, a JavaScript file, or this repository. The
public client ID may be distributed in browser code; the session and tokens belong to each user
in their own browser.

Implementation details are in [`Tone3000Auth.js`](src/nam-wam/tone3000/Tone3000Auth.js),
[`Tone3000Client.js`](src/nam-wam/tone3000/Tone3000Client.js), and the NAM GUI
([`gui.js`](src/nam-wam/gui.js)).

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
`npm run build-static` is an alias for the same operation.

## Test

Run the complete JavaScript test suite:

```sh
npm test
```

The tests cover dynamic file discovery, the host, NAM-to-Cabinet routing, manifests, static
distribution, the AudioWorklet contract, and TONE3000 integration.

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
