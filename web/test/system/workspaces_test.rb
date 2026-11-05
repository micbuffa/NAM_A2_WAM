require "application_system_test_case"

# Tone / Projects: switching changes what is shown, never what is playing
# (see ProjectsTest for a project playing on in Tone).
class WorkspacesTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack
  end

  teardown { switch_to "tone" if page.has_css?("[data-nav=tone]", wait: 0) }

  test "each workspace shows its own panels" do
    assert_selector "#presetsPanel", visible: true
    assert_selector ".fx-rack", visible: true
    assert_selector "#enableLive", visible: true # in the Play live card
    assert_no_selector "#projectsWorkspace", visible: true

    switch_to "projects"
    assert_selector "#projectsWorkspace", visible: true
    assert_selector ".projects-header h2", visible: true # Studio's own page header
    assert_no_selector "#enableLive", visible: true
    assert_no_selector "#presetsPanel", visible: true
    assert_no_selector ".fx-rack", visible: true
    find("[data-nav=devices]").click # Audio devices belong to both, in a popup
    assert_selector "#audioDevicesDialog[open] #inputDevice", visible: true
    find("#audioDevicesDialog [data-close]").click
    assert_no_selector "#audioDevicesDialog[open]"

    visit "/rack/"
    wait_for_rack
    assert_selector "#projectsWorkspace", visible: true # the workspace is remembered
  end

  test "Play shows its title, Play live, then the Play along above the rack dock, whose header holds the presets" do
    assert_selector ".rack-stage > .play-header:first-child h2", text: "Play", visible: true
    assert_selector ".rack-stage > .play-header + #playLive #enableLive", text: "Enable live input", visible: true
    assert_selector "#playLive #playLiveInput", text: "Input off"
    assert_selector "#playLive tl-meter#playLiveMeter", visible: true
    assert_no_selector "#playLive tl-icon, #playLiveRig", visible: :all # no icon, no Edit rig: the dock below shows the rig
    assert_selector ".rack-stage > #playLive + .play-along-section #playAlongHead #playImport", visible: true
    assert_selector ".play-along-section > #playAlongCard > backing-track-player", visible: true
    assert_selector "#rackDock .rack-header #presetsPanel #presetSelect", visible: true
    assert_no_selector ".host-sidebar #presetsPanel", visible: :all
    along, rack = page.evaluate_script(<<~JS)
      [document.querySelector("backing-track-player"), document.querySelector("#rackDock")].map((e) => e.getBoundingClientRect().top)
    JS
    assert_operator along, :<, rack
  end

  test "Play live names the current preset" do
    assert_equal page.evaluate_script("document.querySelector('#presetTitle').textContent.trim()"), find("#playLivePreset").text
  end

  test "the rack dock is as tall as its header and chain A; chain B is reached by scrolling" do
    page.execute_script("const t = document.querySelector('#toggleChains'); t.value = '2'; t.dispatchEvent(new Event('change', {bubbles: true}))")
    assert_selector "#fxChainB", visible: true
    geometry = -> {
      page.evaluate_script(<<~JS)
        (() => {
          const dock = document.querySelector("#rackDock"), header = dock.querySelector(".rack-header");
          const a = document.querySelector("#fxChain").getBoundingClientRect(), b = document.querySelector("#fxChainB").getBoundingClientRect();
          return {headerBottom: header.getBoundingClientRect().bottom, aTop: a.top, aBottom: a.bottom, bTop: b.top,
            dockBottom: dock.getBoundingClientRect().bottom, scrollable: dock.scrollHeight > dock.clientHeight + 1};
        })()
      JS
    }
    g = nil
    deadline = Time.now + 10
    until (g = geometry.call)["scrollable"] && g["aBottom"] <= g["dockBottom"] + 1
      flunk "the dock never fitted chain A: #{g}" if Time.now > deadline
      sleep 0.1
    end
    assert_operator g["aTop"], :>=, g["headerBottom"], "chain A must not cover the dock header"
    assert_operator g["bTop"], :>=, g["dockBottom"] - 40, "chain B starts below the visible part"
    page.execute_script("const t = document.querySelector('#toggleChains'); t.value = '1'; t.dispatchEvent(new Event('change', {bubbles: true}))")
  end

  test "the rack dock collapses to its header and stays collapsed across workspaces and reloads" do
    find("#rackDockToggle").click
    assert_no_selector ".fx-rack", visible: true
    assert_selector "#presetSelect", visible: true

    switch_to "projects"
    assert_selector "#rackDock .rack-dock-placeholder", visible: true

    visit "/rack/"
    wait_for_rack
    switch_to "tone"
    assert_no_selector ".fx-rack", visible: true
    find("#rackDockToggle").click
    assert_selector ".fx-rack", visible: true
  end

  test "a guest is invited to sign in to use projects" do
    switch_to "projects"
    assert_selector "#projectsEmpty", visible: true # instead of the project list
    assert_selector "#projectsEmptyTitle", text: "Sign in to use projects"
    assert_selector "#projectsEmptyAction", text: "Sign in", visible: true
    assert_no_selector "#studioHome", visible: true
  end

  private
    def switch_to(workspace)
      find("[data-nav=#{workspace}]").click # Play and Studio are entries of the left navigation column
      assert_selector "body[data-workspace=#{workspace}]"
    end
end
