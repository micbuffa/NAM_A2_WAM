# Tests serve the rack from the sources (lib/dev_sources.rb). Tests that need
# the WASM engine skip with an explicit hint when it has not been built.
module RackAssets
  WASM_URL = "/build-wasm/dist/nam-simd.wasm"

  def self.built?
    File.file?(File.join(DevSources::REPO_ROOT, WASM_URL))
  end

  def skip_unless_rack_built
    skip "build-wasm/dist/nam-simd.wasm is missing: run npm run setup" unless RackAssets.built?
  end

  # The rack is built once the topbar engine badge leaves "starting".
  def wait_for_rack(wait: 40)
    assert_selector "#engineStatus[data-state=ready], #engineStatus[data-state=idle]", wait:
  end
end
