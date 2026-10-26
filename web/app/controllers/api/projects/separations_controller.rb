# Owner-only staging, then atomic publication. Incomplete uploads are not tracks.
class Api::Projects::SeparationsController < Api::BaseController
  include ProjectAccess

  def create
    current_user.with_lock do
      project = owned_project
      return render_error("Invalid save manifest") unless json_body["manifest"].is_a?(Hash)
      existing = project.separations.find_by(token: json_body["token"])
      if existing
        unless existing.manifest == json_body["manifest"] && existing.source_track_id == json_body["sourceTrackId"].to_i
          return render json: { error: "Save token already belongs to another result" }, status: :conflict
        end
        return render json: ProjectJson.separation(existing)
      end
      source = project.tracks.find(json_body["sourceTrackId"])
      return render_error("Choose an original with audio") unless source.audio.attached?
      return render_error("Discard an unfinished upload before starting another") if project.separations.where(state: "uploading").count >= 2
      separation = project.separations.create!(token: json_body["token"], manifest: json_body["manifest"] || {},
        source_track: source, creator: current_user,
        source_checksum: source.audio.checksum.to_s)
      render json: ProjectJson.separation(separation), status: :created
    end
  end

  def upload
    separation = owned_project.separations.find(params[:id])
    return render_error("Already published", :conflict) unless separation.state == "uploading"
    role = params[:role]
    return render_error("Unknown stem") unless separation.roles.include?(role)
    file = json_body["audio"]
    unless file
      current_user.with_lock do
        separation.reload
        return render_error("Already published", :conflict) unless separation.state == "uploading"
        part = separation.parts.find_by!(role:)
        return render_error("Stem audio is missing") unless part.audio.attached?
        part.update!(part_attributes)
        return render json: { role:, sha256: part.sha256 }
      end
    end
    return render_error("A Float32 stereo WAV file is required") unless file.is_a?(ActionDispatch::Http::UploadedFile)
    frames = separation.manifest.fetch("frames")
    header = file.tempfile.read(44)
    file.tempfile.rewind
    expected = 44 + frames * 8
    valid_header = header&.bytesize == 44 && header[0,4] == "RIFF" && header[8,8] == "WAVEfmt " && header[36,4] == "data" &&
      header[4,4].unpack1("V") == expected - 8 && header[16,4].unpack1("V") == 16 && header[20,16].unpack("vvVVvv") == [3,2,44100,352800,8,32] && header[40,4].unpack1("V") == frames * 8
    return render_error("Invalid WAV contract or truncated audio") unless valid_header && file.size == expected && file.size <= Separation::MAX_STEM_BYTES
    digest = Digest::SHA256.file(file.tempfile.path).hexdigest
    old_blob = nil
    # Serialize quotas per owner (including saves to different projects).
    current_user.with_lock do
      separation.reload
      return render_error("Already published", :conflict) unless separation.state == "uploading"
      part = separation.parts.find_or_initialize_by(role:)
      if part.audio.attached? && part.sha256 == digest
        part.update!(part_attributes)
        return render json: { role:, sha256: digest }
      end
      used_project = Separation.storage_bytes(Project.where(id: owned_project.id))
      used_user = Separation.storage_bytes(current_user.projects)
      return render_error("Audio storage quota exceeded") if used_project + file.size > Separation::PROJECT_QUOTA || used_user + file.size > Separation::USER_QUOTA
      old_blob = part.audio.blob if part.audio.attached?
      part.assign_attributes(sha256: digest, **part_attributes)
      # Upload bytes before attaching: a storage failure cannot publish metadata.
      blob = ActiveStorage::Blob.build_after_unfurling(io: file.tempfile, filename: "#{role}.wav", content_type: "audio/wav")
      begin
        blob.save!
        blob.upload_without_unfurling(file.tempfile)
        part.audio.attach(blob)
        part.save!
      rescue
        blob.purge
        raise
      end
    end
    old_blob&.purge_later
    render json: { role:, sha256: digest }
  end

  def publish
    project = owned_project
    separation = project.separations.find(params[:id])
    current_user.with_lock do
      separation.reload
      unless separation.state == "ready"
        parts = separation.parts.with_attached_audio.index_by(&:role)
        unless parts.keys.sort == separation.roles.sort && parts.values.all? { |part| part.audio.attached? && part.audio.byte_size == 44 + separation.manifest["frames"] * 8 }
          return render_error("Upload every stem before publishing")
        end
        return render_error("The original audio changed; create a new separation", :conflict) unless separation.source_track.audio.checksum == separation.source_checksum
        position = (project.tracks.maximum(:position) || -1) + 1
        separation.roles.each_with_index do |role, index|
          part = parts.fetch(role)
          track = project.tracks.new(name: role.capitalize, instrument: role == "piano" ? "keys" : role, origin: "stem",
            creator: separation.creator, separation:, source_role: role, waveform_peaks: part.peaks, position: position + index, volume: part.volume, pan: part.pan, mute: part.mute, solo: part.solo)
          track.audio.attach(part.audio.blob)
          track.save!
        end
        separation.update!(state: "ready")
      end
      project.update!(active_separation: separation)
    end
    render json: ProjectJson.full(project.reload, current_user)
  end

  def activate
    project = owned_project
    separation = project.separations.find(json_body["id"])
    return render_error("Separation is not ready") unless separation.state == "ready"
    project.update!(active_separation: separation)
    render json: ProjectJson.full(project, current_user)
  end

  # Only unfinished staging is discardable here; published history stays intact.
  def destroy
    separation = owned_project.separations.find(params[:id])
    current_user.with_lock do
      separation.reload
      return render_error("Published separations cannot be removed here", :conflict) if separation.state == "ready"
      separation.destroy!
    end
    head :no_content
  end

  private
    def part_attributes
      attributes = json_body.slice("volume", "pan", "mute", "solo")
      if json_body.key?("peaks")
        attributes["peaks"] = json_body["peaks"].is_a?(String) ? JSON.parse(json_body["peaks"]) : json_body["peaks"]
      end
      attributes
    rescue JSON::ParserError
      raise ActionController::ParameterMissing, :peaks
    end

    def render_error(message, status = :unprocessable_content)
      render json: { error: message }, status:
    end
end
