class Api::Projects::MixesController < Api::BaseController
  include ProjectAccess

  def create
    project = owned_project
    token = json_body["token"]
    return invalid("Invalid render token") unless token.is_a?(String) && token.match?(/\A[a-zA-Z0-9-]{16,80}\z/)
    manifest = json_body["manifest"]
    manifest = JSON.parse(manifest) if manifest.is_a?(String)
    current_user.with_lock do
      existing = project.tracks.find_by(render_token: token)
      if existing
        return invalid("Render token belongs to another mix", :conflict) unless existing.mix_manifest == manifest
        return render json: ProjectJson.backing(existing)
      end
      ProjectMix.validate!(project, manifest)
      file = json_body["audio"]
      unless file.is_a?(ActionDispatch::Http::UploadedFile) && file.size.between?(128, Track::MAX_AUDIO_BYTES) && %w[audio/mpeg audio/mp3].include?(file.content_type)
        return invalid("An MP3 file (maximum 100 MiB) is required")
      end
      # Recognize the encoder's MPEG Layer III frame header, not a renamed file.
      header = file.tempfile.read(4).bytes; file.tempfile.rewind
      unless header.length == 4 && header[0] == 255 && (header[1] & 0xe0) == 0xe0 && (header[1] & 0x18) == 0x18 && (header[1] & 6) == 2 && (header[2] & 0xfc) == 0xb0 && (header[3] & 0xc0) != 0xc0
        return invalid("Invalid MP3 audio")
      end
      if Separation.storage_bytes(Project.where(id: project.id)) + file.size > Separation::PROJECT_QUOTA || Separation.storage_bytes(current_user.projects) + file.size > Separation::USER_QUOTA
        return invalid("Audio storage quota exceeded")
      end
      track = project.tracks.new(origin: "mix", timeline_visible: false, instrument: "other", creator: current_user, render_token: token, mix_manifest: manifest,
        name: "#{project.name.truncate(60)} · #{manifest["selection"] == "loop" ? "Loop" : "Mix"}", position: (project.tracks.maximum(:position) || -1) + 1)
      blob = ActiveStorage::Blob.build_after_unfurling(io: file.tempfile, filename: "studio-mix.mp3", content_type: "audio/mpeg")
      begin
        blob.save!; blob.upload_without_unfurling(file.tempfile)
        track.audio.attach(blob); track.save!
      rescue
        blob.purge
        raise
      end
      render json: ProjectJson.backing(track), status: :created
    end
  rescue JSON::ParserError, ArgumentError => error
    invalid(error.message)
  end

  private
    def invalid(message, status = :unprocessable_content)
      render json: {error: message}, status:
    end
end
