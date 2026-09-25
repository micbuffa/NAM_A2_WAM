require "test_helper"

class UserPreferencesTest < ActiveSupport::TestCase
  test "sanitize keeps only known keys with valid values" do
    assert_equal({ "autoLevel" => false, "modelVariant" => "lite" },
      User.sanitize_preferences("autoLevel" => false, "modelVariant" => "lite", "admin" => true))
    assert_equal({}, User.sanitize_preferences("autoLevel" => "yes", "modelVariant" => "huge"))
  end
end
