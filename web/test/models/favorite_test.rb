require "test_helper"

class FavoriteTest < ActiveSupport::TestCase
  test "kind is restricted and asset refs are unique per user and kind" do
    assert_not Favorite.new(user: users(:alice), kind: "preset", asset_ref: "x").valid?
    assert_not Favorite.new(user: users(:alice), kind: "nam_model", asset_ref: "factory:alice-model").valid?
    assert Favorite.new(user: users(:alice), kind: "ir", asset_ref: "factory:alice-model").valid?
    assert Favorite.new(user: users(:bob), kind: "nam_model", asset_ref: "factory:alice-model").valid?
  end
end
