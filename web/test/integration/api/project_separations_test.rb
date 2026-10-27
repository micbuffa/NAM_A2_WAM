require "test_helper"

class Api::ProjectSeparationsTest < ActionDispatch::IntegrationTest
  def replace_method(object, name, replacement)
    original = object.method(name)
    object.define_singleton_method(name, replacement)
    yield
  ensure
    object.define_singleton_method(name, original)
  end

  def manifest(model = "htdemucs_4s_onnx")
    m = Separation.catalogue.fetch(model)
    { "modelId" => m["id"], "modelVersion" => m["version"], "modelHashes" => m["files"].map { |f| f["sha256"] },
      "roles" => m["roles"], "backend" => "webgpu", "requestedBackend" => "webgpu", "sampleRate" => 44100,
      "frames" => 4, "totalFrames" => 8, "partial" => true }
  end

  def wav
    "RIFF" + [68].pack("V") + "WAVEfmt " + [16,3,2,44100,352800,8,32].pack("VvvVVvv") + "data" + [32].pack("V") + [0.1,-0.1,0.2,-0.2,0.3,-0.3,0.4,-0.4].pack("e*")
  end

  def upload(bytes = wav)
    file = Tempfile.new(["stem", ".wav"])
    file.binmode; file.write(bytes); file.flush
    (@files ||= []) << file
    Rack::Test::UploadedFile.new(file.path, "audio/wav")
  end

  teardown { @files&.each(&:close!) }

  def begin_save(model = "htdemucs_4s_onnx", token: SecureRandom.uuid, source: nil)
    @project = projects(:alice_song)
    @source = source || tracks(:alice_rhythm)
    @source.audio.attach(io: file_fixture("silence.wav").open, filename: "original.wav", content_type: "audio/wav") unless @source.audio.attached?
    @body = { token:, sourceTrackId: @source.id, manifest: manifest(model) }
    post "/api/projects/#{@project.id}/separations", params: @body, as: :json
    assert_response :created
    @id = response.parsed_body["id"]
  end

  def part(role, **options)
    put "/api/projects/#{@project.id}/separations/#{@id}/parts/#{role}", params: { audio: upload, volume: 65, pan: -25, **options }
  end

  def publish
    post "/api/projects/#{@project.id}/separations/#{@id}/publish", params: {}, as: :json
  end

  test "both model batches publish all stems atomically, retain provenance and survive a fresh login" do
    sign_in_as users(:alice)
    %w[htdemucs_4s_onnx bs_roformer_sw_6s].each do |model|
      begin_save(model)
      before = @project.tracks.count
      roles = manifest(model)["roles"]
      roles.each { |role| part(role); assert_response :success; assert_equal before, @project.tracks.count }
      publish
      assert_response :success
      json = response.parsed_body
      assert_equal @id, json["activeSeparationId"]
      assert_equal roles.length + 1, json["trackCount"]
      get "/api/projects"
      assert_response :success
      assert_equal roles.length + 1, response.parsed_body.find { |p| p["id"] == @project.id }["trackCount"]
      stems = json["tracks"].select { |t| t["separationId"] == @id }
      assert_equal roles, stems.map { |t| t["sourceRole"] }
      assert stems.all? { |t| t["origin"] == "stem" && t["presetId"].nil? && t["factoryPreset"].nil? && t["creatorId"] == users(:alice).id }
      assert_equal [65,-25], stems.first.values_at("volume", "pan")
      get stems.first["audio"]["url"]
      assert_response :success
      assert_equal wav, response.body.b
      assert_equal "legacy", @source.reload.origin
      assert_equal presets(:alice_clean).id, @source.preset_id
      assert_no_difference("Track.count") { publish; assert_response :success }
      sign_in_as users(:alice)
      get "/api/projects/#{@project.id}"
      assert_response :success
      batch = response.parsed_body["separations"].find { |s| s["id"] == @id }
      assert_equal manifest(model), batch["manifest"]
      assert_equal @source.audio.checksum, batch["sourceChecksum"]
      patch "/api/projects/#{@project.id}/separations/active", params: { id: @id }, as: :json
      assert_response :success
      delete "/api/projects/#{@project.id}/separations/#{@id}"
      assert_response :conflict
    end
  end

  test "unfinished uploads stay invisible as tracks, can resume idempotently and can be cleaned" do
    sign_in_as users(:alice)
    begin_save
    before = Track.count
    part("bass"); assert_response :success
    publish; assert_response :unprocessable_content
    assert_equal before, Track.count
    post "/api/projects/#{@project.id}/separations", params: @body, as: :json
    assert_response :success
    assert_equal ["bass"], response.parsed_body["uploadedRoles"]
    assert_no_difference("ActiveStorage::Blob.count") { part("bass"); assert_response :success }
    put "/api/projects/#{@project.id}/separations/#{@id}/parts/bass", params: {volume: 55}, as: :json
    assert_response :success
    assert_equal 55, Separation.find(@id).parts.find_by!(role: "bass").volume
    delete "/api/projects/#{@project.id}/separations/#{@id}"
    assert_response :no_content
    assert_equal before, Track.count
    assert_not Separation.exists?(@id)
  end

  test "rejects wrong source, model identity, malformed audio, missing role and expired source version" do
    sign_in_as users(:alice)
    begin_save
    post "/api/projects/#{@project.id}/separations", params: @body.merge(manifest: manifest.merge("modelVersion" => "fake")), as: :json
    assert_response :conflict
    post "/api/projects/#{@project.id}/separations", params: @body.merge(token: SecureRandom.uuid, manifest: manifest.merge("roles" => ["guitar"])), as: :json
    assert_response :unprocessable_content
    put "/api/projects/#{@project.id}/separations/#{@id}/parts/bass", params: {audio: upload(wav[0...-1])}
    assert_response :unprocessable_content
    part("unknown"); assert_response :unprocessable_content
    manifest["roles"].each { |role| part(role); assert_response :success }
    @source.audio.blob.update!(checksum: "changed")
    publish; assert_response :conflict
    assert_empty Separation.find(@id).tracks
  end

  test "shared listeners read published audio but cannot stage or publish and strangers cannot access it" do
    sign_in_as users(:alice)
    begin_save
    @project.shares.create!(user: users(:bob))
    sign_in_as users(:bob)
    post "/api/projects/#{@project.id}/separations", params: @body, as: :json
    assert_response :forbidden
    part("bass"); assert_response :forbidden
    publish; assert_response :forbidden
    sign_in_as users(:alice)
    manifest["roles"].each { |role| part(role); assert_response :success }
    publish; assert_response :success
    url = response.parsed_body["tracks"].find { |t| t["origin"] == "stem" }["audio"]["url"]
    sign_in_as users(:bob)
    get url; assert_response :success
    @project.shares.destroy_all
    get url; assert_response :not_found
  end

  test "storage failure cannot expose stems or leave a staged blob, retry can succeed" do
    sign_in_as users(:alice)
    begin_save
    before = ActiveStorage::Blob.count
    service = ActiveStorage::Blob.service
    # A controlled storage exception is returned as an HTTP error, with no audio metadata published.
    replace_method(service, :upload, ->(*) { raise IOError, "disk full" }) do
      assert_raises(IOError) { part("bass") }
    end
    assert_empty Separation.find(@id).tracks
    assert_equal before, ActiveStorage::Blob.count
    assert_empty Separation.find(@id).parts
    part("bass"); assert_response :success
  end

  test "project and user quotas reject upload before storage writes" do
    sign_in_as users(:alice)
    begin_save
    replace_method(Separation, :storage_bytes, ->(*) { Separation::USER_QUOTA }) do
      assert_no_difference("ActiveStorage::Blob.count") { part("bass"); assert_response :unprocessable_content }
    end
    assert_empty Separation.find(@id).parts
    replace_method(Separation, :storage_bytes, ->(*) { Separation::PROJECT_QUOTA }) do
      assert_no_difference("ActiveStorage::Blob.count") { part("bass"); assert_response :unprocessable_content }
    end
  end

  test "saved source/stem audio is immutable but mixer edits do not upload audio again" do
    sign_in_as users(:alice)
    begin_save
    manifest["roles"].each { |role| part(role); assert_response :success }
    publish; assert_response :success
    stem = Separation.find(@id).tracks.first
    assert_no_difference("ActiveStorage::Blob.count") do
      patch "/api/projects/#{@project.id}/tracks/#{stem.id}", params: {volume: 25, pan: 50, solo: true}, as: :json
      assert_response :success
    end
    patch "/api/projects/#{@project.id}/tracks/#{@source.id}", params: {audio: upload}
    assert_response :unprocessable_content
    checksum = stem.audio.checksum
    delete "/api/projects/#{@project.id}/tracks/#{stem.id}"
    assert_response :success
    assert stem.reload.removed_at
    assert_equal checksum, stem.audio.checksum
    Separation.find(@id).activate_timeline!
    assert_not stem.reload.timeline_visible
    patch "/api/projects/#{@project.id}/tracks/#{stem.id}/restore", as: :json
    assert_response :success
    assert stem.reload.timeline_visible
    assert_nil stem.removed_at
    assert_difference("Project.count", -1) { delete "/api/projects/#{@project.id}"; assert_response :no_content }
  end
  test "published separation can be undone and redone as a group without recalculation or audio deletion" do
    sign_in_as users(:alice)
    begin_save
    manifest["roles"].each { |role| part(role) }
    publish
    assert_response :success
    batch = Separation.find(@id)
    stems = batch.tracks.to_a
    checksums = stems.map { |track| track.audio.checksum }
    changes = [{id: @source.id, before: {visible: false, removed: false}, after: {visible: true, removed: false}}] +
      stems.map { |track| {id: track.id, before: {visible: true, removed: false}, after: {visible: false, removed: false}} }
    patch "/api/projects/#{@project.id}/tracks/visibility", params: {changes:, beforeSeparationId: @id, afterSeparationId: nil}, as: :json
    assert_response :success
    assert @source.reload.timeline_visible
    assert stems.all? { |track| !track.reload.timeline_visible && !track.removed_at }
    inverse = changes.map { |change| change.merge(before: change[:after], after: change[:before]) }
    patch "/api/projects/#{@project.id}/tracks/visibility", params: {changes: inverse, beforeSeparationId: nil, afterSeparationId: @id}, as: :json
    assert_response :success
    assert_not @source.reload.timeline_visible
    assert stems.all? { |track| track.reload.timeline_visible && !track.removed_at }
    assert_equal checksums, stems.map { |track| track.audio.checksum }
    assert_equal "ready", batch.reload.state
  end

  test "WebNN manifests require strict per-block evidence, preserve preferences on fallback and never admit SW6" do
    sign_in_as users(:alice)
    begin_save
    @project.separations.destroy_all
    proof={"runtimeVersion"=>"1.30.0","validatedBlocks"=>1,"dispatches"=>2,"strictParity"=>true,"effectiveHardware"=>"unknown"}
    base=manifest.merge("requestedBackend"=>"webnn-npu","backend"=>"webnn-npu","webnnEvidence"=>proof)
    [base.merge("webnnEvidence"=>nil),base.merge("webnnEvidence"=>"invalid"),base.merge("webnnEvidence"=>proof.merge("dispatches"=>0)),manifest("bs_roformer_sw_6s").merge("requestedBackend"=>"webnn-cpu")].each do |invalid|
      post "/api/projects/#{@project.id}/separations",params:@body.merge(token:SecureRandom.uuid,manifest:invalid),as: :json
      assert_response :unprocessable_content
    end
    [base,base.merge("backend"=>"wasm","webnnEvidence"=>nil)].each do |valid|
      post "/api/projects/#{@project.id}/separations",params:@body.merge(token:SecureRandom.uuid,manifest:valid),as: :json
      assert_response :created
      assert_equal valid,response.parsed_body["manifest"]
    end
  end

  test "separations replace only their source and mix together with other project tracks" do
    sign_in_as users(:alice)
    begin_save
    first_source = @source
    manifest["roles"].each { |role| part(role) }
    publish; assert_response :success
    first_batch = @id
    first_track = Separation.find(first_batch).tracks.first
    first_track.update!(volume: 44)
    begin_save("bs_roformer_sw_6s", source: tracks(:alice_drums))
    manifest("bs_roformer_sw_6s")["roles"].each { |role| part(role) }
    publish; assert_response :success
    second_batch = @id
    full = response.parsed_body
    assert_equal 10, full["trackCount"]
    assert_equal 10, full["tracks"].count { |track| track["timelineVisible"] && track["origin"] != "mix" }
    assert_not first_source.reload.timeline_visible
    assert_not tracks(:alice_drums).reload.timeline_visible
    assert first_track.reload.timeline_visible
    assert_equal 44, first_track.volume
    # A project mix may include two complete separated sources.
    visible = @project.tracks.where(timeline_visible: true).with_attached_audio
    mix = {"selection"=>"song","format"=>"mp3","sampleRate"=>44100,"bitrate"=>192,"frames"=>4,
      "range"=>{"start"=>0,"end"=>4.0/44100},"peak"=>0.2,"attenuation"=>1,"separationId"=>nil,
      "sources"=>visible.map { |track| {"id"=>track.id,"checksum"=>track.audio.checksum,"volume"=>track.volume,"pan"=>track.pan,"mute"=>false,"solo"=>false,"inputMonitoring"=>false} }}
    assert ProjectMix.validate!(@project, mix)
    # Deliberately removed instruments are not required for an otherwise ready mix.
    delete "/api/projects/#{@project.id}/tracks/#{first_track.id}", as: :json
    assert_response :success
    mix["sources"].reject! { |source| source["id"] == first_track.id }
    assert ProjectMix.validate!(@project, mix)
    incomplete = Marshal.load(Marshal.dump(mix))
    incomplete["sources"].pop
    assert_raises(ArgumentError) { ProjectMix.validate!(@project, incomplete) }

    # Re-separating the first original must preserve the second source.
    begin_save("bs_roformer_sw_6s", source: first_source)
    manifest("bs_roformer_sw_6s")["roles"].each { |role| part(role) }
    publish; assert_response :success
    assert_equal 12, response.parsed_body["trackCount"]
    assert_not first_track.reload.timeline_visible
    assert Separation.find(second_batch).tracks.all?(&:timeline_visible)
    patch "/api/projects/#{@project.id}/separations/active", params: {id:first_batch}, as: :json
    assert_response :success
    assert_equal 9, response.parsed_body["trackCount"]
    assert_not first_track.reload.timeline_visible
    assert_equal 44, first_track.volume
    assert Separation.find(second_batch).tracks.all?(&:timeline_visible)
    assert_not first_source.reload.timeline_visible
  end

end
