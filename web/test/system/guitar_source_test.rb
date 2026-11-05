require "application_system_test_case"

# The guitar source (live input or a dry file with its player) is a developer tool: it sits in
# the navigation column, above Audio devices, only with FRETWORK_DEV_TOOLS=1 (web/.env) and only on Play.
class GuitarSourceTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_built
    @previous = ENV["FRETWORK_DEV_TOOLS"] # web/.env may set it on this machine
  end

  teardown do
    ENV["FRETWORK_DEV_TOOLS"] = @previous
    find("[data-nav=tone]").click if page.has_css?("[data-nav=tone]", wait: 0)
  end

  test "with developer tools, the guitar source sits above Audio devices on Play only" do
    open_rack dev_tools: "1"
    assert_selector ".host-nav-bottom #playSource", visible: true
    assert page.evaluate_script(<<~JS), "the source comes before Audio devices"
      !!(document.querySelector('#playSource').compareDocumentPosition(document.querySelector('[data-nav=devices]')) & Node.DOCUMENT_POSITION_FOLLOWING)
    JS
    assert_operator all("#audioSource option", visible: :all).size, :>, 1, "dry files are listed after Live input"
    assert_no_selector "#playerPanel", visible: true # Live input: no file player
    assert_no_selector "#inputChannelStatus, #discovery", visible: true

    find("[data-nav=projects]").click
    assert_selector "body[data-workspace=projects]"
    assert_no_selector "#playSource", visible: true
  end

  test "without developer tools, the guitar source stays hidden and on Live input" do
    open_rack dev_tools: nil
    assert_no_selector "#playSource", visible: true
    assert_equal [ "live" ], all("#audioSource option", visible: :all).map(&:value)
  end

  private
    def open_rack(dev_tools:)
      ENV["FRETWORK_DEV_TOOLS"] = dev_tools
      visit "/rack/"
      wait_for_rack
    end
end
