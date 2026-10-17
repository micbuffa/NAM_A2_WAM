require "application_system_test_case"

# Every popup closes on a click outside it, like Esc (ui/light-dismiss.js).
class DialogLightDismissTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_synced
    visit "/rack/"
    wait_for_rack
  end

  test "a click outside closes the settings dialog, a click inside does not" do
    find("#settingsButton").click
    assert_selector "dialog.host-settings[open]"
    find("dialog.host-settings h3", text: "Audio").click
    assert_selector "dialog.host-settings[open]"

    click_outside
    assert_no_selector "dialog[open]"
    assert_equal "false", find("#settingsButton")["aria-expanded"]
  end

  test "a click outside the new preset dialog cancels it" do
    click_on "New preset"
    assert_selector "dialog.new-preset-dialog[open]"
    click_outside
    assert_no_selector "dialog[open]"
    assert_selector "#presetSelect option", text: "No preset saved yet", visible: :all
    assert_selector "#presetTitle", text: "Untitled rack"
  end

  private
    def click_outside
      page.driver.browser.action.move_to_location(8, 8).click.perform
    end
end
