class Separation < ApplicationRecord
  MAX_STEM_BYTES = 512.megabytes
  PROJECT_QUOTA = 2.gigabytes
  USER_QUOTA = 5.gigabytes
  belongs_to :project
  belongs_to :source_track, class_name: "Track"
  belongs_to :creator, class_name: "User"
  has_many :parts, class_name: "SeparationPart", dependent: :destroy
  has_many :tracks, dependent: :destroy
  validates :token, format: { with: /\A[a-zA-Z0-9-]{16,80}\z/ }, uniqueness: { scope: :project_id }
  validates :state, inclusion: { in: %w[uploading ready] }
  validate :valid_manifest

  def self.catalogue
    # Production images contain public/rack, not the development repository.
    path = Rails.root.join("../examples/wam/source-separation/studio-models.json")
    path = Rails.root.join("public/rack/source-separation/studio-models.json") unless path.exist?
    JSON.parse(path.read).fetch("models").index_by { |model| model.fetch("id") }
  end

  # Activate only this source's instruments. Other imports/parts keep their
  # visibility and mix. History remains attached and can be restored later.
  def activate_timeline!
    siblings = project.separations.where(source_track_id:)
    project.tracks.where(separation_id: siblings.select(:id)).update_all(timeline_visible: false)
    source_track.update!(timeline_visible: false)
    tracks.where(removed_at: nil).update_all(timeline_visible: true)
    project.update!(active_separation: self)
  end

  def roles = manifest.fetch("roles")

  def self.storage_bytes(projects)
    attachments = ActiveStorage::Attachment.where(record_type: "Track", record_id: Track.where(project_id: projects.select(:id)).select(:id))
      .or(ActiveStorage::Attachment.where(record_type: "SeparationPart", record_id: SeparationPart.where(separation_id: where(project_id: projects.select(:id)).select(:id)).select(:id)))
    ActiveStorage::Blob.where(id: attachments.select(:blob_id)).sum(:byte_size)
  end

  private
    def valid_manifest
      model = self.class.catalogue[manifest["modelId"]]
      valid = model && manifest["modelVersion"] == model["version"] && manifest["modelHashes"] == model["files"].map { |file| file["sha256"] } && manifest["roles"] == model["roles"]
      valid &&= %w[wasm webgpu webnn-cpu webnn-gpu webnn-npu].include?(manifest["requestedBackend"]) && %w[wasm webgpu webnn-cpu webnn-gpu webnn-npu].include?(manifest["backend"])
      if manifest["backend"].to_s.start_with?("webnn-")
        evidence=manifest["webnnEvidence"] || {}
        valid &&= evidence.is_a?(Hash) && manifest["modelId"]=="htdemucs_4s_onnx" && evidence["strictParity"]==true && evidence["validatedBlocks"].is_a?(Integer) && evidence["validatedBlocks"]>0 && evidence["dispatches"].is_a?(Integer) && evidence["dispatches"]>0 && evidence["runtimeVersion"]=="1.30.0" && evidence["effectiveHardware"]=="unknown"
      end
      valid &&= manifest["modelId"]=="htdemucs_4s_onnx" if manifest["requestedBackend"].to_s.start_with?("webnn-")
      frames = manifest["frames"]
      valid &&= manifest["sampleRate"] == 44100 && frames.is_a?(Integer) && frames.positive? && 44 + frames * 8 <= MAX_STEM_BYTES
      valid &&= [ true, false ].include?(manifest["partial"]) && manifest["totalFrames"].is_a?(Integer) && manifest["totalFrames"] >= frames && manifest["totalFrames"] <= 86400 * 44100
      if manifest.key?("sourceFrames") || manifest.key?("excerptSeconds")
        valid &&= manifest["sourceFrames"].is_a?(Integer) && manifest["sourceFrames"] >= manifest["totalFrames"] && manifest["sourceFrames"] <= 86400 * 44100 && [0,5,10,30,60].include?(manifest["excerptSeconds"])
      end
      valid &&= source_track&.project_id == project_id && %w[original legacy].include?(source_track&.origin) && source_track.audio.attached? && source_checksum == source_track.audio.checksum
      errors.add(:manifest, "has an invalid model, source or audio contract") unless valid
    end
end
