require "test_helper"

class SignInTokenTest < ActiveSupport::TestCase
  test "issue stores a digest only, valid for 15 minutes" do
    issued = SignInToken.issue!(email: " New@Example.com ", request_ip: "1.2.3.4")
    record = issued.record
    assert_equal "new@example.com", record.email
    assert_operator issued.token.length, :>=, 40
    assert_not_equal issued.token, record.token_digest
    assert_equal SignInToken.digest(issued.token), record.token_digest
    assert_in_delta 15.minutes.from_now, record.expires_at, 5.seconds
    assert_equal "1.2.3.4", record.request_ip
  end

  test "token signs in once and creates the account on first use" do
    issued = SignInToken.issue!(email: "first@example.com")
    assert_difference -> { User.count }, 1 do
      user = SignInToken.find_active_by_token(issued.token).consume
      assert_equal "first@example.com", user.email
    end
    assert_nil SignInToken.find_active_by_token(issued.token)
    assert_nil issued.record.consume
  end

  test "existing users are reused" do
    issued = SignInToken.issue!(email: "ALICE@example.com")
    assert_no_difference -> { User.count } do
      assert_equal users(:alice), issued.record.consume
    end
  end

  test "expired tokens are rejected" do
    issued = SignInToken.issue!(email: "alice@example.com")
    travel 16.minutes do
      assert_nil SignInToken.find_active_by_token(issued.token)
    end
  end

  test "a new request invalidates previous tokens" do
    first = SignInToken.issue!(email: "alice@example.com")
    second = SignInToken.issue!(email: "alice@example.com")
    assert_nil SignInToken.find_active_by_token(first.token)
    assert_equal users(:alice), SignInToken.find_active_by_token(second.token).consume
  end
end
