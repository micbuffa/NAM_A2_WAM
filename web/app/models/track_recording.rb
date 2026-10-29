# Validation independent of browser metadata: accept exactly the mono Float32
# WAV written by our DI worker, with consistent frame placement and byte count.
module TrackRecording
  def self.validate!(data, file)
    raise ArgumentError, "Invalid recording metadata" unless data.is_a?(Hash) && data["version"] == 1 && data["sessionId"].is_a?(String) && data["sessionId"].match?(/\A[0-9a-f-]{36}\z/) && data["channels"] == 1 && %w[manual uncalibrated loopback].include?(data["calibration"])
    keys = %w[sampleRate frames capturedFrames startProjectFrame compensationFrames]
    raise ArgumentError, "Invalid recording frame counts" unless keys.all? { |key| data[key].is_a?(Integer) && data[key] >= 0 }
    rate, frames, captured, start, compensation = data.values_at(*keys)
    raise ArgumentError, "Invalid recording rate or compensation" unless (8000..192000).cover?(rate) && captured.positive? && compensation <= rate * 2
    validate_calibration!(data)
    expected_frames = [start - compensation, 0].max + captured - [captured, [compensation - start, 0].max].min
    raise ArgumentError, "Invalid recording length" unless frames.positive? && frames == expected_frames && file.size == 44 + frames * 4 && file.size <= Track::MAX_AUDIO_BYTES
    state = data["capturePresetSnapshot"]
    raise ArgumentError, "Missing complete preset snapshot" unless state.is_a?(Hash) && state["version"] == 2 && state["a"].is_a?(Hash) && state.to_json.bytesize <= Preset::MAX_STATE_BYTES
    io = file.tempfile
    io.rewind
    header = io.read(44)
    io.rewind
    valid = header&.bytesize == 44 && header[0, 4] == "RIFF" && header[8, 8] == "WAVEfmt " && header[36, 4] == "data" &&
      header[4, 4].unpack1("V") == file.size - 8 && header[16, 4].unpack1("V") == 16 && header[20, 4].unpack("v2") == [3, 1] &&
      header[24, 8].unpack("V2") == [rate, rate * 4] && header[32, 4].unpack("v2") == [4, 32] && header[40, 4].unpack1("V") == frames * 4
    raise ArgumentError, "Expected a mono lossless Float32 DI WAV" unless valid
  end

  # Provenance reported by the client, not a server certification of hardware.
  # Keep device identifiers and raw probe audio out of persisted track metadata.
  def self.validate_calibration!(data)
    details = data["calibrationDetails"]
    unless data["calibration"] == "loopback"
      raise ArgumentError, "Unexpected calibration details" unless details.nil?
      return
    end
    keys = %w[protocol compensationKind sampleRate frames spreadFrames validProbes totalProbes confidence validationResidualFrames measuredAt outputChannel]
    rate = data["sampleRate"]
    valid = details.is_a?(Hash) && details.keys.sort == keys.sort && details["protocol"] == "loopback-correlation-v1" && details["compensationKind"] == "round-trip" &&
      details["sampleRate"] == rate && details["frames"] == data["compensationFrames"] && details["frames"] <= (rate * 0.75).floor &&
      details["spreadFrames"].is_a?(Integer) && (0..[3, (rate * 0.001).round].max).cover?(details["spreadFrames"]) &&
      [4, 5].include?(details["validProbes"]) && details["totalProbes"] == 6 &&
      details["confidence"].is_a?(Numeric) && details["confidence"].finite? && (0.65..1).cover?(details["confidence"]) &&
      details["validationResidualFrames"].is_a?(Integer) && details["validationResidualFrames"].abs <= [2, (rate * 0.0005).round].max &&
      [0, 1].include?(details["outputChannel"]) && details["measuredAt"].is_a?(String)
    raise ArgumentError, "Invalid loopback calibration metadata" unless valid
    Time.iso8601(details["measuredAt"])
  rescue ArgumentError
    raise ArgumentError, "Invalid loopback calibration metadata"
  end

end
