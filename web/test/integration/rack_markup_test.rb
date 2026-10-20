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
end
