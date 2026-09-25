require "test_helper"

class Api::PresetsTest < ActionDispatch::IntegrationTest
  STATE = { "version" => 1, "nam" => { "parameterValues" => { "inputGain" => { "id" => "inputGain", "value" => 6 } },
    "model" => { "name" => "A2.nam", "data" => "{}" } }, "cabinet" => { "ir" => { "samples" => [ 0.5, -0.25, 0.0 ] } } }.freeze

  test "requires a session" do
    get api_presets_path
    assert_response :unauthorized
    post api_presets_path, params: { name: "x", state: STATE }, as: :json
    assert_response :unauthorized
  end

  test "CRUD round-trip keeps the full chain state" do
    sign_in_as users(:alice)

    post api_presets_path, params: { name: "Crunch", state: STATE }, as: :json
    assert_response :created
    id = response.parsed_body["id"]

    get api_preset_path(id)
    assert_equal STATE, response.parsed_body["state"]

    patch api_preset_path(id), params: { name: "Crunch 2" }, as: :json
    assert_response :success
    assert_equal "Crunch 2", Preset.find(id).name
    assert_equal STATE, Preset.find(id).state

    get api_presets_path
    names = response.parsed_body.map { |preset| preset["name"] }
    assert_equal [ "Crunch 2", "Alice clean" ].sort, names.sort
    assert response.parsed_body.none? { |preset| preset.key?("state") }, "index must not ship states"

    delete api_preset_path(id), as: :json
    assert_response :no_content
    assert_not Preset.exists?(id)
  end

  test "a user can never read or change another user's presets" do
    sign_in_as users(:bob)
    alices = presets(:alice_clean)

    get api_presets_path
    assert_equal [ presets(:bob_lead).id ], response.parsed_body.map { |preset| preset["id"] }

    get api_preset_path(alices)
    assert_response :not_found
    patch api_preset_path(alices), params: { name: "pwned" }, as: :json
    assert_response :not_found
    delete api_preset_path(alices), as: :json
    assert_response :not_found
    assert_equal "Alice clean", alices.reload.name
  end

  test "invalid presets are rejected" do
    sign_in_as users(:alice)
    post api_presets_path, params: { name: "", state: STATE }, as: :json
    assert_response :unprocessable_content
    post api_presets_path, params: { name: "x" }, as: :json
    assert_response :unprocessable_content
  end

  test "writes require the CSRF token" do
    with_forgery_protection do
      get "/rack/"
      token = css_select("meta[name=csrf-token]").first["content"]
      sign_in_code = SignInToken.issue!(email: "alice@example.com").code
      post sign_in_code_path, params: { email: "alice@example.com", code: sign_in_code }, headers: { "X-CSRF-Token" => token }, as: :json
      assert_response :success
      token = response.parsed_body["csrfToken"] # rotated by the new session

      post api_presets_path, params: { name: "No token", state: STATE }, as: :json
      assert_response :unprocessable_content
      assert_equal "Invalid CSRF token", response.parsed_body["error"]

      post api_presets_path, params: { name: "With token", state: STATE }, headers: { "X-CSRF-Token" => token }, as: :json
      assert_response :created
    end
  end
end
