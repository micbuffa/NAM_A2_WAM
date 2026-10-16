require "test_helper"

class UserPreferencesTest < ActiveSupport::TestCase
  test "sanitize keeps only known keys with valid values" do
    assert_equal({ "autoLevel" => false, "modelVariant" => "lite" },
      User.sanitize_preferences("autoLevel" => false, "modelVariant" => "lite", "admin" => true))
    assert_equal({}, User.sanitize_preferences("autoLevel" => "yes", "modelVariant" => "huge"))
  end

  test "the last preset is an account preset id, a Factory id, or none" do
    assert_equal({ "lastPresetId" => 12 }, User.sanitize_preferences("lastPresetId" => 12))
    assert_equal({ "lastPresetId" => "factory:twin-clean" }, User.sanitize_preferences("lastPresetId" => "factory:twin-clean"))
    assert_equal({ "lastPresetId" => nil }, User.sanitize_preferences("lastPresetId" => nil))
    [ 0, -3, "12", "local-abc", "factory:<script>", 1.5, {} ].each do |value|
      assert_equal({}, User.sanitize_preferences("lastPresetId" => value), value.inspect)
    end
  end
end
