# YouTube imports now belong to Play: each YouTube source track of a project
# (not removed, with audio) becomes a backing track of its creator, sharing the
# same blob (no copied bytes). Projects and their tracks are left untouched.
class ConvertYoutubeTracksToBackingTracks < ActiveRecord::Migration[8.1]
  class Track < ActiveRecord::Base
    self.table_name = "tracks"
  end

  class Project < ActiveRecord::Base
    self.table_name = "projects"
  end

  class BackingTrack < ActiveRecord::Base
    self.table_name = "backing_tracks"
  end

  class Attachment < ActiveRecord::Base
    self.table_name = "active_storage_attachments"
  end

  def up
    Track.where(origin: "original", removed_at: nil).find_each do |track|
      metadata = track.import_metadata
      next unless metadata.is_a?(Hash) && metadata["kind"] == "youtube"
      next if BackingTrack.where("json_extract(import_metadata, '$.convertedFromTrackId') = ?", track.id).exists?

      attachment = Attachment.find_by(record_type: "Track", record_id: track.id, name: "audio")
      user_id = track.creator_id || Project.where(id: track.project_id).pick(:user_id)
      next unless attachment && user_id

      duration = metadata["duration"].is_a?(Numeric) && metadata["duration"].positive? && metadata["duration"] < 86_400 ? metadata["duration"] : nil
      backing = BackingTrack.create!(user_id:, name: track.name, source: "youtube", duration:,
        import_metadata: metadata.except("sourceTrackId").merge("convertedFromTrackId" => track.id),
        created_at: track.created_at, updated_at: Time.current)
      Attachment.create!(name: "audio", record_type: "BackingTrack", record_id: backing.id, blob_id: attachment.blob_id, created_at: Time.current)
    end
  end

  def down
    converted = BackingTrack.where("json_extract(import_metadata, '$.convertedFromTrackId') IS NOT NULL")
    Attachment.where(record_type: "BackingTrack", record_id: converted.select(:id)).delete_all
    converted.delete_all
  end
end
