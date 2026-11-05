require "application_system_test_case"

# Play along: the backing track panel at the top of Play. Always open, it shows one
# view at a time: the library (My tracks, then Factory) or the open track, whose
# name appears once, in the transport row, next to a Library button.
class PlayAlongTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack
  end

  teardown do
    next unless page.has_css?("[data-nav=tone]", wait: 0)
    switch_to "tone"
    page.execute_script("localStorage.removeItem('nam-a2-wam.playAlong')") # the next test starts from the defaults
  end

  test "the panel opens on the library table, a row opens the track, and leaving Play pauses it" do
    shadow = find("backing-track-player").shadow_root
    shadow.assert_no_selector "#expand, #miniWave", visible: :all # it no longer collapses
    shadow.assert_selector "#libraryView"
    shadow.assert_no_selector "#back"
    assert_equal [ "my tracks", "factory" ], shadow.all("#list th.section").map { |th| th.text.sub(/\s*\d+\z/, "").downcase } # shown uppercase
    assert_equal 0, shadow.all("#list tbody:first-of-type button").size, "no personal track when signed out"
    assert_equal 29, shadow.all("#list tbody:last-of-type button").size

    open_track shadow, "Born To Be Wild - Steppenwolf"
    shadow.assert_no_selector "#libraryView"
    shadow.assert_no_selector "#openStudio", visible: :all
    assert_equal 1, shadow.all("*", text: "Born To Be Wild - Steppenwolf", exact_text: true).size, "the name appears once"
    loop_on = shadow.find("#loop")["aria-pressed"]
    shadow.find("#loop").click
    assert_not_equal loop_on, shadow.find("#loop")["aria-pressed"], "the Loop button toggles the A-B loop"
    shadow.find("#loop").click
    shadow.find("#play:not([disabled])", wait: 20).click
    shadow.assert_selector "#play[icon=pause]"
    assert playing?

    shadow.find("#back").click
    shadow.assert_selector "#libraryView"
    shadow.assert_no_selector "#back"
    shadow.assert_selector "#list tr[aria-selected=true]", text: "Born To Be Wild - Steppenwolf"
    assert playing?, "going back to the library keeps playing"

    switch_to "projects"
    assert_no_selector "backing-track-player", visible: true
    assert_not playing?, "leaving Play pauses the backing track"
    switch_to "tone"
    assert_selector "backing-track-player", visible: true
  end

  test "the last track, its loop and the track view come back after a reload, without playing" do
    shadow = find("backing-track-player").shadow_root
    open_track shadow, "Born To Be Wild - Steppenwolf"
    page.execute_script("window.phase3Debug.playAlong.engine.setLoop({enabled: true, startSeconds: 10, endSeconds: 20})")
    sleep 1 # the settings are saved 800 ms after the last change

    visit "/rack/"
    wait_for_rack
    shadow = find("backing-track-player").shadow_root
    shadow.assert_selector "#title", text: "Born To Be Wild - Steppenwolf", wait: 20
    shadow.assert_selector "#trackView", wait: 20
    assert_equal 10, page.evaluate_script("window.phase3Debug.playAlong.engine.loop.startSeconds")
    assert_not playing?
  end

  test "space plays and pauses from the waveform, not while typing in the filter" do
    shadow = find("backing-track-player").shadow_root
    open_track shadow, "Born To Be Wild - Steppenwolf"
    shadow.find("#wave").click
    shadow.find("#wave").send_keys(:space)
    shadow.assert_selector "#play[icon=pause]"
    shadow.find("#wave").send_keys(:space)
    shadow.assert_selector "#play[icon=play]"
    shadow.find("#back").click
    shadow.find("#filter").send_keys(" ")
    assert_not playing?
  end

  test "a file from this device opens its track and is listed in My tracks, not in Factory" do
    shadow = find("backing-track-player").shadow_root
    page.execute_script(<<~JS)
      const player = window.phase3Debug.playAlong;
      const url = player.library.tracks.find((track) => track.title === "Always on the Run - Lenny Krawitz").url;
      fetch(url).then((response) => response.blob()).then((blob) => player.openFile(new File([blob], "my-backing.mp3", {type: "audio/mpeg"})));
    JS
    shadow.assert_selector "#trackView", wait: 20
    shadow.assert_selector "#title", text: "my-backing.mp3", wait: 20

    shadow.find("#back").click
    mine = shadow.find("#list tbody:first-of-type")
    assert mine.has_css?("tr[aria-selected=true]", text: "my-backing.mp3")
    assert mine.has_css?("td.origin", text: "This device")
    shadow.find("#list tbody:last-of-type").assert_no_text "my-backing.mp3"
  end

  private
    def playing? = page.evaluate_script("window.phase3Debug.playAlong.engine.playing")

    def open_track(shadow, title)
      shadow.find("#list button", text: title).click
      shadow.assert_selector "#title", text: title, wait: 20
      shadow.assert_selector "#trackView"
    end

    # Play and Studio are entries of the left navigation column.
    def switch_to(workspace)
      find("[data-nav=#{workspace}]").click
      assert_selector "body[data-workspace=#{workspace}]"
    end
end
