# Mixes sent from Studio now belong to Play: each mix track (not removed, with
# audio) becomes a backing track of its sender, sharing the same blob (no
# copied bytes). The hidden mix tracks themselves are left in their projects.
class ConvertStudioMixesToBackingTracks < ActiveRecord::Migration[8.1]
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
    Track.where(origin: "mix", removed_at: nil).find_each do |track|
      next if BackingTrack.where("json_extract(import_metadata, '$.convertedFromTrackId') = ?", track.id).exists?

      attachment = Attachment.find_by(record_type: "Track", record_id: track.id, name: "audio")
      project = Project.find_by(id: track.project_id)
      user_id = track.creator_id || project&.user_id
      next unless attachment && project && user_id

      manifest = track.mix_manifest.is_a?(Hash) ? track.mix_manifest : {}
      frames, rate = manifest["frames"], manifest["sampleRate"] || 44_100
      duration = frames.is_a?(Numeric) && frames.positive? && frames.to_f / rate < 86_400 ? frames.to_f / rate : nil
      backing = BackingTrack.create!(user_id:, name: track.name, source: "studio", duration:,
        import_metadata: { "kind" => "studio_mix", "projectId" => project.id, "projectName" => project.name,
          "renderToken" => track.render_token, "manifest" => manifest, "convertedFromTrackId" => track.id },
        created_at: track.created_at, updated_at: Time.current)
      Attachment.create!(name: "audio", record_type: "BackingTrack", record_id: backing.id, blob_id: attachment.blob_id, created_at: Time.current)
    end
  end

  def down
    converted = BackingTrack.where(source: "studio").where("json_extract(import_metadata, '$.convertedFromTrackId') IS NOT NULL")
    Attachment.where(record_type: "BackingTrack", record_id: converted.select(:id)).delete_all
    converted.delete_all
  end
end
