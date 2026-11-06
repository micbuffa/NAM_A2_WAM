require "test_helper"

# The rack page is generated from examples/wam/index.html (lib/rack_view.rb).
class RackMarkupTest < ActionDispatch::IntegrationTest
  test "rack page keeps every id of examples/wam/index.html" do
    ids = File.read(RackView::SOURCE).scan(/\sid="([^"]+)"/).flatten
    assert_operator ids.size, :>, 20

    get "/rack/"
    ids.each { |id| assert_select "##{id}", { count: 1 }, "missing ##{id}" }
  end

  test "rack page carries the CSRF token and the current user payload" do
    with_forgery_protection { get "/rack/" }
    assert_select "meta[name=csrf-token]"
    assert_select "script#currentUser[type='application/json']", text: "null"
  end

  test "rack page tells whether developer tools are on (FRETWORK_DEV_TOOLS=1)" do
    with_dev_tools(nil) { get "/rack/" }
    assert_select "meta[name=fretwork-dev-tools][content=false]"
    with_dev_tools("1") { get "/rack/" }
    assert_select "meta[name=fretwork-dev-tools][content=true]"
  end
  test "Studio exposes one separation entry and leaves duration selection to its dialog" do
    get "/rack/"
    assert_select "#studioSeparation[hidden]", count: 1
    assert_select "#studioSeparate", count: 0
    assert_select "#studioStop[hidden]", text: "Stop separation"
    # Separating lives in the project's ⋯ menu (Separate again… once separated).
    assert_select "#projectMore #projectSeparate[hidden][aria-haspopup=dialog]", text: "Separate instruments…"
    # The chooser creates this field dynamically; the whole-song default and
    # excerpt dispatch are covered by the StudioSeparationView unit tests.
    assert_select "#studioExcerpt", count: 0
    # Studio and recording settings are sections of Settings (StudioSettings.js), not buttons of the project view.
    assert_select "#settingsButton", count: 1
    assert_select "#studioOptions, #recordOptions", count: 0
    assert_select "#studioOptionsPanel[hidden]", count: 1
    assert_select "#recordOptionsPanel[hidden]", count: 1
    assert_select "#studioProgress[aria-label='Separation progress']", count: 1
    assert_select "#studioOriginal, #studioInstruments", count: 0
    assert_select "#studioTrackState[role='status']", count: 1
  end

  test "Studio exposes an accessible playback master volume" do
    get "/rack/"
    assert_select "#projectMasterVolume[type=range][min='0'][max='100'][value='100'][aria-label='Studio master volume']", count:1
    assert_select "#projectMasterValue", text:"100%"
  end

  test "Studio toolbar stays in its header, the navigation column collapses, and tracks share a scrollport" do
    get "/rack/"
    assert_select ".projects-header #projectImport", count: 1
    assert_select ".projects-header #projectNew", count: 1
    assert_select "#hostSidebar #hostNavToggle[aria-controls='hostSidebar'][aria-expanded='true']", count: 1 # last entry of the column
    assert_select "#projectTrackViewport[role='region'][tabindex='0']" do
      assert_select "#projectRuler", count: 1
      assert_select "#projectTracks", count: 1
    end
  end

  test "recording shares the transport and has no redundant input panel" do
    get "/rack/"
    assert_select ".project-transport #projectRecord[aria-label=Record]", count: 1
    assert_select "#projectRecordStop", count: 0
    assert_select ".project-transport #projectPlay[icon=play][size=sm]", count: 1
    # Loop is one LED toggle; the × that clears the region starts hidden.
    assert_select ".project-loop #projectLoop.led-toggle", count: 1
    assert_select ".project-loop #projectLoopReset[hidden][aria-label=?]", "Clear the loop", count: 1
    assert_select ".project-loop-head", count: 0
    assert_select ".project-position #projectClock + #projectBarBeat", count: 1
    assert_select "#recordPanel, #recordArm, #recordMonitor", count: 0
    assert_select "#recordStatusBar #recordStatus[role=status]", count: 1
    assert_select "#recordOptionsPanel #recordCurrentTone", count: 1
    assert_select "#recordOptionsPanel #recordDiscard", count: 1
    assert_select "#studioOptionsPanel #projectTrackDensity", count: 1
  end

  test "Studio ruler exposes its interactive A B controls to accessibility" do
    get "/rack/"
    assert_select ".project-ruler-row[aria-hidden='true']", count: 0
    assert_select "#projectRuler[aria-label='Timeline and A/B loop']", count: 1
  end

  private
    # web/.env may set the flag on this machine; each test sets it explicitly.
    def with_dev_tools(value)
      previous = ENV["FRETWORK_DEV_TOOLS"]
      ENV["FRETWORK_DEV_TOOLS"] = value
      yield
    ensure
      ENV["FRETWORK_DEV_TOOLS"] = previous
    end
end
