require "test_helper"
class Api::BackingImportsTest < ActionDispatch::IntegrationTest
  setup {sign_in_as users(:alice)}
  test "Tone local file creates an original without presets and is immediately available for separation" do
    assert_difference("Project.count",1) do
      post "/api/projects/from_backing",params:{title:"Tone backing",audio:fixture_file_upload("silence.wav","audio/wav")}
      assert_response :created
    end
    track=response.parsed_body["tracks"].first
    assert_equal "original",track["origin"];assert_nil track["presetId"];assert_equal "local",track["importMetadata"]["kind"]
    get track["audio"]["url"];assert_response :success
  end
  test "saved Tone mix reuses authorized blob; foreign mix and arbitrary URL are refused" do
    source=tracks(:alice_drums)
    source.update_columns(origin:"mix",mix_manifest:{"frames"=>4410})
    source.audio.attach(io:file_fixture("studio-mix.mp3").open,filename:"mix.mp3",content_type:"audio/mpeg")
    assert_no_difference("ActiveStorage::Blob.count") do
      post "/api/projects/from_backing",params:{id:"studio-#{source.id}"},as: :json;assert_response :created
    end
    track=Track.find(response.parsed_body["tracks"].first["id"])
    assert_equal source.audio.blob,track.audio.blob;assert_equal "original",track.origin
    sign_in_as users(:bob)
    post "/api/projects/from_backing",params:{id:"studio-#{source.id}"},as: :json;assert_response :not_found
    post "/api/projects/from_backing",params:{id:"https://evil.test/audio"},as: :json;assert_response :unprocessable_content
  end
  test "invalid local audio and quota refusal leave no project or orphan blob" do
    assert_no_difference(["Project.count","ActiveStorage::Blob.count"]) do
      post "/api/projects/from_backing",params:{audio:fixture_file_upload("microphone_permission_mock.js","text/javascript")};assert_response :unprocessable_content
    end
    original=Separation.method(:storage_bytes)
    Separation.define_singleton_method(:storage_bytes) { |*| Separation::USER_QUOTA }
    assert_no_difference("Project.count") do
      post "/api/projects/from_backing",params:{audio:fixture_file_upload("silence.wav","audio/wav")};assert_response :unprocessable_content
    end
  ensure
    Separation.define_singleton_method(:storage_bytes,original) if original
  end
  test "file import appends to a chosen owned project without hiding previous tracks or renaming the project" do
    sign_in_as users(:alice)
    project=projects(:alice_song)
    before=project.tracks.count
    file=Rack::Test::UploadedFile.new(file_fixture("studio-mix.mp3"),"audio/mpeg")
    assert_no_difference("Project.count") do
      post "/api/projects/from_backing",params:{projectId:project.id,title:"Imported song",audio:file}
      assert_response :created
    end
    full=response.parsed_body
    assert_equal project.id,full["id"]
    assert_equal project.name,full["name"]
    assert_equal before+1,full["trackCount"]
    imported=project.tracks.find(full["importedTrackId"])
    assert_equal "original",imported.origin
    assert imported.timeline_visible
    assert imported.audio.attached?
    assert_equal "Imported song",imported.name
    assert_equal before,imported.position
    # The destination must be owned, even if another project is shared.
    post "/api/projects/from_backing",params:{projectId:projects(:bob_jam).id,audio: Rack::Test::UploadedFile.new(file_fixture("studio-mix.mp3"),"audio/mpeg")}
    assert_response :not_found
  end

  test "new project import uses its chosen project name and leaves separation optional" do
    sign_in_as users(:alice)
    post "/api/projects/from_backing",params:{name:"My named project",title:"Song",audio:Rack::Test::UploadedFile.new(file_fixture("studio-mix.mp3"),"audio/mpeg")}
    assert_response :created
    assert_equal "My named project",response.parsed_body["name"]
    assert_equal 1,response.parsed_body["trackCount"]
    assert_empty response.parsed_body["separations"]
    assert response.parsed_body["tracks"].first["timelineVisible"]
  end

end
