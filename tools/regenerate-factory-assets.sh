#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
printf '%s\n' 'Generating Factory Asset manifests...'
node "$REPO_ROOT/tools/generate-factory-manifests.mjs"
printf '%s\n' 'Done.'
