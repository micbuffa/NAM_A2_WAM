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

  def save_mix(manifest: @manifest, token: @token, file: nil)
    post "/api/projects/#{@project.id}/mixes", params: {token:,manifest:manifest.to_json,audio:file || fixture_file_upload("studio-mix.mp3","audio/mpeg")}
  end

  test "rendered backing is private, idempotent, persists across login and links its project" do
    assert_difference("Track.count",1) { save_mix; assert_response :created }
    entry=response.parsed_body
    assert_match(/\Astudio-\d+\z/,entry["id"])
    assert_equal @project.id,entry["projectId"]
    assert_equal @manifest,entry["manifest"]
    track=Track.find(entry["id"].delete_prefix("studio-"))
    assert_equal ["mix",users(:alice).id,nil],track.values_at(:origin,:creator_id,:preset_id)
    assert_no_difference("Track.count") {save_mix;assert_response :success}
    save_mix(manifest:@manifest.merge("peak"=>0.3));assert_response :conflict
    sign_in_as users(:alice)
    get "/api/backing_tracks";assert_response :success
    assert_equal [entry["id"]],response.parsed_body.map { |t| t["id"] }
    get entry["url"];assert_response :success
    assert_equal file_fixture("studio-mix.mp3").binread,response.body.b
    get entry["url"],headers:{"Range"=>"bytes=0-99"};assert_response :partial_content
    @project.shares.create!(user:users(:bob))
    sign_in_as users(:bob)
    get "/api/backing_tracks";assert_equal entry["id"],response.parsed_body.first["id"]
    get entry["url"];assert_response :success
    save_mix;assert_response :forbidden
    @project.shares.destroy_all
    get entry["url"];assert_response :not_found
    get "/api/backing_tracks";assert_empty response.parsed_body
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

  test "quota refusal leaves no blob and saved mix files cannot be replaced or manually deleted" do
    original=Separation.method(:storage_bytes)
    Separation.define_singleton_method(:storage_bytes) { |*| Separation::USER_QUOTA }
    assert_no_difference("ActiveStorage::Blob.count") {save_mix;assert_response :unprocessable_content}
    Separation.define_singleton_method(:storage_bytes,original)
    save_mix;assert_response :created
    id=response.parsed_body["id"].delete_prefix("studio-")
    patch "/api/projects/#{@project.id}/tracks/#{id}",params:{audio:fixture_file_upload("silence.wav","audio/wav")};assert_response :unprocessable_content
    delete "/api/projects/#{@project.id}/tracks/#{id}";assert_response :unprocessable_content
    assert_equal "studio-#{id}",User.sanitize_preferences({"playAlong"=>{"trackId"=>"studio-#{id}"}}).dig("playAlong","trackId")
  ensure
    Separation.define_singleton_method(:storage_bytes,original) if original
  end
  test "failed storage cannot publish a backing and a retry succeeds without changing the source" do
    service=ActiveStorage::Blob.service
    original=service.method(:upload)
    service.define_singleton_method(:upload) { |*| raise IOError, "disk full" }
    assert_no_difference(["Track.count", "ActiveStorage::Blob.count"]) do
      assert_raises(IOError) { save_mix }
    end
    service.define_singleton_method(:upload,original)
    save_mix;assert_response :created
    assert_equal "drums.wav",@source.reload.audio.filename.to_s
  ensure
    service.define_singleton_method(:upload,original) if service && original
  end

end
