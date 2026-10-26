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
  test "Studio exposes one separation entry and leaves duration selection to its dialog" do
    get "/rack/"
    assert_select "#studioSeparation[hidden]", count: 1
    assert_select "#studioSeparate", text: "Separate instruments"
    assert_select "#studioStop[hidden]", text: "Stop separation"
    # The chooser creates this field dynamically; the whole-song default and
    # excerpt dispatch are covered by the StudioSeparationView unit tests.
    assert_select "#studioExcerpt", count: 0
    assert_select "details.studio-separation-settings:not([open])", count: 1
    assert_select "#studioProgress[aria-label='Separation progress']", count: 1
    assert_select "#studioOriginal[aria-pressed='true']", count: 1
  end

  test "Studio ruler exposes its interactive A B controls to accessibility" do
    get "/rack/"
    assert_select ".project-ruler-row[aria-hidden='true']", count: 0
    assert_select "#projectRuler[aria-label='Timeline and A/B loop']", count: 1
  end

end
