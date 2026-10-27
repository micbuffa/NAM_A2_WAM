require "test_helper"

class Api::ProjectTracksTest < ActionDispatch::IntegrationTest
  def audio_upload(name = "silence.wav")
    fixture_file_upload(name, "audio/wav")
  end

  test "adds a track with its audio file and streams it back" do
    sign_in_as users(:alice)
    project = projects(:alice_song)

    post api_project_tracks_path(project), params: { name: "Lead", instrument: "guitar", factoryPreset: "factory:british-edge",
      volume: "70", pan: "-20", audio: audio_upload }
    assert_response :created
    track = response.parsed_body
    assert_equal [ "Lead", 2, "factory:british-edge", 70, -20 ], track.values_at("name", "position", "factoryPreset", "volume", "pan")
    assert_equal [ "silence.wav", "audio/x-wav" ], track["audio"].values_at("filename", "contentType")
    assert_includes track["audio"]["url"], "v=#{CGI.escape(Track.find(track["id"]).audio.checksum)}"

    get track["audio"]["url"]
    assert_response :success
    assert_equal file_fixture("silence.wav").binread, response.body
    assert_equal "bytes", response.headers["Accept-Ranges"]

    get track["audio"]["url"], headers: { "Range" => "bytes=0-3" }
    assert_response :partial_content
    assert_equal "RIFF", response.body
  end

  test "updates mixer settings and replaces the audio" do
    sign_in_as users(:alice)
    track = tracks(:alice_rhythm)

    patch api_project_track_path(track.project, track), params: { volume: 55, pan: 30, mute: true, solo: true, inputMonitoring: true }, as: :json
    assert_response :success
    assert_equal [ 55, 30, true, true, true ], track.reload.values_at(:volume, :pan, :mute, :solo, :input_monitoring)

    patch api_project_track_path(track.project, track), params: { audio: audio_upload }
    assert_response :success
    assert_equal "silence.wav", track.reload.audio.filename.to_s

    patch api_project_track_path(track.project, track), params: { instrument: "vocals", presetId: nil }, as: :json
    assert_response :success
    assert_equal [ "vocals", nil ], track.reload.values_at(:instrument, :preset_id)
  end

  test "rejects invalid tracks" do
    sign_in_as users(:alice)
    project = projects(:alice_song)

    post api_project_tracks_path(project), params: { name: "Keys", instrument: "keys", factoryPreset: "factory:twin-clean" }, as: :json
    assert_response :unprocessable_content
    assert_includes response.parsed_body["error"], "guitar and bass"

    post api_project_tracks_path(project), params: { name: "Bob's tone", presetId: presets(:bob_lead).id }, as: :json
    assert_response :unprocessable_content

    post api_project_tracks_path(project), params: { name: "Notes", audio: fixture_file_upload("microphone_permission_mock.js", "text/javascript") }
    assert_response :unprocessable_content
    assert_includes response.parsed_body["error"], "audio file"
  end

  test "reorders and deletes tracks" do
    sign_in_as users(:alice)
    project = projects(:alice_song)
    rhythm, drums = tracks(:alice_rhythm), tracks(:alice_drums)

    patch order_api_project_tracks_path(project), params: { ids: [ drums.id ] }, as: :json
    assert_response :unprocessable_content

    patch order_api_project_tracks_path(project), params: { ids: [ drums.id, rhythm.id ] }, as: :json
    assert_response :success
    assert_equal %w[Drums Rhythm], response.parsed_body["tracks"].map { |track| track["name"] }

    delete api_project_track_path(project, drums), as: :json
    assert_response :success
    assert drums.reload.removed_at
    assert_not drums.timeline_visible
    assert_equal [ "Rhythm" ], project.tracks.where(removed_at: nil).map(&:name)
    assert_equal drums.id, response.parsed_body["id"]
    patch restore_api_project_track_path(project, drums), as: :json
    assert_response :success
    assert_nil drums.reload.removed_at
    assert drums.timeline_visible
    assert_not drums.input_monitoring
  end

  test "removed audio is recoverable, monitoring is off and repeated delete is idempotent" do
    sign_in_as users(:alice)
    track = tracks(:alice_rhythm)
    track.audio.attach(io: file_fixture("silence.wav").open, filename: "take.wav", content_type: "audio/wav")
    track.update!(input_monitoring: true)
    blob_id = track.audio.blob.id
    assert_no_difference("ActiveStorage::Blob.count") do
      2.times do
        delete api_project_track_path(track.project, track), as: :json
        assert_response :success
        assert response.parsed_body["removedAt"]
      end
    end
    assert_not track.reload.input_monitoring
    get api_project_path(track.project)
    assert_response :success
    assert_equal 1, response.parsed_body["trackCount"]
    assert_equal blob_id, track.audio.blob.id
    patch restore_api_project_track_path(track.project, track), as: :json
    assert_response :success
    assert_nil response.parsed_body["removedAt"]
    assert_equal blob_id, track.reload.audio.blob.id
    assert_not track.input_monitoring
    assert_equal file_fixture("silence.wav").binread, track.audio.download
    patch restore_api_project_track_path(track.project, track), as: :json
    assert_response :success
  end

  test "group visibility commands are atomic, preserve blobs and reject stale state" do
    sign_in_as users(:alice)
    project = projects(:alice_song)
    rhythm, drums = tracks(:alice_rhythm), tracks(:alice_drums)
    rhythm.audio.attach(io: file_fixture("silence.wav").open, filename: "take.wav", content_type: "audio/wav")
    blob_id = rhythm.audio.blob.id
    visible = { visible: true, removed: false }
    removed = { visible: false, removed: true }
    changes = [rhythm, drums].map { |row| {id: row.id, before: visible, after: removed} }
    body = {changes:, beforeSeparationId: nil, afterSeparationId: nil}
    patch "/api/projects/#{project.id}/tracks/visibility", params: body, as: :json
    assert_response :success
    assert_equal 2, response.parsed_body["tracks"].size
    assert rhythm.reload.removed_at
    assert drums.reload.removed_at
    patch "/api/projects/#{project.id}/tracks/visibility", params: body, as: :json
    assert_response :success # Retry after a lost response is idempotent.
    # One stale entry must prevent all changes, including the valid one.
    inverse = changes.map { |change| change.merge(before: removed, after: visible) }
    inverse.last[:before] = visible
    patch "/api/projects/#{project.id}/tracks/visibility", params: body.merge(changes: inverse), as: :json
    assert_response :conflict
    assert rhythm.reload.removed_at
    inverse.last[:before] = removed
    patch "/api/projects/#{project.id}/tracks/visibility", params: body.merge(changes: inverse), as: :json
    assert_response :success
    assert_nil rhythm.reload.removed_at
    assert rhythm.timeline_visible
    assert_equal blob_id, rhythm.audio.blob.id
  end

  test "group history cannot modify foreign tracks, malformed commands or shared projects" do
    sign_in_as users(:alice)
    project = projects(:alice_song)
    state = {visible: true, removed: false}
    [[], [{id: tracks(:bob_bass).id, before: state, after: state}], [{id: tracks(:alice_rhythm).id, before: state, after: {visible: true, removed: true}}]].each do |changes|
      patch "/api/projects/#{project.id}/tracks/visibility", params: {changes:, beforeSeparationId: nil, afterSeparationId: nil}, as: :json
      assert_response :unprocessable_content
    end
    patch "/api/projects/#{tracks(:bob_bass).project_id}/tracks/visibility", params: {}, as: :json
    assert_response :forbidden
  end

  test "a shared viewer can listen but not edit; others cannot reach the tracks" do
    bobs = tracks(:bob_bass)
    bobs.audio.attach(io: file_fixture("silence.wav").open, filename: "bass.wav", content_type: "audio/wav")

    sign_in_as users(:alice)
    get audio_api_project_track_path(bobs.project, bobs)
    assert_response :success
    patch api_project_track_path(bobs.project, bobs), params: { volume: 1 }, as: :json
    assert_response :forbidden
    post api_project_tracks_path(bobs.project), params: { name: "x" }, as: :json
    assert_response :forbidden
    delete api_project_track_path(bobs.project, bobs), as: :json
    assert_response :forbidden
    patch restore_api_project_track_path(bobs.project, bobs), as: :json
    assert_response :forbidden
    assert_equal 80, bobs.reload.volume

    alices = tracks(:alice_rhythm)
    sign_in_as users(:bob)
    get audio_api_project_track_path(alices.project, alices)
    assert_response :not_found
    patch api_project_track_path(alices.project, alices), params: { volume: 1 }, as: :json
    assert_response :not_found
  end

  test "a track's account preset is readable by everyone who sees the project" do
    bobs = tracks(:bob_bass)
    bobs.update!(preset: presets(:bob_lead), factory_preset: nil)

    sign_in_as users(:alice) # shared with her: she cannot read Bob's presets otherwise
    get preset_api_project_track_path(bobs.project, bobs)
    assert_response :success
    assert_equal [ "Bob lead", 1 ], [ response.parsed_body["name"], response.parsed_body.dig("state", "version") ]
    get api_preset_path(presets(:bob_lead))
    assert_response :not_found

    get preset_api_project_track_path(projects(:alice_song), tracks(:alice_drums))
    assert_response :not_found # no preset

    sign_in_as users(:bob)
    get preset_api_project_track_path(projects(:alice_song), tracks(:alice_rhythm))
    assert_response :not_found # not shared with him
  end

  test "a track without audio has nothing to stream" do
    sign_in_as users(:alice)
    get audio_api_project_track_path(projects(:alice_song), tracks(:alice_drums))
    assert_response :not_found
  end
  test "original uploads retain their origin and reject presets and relabelling" do
    sign_in_as users(:alice)
    project = projects(:alice_song)
    post api_project_tracks_path(project), params: { name: "Original mix", origin: "original", instrument: "guitar", audio: audio_upload }
    assert_response :created
    assert_equal "original", response.parsed_body["origin"]
    original = Track.find(response.parsed_body["id"])

    patch api_project_track_path(project, original), params: { factoryPreset: "factory:twin-clean" }, as: :json
    assert_response :unprocessable_content
    patch api_project_track_path(project, original), params: { origin: "personal" }, as: :json
    assert_response :unprocessable_content
    assert_equal "original", original.reload.origin
    assert_nil original.factory_preset

    %w[stem mix legacy].each do |origin|
      post api_project_tracks_path(project), params: { name: "Reserved", origin: }, as: :json
      assert_response :unprocessable_content
    end
  end

  test "a generated guitar stem cannot get a preset through the API" do
    sign_in_as users(:alice)
    stem = projects(:alice_song).tracks.create!(name: "Separated guitar", origin: "stem", instrument: "guitar")
    patch api_project_track_path(stem.project, stem), params: { presetId: presets(:alice_clean).id }, as: :json
    assert_response :unprocessable_content
    patch api_project_track_path(stem.project, stem), params: { inputMonitoring: true, volume: 65, pan: 30 }, as: :json
    assert_response :success
    assert_equal [false, 65, 30], response.parsed_body.values_at("inputMonitoring", "volume", "pan")
    # Defense against stale/invalid rows written by an external import.
    stem.update_column(:preset_id, presets(:alice_clean).id)
    get preset_api_project_track_path(stem.project, stem)
    assert_response :not_found
  end

end
