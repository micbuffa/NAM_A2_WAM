# API payloads of projects and tracks (camelCase, like the other /api routes).
module ProjectJson
  extend self

  def summary(project, viewer, track_count: nil)
    { id: project.id, name: project.name, bpm: project.bpm, owned: project.owned_by?(viewer),
      owner: { id: project.user.id, name: project.user.display_name }, trackCount: track_count || visible_track_count(project),
      createdAt: project.created_at, updatedAt: project.updated_at }
  end

  def full(project, viewer)
    tracks = project.tracks.with_attached_audio.includes(:preset, :separation).to_a
    json = summary(project, viewer, track_count: visible_track_count(project, tracks)).merge(tracks: tracks.map { |track| self.track(track) })
    batches = viewer && project.owned_by?(viewer) ? project.separations : project.separations.where(state: "ready")
    json[:separations] = batches.includes(:creator, :parts).order(:created_at).map { |separation| self.separation(separation) }
    json[:activeSeparationId] = project.active_separation_id
    json[:shares] = project.shares.includes(:user).order(:created_at).map { |share| self.share(share) } if json[:owned]
    json
  end

  # Count the restored deck, not the archive of every separation and mix.
  def visible_track_count(project, tracks = project.tracks)
    tracks.count { |track| track.timeline_visible && !track.removed_at && track.origin != "mix" }
  end

  def separation(separation)
    { id: separation.id, state: separation.state, sourceTrackId: separation.source_track_id,
      creatorId: separation.creator_id, creatorName: separation.creator.display_name,
      manifest: separation.manifest, sourceChecksum: separation.source_checksum,
      uploadedRoles: separation.parts.map(&:role), createdAt: separation.created_at }
  end

  def track(track)
    { id: track.id, position: track.position, timelineVisible: track.timeline_visible, removedAt: track.removed_at, name: track.name, origin: track.origin, instrument: track.instrument,
      importMetadata: track.import_metadata, creatorId: track.creator_id, separationId: track.separation_id, sourceRole: track.source_role, presetId: track.preset_id, presetName: track.preset&.name, factoryPreset: track.factory_preset,
      volume: track.volume, pan: track.pan, mute: track.mute, solo: track.solo, inputMonitoring: track.input_monitoring,
      waveform: track.waveform_peaks && { peaks: track.waveform_peaks, duration: track.separation.manifest["frames"].to_f / 44100 },
      audio: audio(track), updatedAt: track.updated_at }
  end

  def backing(track)
    { id: "studio-#{track.id}", title: track.name, projectId: track.project_id, projectName: track.project.name,
      url: audio(track)[:url], filename: track.audio.filename.to_s, duration: track.mix_manifest["frames"].to_f / 44100,
      origin: "studio", manifest: track.mix_manifest, createdAt: track.created_at }
  end

  def share(share)
    { id: share.id, userId: share.user_id, email: share.user.email, name: share.user.display_name }
  end

  private
    def audio(track)
      return unless track.audio.attached?

      # The checksum versions the URL: the audio is cached privately, and a replaced file must not be served from the cache.
      { filename: track.audio.filename.to_s, contentType: track.audio.content_type, byteSize: track.audio.byte_size,
        checksum: track.audio.checksum, url: Rails.application.routes.url_helpers.audio_api_project_track_path(track.project_id, track, v: track.audio.checksum) }
    end
end
