#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

echo "==> Checking prerequisites"
for cmd in node cmake emcmake; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "  ERROR: '$cmd' not found." >&2
    if [[ "$cmd" == "cmake" || "$cmd" == "emcmake" ]]; then
      echo "  Install cmake and emscripten: brew install cmake emscripten" >&2
    fi
    exit 1
  fi
done
echo "  node $(node --version), cmake $(cmake --version | head -1 | cut -d' ' -f3), emcmake OK"

echo ""
echo "==> third_party/wam-examples"
WAM_DIR="$REPO_ROOT/third_party/wam-examples"
if [[ ! -d "$WAM_DIR" ]]; then
  git clone https://github.com/webaudiomodules/wam-examples "$WAM_DIR"
else
  echo "  Directory exists, updating submodules"
fi
git -C "$WAM_DIR" submodule update --init --recursive

echo ""
echo "==> third_party/NeuralAmpModelerCore"
NAM_DIR="$REPO_ROOT/third_party/NeuralAmpModelerCore"
if [[ ! -d "$NAM_DIR" ]]; then
  git clone https://github.com/sdatkinson/NeuralAmpModelerCore "$NAM_DIR"
else
  echo "  Directory exists, updating submodules"
fi
git -C "$NAM_DIR" submodule update --init --depth 1

echo ""
echo "==> Building WASM"
WASM_OUTPUT="$REPO_ROOT/build-wasm/dist/nam-simd.wasm"
if [[ -f "$WASM_OUTPUT" ]]; then
  echo "  nam-simd.wasm already present, skipping build"
else
  JOBS="$(nproc 2>/dev/null || sysctl -n hw.logicalcpu 2>/dev/null || echo 4)"
  emcmake cmake -S "$REPO_ROOT" -B "$REPO_ROOT/build-wasm" -DCMAKE_BUILD_TYPE=Release
  cmake --build "$REPO_ROOT/build-wasm" -j "$JOBS"
fi

echo ""
echo "==> Setup complete — run: npm start"
