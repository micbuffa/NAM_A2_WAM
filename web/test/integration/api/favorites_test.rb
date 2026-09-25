require "test_helper"

class Api::FavoritesTest < ActionDispatch::IntegrationTest
  test "requires a session" do
    get api_favorites_path
    assert_response :unauthorized
  end

  test "create is idempotent and delete works by id or by asset ref" do
    sign_in_as users(:alice)
    2.times do |i|
      post api_favorites_path, params: { kind: "ir", assetRef: "tone3000:42", metadata: { name: "IR v#{i}" } }, as: :json
      assert_response :created
    end
    assert_equal 1, users(:alice).favorites.where(kind: "ir").count
    assert_equal "IR v1", users(:alice).favorites.find_by(asset_ref: "tone3000:42").metadata["name"]

    get api_favorites_path(kind: "ir")
    assert_equal [ "tone3000:42" ], response.parsed_body.map { |favorite| favorite["assetRef"] }

    delete api_favorites_path(kind: "ir", assetRef: "tone3000:42"), as: :json
    assert_response :no_content
    delete api_favorite_path(favorites(:alice_model)), as: :json
    assert_response :no_content
    assert_empty users(:alice).favorites.reload
  end

  test "favorites are scoped to their owner" do
    sign_in_as users(:alice)
    get api_favorites_path
    assert_equal [ "factory:alice-model" ], response.parsed_body.map { |favorite| favorite["assetRef"] }

    delete api_favorite_path(favorites(:bob_ir)), as: :json
    assert_response :not_found
    delete api_favorites_path(kind: "ir", assetRef: "factory:bob-ir"), as: :json
    assert Favorite.exists?(favorites(:bob_ir).id)
  end

  test "rejects unknown kinds" do
    sign_in_as users(:alice)
    post api_favorites_path, params: { kind: "preset", assetRef: "x" }, as: :json
    assert_response :unprocessable_content
  end
end
