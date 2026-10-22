# API payloads of projects and tracks (camelCase, like the other /api routes).
module ProjectJson
  extend self

  def summary(project, viewer, track_count: project.tracks.size)
    { id: project.id, name: project.name, bpm: project.bpm, owned: project.owned_by?(viewer),
      owner: { id: project.user.id, name: project.user.display_name }, trackCount: track_count,
      createdAt: project.created_at, updatedAt: project.updated_at }
  end

  def full(project, viewer)
    tracks = project.tracks.with_attached_audio.includes(:preset).to_a
    json = summary(project, viewer, track_count: tracks.size).merge(tracks: tracks.map { |track| self.track(track) })
    json[:shares] = project.shares.includes(:user).order(:created_at).map { |share| self.share(share) } if json[:owned]
    json
  end

  def track(track)
    { id: track.id, position: track.position, name: track.name, instrument: track.instrument,
      presetId: track.preset_id, presetName: track.preset&.name, factoryPreset: track.factory_preset,
      volume: track.volume, pan: track.pan, mute: track.mute, solo: track.solo, inputMonitoring: track.input_monitoring,
      audio: audio(track), updatedAt: track.updated_at }
  end

  def share(share)
    { id: share.id, userId: share.user_id, email: share.user.email, name: share.user.display_name }
  end

  private
    def audio(track)
      return unless track.audio.attached?

      # The checksum versions the URL: the audio is cached privately, and a replaced file must not be served from the cache.
      { filename: track.audio.filename.to_s, contentType: track.audio.content_type, byteSize: track.audio.byte_size,
        url: Rails.application.routes.url_helpers.audio_api_project_track_path(track.project_id, track, v: track.audio.checksum) }
    end
end
