require "test_helper"

# One joined product journey in the isolated Rails test database. All PCM is
# generated here; the MP3 is a bundled fixture, not a real user's recording.
class Api::StudioWorkflowTest < ActionDispatch::IntegrationTest
  teardown { @files&.each(&:close!) }

  def upload_wav(frames, channels: 2, rate: 44100)
    data = Array.new(frames * channels) { |i| i.even? ? 0.125 : -0.125 }.pack("e*")
    bytes = "RIFF" + [36 + data.bytesize].pack("V") + "WAVEfmt " + [16, 3, channels, rate, rate * channels * 4, channels * 4, 32].pack("VvvVVvv") + "data" + [data.bytesize].pack("V") + data
    file = Tempfile.new(["studio-journey", ".wav"])
    file.binmode; file.write(bytes); file.flush
    (@files ||= []) << file
    Rack::Test::UploadedFile.new(file.path, "audio/wav")
  end

  def mix_source(track)
    { "id" => track.id, "checksum" => track.audio.checksum, "volume" => 65, "pan" => -20, "mute" => false, "solo" => false, "inputMonitoring" => false }
  end

  test "import, stopped separation, Tone backing, DI sound edit, save, reopen and track restore preserve one project" do
    sign_in_as users(:alice)
    post "/api/projects/from_backing", params: {title: "Studio journey", audio: upload_wav(8820)}
    assert_response :created
    project = Project.find(response.parsed_body["id"])
    source = project.tracks.find(response.parsed_body["importedTrackId"])
    assert_equal "original", source.origin
    source_blob = source.audio.blob.id

    catalogue = Separation.catalogue.fetch("htdemucs_4s_onnx")
    manifest = { "modelId" => catalogue["id"], "modelVersion" => catalogue["version"], "modelHashes" => catalogue["files"].map { |f| f["sha256"] },
      "roles" => catalogue["roles"], "backend" => "webgpu", "requestedBackend" => "webgpu", "sampleRate" => 44100, "frames" => 4410, "totalFrames" => 8820, "partial" => true }
    post "/api/projects/#{project.id}/separations", params: {token: SecureRandom.uuid, sourceTrackId: source.id, manifest: manifest}, as: :json
    assert_response :created
    batch = response.parsed_body["id"]
    manifest["roles"].each do |role|
      put "/api/projects/#{project.id}/separations/#{batch}/parts/#{role}", params: {audio: upload_wav(4410), volume: 65, pan: -20}
      assert_response :success
    end
    post "/api/projects/#{project.id}/separations/#{batch}/publish", params: {}, as: :json
    assert_response :success
    assert_equal 4, response.parsed_body["trackCount"]
    stems = project.tracks.where(origin: "stem").order(:position).to_a
    assert_equal source_blob, source.reload.audio.blob.id
    assert_not source.timeline_visible
    assert stems.all? { |track| track.preset_id.nil? && track.preset_snapshot.blank? }

    mix = {"format" => "mp3", "sampleRate" => 44100, "bitrate" => 192, "selection" => "song", "frames" => 4410,
      "range" => {"start" => 0, "end" => 0.1}, "peak" => 0.2, "attenuation" => 1, "separationId" => batch, "sources" => stems.map { |track| mix_source(track) }}
    post "/api/projects/#{project.id}/mixes", params: {token: SecureRandom.uuid, manifest: mix.to_json, audio: fixture_file_upload("studio-mix.mp3", "audio/mpeg")}
    assert_response :created
    backing = response.parsed_body
    assert_equal project.id, backing["projectId"]
    get "/api/backing_tracks"
    assert response.parsed_body.any? { |entry| entry["id"] == backing["id"] }
    get backing["url"]
    assert_response :success
    assert_equal file_fixture("studio-mix.mp3").binread, response.body.b

    post api_project_tracks_path(project), params: {name: "My solo", origin: "personal", instrument: "guitar"}, as: :json
    assert_response :created
    row = response.parsed_body
    guitar = project.tracks.find(row["id"])
    captured = {version: 2, a: {entries: []}, sourceTrim: {live: 0, file: -18}}
    metadata = {version: 1, sessionId: SecureRandom.uuid, sampleRate: 48000, channels: 1, frames: 4800, capturedFrames: 4800,
      startProjectFrame: 672, compensationFrames: 672, calibration: "manual", capturePresetSnapshot: captured}
    post recording_api_project_track_path(project, guitar), params: {metadata: metadata.to_json, expectedUpdatedAt: row["updatedAt"], audio: upload_wav(4800, channels: 1, rate: 48000)}
    assert_response :success
    di_blob = guitar.reload.audio.blob.id
    edited = captured.deep_dup
    edited[:sourceTrim][:live] = 6
    patch api_project_track_path(project, guitar), params: {snapshotId: "local-fx-edit", presetSnapshot: edited, presetId: nil, factoryPreset: nil, volume: 75, pan: 15}, as: :json
    assert_response :success
    patch api_project_path(project), params: {bpm: 90, timeSignature: "3/4"}, as: :json
    assert_response :success

    # A saved WAM snapshot must not be exported as if it were raw DI.
    invalid_mix = mix.merge("separationId" => nil, "sources" => mix["sources"] + [mix_source(guitar.reload)])
    assert_no_difference("Track.count") do
      post "/api/projects/#{project.id}/mixes", params: {token: SecureRandom.uuid, manifest: invalid_mix.to_json, audio: fixture_file_upload("studio-mix.mp3", "audio/mpeg")}
      assert_response :unprocessable_content
      assert_match(/Preset rendering/, response.parsed_body["error"])
    end

    sign_in_as users(:alice)
    get api_project_path(project)
    assert_response :success
    full = response.parsed_body
    assert_equal [90, "3/4", 5], full.values_at("bpm", "timeSignature", "trackCount")
    reopened = full["tracks"].find { |track| track["id"] == guitar.id }
    assert_equal edited.deep_stringify_keys, reopened["presetSnapshot"]
    assert_equal captured.deep_stringify_keys, reopened.dig("recording", "capturePresetSnapshot")
    assert_equal di_blob, guitar.reload.audio.blob.id
    delete api_project_track_path(project, guitar)
    assert_response :success
    patch restore_api_project_track_path(project, guitar), as: :json
    assert_response :success
    assert_equal di_blob, guitar.reload.audio.blob.id
    assert_equal source_blob, source.reload.audio.blob.id
  end
end
