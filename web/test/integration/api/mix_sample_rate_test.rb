require "test_helper"
class Api::MixSampleRateTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:alice)
    @project = projects(:alice_song)
    @source = tracks(:alice_drums)
    @source.audio.attach(io: file_fixture("silence.wav").open, filename: "DI.wav", content_type: "audio/wav")
  end
  def manifest(rate)
    {"format"=>"mp3","sampleRate"=>rate,"bitrate"=>192,"frames"=>rate/10,"range"=>{"start"=>0,"end"=>0.1},"selection"=>"song","peak"=>0.2,"attenuation"=>1,
     "sources"=>[{"id"=>@source.id,"checksum"=>@source.audio.checksum,"volume"=>80,"pan"=>0,"mute"=>false,"solo"=>false,"inputMonitoring"=>false}]}
  end
  test "rate changes are frame-accurate and a44.1kHz MP3 cannot be relabelled48kHz" do
    [32000,44100,48000].each do |rate|
      assert ProjectMix.validate!(@project,manifest(rate))
    end
    post "/api/projects/#{@project.id}/mixes",params:{token:SecureRandom.uuid,manifest:manifest(48000).to_json,audio:fixture_file_upload("studio-mix.mp3","audio/mpeg")}
    assert_response :unprocessable_content
    assert_equal "Invalid MP3 audio",response.parsed_body["error"]
  end
  test "real32 and48kHz encoder files are accepted with accurate backing duration" do
    [32000,48000].each do |rate|
      post "/api/projects/#{@project.id}/mixes",params:{token:SecureRandom.uuid,manifest:manifest(rate).to_json,audio:fixture_file_upload("studio-mix-#{rate}.mp3","audio/mpeg")}
      assert_response :created
      assert_in_delta 0.1,response.parsed_body["duration"],1e-9
      assert_equal rate,response.parsed_body.dig("manifest","sampleRate")
    end
  end
  test "processed snapshot provenance permits export and rejects a stale edit or missing render" do
    @source.update!(instrument:"guitar",preset_snapshot:{"version"=>2,"a"=>{"entries"=>[]}},snapshot_id:"test-copy")
    value=manifest(48000)
    assert_raises(ArgumentError){ProjectMix.validate!(@project,value)}
    value["render"]={"version"=>1,"engine"=>"wam-offline-v1","outputRate"=>48000,"tailSeconds"=>0,"sourceRange"=>value["range"].deep_dup,
      "tracks"=>[{"id"=>@source.id,"rate"=>48000,"variant"=>"lite","snapshotId"=>@source.snapshot_id,"updatedAt"=>@source.updated_at.iso8601(3)}]}
    assert ProjectMix.validate!(@project,value)
    post "/api/projects/#{@project.id}/mixes",params:{token:SecureRandom.uuid,manifest:value.to_json,audio:fixture_file_upload("studio-mix-48000.mp3","audio/mpeg")}
    assert_response :created
    assert_equal value["render"],response.parsed_body.dig("manifest","render")
    stale=value.deep_dup;stale["render"]["tracks"][0]["snapshotId"]="old"
    assert_raises(ArgumentError){ProjectMix.validate!(@project,stale)}
    stale=value.deep_dup;stale["render"]["tracks"][0]["updatedAt"]="old"
    assert_raises(ArgumentError){ProjectMix.validate!(@project,stale)}
    stale=value.deep_dup;stale["render"]["tracks"] << stale["render"]["tracks"][0].merge("id"=>-1)
    assert_raises(ArgumentError){ProjectMix.validate!(@project,stale)}
    assert_raises(ArgumentError){ProjectMix.validate!(@project,value.merge("sampleRate"=>96000))}
  end
  test "a library preset edited during export cannot publish its older sound" do
    @source.update!(instrument:"guitar",preset:presets(:alice_clean))
    value=manifest(48000)
    value["render"]={"version"=>1,"engine"=>"wam-offline-v1","outputRate"=>48000,"tailSeconds"=>0,"sourceRange"=>value["range"].deep_dup,
      "tracks"=>[{"id"=>@source.id,"rate"=>48000,"variant"=>"lite","presetId"=>@source.preset_id,"factoryPreset"=>nil,"updatedAt"=>@source.updated_at.iso8601(3),"presetUpdatedAt"=>@source.preset.updated_at.iso8601(3)}]}
    assert ProjectMix.validate!(@project,value)
    @source.preset.update!(name:"Edited",updated_at:1.minute.from_now)
    assert_raises(ArgumentError){ProjectMix.validate!(@project,value)}
  end

end
