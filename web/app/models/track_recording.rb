# Validation independent of browser metadata: accept exactly the mono Float32
# WAV written by our DI worker, with consistent frame placement and byte count.
module TrackRecording
  def self.validate!(data, file)
    raise ArgumentError, "Invalid recording metadata" unless data.is_a?(Hash) && data["version"] == 1 && data["sessionId"].is_a?(String) && data["sessionId"].match?(/\A[0-9a-f-]{36}\z/) && data["channels"] == 1 && %w[manual uncalibrated].include?(data["calibration"])
    keys = %w[sampleRate frames capturedFrames startProjectFrame compensationFrames]
    raise ArgumentError, "Invalid recording frame counts" unless keys.all? { |key| data[key].is_a?(Integer) && data[key] >= 0 }
    rate, frames, captured, start, compensation = data.values_at(*keys)
    raise ArgumentError, "Invalid recording rate or compensation" unless (8000..192000).cover?(rate) && captured.positive? && compensation <= rate * 2
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
end
