require "test_helper"

# app/views/rack/show.html.erb is the Rails port of examples/wam/index.html.
# Guard against drift: every element id the host scripts rely on must exist.
class RackMarkupTest < ActionDispatch::IntegrationTest
  test "rack view keeps every id of examples/wam/index.html" do
    source = Rails.root.join("../examples/wam/index.html").read
    ids = source.scan(/\sid="([^"]+)"/).flatten
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
