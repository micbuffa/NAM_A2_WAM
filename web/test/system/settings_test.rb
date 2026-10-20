require "application_system_test_case"

# Settings (topbar gear): Audio, General and Account sections.
class SettingsTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack
  end

  test "the gear opens Audio first and lists the sections in order" do
    find("#settingsButton").click
    within("dialog[open]", text: "Settings") do
      assert_equal ["Audio", "General", "Account"], all(".settings-nav-item").map(&:text)
      assert_text "48,000 Hz"
      assert_text "Estimated output delay"
    end
  end

  test "General keeps its session controls across openings" do
    find("#settingsButton").click
    within("dialog[open]", text: "Settings") do
      click_on "General"
      click_on "Save WAM state"
      assert_text "serialized bytes"
      click_on "Done"
    end
    assert_no_css "dialog[open]"
    find("#settingsButton").click
    within("dialog[open]", text: "Settings") do
      click_on "General" unless page.has_text?("Save WAM state", wait: 0)
      assert_text "serialized bytes"
      click_on "Restore state"
      assert_link "WAM FX Registry Lab", href: "./fx-test/"
    end
  end
end
