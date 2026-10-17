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
end
