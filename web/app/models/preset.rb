class Preset < ApplicationRecord
  MAX_STATE_BYTES = 8.megabytes

  belongs_to :user

  normalizes :name, with: ->(name) { name.squish }
  validates :name, presence: true, length: { maximum: 100 }
  validate :state_is_a_chain

  def summary_json
    { id:, name:, createdAt: created_at, updatedAt: updated_at }
  end

  def full_json
    summary_json.merge(state:)
  end

  private
    def state_is_a_chain
      if !state.is_a?(Hash) || state.empty?
        errors.add(:state, "must be a WAM chain state object")
      elsif state.to_json.bytesize > MAX_STATE_BYTES
        errors.add(:state, "is too large (maximum #{MAX_STATE_BYTES / 1.megabyte} MB)")
      end
    end
end
