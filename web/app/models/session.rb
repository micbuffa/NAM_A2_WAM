# A signed-in device. The signed session_id cookie points here. A session
# unused for IDLE_TIMEOUT is dropped, so a forgotten device (public computer,
# lost laptop) does not stay signed in for good.
class Session < ApplicationRecord
  SEEN_THROTTLE = 10.minutes
  IDLE_TIMEOUT = 90.days

  belongs_to :user

  scope :idle, -> { where(last_seen_at: ...IDLE_TIMEOUT.ago).or(where(last_seen_at: nil, created_at: ...IDLE_TIMEOUT.ago)) }

  def idle?(now = Time.current) = (last_seen_at || created_at) < now - IDLE_TIMEOUT

  def touch_last_seen(now = Time.current)
    update_column(:last_seen_at, now) if last_seen_at.nil? || last_seen_at < now - SEEN_THROTTLE
  end
end
