require "test_helper"

class SessionTest < ActiveSupport::TestCase
  test "last_seen_at is throttled" do
    session = users(:alice).sessions.create!(last_seen_at: 1.minute.ago)
    assert_no_changes -> { session.reload.last_seen_at } do
      session.touch_last_seen
    end
    session.update_column(:last_seen_at, 1.hour.ago)
    assert_changes -> { session.reload.last_seen_at } do
      session.touch_last_seen
    end
  end
end
