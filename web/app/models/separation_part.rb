class SeparationPart < ApplicationRecord
  belongs_to :separation
  has_one_attached :audio
  validates :role, uniqueness: { scope: :separation_id }
  validates :volume, numericality: { only_integer: true, in: 0..100 }
  validates :pan, numericality: { only_integer: true, in: -100..100 }
  validate :valid_peaks
  def valid_peaks
    return if peaks.nil?
    errors.add(:peaks, "must be a bounded finite envelope") unless peaks.is_a?(Array) && peaks.length.between?(1,2048) && peaks.all? { |value| value.is_a?(Numeric) && value.finite? && value >= 0 }
  end
  validate { errors.add(:role, "is not in this separation") unless separation.roles.include?(role) }
end
