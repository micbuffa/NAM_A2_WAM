require "application_system_test_case"

# Play along: the backing track dock at the bottom of Tone.
class PlayAlongTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack
  end

  teardown { switch_to "tone" if page.has_css?("#workspaceSwitch", wait: 0) }

  test "the dock opens on the library, plays a track and pauses outside Tone" do
    dock = find("backing-track-player")
    shadow = dock.shadow_root
    assert shadow.find("#body", visible: :all)[:hidden], "collapsed by default"
    shadow.find("#title").click
    assert_equal "true", shadow.find("#expand")["aria-expanded"]
    assert_equal 29, shadow.all("#list button").size

    shadow.find("#list button", text: "Born To Be Wild - Steppenwolf").click
    shadow.assert_selector "#title", text: "Born To Be Wild - Steppenwolf", wait: 20
    shadow.find("#play:not([disabled])", wait: 20).click
    shadow.assert_selector "#play[icon=pause]"
    assert playing?

    switch_to "projects"
    assert_no_selector "backing-track-player", visible: true
    assert_not playing?, "leaving Tone pauses the backing track"
    switch_to "tone"
    assert_selector "backing-track-player", visible: true
  end

  private
    def playing? = page.evaluate_script("window.phase3Debug.playAlong.engine.playing")

    def switch_to(workspace)
      page.execute_script("const s = document.getElementById('workspaceSwitch'); s.value = arguments[0]; s.dispatchEvent(new Event('change'))", workspace)
      assert_selector "body[data-workspace=#{workspace}]"
    end
end
