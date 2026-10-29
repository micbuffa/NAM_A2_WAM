require "test_helper"

class Api::TrackRecordingsTest < ActionDispatch::IntegrationTest
  def setup
    sign_in_as users(:alice)
    @project = projects(:alice_song)
    @track = @project.tracks.create!(name: "New guitar", origin: "personal", instrument: "guitar", position: 2, creator: users(:alice))
    @metadata = { version: 1, sessionId: SecureRandom.uuid, sampleRate: 48000, channels: 1, frames: 4, capturedFrames: 4,
      startProjectFrame: 0, compensationFrames: 0, calibration: "uncalibrated", capturePresetSnapshot: { version: 2, a: { entries: [] }, sourceTrim: { live: 0, file: -18 } } }
  end

  def wav
    samples = [0.125, -0.5, 0.75, 1.25].pack("e*")
    "RIFF" + [36 + samples.bytesize].pack("V") + "WAVEfmt " + [16].pack("V") + [3, 1].pack("v2") + [48000, 192000].pack("V2") + [4, 32].pack("v2") + "data" + [samples.bytesize].pack("V") + samples
  end

  def upload(data = wav)
    file = Tempfile.new(["di", ".wav"])
    file.binmode; file.write(data); file.rewind
    Rack::Test::UploadedFile.new(file.path, "audio/wav")
  end

  def publish(track = @track, metadata = @metadata, version: track.updated_at.iso8601(3), file: upload)
    post recording_api_project_track_path(track.project, track), params: { metadata: metadata.to_json, expectedUpdatedAt: version, audio: file }
  end

  test "publishes an empty personal track with lossless DI and an independent preset snapshot, idempotently" do
    publish
    assert_response :success
    body = response.parsed_body
    assert_equal @metadata[:sessionId], body.dig("recording", "sessionId")
    assert_equal @metadata[:capturePresetSnapshot].deep_stringify_keys, body["presetSnapshot"]
    assert_equal wav, @track.reload.audio.download
    assert_nil @track.preset_id
    old_blob = @track.audio.blob.id
    patch api_project_track_path(@project, @track), params: { audio: upload }
    assert_response :unprocessable_content
    assert_equal old_blob, @track.reload.audio.blob.id
    publish(version: "original version before save")
    assert_response :success
    assert_equal old_blob, @track.reload.audio.blob.id
    get preset_api_project_track_path(@project, @track)
    assert_response :success
    assert_equal body["presetSnapshot"], response.parsed_body["state"]
    get api_project_path(@project)
    assert_equal @metadata[:sessionId], response.parsed_body["tracks"].find { |t| t["id"] == @track.id }.dig("recording", "sessionId")
  end

  test "persists measured loopback provenance and rejects incompatible or identifying calibration fields" do
    details = { protocol: "loopback-correlation-v1", compensationKind: "round-trip", sampleRate: 48000, frames: 528,
      spreadFrames: 2, validProbes: 5, totalProbes: 6, confidence: 0.99, validationResidualFrames: 0,
      measuredAt: Time.current.iso8601, outputChannel: 0 }
    metadata = @metadata.merge(startProjectFrame: 528, compensationFrames: 528, calibration: "loopback", calibrationDetails: details)
    [{ frames: 529 }, { spreadFrames: 300 }, { confidence: 0.2 }, { validationResidualFrames: 90 }, { protocol: "unknown" },
      { measuredAt: "bad date" }, { deviceId: "private-browser-device-id" }, { outputChannel: 9 }].each do |changes|
      publish(@track, metadata.merge(calibrationDetails: details.merge(changes)))
      assert_response :unprocessable_content
      assert_not @track.reload.audio.attached?
    end
    publish(@track, metadata.merge(calibrationDetails: nil))
    assert_response :unprocessable_content
    publish(@track, metadata.merge(calibration: "manual"))
    assert_response :unprocessable_content
    publish(@track, metadata)
    assert_response :success
    assert_equal details.deep_stringify_keys, response.parsed_body.dig("recording", "calibrationDetails")
    get api_project_path(@project)
    saved = response.parsed_body["tracks"].find { |row| row["id"] == @track.id }
    assert_equal "loopback", saved.dig("recording", "calibration")
    assert_equal 528, saved.dig("recording", "compensationFrames")
    assert_equal wav, @track.reload.audio.download
  end

  test "changing a recorded track sound preserves dry WAV and capture provenance and does not link the library" do
    publish
    assert_response :success
    original = @track.reload.recording.deep_dup
    snapshot = { version: 2, a: { entries: [] }, sourceTrim: { live: 4 } }
    patch api_project_track_path(@project, @track), params: { presetSnapshot: snapshot, snapshotId: "edited-sound", presetId: nil, factoryPreset: nil }, as: :json
    assert_response :success
    assert_equal snapshot.deep_stringify_keys, @track.reload.preset_snapshot
    assert_equal wav, @track.audio.download
    assert_equal original, @track.recording
    shared = @project.shares.create!(user: users(:bob))
    sign_in_as users(:bob)
    get preset_api_project_track_path(@project, @track)
    assert_response :success
    assert_equal snapshot.deep_stringify_keys, response.parsed_body["state"]
    patch api_project_track_path(@project, @track), params: { snapshotId: "forbidden", presetSnapshot: snapshot }, as: :json
    assert_response :forbidden
    shared.destroy!
  end

  test "rejects occupied or stale tracks without changing audio or preset" do
    publish(version: "stale")
    assert_response :conflict
    assert_not @track.reload.audio.attached?
    publish
    assert_response :success
    old_blob = @track.reload.audio.blob.id
    publish(@track, @metadata.merge(sessionId: SecureRandom.uuid))
    assert_response :conflict
    assert_equal old_blob, @track.reload.audio.blob.id
  end

  test "rejects wrong origins, channels, missing snapshot, malformed WAV and frame placement before attachment" do
    cases = [@metadata.merge(channels: 2), @metadata.merge(capturePresetSnapshot: nil), @metadata.merge(frames: 20), @metadata.merge(compensationFrames: 999999)]
    cases.each do |metadata|
      publish(@track, metadata)
      assert_response :unprocessable_content
      assert_not @track.reload.audio.attached?
    end
    publish(file: upload("not a WAV"))
    assert_response :unprocessable_content
    original = @project.tracks.create!(name: "Original", origin: "original", instrument: "guitar", position: 3)
    publish(original)
    assert_response :unprocessable_content
  end

  test "read-only recipients can listen to snapshots but cannot record, strangers cannot read them" do
    publish
    assert_response :success
    @project.shares.create!(user: users(:bob))
    sign_in_as users(:bob)
    get preset_api_project_track_path(@project, @track)
    assert_response :success
    publish
    assert_response :forbidden
    @project.shares.destroy_all
    get preset_api_project_track_path(@project, @track)
    assert_response :not_found
  end

  test "invalid snapshot does not allocate a blob or alter the empty track" do
    blob_count = ActiveStorage::Blob.count
    publish(@track, @metadata.merge(capturePresetSnapshot: { version: 1 }))
    assert_response :unprocessable_content
    assert_equal blob_count, ActiveStorage::Blob.count
    assert_nil @track.reload.recording
  end
  test "storage failure leaves an empty track and no staged blob; the same take can retry" do
    service = ActiveStorage::Blob.service
    original = service.method(:upload)
    service.define_singleton_method(:upload) { |*| raise IOError, "disk full" }
    assert_no_difference("ActiveStorage::Blob.count") do
      assert_raises(IOError) { publish }
    end
    assert_not @track.reload.audio.attached?
    assert_nil @track.recording
    service.define_singleton_method(:upload, original)
    publish
    assert_response :success
    assert_equal wav, @track.reload.audio.download
  ensure
    service.define_singleton_method(:upload, original) if service && original
  end

end
