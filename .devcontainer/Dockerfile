# Emscripten toolchain (emcc, emcmake, cmake, python3) pinned to the version used locally.
FROM emscripten/emsdk:6.0.9

# ffmpeg: tools/analyze_ir_levels.mjs — numpy: tests/compare.py — rsync: web/bin/rack-sync
# lib*-dev: compiling Ruby
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg git python3-numpy rsync sqlite3 \
      libffi-dev libreadline-dev libssl-dev libyaml-dev zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*

# Ruby for the Rails app in web/; keep in sync with web/.ruby-version.
ARG RUBY_VERSION=4.0.1
ARG RUBY_BUILD_VERSION=20261013
RUN git clone --depth 1 --branch v${RUBY_BUILD_VERSION} https://github.com/rbenv/ruby-build.git /tmp/ruby-build \
 && /tmp/ruby-build/bin/ruby-build ${RUBY_VERSION} /usr/local \
 && rm -rf /tmp/ruby-build /tmp/ruby-build.*
