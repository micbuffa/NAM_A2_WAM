# A signed-in device. The signed session_id cookie points here.
class Session < ApplicationRecord
  SEEN_THROTTLE = 10.minutes

  belongs_to :user

  def touch_last_seen(now = Time.current)
    update_column(:last_seen_at, now) if last_seen_at.nil? || last_seen_at < now - SEEN_THROTTLE
  end
end
