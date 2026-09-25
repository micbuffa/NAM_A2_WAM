require "test_helper"

class FavoriteTest < ActiveSupport::TestCase
  test "kind is restricted and asset refs are unique per user and kind" do
    assert_not Favorite.new(user: users(:alice), kind: "preset", asset_ref: "x").valid?
    assert_not Favorite.new(user: users(:alice), kind: "nam_model", asset_ref: "factory:alice-model").valid?
    assert Favorite.new(user: users(:alice), kind: "ir", asset_ref: "factory:alice-model").valid?
    assert Favorite.new(user: users(:bob), kind: "nam_model", asset_ref: "factory:alice-model").valid?
  end

  test "metadata can hold a model snapshot but not unbounded data" do
    model = { "id" => "tone3000:1", "data" => "x" * 400.kilobytes }
    assert Favorite.new(user: users(:alice), kind: "nam_model", asset_ref: "tone3000:1", metadata: model).valid?
    huge = { "data" => "x" * (Favorite::MAX_METADATA_BYTES + 1) }
    assert_not Favorite.new(user: users(:alice), kind: "nam_model", asset_ref: "tone3000:2", metadata: huge).valid?
  end
end
