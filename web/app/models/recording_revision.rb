# Only inactive versions, shared immutable blobs (never duplicated WAV bytes).
# Two inactive revisions per project, matching the session's audio command cap.
class RecordingRevision < ApplicationRecord
  belongs_to :track
  has_one_attached :audio
  FIELDS = %w[recording preset_snapshot snapshot_id preset_id factory_preset].freeze
  LIMIT = 2

  def self.archive!(track)
    track.recording_version_id ||= SecureRandom.uuid
    revision = create!(track: track, token: track.recording_version_id, state: track.attributes.slice(*FIELDS))
    revision.audio.attach(track.audio.blob) if track.audio.attached?
    revision
  end

  def release!
    blob = audio.blob if audio.attached?
    audio.detach
    destroy!
    blob.purge_later if blob && !blob.attachments.exists?
  end

  def self.prune!(project)
    where(track_id: project.tracks.select(:id)).order(created_at: :desc, id: :desc).offset(LIMIT).each(&:release!)
  end
end
