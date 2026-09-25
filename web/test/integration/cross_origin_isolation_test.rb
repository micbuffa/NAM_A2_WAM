require "test_helper"

# SharedArrayBuffer only exists on cross-origin isolated pages: COOP and COEP
# must be sent on the page and on every static asset it loads.
class CrossOriginIsolationTest < ActionDispatch::IntegrationTest
  include RackAssets

  test "rack page is sent with isolation headers" do
    get "/rack/"
    assert_response :success
    assert_isolation_headers
  end

  test "rack page redirects to the trailing-slash URL" do
    get "/rack"
    assert_redirected_to "/rack/"
    get "/"
    assert_redirected_to "/rack/"
  end

  test "TONE3000 redirect URI renders the rack page" do
    get "/rack/index.html", params: { code: "abc", state: "xyz" }
    assert_response :success
    assert_select "script[src='./main.js'][type=module]"
  end

  test "static files are sent with isolation headers" do
    get "/robots.txt"
    assert_response :success
    assert_isolation_headers
  end

  test "WASM is served statically as application/wasm with isolation headers" do
    skip_unless_rack_synced
    get "/rack/#{RackAssets::WASM_PATH}"
    assert_response :success
    assert_equal "application/wasm", response.media_type
    assert_isolation_headers
  end

  test "rack ES modules are served statically" do
    skip_unless_rack_synced
    get "/rack/main.js"
    assert_response :success
    assert_equal "text/javascript", response.media_type
    assert_isolation_headers
  end

  private
    def assert_isolation_headers
      assert_equal "same-origin", response.headers["cross-origin-opener-policy"]
      assert_equal "require-corp", response.headers["cross-origin-embedder-policy"]
      assert_equal "same-origin", response.headers["cross-origin-resource-policy"]
    end
end
