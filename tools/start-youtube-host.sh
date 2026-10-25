#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if command -v node >/dev/null 2>&1 && node --version >/dev/null 2>&1; then
  exec node examples/wam/server.mjs
fi
# Codex desktop bundles a separate Node runtime; useful when the system Node is broken.
nam_bundled_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [ -x "$nam_bundled_node" ]; then exec "$nam_bundled_node" examples/wam/server.mjs; fi
printf '%s\n' 'Node.js 22+ requis. Installez Node puis relancez ce script.' >&2
exit 1
