# "Use in Play": a mix rendered in Studio becomes a Play backing track of its sender,
# independent of the project afterwards (rename or delete it in Play only). A draft
# is the mix of unsaved work: its sources cannot be checked against the saved
# project, so only its audio contract is.
class Api::Projects::MixesController < Api::BaseController
  include ProjectAccess

  def create
    project = owned_project
    token = json_body["token"]
    return invalid("Invalid render token") unless token.is_a?(String) && token.match?(/\A[a-zA-Z0-9-]{16,80}\z/)
    manifest = json_body["manifest"]
    manifest = JSON.parse(manifest) if manifest.is_a?(String)
    draft = ActiveModel::Type::Boolean.new.cast(json_body["draft"]) || false
    name = json_body["name"].to_s.squish.presence
    return invalid("Name is too long (maximum is 80 characters)") if name && name.length > 80
    current_user.with_lock do
      existing = current_user.backing_tracks.for_render_token(token)
      if existing
        return invalid("Render token belongs to another mix", :conflict) unless existing.import_metadata["manifest"] == manifest
        existing.update!(name:) if name
        return render json: existing.api_json
      end
      draft ? ProjectMix.validate_contract!(manifest) : ProjectMix.validate!(project, manifest)
      file = json_body["audio"]
      unless file.is_a?(ActionDispatch::Http::UploadedFile) && file.size.between?(128, Track::MAX_AUDIO_BYTES) && %w[audio/mpeg audio/mp3].include?(file.content_type)
        return invalid("An MP3 file (maximum 100 MiB) is required")
      end
      # Recognize the encoder's MPEG Layer III frame header, not a renamed file.
      header = file.tempfile.read(4).bytes; file.tempfile.rewind
      rate_index = [44100, 48000, 32000].index(manifest["sampleRate"])
      unless header.length == 4 && header[0] == 255 && (header[1] & 0xe0) == 0xe0 && (header[1] & 0x18) == 0x18 && (header[1] & 6) == 2 && (header[2] >> 4) == 11 && ((header[2] >> 2) & 3) == rate_index && (header[3] & 0xc0) != 0xc0
        return invalid("Invalid MP3 audio")
      end
      return invalid("Audio storage quota exceeded") if BackingTrack.quota_exceeded?(current_user, file.size)
      name ||= "#{project.name.truncate(60)} · #{manifest["selection"] == "loop" ? "Loop" : "Mix"}"
      track = current_user.backing_tracks.new(source: "studio", name:, duration: manifest["frames"].to_f / manifest["sampleRate"],
        import_metadata: { "kind" => "studio_mix", "projectId" => project.id, "projectName" => project.name, "renderToken" => token, "manifest" => manifest, "draft" => draft })
      blob = ActiveStorage::Blob.build_after_unfurling(io: file.tempfile, filename: "studio-mix.mp3", content_type: "audio/mpeg")
      begin
        blob.save!; blob.upload_without_unfurling(file.tempfile)
        track.audio.attach(blob); track.save!
      rescue
        blob.purge
        raise
      end
      render json: track.api_json, status: :created
    end
  rescue JSON::ParserError, ArgumentError => error
    invalid(error.message)
  end

  private
    def invalid(message, status = :unprocessable_content)
      render json: {error: message}, status:
    end
end
