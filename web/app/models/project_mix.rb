# Immutable provenance of a rendered accompaniment; no live input or output mix.
class ProjectMix
  def self.validate!(project, manifest)
    raise ArgumentError, "Invalid mix manifest" unless manifest.is_a?(Hash)
    frames = manifest["frames"]
    range = manifest["range"]
    valid = %w[song loop].include?(manifest.fetch("selection", "song")) && manifest["format"] == "mp3" && manifest["sampleRate"] == 44100 && manifest["bitrate"] == 192 &&
      frames.is_a?(Integer) && frames.positive? && frames <= 86400 * 44100 && range.is_a?(Hash) &&
      range.values_at("start", "end").all? { |v| v.is_a?(Numeric) && v.finite? && v >= 0 && v <= 86400 } &&
      range["end"] > range["start"] && ((range["end"]-range["start"])*44100-frames).abs <= 1 &&
      manifest.values_at("peak", "attenuation").all? { |v| v.is_a?(Numeric) && v.finite? && v >= 0 } &&
      manifest["attenuation"].positive? && manifest["attenuation"] <= 1 && manifest["peak"]*manifest["attenuation"] <= 0.891251
    sources = manifest["sources"]
    valid &&= sources.is_a?(Array) && sources.any? && sources.length <= 200 && sources.all? { |s| s.is_a?(Hash) } && sources.map { |s| s["id"] }.uniq.length == sources.length
    raise ArgumentError, "Invalid mix audio contract" unless valid
    tracks = project.tracks.with_attached_audio.where(id: sources.map { |s| s["id"] }).index_by(&:id)
    sources.each do |source|
      track = tracks[source["id"]]
      raise ArgumentError, "Original audio changed; render the mix again" unless track && track.audio.attached? && track.audio.checksum == source["checksum"]
      # Do not silently export a dry DI instead of an unqualified WAM render.
      raise ArgumentError, "Preset rendering is not validated yet; export the separated instruments instead" if track.preset_id || track.factory_preset
      raise ArgumentError, "Generated mixes cannot be mixed back into their own source" if track.origin == "mix"
      raise ArgumentError, "A reserved source is not in the project timeline" unless track.timeline_visible && !track.removed_at
      valid_mix = source["volume"].is_a?(Integer) && (0..100).cover?(source["volume"]) && source["pan"].is_a?(Integer) && (-100..100).cover?(source["pan"]) &&
        [true,false].include?(source["mute"]) && [true,false].include?(source["solo"]) && source["inputMonitoring"] == false
      raise ArgumentError, "Invalid source mix" unless valid_mix
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
end
