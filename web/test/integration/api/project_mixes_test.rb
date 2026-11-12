require "test_helper"

class Api::ProjectMixesTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:alice)
    @project = projects(:alice_song)
    @source = tracks(:alice_drums)
    @source.audio.attach(io: file_fixture("silence.wav").open, filename: "drums.wav", content_type: "audio/wav")
    @token = SecureRandom.uuid
    @manifest = { "format"=>"mp3", "sampleRate"=>44100, "bitrate"=>192, "frames"=>4410,
      "range"=>{"start"=>0,"end"=>0.1}, "peak"=>0.2, "attenuation"=>1, "separationId"=>nil,
      "sources"=>[{"id"=>@source.id,"checksum"=>@source.audio.checksum,"volume"=>65,"pan"=>-20,"mute"=>false,"solo"=>false,"inputMonitoring"=>false}] }
  end

  def save_mix(manifest: @manifest, token: @token, file: nil, **extra)
    post "/api/projects/#{@project.id}/mixes", params: {token:,manifest:manifest.to_json,audio:file || fixture_file_upload("studio-mix.mp3","audio/mpeg"),**extra}
  end

  test "the sender names the mix, and a retry with another name renames it instead of duplicating it" do
    save_mix(name: "  Always   on the run · No guitar ");assert_response :created
    entry=response.parsed_body
    assert_equal "Always on the run · No guitar",entry["title"]
    assert_no_difference("BackingTrack.count") { save_mix(name: "Take two");assert_response :success }
    assert_equal "Take two",BackingTrack.find(entry["id"].delete_prefix("upload-")).name
    save_mix(token: SecureRandom.uuid, name: "x" * 81);assert_response :unprocessable_content
  end

  test "a draft (unsaved project) is saved in Play on its audio contract alone, never a Studio track" do
    unsaved = @manifest.except("sources","separationId")
    save_mix(manifest: unsaved);assert_response :unprocessable_content
    assert_no_difference("Track.count") { assert_difference("BackingTrack.count",1) { save_mix(manifest: unsaved, draft: true);assert_response :created } }
    backing=BackingTrack.find(response.parsed_body["id"].delete_prefix("upload-"))
    assert_equal ["studio",true,"Alice song · Mix"],[backing.source,backing.import_metadata["draft"],backing.name]
    save_mix(manifest: unsaved.merge("peak"=>2), token: SecureRandom.uuid, draft: true);assert_response :unprocessable_content
    sign_in_as users(:bob)
    save_mix(manifest: unsaved, token: SecureRandom.uuid, draft: true);assert_response :not_found
  end

  test "Use in Play makes the mix a private Play backing track of its sender, idempotent and independent of the project" do
    assert_no_difference("Track.count") { assert_difference("BackingTrack.count",1) { save_mix; assert_response :created } }
    entry=response.parsed_body
    assert_match(/\Aupload-\d+\z/,entry["id"])
    assert_equal [@project.id,"Alice song","studio",true],entry.values_at("projectId","projectName","origin","editable")
    assert_equal @manifest,entry["manifest"]
    assert_equal "Alice song · Mix",entry["title"]
    assert_in_delta 0.1,entry["duration"]
    assert_equal users(:alice),BackingTrack.find(entry["id"].delete_prefix("upload-")).user
    assert_no_difference("BackingTrack.count") {save_mix;assert_response :success}
    save_mix(manifest:@manifest.merge("peak"=>0.3));assert_response :conflict
    sign_in_as users(:alice)
    get "/api/backing_tracks";assert_response :success
    assert_equal [entry["id"]],response.parsed_body.map { |t| t["id"] }
    get entry["url"];assert_response :success
    assert_equal file_fixture("studio-mix.mp3").binread,response.body.b
    get entry["url"],headers:{"Range"=>"bytes=0-99"};assert_response :partial_content
    @project.shares.create!(user:users(:bob))
    sign_in_as users(:bob)
    get "/api/backing_tracks";assert_empty response.parsed_body
    get entry["url"];assert_response :not_found
    save_mix;assert_response :forbidden
    sign_in_as users(:alice)
    @project.destroy!
    get entry["url"];assert_response :success
  end

  test "stale source, unqualified preset, monitoring, malformed format and excessive level cannot publish a mix" do
    [@manifest.merge("sampleRate"=>48000),@manifest.merge("attenuation"=>1,"peak"=>2),@manifest.merge("frames"=>12),
      @manifest.merge("sources"=>[@manifest["sources"].first.merge("checksum"=>"stale")]),
      @manifest.merge("sources"=>[@manifest["sources"].first.merge("inputMonitoring"=>true)])].each do |invalid|
      assert_no_difference("Track.count") {save_mix(manifest:invalid);assert_response :unprocessable_content}
    end
    @source.update!(instrument:"guitar",preset:presets(:alice_clean))
    save_mix;assert_response :unprocessable_content
    @source.update!(preset:nil)
    save_mix(file:fixture_file_upload("silence.wav","audio/wav"));assert_response :unprocessable_content
  end

  test "quota refusal leaves no blob, and the sender renames or deletes the mix in Play" do
    original=BackingTrack.method(:storage_bytes)
    BackingTrack.define_singleton_method(:storage_bytes) { |*| Separation::USER_QUOTA }
    assert_no_difference("ActiveStorage::Blob.count") {save_mix;assert_response :unprocessable_content}
    BackingTrack.define_singleton_method(:storage_bytes,original)
    save_mix;assert_response :created
    id=response.parsed_body["id"]
    assert_equal id,User.sanitize_preferences({"playAlong"=>{"trackId"=>id}}).dig("playAlong","trackId")
    patch "/api/backing_tracks/#{id.delete_prefix("upload-")}",params:{name:"Practice mix"};assert_response :success
    delete "/api/backing_tracks/#{id.delete_prefix("upload-")}";assert_response :no_content
    assert_equal "Alice song",@project.reload.name
  ensure
    BackingTrack.define_singleton_method(:storage_bytes,original) if original
  end
  test "failed storage cannot publish a backing and a retry succeeds without changing the source" do
    service=ActiveStorage::Blob.service
    original=service.method(:upload)
    service.define_singleton_method(:upload) { |*| raise IOError, "disk full" }
    assert_no_difference(["BackingTrack.count", "ActiveStorage::Blob.count"]) do
      assert_raises(IOError) { save_mix }
    end
    service.define_singleton_method(:upload,original)
    save_mix;assert_response :created
    assert_equal "drums.wav",@source.reload.audio.filename.to_s
  ensure
    service.define_singleton_method(:upload,original) if service && original
  end

end
