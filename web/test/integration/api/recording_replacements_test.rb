require "test_helper"
class Api::RecordingReplacementsTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:alice)
    @project=projects(:alice_song)
    @track=@project.tracks.create!(name:"Solo",origin:"personal",instrument:"guitar",position:99,creator:users(:alice))
  end
  teardown { @files&.each(&:close!) }
  def publish(n, replace: false)
    samples=Array.new(n){0.125}.pack("e*")
    wav="RIFF"+[36+samples.bytesize].pack("V")+"WAVEfmt "+[16,3,1,48000,192000,4,32].pack("VvvVVvv")+"data"+[samples.bytesize].pack("V")+samples
    file=Tempfile.new(["replacement",".wav"]);file.binmode;file.write(wav);file.flush;(@files||=[])<<file
    @metadata={version:1,sessionId:SecureRandom.uuid,sampleRate:48000,channels:1,frames:n,capturedFrames:n,startProjectFrame:0,compensationFrames:0,calibration:"uncalibrated",capturePresetSnapshot:{version:2,a:{entries:[]}}}
    @track.reload
    post recording_api_project_track_path(@project,@track),params:{metadata:@metadata.to_json,expectedUpdatedAt:@track.updated_at.iso8601(3),replaceChecksum:replace ? @track.audio.checksum : nil,audio:Rack::Test::UploadedFile.new(file.path,"audio/wav")}
    assert_response :success
    response.parsed_body
  end
  test "partial take metadata preserves duration and playback preset through save and history" do
    first=publish(8)
    @track.update!(preset_snapshot:{version:2,a:{entries:[]},label:"Existing playback"},snapshot_id:"old-sound")
    prior=@track.preset_snapshot
    metadata=@metadata.merge(sessionId:SecureRandom.uuid,capturedFrames:2,startProjectFrame:3,frames:8,edit:{mode:"overwrite",baseFrames:8,startFrame:3,endFrame:5})
    post recording_api_project_track_path(@project,@track),params:{metadata:metadata.to_json,expectedUpdatedAt:@track.updated_at.iso8601(3),replaceChecksum:@track.audio.checksum,audio:Rack::Test::UploadedFile.new(@files.last.path,"audio/wav")}
    assert_response :success
    partial=@track.reload.recording_version_id
    assert_equal prior,@track.preset_snapshot
    assert_equal 8,@track.recording["frames"]
    assert_equal 2,@track.recording["capturedFrames"]
    restore(first["recordingVersionId"]);assert_response :success
    restore(partial);assert_response :success
    assert_equal "overwrite",@track.reload.recording.dig("edit","mode")
  end
  test "inconsistent overwrite interval is refused without changing current audio" do
    publish(8);old=@track.reload.audio.blob.id
    metadata=@metadata.merge(sessionId:SecureRandom.uuid,capturedFrames:2,startProjectFrame:3,edit:{mode:"overwrite",baseFrames:8,startFrame:3,endFrame:7})
    post recording_api_project_track_path(@project,@track),params:{metadata:metadata.to_json,expectedUpdatedAt:@track.updated_at.iso8601(3),replaceChecksum:@track.audio.checksum,audio:Rack::Test::UploadedFile.new(@files.last.path,"audio/wav")}
    assert_response :unprocessable_content
    assert_equal old,@track.reload.audio.blob.id
  end
  test "A B punch and cycle takes persist only the selected interval and restore original versions" do
    first=publish(8)
    %w[punch cycle].each do |mode|
      range={mode:mode,startFrame:2,endFrame:6,transportStartFrame:mode=="punch" ? 0 : 2,takeNumber:mode=="punch" ? 1 : 4,complete:true,contentFrames:4}
      metadata=@metadata.merge(sessionId:SecureRandom.uuid,startProjectFrame:range[:transportStartFrame],compensationFrames:1,calibration:"manual",capturedFrames:20,rangeTake:range,edit:{mode:"overwrite",baseFrames:8,startFrame:2,endFrame:6})
      post recording_api_project_track_path(@project,@track),params:{metadata:metadata.to_json,expectedUpdatedAt:@track.reload.updated_at.iso8601(3),replaceChecksum:@track.audio.checksum,audio:Rack::Test::UploadedFile.new(@files.last.path,"audio/wav")}
      assert_response :success
      assert_equal mode,@track.reload.recording.dig("rangeTake","mode")
      assert_equal 8,@track.recording["frames"]
    end
    restore(first["recordingVersionId"]);assert_response :success
    assert_nil @track.reload.recording["rangeTake"]
  end
  test "invalid range duration or incomplete marked complete is refused without changing audio" do
    publish(8);old=@track.reload.audio.blob.id
    range={mode:"cycle",startFrame:2,endFrame:6,transportStartFrame:2,takeNumber:3,complete:true,contentFrames:2}
    metadata=@metadata.merge(sessionId:SecureRandom.uuid,startProjectFrame:2,capturedFrames:12,rangeTake:range,edit:{mode:"overwrite",baseFrames:8,startFrame:2,endFrame:4})
    post recording_api_project_track_path(@project,@track),params:{metadata:metadata.to_json,expectedUpdatedAt:@track.updated_at.iso8601(3),replaceChecksum:@track.audio.checksum,audio:Rack::Test::UploadedFile.new(@files.last.path,"audio/wav")}
    assert_response :unprocessable_content
    assert_equal old,@track.reload.audio.blob.id
  end
  def restore(token, expected: @track.reload.updated_at.iso8601(3))
    patch recording_version_api_project_track_path(@project,@track),params:{versionId:token,expectedUpdatedAt:expected,expectedChecksum:@track.audio.blob&.checksum},as: :json
  end
  test "shorter replacement, undo and redo preserve exact original blobs and capture snapshots" do
    first=publish(8);original=@track.reload.audio.blob.id
    second=publish(4,replace:true);replacement=@track.reload.audio.blob.id
    assert_not_equal original,replacement
    assert_equal 60,@track.audio.byte_size
    restore(first["recordingVersionId"]);assert_response :success;assert_equal original,@track.reload.audio.blob.id;assert_equal 8,@track.recording["frames"]
    restore(second["recordingVersionId"]);assert_response :success;assert_equal replacement,@track.reload.audio.blob.id;assert_equal 4,@track.recording["frames"]
    restore(second["recordingVersionId"],expected:"stale");assert_response :success
    restore(first["recordingVersionId"],expected:"stale");assert_response :conflict;assert_equal replacement,@track.reload.audio.blob.id
    @project.shares.create!(user:users(:bob))
    sign_in_as users(:bob);restore(first["recordingVersionId"]);assert_response :forbidden
  end
  test "initial empty state can be undone and at most two inactive versions survive" do
    first=publish(8);blank=first["previousRecordingVersionId"]
    restore(blank);assert_response :success;assert_not @track.reload.audio.attached?
    restore(first["recordingVersionId"]);assert_response :success
    publish(7,replace:true);second=@track.reload.recording_version_id
    publish(6,replace:true);publish(5,replace:true)
    assert_equal 2,RecordingRevision.where(track_id:@project.tracks.select(:id)).count
    restore(blank);assert_response :conflict
    restore(second);assert_response :success;assert_equal 7,@track.reload.recording["frames"]
  end
  test "storage failure never changes the occupied track or its version" do
    publish(8);original=@track.reload.audio.blob.id;version=@track.recording_version_id
    service=ActiveStorage::Blob.service;upload=service.method(:upload);service.define_singleton_method(:upload){|*|raise IOError,"disk full"}
    assert_raises(IOError){publish(4,replace:true)}
    assert_equal original,@track.reload.audio.blob.id;assert_equal version,@track.recording_version_id
  ensure
    service.define_singleton_method(:upload,upload) if service&&upload
  end
  test "lost replacement response can be retried without duplicating files or losing the undo token" do
    first=publish(8);second=publish(4,replace:true)
    assert_no_difference(["RecordingRevision.count","ActiveStorage::Blob.count"]) do
      post recording_api_project_track_path(@project,@track),params:{metadata:@metadata.to_json,expectedUpdatedAt:first["updatedAt"],replaceChecksum:"old",audio:Rack::Test::UploadedFile.new(@files.last.path,"audio/wav")}
      assert_response :success
      assert_equal second["previousRecordingVersionId"],response.parsed_body["previousRecordingVersionId"]
    end
  end
  test "recovery audio counts toward quota and pruning never purges another track's shared blob" do
    publish(8);blob=@track.reload.audio.blob
    size=Separation.storage_bytes(Project.where(id:@project.id))
    other=@project.tracks.create!(name:"Shared immutable audio",origin:"personal",instrument:"guitar",position:100,creator:users(:alice));other.audio.attach(blob)
    assert_equal size,Separation.storage_bytes(Project.where(id:@project.id))
    publish(7,replace:true)
    assert_equal size+72,Separation.storage_bytes(Project.where(id:@project.id))
    publish(6,replace:true);publish(5,replace:true)
    assert_equal 2,RecordingRevision.where(track_id:@project.tracks.select(:id)).count
    perform_enqueued_jobs(only:ActiveStorage::PurgeJob)
    assert_equal blob.download,other.reload.audio.download
    assert_equal 76,other.audio.byte_size
  end

end
