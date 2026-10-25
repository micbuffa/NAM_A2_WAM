#!/bin/sh
set -eu
cd "$(dirname "$0")"
nam_import_python="${PYTHON:-python3}"
if ! "$nam_import_python" -c 'import sys; assert sys.version_info >= (3,10)' >/dev/null 2>&1; then
  nam_import_python="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
fi
if ! "$nam_import_python" -c 'import sys; assert sys.version_info >= (3,10)' >/dev/null 2>&1; then
  printf '%s\n' 'Python 3.10+ requis. Relancez avec PYTHON=/chemin/vers/python3.' >&2
  exit 1
fi
"$nam_import_python" -m venv .youtube-runtime
.youtube-runtime/bin/python -m pip install 'yt-dlp[default]==2026.10.21'
.youtube-runtime/bin/yt-dlp --version
