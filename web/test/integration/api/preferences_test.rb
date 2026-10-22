require "test_helper"

class Api::PreferencesTest < ActionDispatch::IntegrationTest
  test "requires a session" do
    patch api_preferences_path, params: { autoLevel: false }, as: :json
    assert_response :unauthorized
  end

  test "merges whitelisted preferences" do
    sign_in_as users(:alice)
    patch api_preferences_path, params: { autoLevel: false, admin: true }, as: :json
    patch api_preferences_path, params: { modelVariant: "lite" }, as: :json
    assert_equal({ "autoLevel" => false, "modelVariant" => "lite" }, response.parsed_body)
    get api_preferences_path
    assert_equal({ "autoLevel" => false, "modelVariant" => "lite" }, response.parsed_body)
    assert_equal({}, users(:bob).reload.preferences)
  end

  test "keeps only valid Play along settings" do
    sign_in_as users(:alice)
    play_along = { trackId: "bt-e593dafe4c5eefe3", rate: 0.85, volumeDb: -9, mix: 0.6, guitarPan: 0, muted: false, expanded: true,
      loop: { enabled: true, startSeconds: 12.5, endSeconds: 40 } }
    patch api_preferences_path, params: { playAlong: play_along.merge(admin: true, normalized: "yes") }, as: :json
    assert_equal play_along.deep_stringify_keys, response.parsed_body["playAlong"]

    patch api_preferences_path, params: { playAlong: { trackId: "../etc/passwd", rate: 4, loop: { enabled: true, startSeconds: -1, endSeconds: 2 } } }, as: :json
    assert_equal({}, response.parsed_body["playAlong"], "nothing valid is kept")
    patch api_preferences_path, params: { playAlong: "loud" }, as: :json
    assert_equal({}, response.parsed_body["playAlong"], "a non-object leaves the stored value")
  end
end
