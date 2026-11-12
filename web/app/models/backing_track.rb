# A backing track a user uploaded in Play. Only its creator sees, renames or deletes it (no sharing yet).
# The audio stays on Active Storage so production can move it to S3 (config/storage.yml).
class BackingTrack < ApplicationRecord
  SOURCES = %w[upload youtube studio].freeze

  belongs_to :user
  # The blob can be shared with a Studio track (converted YouTube import, Separate instruments):
  # it is purged only once nothing else uses it.
  has_one_attached :audio, dependent: false
  before_destroy :release_audio
  after_destroy_commit :purge_unused_audio

  normalizes :name, with: ->(name) { name.squish }
  validates :name, presence: true, length: { maximum: 80 }
  validates :duration, numericality: { greater_than: 0, less_than: 86_400 }, allow_nil: true
  validates :source, inclusion: { in: SOURCES }
  validate :audio_is_a_sound_file

  scope :owned_by, ->(user) { user ? where(user:) : none }

  # Bytes of a user's Play backing tracks, counted with their projects in the account quota.
  def self.storage_bytes(user)
    ActiveStorage::Blob.where(id: ActiveStorage::Attachment.where(record_type: name, record_id: where(user:).select(:id)).select(:blob_id)).sum(:byte_size)
  end

  # A Studio mix already sent to Play with this render token (sending again is idempotent).
  def self.for_render_token(token)
    where(source: "studio").find_by("json_extract(import_metadata, '$.renderToken') = ?", token)
  end

  # Play's library entry (camelCase, like the other /api routes).
  def api_json
    metadata = import_metadata || {}
    { id: "upload-#{id}", title: name, origin: source, editable: true, videoId: metadata["videoId"],
      projectId: metadata["projectId"], projectName: metadata["projectName"], manifest: metadata["manifest"],
      url: Rails.application.routes.url_helpers.audio_api_backing_track_path(self, v: audio.checksum), filename: audio.filename.to_s,
      contentType: audio.content_type, byteSize: audio.byte_size, duration: duration || audio.blob.metadata["duration"], createdAt: created_at }
  end

  def self.quota_exceeded?(user, extra_bytes)
    Separation.storage_bytes(user.projects) + storage_bytes(user) + extra_bytes > Separation::USER_QUOTA
  end

  private
    def release_audio
      @released_blob = audio.blob if audio.attached?
      audio.detach
    end

    def purge_unused_audio
      @released_blob.purge_later if @released_blob && !@released_blob.attachments.exists?
    end

    def audio_is_a_sound_file
      return errors.add(:audio, "is missing") unless audio.attached?

      errors.add(:audio, "must be an audio file (MP3, WAV, M4A, AIFF, OGG or FLAC)") unless Track::AUDIO_CONTENT_TYPES.include?(audio.content_type)
      errors.add(:audio, "is too large (maximum #{Track::MAX_AUDIO_BYTES / 1.megabyte} MB)") if audio.byte_size > Track::MAX_AUDIO_BYTES
    end
end
