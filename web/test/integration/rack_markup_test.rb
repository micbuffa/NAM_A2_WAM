require "test_helper"

# app/views/rack/show.html.erb is generated from examples/wam/index.html by
# bin/rack-sync (lib/rack_view.rb). Guard against a stale or hand-edited view.
class RackMarkupTest < ActionDispatch::IntegrationTest
  test "rack view is up to date with examples/wam/index.html" do
    assert_equal RackView.generate, File.read(RackView::TARGET), "stale view: run bin/rack-sync"
  end

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
