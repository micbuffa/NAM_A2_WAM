require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "normalizes and validates email" do
    user = User.create!(email: "  Carol@Example.COM ")
    assert_equal "carol@example.com", user.email
    assert_not User.new(email: "CAROL@example.com").valid?
    assert_not User.new(email: "not-an-email").valid?
  end

  test "account json exposes only public fields" do
    json = users(:alice).account_json
    assert_equal %i[id email name preferences].sort, json.keys.sort
    assert_equal "alice@example.com", json[:name]
  end
end
