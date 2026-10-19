require "test_helper"

class Api::ImportsTest < ActionDispatch::IntegrationTest
  test "imports guest data into the signed-in account only" do
    users(:alice).update!(preferences: { "modelVariant" => "full" })
    sign_in_as users(:alice)

    post api_import_path, as: :json, params: {
      presets: [ { name: "Local crunch", state: { version: 1, nam: {}, cabinet: {} } } ],
      favorites: [ { kind: "nam_model", assetRef: "factory:alice-model", metadata: { name: "updated" } },
                   { kind: "ir", assetRef: "local:ir", metadata: {} } ],
      preferences: { autoLevel: false, modelVariant: "lite" }
    }
    assert_response :success

    alice = users(:alice).reload
    assert_not alice.presets.exists?(name: "Local crunch"), "presets are not imported"
    assert_not response.parsed_body.key?("presets")
    assert_equal 2, alice.favorites.count
    assert_equal({ "autoLevel" => false, "modelVariant" => "full" }, alice.preferences) # account wins
    assert_equal 1, users(:bob).presets.count
  end

  test "an invalid entry rolls the whole import back" do
    sign_in_as users(:alice)
    post api_import_path, as: :json, params: {
      favorites: [ { kind: "ir", assetRef: "local:ok", metadata: {} }, { kind: "unknown", assetRef: "local:bad", metadata: {} } ]
    }
    assert_response :unprocessable_content
    assert_not users(:alice).favorites.exists?(asset_ref: "local:ok")
  end
end
