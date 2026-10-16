require "application_system_test_case"

# Tone / Tracks: switching changes what is shown, never what is playing.
class WorkspacesTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_synced
    visit "/rack/"
    wait_for_rack
  end

  teardown { switch_to "tone" if page.has_css?("#workspaceSwitch", wait: 0) }

  test "each workspace shows its own panels" do
    assert_selector "#presetsPanel", visible: true
    assert_selector ".fx-rack", visible: true
    assert_no_selector "#audioSource", visible: true
    assert_no_selector "backing-track-player", visible: true

    switch_to "tracks"
    assert_selector "#audioSource", visible: true
    assert_selector "backing-track-player", visible: true
    assert_no_selector "#presetsPanel", visible: true
    assert_no_selector ".fx-rack", visible: true
    assert_selector "#inputDevice", visible: true # Audio devices belong to both

    visit "/rack/"
    wait_for_rack
    assert_selector "backing-track-player", visible: true # the workspace is remembered
  end

  test "a backing track keeps playing when switching workspaces" do
    switch_to "tracks"
    page.evaluate_async_script(<<~JS)
      const done = arguments[0];
      const {engine, library} = phase3Debug.backingPlayer;
      engine.loadTrack(library.tracks[0].id).then(() => engine.play()).then(() => done());
    JS
    assert page.evaluate_script("phase3Debug.backingPlayer.engine.playing")
    switch_to "tone"
    sleep 0.3
    assert page.evaluate_script("phase3Debug.backingPlayer.engine.playing"), "switching to Tone must not stop the backing track"
    position = page.evaluate_script("phase3Debug.backingPlayer.engine.position")
    sleep 0.3
    assert_operator page.evaluate_script("phase3Debug.backingPlayer.engine.position"), :>, position
    page.execute_script("phase3Debug.backingPlayer.engine.stop()")
  end

  test "the Tracks cards follow the active preset and lead back to Tone" do
    switch_to "tracks"
    assert_selector "#activeToneName", text: "Untitled rack"
    assert_selector "#guitarSourceDetail", text: "Monitoring is off"

    switch_to "tone"
    find("#presetSelect").find("option", exact_text: "British Edge · Crunch").select_option
    assert_selector "#presetTitle", text: "British Edge"
    switch_to "tracks"
    assert_selector "#activeToneName", text: "British Edge"
    assert_selector "#activeToneMeta", text: "Factory · Crunch · 1 chain"

    click_on "Edit in Tone"
    assert_selector "body[data-workspace=tone]"
    assert_selector ".fx-rack", visible: true
  end

  private
    def switch_to(workspace)
      page.execute_script("const s = document.getElementById('workspaceSwitch'); s.value = arguments[0]; s.dispatchEvent(new Event('change'))", workspace)
      assert_selector "body[data-workspace=#{workspace}]"
    end
end
