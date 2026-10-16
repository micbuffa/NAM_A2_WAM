require "application_system_test_case"

# Regression: after resetting the microphone permission, the user picks a
# 2-channel sound card in the browser prompt. The rack must keep that card
# instead of falling back to the (mono) system default after the grant.
class MicrophonePermissionTest < ApplicationSystemTestCase
  include RackAssets

  MOCK = Rails.root.join("test/fixtures/files/microphone_permission_mock.js").read

  setup do
    skip_unless_rack_synced
    page.driver.browser.execute_cdp("Page.addScriptToEvaluateOnNewDocument", source: MOCK)
  end

  test "the sound card picked in the startup permission prompt stays selected" do
    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_select_value "Scarlett Solo USB", "Input 1, Input 2"

    click_on "Enable live input"
    assert_text "Live input active", wait: 10
    assert_select_value "Scarlett Solo USB", "Input 1, Input 2"
    assert_equal [ %(\"\" -> card (2 ch)), %(\"card\" -> card (2 ch)) ], page.evaluate_script("window.__gum")
  end

  test "the sound card picked when enabling live input after a dismissed prompt stays selected" do
    visit "/rack/"
    page.execute_script("window.name = 'dismiss-first-prompt'; location.reload()")
    wait_for_rack(wait: 40)
    assert_text "Cannot detect channels"

    click_on "Enable live input"
    assert_text "Live input active", wait: 10
    assert_select_value "Scarlett Solo USB", "Input 1, Input 2"
    assert_equal [ %(\"\" -> card (2 ch)) ], page.evaluate_script("window.__gum")
  end

  private
    def assert_select_value(device, channels)
      assert_equal device, page.evaluate_script("document.querySelector('#inputDevice').selectedOptions[0]?.textContent")
      assert_equal channels, page.evaluate_script("[...document.querySelector('#inputChannel').options].map(o => o.textContent).join(', ')")
    end
end
