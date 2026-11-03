# Immutable provenance of a rendered accompaniment; no live input or output mix.
class ProjectMix
  def self.validate!(project, manifest)
    raise ArgumentError, "Invalid mix manifest" unless manifest.is_a?(Hash)
    rate = manifest["sampleRate"]
    frames = manifest["frames"]
    range = manifest["range"]
    valid = %w[song loop].include?(manifest.fetch("selection", "song")) && manifest["format"] == "mp3" && [32000, 44100, 48000].include?(rate) && manifest["bitrate"] == 192 &&
      frames.is_a?(Integer) && frames.positive? && frames <= 86400 * rate && range.is_a?(Hash) &&
      range.values_at("start", "end").all? { |v| v.is_a?(Numeric) && v.finite? && v >= 0 && v <= 86400 } &&
      range["end"] > range["start"] && ((range["end"]-range["start"])*rate-frames).abs <= 1 &&
      manifest.values_at("peak", "attenuation").all? { |v| v.is_a?(Numeric) && v.finite? && v >= 0 } &&
      manifest["attenuation"].positive? && manifest["attenuation"] <= 1 && manifest["peak"]*manifest["attenuation"] <= 0.891251
    sources = manifest["sources"]
    valid &&= sources.is_a?(Array) && sources.any? && sources.length <= 200 && sources.all? { |s| s.is_a?(Hash) } && sources.map { |s| s["id"] }.uniq.length == sources.length
    raise ArgumentError, "Invalid mix audio contract" unless valid
    tracks = project.tracks.with_attached_audio.where(id: sources.map { |s| s["id"] }).index_by(&:id)
    sources.each do |source|
      track = tracks[source["id"]]
      raise ArgumentError, "Original audio changed; render the mix again" unless track && track.audio.attached? && track.audio.checksum == source["checksum"]
      validate_sound!(track, manifest) if track.preset_id || track.factory_preset || track.preset_snapshot.present?
      raise ArgumentError, "Generated mixes cannot be mixed back into their own source" if track.origin == "mix"
      raise ArgumentError, "A reserved source is not in the project timeline" unless track.timeline_visible && !track.removed_at
      valid_mix = source["volume"].is_a?(Integer) && (0..100).cover?(source["volume"]) && source["pan"].is_a?(Integer) && (-100..100).cover?(source["pan"]) &&
        [true,false].include?(source["mute"]) && [true,false].include?(source["solo"]) && source["inputMonitoring"] == false
      raise ArgumentError, "Invalid source mix" unless valid_mix
    end
    wet_ids = tracks.values.select { |track| track.preset_id || track.factory_preset || track.preset_snapshot.present? }.map(&:id).sort
    if wet_ids.any?
      raise ArgumentError, "Invalid rendered track list" unless manifest.dig("render", "tracks").map { |row| row["id"] }.sort == wet_ids
    end
    batches = tracks.values.map(&:separation_id).compact.uniq
    if manifest["separationId"].present?
      raise ArgumentError, "Invalid separation source" unless batches == [manifest["separationId"]] && tracks.values.all? { |track| track.origin == "stem" }
    end
    batches.each do |id|
      batch = project.separations.find(id)
      count = tracks.values.count { |track| track.separation_id == id }
      raise ArgumentError, "Save every instrument before exporting" unless batch.state == "ready" && count == batch.tracks.where(timeline_visible: true, removed_at: nil).count
    end

    true
  end

  def self.validate_sound!(track, manifest)
    render = manifest["render"]
    valid = render.is_a?(Hash) && render["version"] == 1 && render["engine"] == "wam-offline-v1" && render["outputRate"] == manifest["sampleRate"] &&
      render["tailSeconds"].is_a?(Numeric) && render["tailSeconds"].finite? && render["tailSeconds"].between?(0, 10) &&
      render["tracks"].is_a?(Array) && render["tracks"].all? { |row| row.is_a?(Hash) } &&
      render["tracks"].map { |row| row["id"] }.uniq.length == render["tracks"].length
    raise ArgumentError, "Preset rendering metadata is missing or invalid" unless valid
    source_range = render["sourceRange"]
    valid_range = source_range.is_a?(Hash) && source_range.values_at("start", "end").all? { |v| v.is_a?(Numeric) && v.finite? } &&
      source_range["start"] == manifest["range"]["start"] && source_range["end"] > source_range["start"] &&
      ((source_range["end"] + render["tailSeconds"] - manifest["range"]["end"]) * manifest["sampleRate"]).abs <= 1 &&
      (manifest["selection"] != "loop" || render["tailSeconds"].zero?)
    raise ArgumentError, "Invalid processed mix range" unless valid_range
    sound = render["tracks"].find { |row| row["id"] == track.id }
    valid_sound = sound && sound["variant"] == "lite" && sound["rate"].is_a?(Integer) && sound["rate"].between?(8000, 192000) &&
      sound["updatedAt"] == track.updated_at.iso8601(3)
    if track.preset_snapshot.present?
      valid_sound &&= sound["snapshotId"] == track.snapshot_id && sound["presetId"].nil? && sound["factoryPreset"].nil?
    else
      valid_sound &&= sound["presetId"] == track.preset_id && sound["factoryPreset"] == track.factory_preset
      valid_sound &&= sound["presetUpdatedAt"] == track.preset.updated_at.iso8601(3) if track.preset_id
    end
    raise ArgumentError, "Track sound changed; render the mix again" unless valid_sound
  end

end
