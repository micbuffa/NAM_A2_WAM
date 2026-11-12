require "test_helper"

class Api::BackingTracksTest < ActionDispatch::IntegrationTest
  include SignInHelper
  include ActiveJob::TestHelper

  def upload(name: "My jam", file: fixture_file_upload("tone.wav", "audio/wav"), duration: "1.5")
    post "/api/backing_tracks", params: { name:, audio: file, duration: }
  end

  test "a signed-in user saves a backing track and finds it in My tracks" do
    sign_in_as users(:alice)
    upload
    assert_response :created
    created = response.parsed_body
    assert_match(/\Aupload-\d+\z/, created["id"])
    assert_equal [ "My jam", "upload", true, 1.5, "tone.wav" ], created.values_at("title", "origin", "editable", "duration", "filename")

    get "/api/backing_tracks"
    assert_equal created["id"], response.parsed_body.first["id"]

    get created["url"]
    assert_response :success
    assert_equal file_fixture("tone.wav").binread, response.body
    get created["url"], headers: { "Range" => "bytes=0-3" }
    assert_response :partial_content
    assert_equal "RIFF", response.body
  end

  test "rejects missing names and files that are not audio" do
    sign_in_as users(:alice)
    upload(name: " ")
    assert_response :unprocessable_content
    upload(file: fixture_file_upload("microphone_permission_mock.js", "text/javascript"))
    assert_response :unprocessable_content
    post "/api/backing_tracks", params: { name: "No file" }
    assert_response :bad_request
    assert_equal 0, BackingTrack.count
  end

  test "only its creator renames or deletes it" do
    sign_in_as users(:alice)
    upload
    id = BackingTrack.last.id
    patch "/api/backing_tracks/#{id}", params: { name: "  Solo   practice " }
    assert_response :success
    assert_equal "Solo practice", response.parsed_body["title"]
    patch "/api/backing_tracks/#{id}", params: { name: "" }
    assert_response :unprocessable_content

    sign_in_as users(:bob)
    get "/api/backing_tracks"
    assert_empty response.parsed_body
    patch "/api/backing_tracks/#{id}", params: { name: "Mine now" }
    assert_response :not_found
    get "/api/backing_tracks/#{id}/audio"
    assert_response :not_found
    delete "/api/backing_tracks/#{id}"
    assert_response :not_found

    sign_in_as users(:alice)
    delete "/api/backing_tracks/#{id}"
    assert_response :no_content
    assert_not BackingTrack.exists?(id)
  end

  test "guests cannot save backing tracks" do
    upload
    assert_response :unauthorized
  end

  test "uploads count in the account quota" do
    sign_in_as users(:alice)
    storage=BackingTrack.method(:storage_bytes)
    BackingTrack.define_singleton_method(:storage_bytes) { |*| Separation::USER_QUOTA }
    upload
    assert_response :unprocessable_content
    assert_match(/quota/, response.parsed_body["error"])
  ensure
    BackingTrack.define_singleton_method(:storage_bytes, storage) if storage
  end

  test "Separate instruments copies a Play backing track into a new Studio project, for its creator only" do
    sign_in_as users(:alice)
    upload
    id=response.parsed_body["id"]
    post "/api/projects/from_backing", params: { id: }, as: :json
    assert_response :created
    imported=Track.find(response.parsed_body["importedTrackId"])
    assert_equal [ "My jam", "play_backing", "upload" ], [ imported.name, imported.import_metadata["kind"], imported.import_metadata["source"] ]
    assert_equal BackingTrack.last.audio.blob, imported.audio.blob
    sign_in_as users(:bob)
    post "/api/projects/from_backing", params: { id: }, as: :json
    assert_response :not_found
  end

  test "deleting a backing track purges its audio unless a Studio track still uses it" do
    sign_in_as users(:alice)
    upload
    alone = BackingTrack.last
    blob = alone.audio.blob
    perform_enqueued_jobs { delete "/api/backing_tracks/#{alone.id}" }
    assert_response :no_content
    assert_not ActiveStorage::Blob.exists?(blob.id)

    upload
    shared = BackingTrack.last
    post "/api/projects/from_backing", params: { id: "upload-#{shared.id}" }, as: :json
    studio = Track.find(response.parsed_body["importedTrackId"])
    perform_enqueued_jobs { delete "/api/backing_tracks/#{shared.id}" }
    assert_response :no_content
    assert studio.reload.audio.attached?
    assert_equal file_fixture("tone.wav").binread, studio.audio.download
  end
end
