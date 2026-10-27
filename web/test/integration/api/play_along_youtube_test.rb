require "test_helper"

class Api::PlayAlongYoutubeTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:alice)
    @source = projects(:alice_song).tracks.create!(name: "YouTube audio", creator: users(:alice), instrument: "other", position: 2,
      origin: "original", import_metadata: {"kind"=>"youtube", "videoId"=>"test-video", "duration"=>0.1})
    @source.audio.attach(io: file_fixture("studio-mix.mp3").open, filename: "youtube-test.mp3", content_type: "audio/mpeg")
  end

  test "YouTube originals persist in the private Tone catalogue without separation" do
    get "/api/backing_tracks"
    assert_response :success
    entry = response.parsed_body.find { |track| track["id"] == "studio-source-#{@source.id}" }
    assert entry
    assert_equal "youtube", entry["origin"]
    assert_equal @source.project_id, entry["projectId"]
    assert_equal "youtube-test.mp3", entry["filename"]
    assert_equal "audio/mpeg", entry["contentType"]
    get entry["url"]
    assert_response :success
    assert_equal file_fixture("studio-mix.mp3").binread, response.body
    assert_empty @source.project.separations
    sign_in_as users(:bob)
    get "/api/backing_tracks"
    assert_response :success
    assert_not response.parsed_body.any? { |track| track["id"] == entry["id"] }
    get entry["url"]
    assert_response :not_found
  end

  test "Separate instruments in Tone can reuse the authorized YouTube source without downloading it again" do
    assert_no_difference("ActiveStorage::Blob.count") do
      post "/api/projects/from_backing", params: {id: "studio-source-#{@source.id}"}, as: :json
      assert_response :created
    end
    imported = Track.find(response.parsed_body["importedTrackId"])
    assert_equal @source.audio.blob, imported.audio.blob
    assert_equal "original", imported.origin
    assert_equal "studio_source", imported.import_metadata["kind"]
    assert_equal @source.id, imported.import_metadata["sourceTrackId"]
    # Do not duplicate the source in the YouTube catalogue for every separation.
    get "/api/backing_tracks"
    assert_equal 1, response.parsed_body.count { |entry| entry["origin"] == "youtube" }
    sign_in_as users(:bob)
    post "/api/projects/from_backing", params: {id: "studio-source-#{@source.id}"}, as: :json
    assert_response :not_found
  end

  test "removed sources and plain local originals are not exposed as YouTube backings" do
    @source.update!(removed_at: Time.current, timeline_visible: false)
    @source.project.tracks.create!(name: "Local audio", creator: users(:alice), instrument: "other", position: 3, origin: "original", import_metadata: nil)
    get "/api/backing_tracks"
    assert_response :success
    assert_empty response.parsed_body
    post "/api/projects/from_backing", params: {id: "studio-source-#{@source.id}"}, as: :json
    assert_response :not_found
  end
end
