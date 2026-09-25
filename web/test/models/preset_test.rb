require "test_helper"

class PresetTest < ActiveSupport::TestCase
  test "requires a name and an object state" do
    assert_not Preset.new(user: users(:alice), name: " ", state: { "nam" => {} }).valid?
    assert_not Preset.new(user: users(:alice), name: "x", state: []).valid?
    assert_not Preset.new(user: users(:alice), name: "x", state: {}).valid?
    preset = Preset.new(user: users(:alice), name: "  Big   crunch ", state: { "nam" => {} })
    assert preset.valid?
    assert_equal "Big crunch", preset.name
  end

  test "rejects oversized states" do
    preset = Preset.new(user: users(:alice), name: "x", state: { "blob" => "a" * (Preset::MAX_STATE_BYTES + 1) })
    assert_not preset.valid?
    assert_includes preset.errors[:state].first, "too large"
  end
end
