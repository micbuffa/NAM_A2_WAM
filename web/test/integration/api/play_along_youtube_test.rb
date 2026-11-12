require "test_helper"

# YouTube imports belong to Play (backing tracks); a Studio project's YouTube source stays in Studio.
class Api::PlayAlongYoutubeTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:alice)
    @source = projects(:alice_song).tracks.create!(name: "YouTube audio", creator: users(:alice), instrument: "other", position: 2,
      origin: "original", import_metadata: { "kind" => "youtube", "videoId" => "test-video", "duration" => 0.1 })
    @source.audio.attach(io: file_fixture("studio-mix.mp3").open, filename: "youtube-test.mp3", content_type: "audio/mpeg")
  end

  test "a Studio project's YouTube source is not listed in Play nor importable by its old Play id" do
    get "/api/backing_tracks"
    assert_response :success
    assert_empty response.parsed_body
    post "/api/projects/from_backing", params: { id: "studio-source-#{@source.id}" }, as: :json
    assert_response :unprocessable_content
  end

  test "Separate instruments on a Play YouTube backing track reuses its audio and keeps its provenance" do
    backing = users(:alice).backing_tracks.new(name: "Clip", source: "youtube", import_metadata: { "kind" => "youtube", "videoId" => "test-video", "url" => "https://www.youtube.com/watch?v=test-video" })
    backing.audio.attach(@source.audio.blob)
    backing.save!
    assert_no_difference("ActiveStorage::Blob.count") do
      post "/api/projects/from_backing", params: { id: "upload-#{backing.id}" }, as: :json
      assert_response :created
    end
    imported = Track.find(response.parsed_body["importedTrackId"])
    assert_equal backing.audio.blob, imported.audio.blob
    assert_equal [ "play_backing", "youtube", "test-video" ], imported.import_metadata.values_at("kind", "source", "videoId")
  end
end
