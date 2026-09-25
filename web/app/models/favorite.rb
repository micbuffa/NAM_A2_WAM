class Favorite < ApplicationRecord
  KINDS = %w[nam_model ir].freeze
  # NAM snapshots embed the model text (~300 KB) so a TONE3000 favorite can
  # be loaded on another device; IR snapshots embed the IR file (base64).
  MAX_METADATA_BYTES = 2.megabytes

  belongs_to :user

  validates :kind, inclusion: { in: KINDS }
  validates :asset_ref, presence: true, length: { maximum: 512 }, uniqueness: { scope: [ :user_id, :kind ] }
  validate :metadata_is_small_object

  def as_api_json
    { id:, kind:, assetRef: asset_ref, metadata:, savedAt: updated_at }
  end

  private
    def metadata_is_small_object
      if !metadata.is_a?(Hash)
        errors.add(:metadata, "must be an object")
      elsif metadata.to_json.bytesize > MAX_METADATA_BYTES
        errors.add(:metadata, "is too large")
      end
    end
end
