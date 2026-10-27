# Only audio already authorized in Tone; never fetch a browser-supplied URL.
class BackingProjectImport
  def self.call(user:, id: nil, audio: nil, title: nil, project_id: nil, name: nil)
    blob = nil; owned_blob = false; metadata = { "kind" => "local" }
    if id.to_s.match?(/\Astudio-[1-9][0-9]*\z/)
      source = Track.where(project: Project.visible_to(user), origin: "mix").with_attached_audio.find(id.delete_prefix("studio-"))
      raise ArgumentError, "Backing audio is missing" unless source.audio.attached?
      blob = source.audio.blob; title = source.name
      metadata = {"kind"=>"studio_mix", "sourceProjectId"=>source.project_id, "sourceTrackId"=>source.id, "checksum"=>blob.checksum}
    elsif id.to_s.match?(/\Astudio-source-[1-9][0-9]*\z/)
      source = Track.where(project: Project.visible_to(user), origin: "original", removed_at: nil).with_attached_audio.find(id.delete_prefix("studio-source-"))
      raise ActiveRecord::RecordNotFound unless source.import_metadata&.dig("kind") == "youtube"
      raise ArgumentError, "Backing audio is missing" unless source.audio.attached?
      blob = source.audio.blob; title = source.name
      metadata = source.import_metadata.merge("kind"=>"studio_source", "sourceProjectId"=>source.project_id, "sourceTrackId"=>source.id, "checksum"=>blob.checksum)
    elsif id.to_s.match?(/\Abt-[a-f0-9]{16}\z/)
      directory = Rails.root.join("public/rack/assets/backingTracks")
      entry = JSON.parse(directory.join("tracks.json").read).fetch("tracks").find { |t| t["id"] == id }
      raise ActiveRecord::RecordNotFound unless entry
      path = directory.join(URI::DEFAULT_PARSER.unescape(entry.fetch("url"))).realpath
      raise ArgumentError, "Invalid bundled path" unless path.file? && path.to_s.start_with?(directory.realpath.to_s + "/")
      audio = {io:path.open("rb"),filename:path.basename.to_s,content_type:"audio/mpeg"}; title = entry["title"]
      metadata = {"kind"=>"bundled", "backingId"=>id}
    elsif id.present?
      raise ArgumentError, "Choose a backing from Tone"
    else
      raise ArgumentError, "Choose a local audio file" unless audio.is_a?(ActionDispatch::Http::UploadedFile)
      title = audio.original_filename if title.blank?
    end
    user.with_lock do
      size = blob ? blob.byte_size : audio.is_a?(Hash) ? audio[:io].size : audio.size
      raise ArgumentError, "Audio exceeds 100 MiB" unless size.positive? && size <= Track::MAX_AUDIO_BYTES
      raise ArgumentError, "Account audio quota exceeded" if Separation.storage_bytes(user.projects)+size > Separation::USER_QUOTA
      project = project_id.present? ? user.projects.find(project_id) : user.projects.create!(name:(name.presence || title).to_s.truncate(120),bpm:120)
      raise ArgumentError, "Project audio quota exceeded" if Separation.storage_bytes(Project.where(id:project.id))+size > Separation::PROJECT_QUOTA
      track = project.tracks.new(name:title.to_s.truncate(80),instrument:"other",origin:"original",creator:user,position:(project.tracks.maximum(:position) || -1)+1,import_metadata:metadata)
      unless blob
        input = audio.is_a?(Hash) ? audio : {io:audio.tempfile,filename:audio.original_filename,content_type:audio.content_type}
        blob = ActiveStorage::Blob.build_after_unfurling(**input);blob.save!;owned_blob=true;blob.upload_without_unfurling(input[:io])
      end
      track.audio.attach(blob);track.save!;[project,track]
    end
  rescue
    blob.purge if owned_blob && blob
    raise
  ensure
    audio[:io].close if audio.is_a?(Hash)
  end
end
