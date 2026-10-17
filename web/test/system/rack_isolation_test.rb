require "application_system_test_case"

class RackIsolationTest < ApplicationSystemTestCase
  include RackAssets

  test "rack page is cross-origin isolated and the WAM chain initializes" do
    skip_unless_rack_synced
    visit "/rack/"

    assert_equal true, page.evaluate_script("window.crossOriginIsolated")
    assert_equal true, page.evaluate_script("typeof SharedArrayBuffer === 'function'")
    wait_for_rack(wait: 30)
    assert_equal true, page.evaluate_script("Boolean(window.phase3Debug?.node && window.phase3Debug?.cabinetNode)")
    assert_nil page.evaluate_script("window.phase3Error || null")
  end
end
