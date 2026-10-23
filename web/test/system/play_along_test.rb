require "application_system_test_case"

# Play along: the backing track dock at the bottom of Tone.
class PlayAlongTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack
  end

  teardown do
    next unless page.has_css?("#workspaceSwitch", wait: 0)
    switch_to "tone"
    page.execute_script("localStorage.removeItem('nam-a2-wam.playAlong')") # the next test starts from the defaults
  end

  test "the dock opens on the library, plays a track and pauses outside Tone" do
    dock = find("backing-track-player")
    shadow = dock.shadow_root
    assert shadow.find("#body", visible: :all)[:hidden], "collapsed by default"
    shadow.find("#title").click
    assert_equal "true", shadow.find("#expand")["aria-expanded"]
    assert_equal 29, shadow.all("#list button").size

    shadow.find("#list button", text: "Born To Be Wild - Steppenwolf").click
    shadow.assert_selector "#title", text: "Born To Be Wild - Steppenwolf", wait: 20
    loop_on = shadow.find("#loop")["aria-pressed"]
    shadow.find("#loop").click
    assert_not_equal loop_on, shadow.find("#loop")["aria-pressed"], "the Loop button toggles the A-B loop"
    shadow.find("#loop").click
    shadow.find("#play:not([disabled])", wait: 20).click
    shadow.assert_selector "#play[icon=pause]"
    assert playing?

    switch_to "projects"
    assert_no_selector "backing-track-player", visible: true
    assert_not playing?, "leaving Tone pauses the backing track"
    switch_to "tone"
    assert_selector "backing-track-player", visible: true
  end

  test "the last track, its loop and the open dock come back after a reload, without playing" do
    shadow = find("backing-track-player").shadow_root
    shadow.find("#title").click
    shadow.find("#list button", text: "Born To Be Wild - Steppenwolf").click
    shadow.assert_selector "#title", text: "Born To Be Wild - Steppenwolf", wait: 20
    page.execute_script("window.phase3Debug.playAlong.engine.setLoop({enabled: true, startSeconds: 10, endSeconds: 20})")
    sleep 1 # the settings are saved 800 ms after the last change

    visit "/rack/"
    wait_for_rack
    shadow = find("backing-track-player").shadow_root
    shadow.assert_selector "#title", text: "Born To Be Wild - Steppenwolf", wait: 20
    assert_equal "true", shadow.find("#expand")["aria-expanded"]
    assert_equal 10, page.evaluate_script("window.phase3Debug.playAlong.engine.loop.startSeconds")
    assert_not playing?
  end

  test "space plays and pauses from the waveform, not while typing in the filter" do
    shadow = find("backing-track-player").shadow_root
    shadow.find("#title").click
    shadow.find("#list button", text: "Born To Be Wild - Steppenwolf").click
    shadow.assert_selector "#title", text: "Born To Be Wild - Steppenwolf", wait: 20
    shadow.find("#wave").click
    shadow.find("#wave").send_keys(:space)
    shadow.assert_selector "#play[icon=pause]"
    shadow.find("#wave").send_keys(:space)
    shadow.assert_selector "#play[icon=play]"
    shadow.find("#filter").send_keys(" ")
    assert_not playing?
  end

  private
    def playing? = page.evaluate_script("window.phase3Debug.playAlong.engine.playing")

    def switch_to(workspace)
      page.execute_script("const s = document.getElementById('workspaceSwitch'); s.value = arguments[0]; s.dispatchEvent(new Event('change'))", workspace)
      assert_selector "body[data-workspace=#{workspace}]"
    end
end
