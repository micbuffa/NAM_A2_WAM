require "test_helper"
class Api::AudioImportsTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper
  setup do
    sign_in_as users(:alice)
    @available=YoutubeDownloader.method(:available?)
    YoutubeDownloader.define_singleton_method(:available?) { true }
  end
  teardown { YoutubeDownloader.define_singleton_method(:available?,@available) }
  test "canonical single video URLs only" do
    assert_equal "https://www.youtube.com/watch?v=9rPbKNMjuzI",AudioImport.youtube_url("https://youtu.be/9rPbKNMjuzI?t=3")
    %w[http://youtu.be/9rPbKNMjuzI https://evil.test/watch?v=9rPbKNMjuzI https://youtube.com@evil.test/watch?v=9rPbKNMjuzI https://youtube.com/playlist?list=abc https://youtube.com/watch?v=../../etc https://youtu.be:444/9rPbKNMjuzI].each do |url|
      assert_raises(ArgumentError) { AudioImport.youtube_url(url) }
    end
  end
  test "authenticated queued job is private, cancellable, recovered on reconnect and not duplicated while active" do
    assert_enqueued_with(job:YoutubeImportJob) {post "/api/audio_imports",params:{url:"https://youtu.be/9rPbKNMjuzI"},as: :json;assert_response :accepted}
    id=response.parsed_body["id"]
    assert_equal "queued",response.parsed_body["state"]
    assert_no_difference("AudioImport.count") {post "/api/audio_imports",params:{url:"https://youtu.be/9rPbKNMjuzI"},as: :json;assert_response :unprocessable_content}
    get "/api/audio_imports";assert_equal id,response.parsed_body.first["id"]
    sign_in_as users(:bob)
    get "/api/audio_imports/#{id}";assert_response :not_found
    delete "/api/audio_imports/#{id}";assert_response :not_found
    sign_in_as users(:alice)
    delete "/api/audio_imports/#{id}";assert_response :success;assert_equal "cancelled",response.parsed_body["state"]
    assert_no_difference("Project.count") {YoutubeImportJob.perform_now(id)}
    get "/api/audio_imports/capabilities";assert_equal true,response.parsed_body["available"]
  end
  test "unavailable service and stale tasks report explicit errors" do
    YoutubeDownloader.define_singleton_method(:available?) { false }
    post "/api/audio_imports",params:{url:"https://youtu.be/9rPbKNMjuzI"},as: :json;assert_response :service_unavailable
    record=users(:alice).audio_imports.create!(url:"https://youtu.be/9rPbKNMjuzI",updated_at:30.minutes.ago)
    get "/api/audio_imports";assert_equal "error",record.reload.state
  end
  test "job publishes a private original with provenance and re-execution cannot duplicate it" do
    record=users(:alice).audio_imports.create!(url:"https://www.youtube.com/watch?v=9rPbKNMjuzI")
    download=YoutubeDownloader.instance_method(:download)
    source=file_fixture("studio-mix.mp3").to_s
    YoutubeDownloader.define_method(:download) { [source,{"kind"=>"youtube","videoId"=>"9rPbKNMjuzI","title"=>"Test music","url"=>@record.url}] }
    assert_difference("Project.count",1) {YoutubeImportJob.perform_now(record.id)}
    assert_equal "ready",record.reload.state
    track=Project.find(record.project_id).tracks.first
    assert_equal "original",track.origin;assert_equal "youtube",track.import_metadata["kind"];assert track.audio.attached?
    assert_equal users(:alice),track.creator
    assert_no_difference("Track.count") {YoutubeImportJob.perform_now(record.id)}
    get "/api/projects/#{record.project_id}";assert_response :success
    sign_in_as users(:bob);get "/api/projects/#{record.project_id}";assert_response :not_found
  ensure
    YoutubeDownloader.define_method(:download,download) if download
  end
  test "downloader failure creates no project and failed job can be seen without polling forever" do
    record=users(:alice).audio_imports.create!(url:"https://www.youtube.com/watch?v=9rPbKNMjuzI")
    download=YoutubeDownloader.instance_method(:download)
    YoutubeDownloader.define_method(:download) {raise "Video unavailable"}
    assert_no_difference(["Project.count","ActiveStorage::Blob.count"]) {YoutubeImportJob.perform_now(record.id)}
    assert_equal "error",record.reload.state;assert_equal "Video unavailable",record.message
  ensure
    YoutubeDownloader.define_method(:download,download) if download
  end
  test "audio import and Tone transfer writes require CSRF tokens" do
    with_forgery_protection do
      get "/rack/"
      token=css_select("meta[name=csrf-token]").first["content"]
      sign_in_token=SignInToken.issue!(email:"alice@example.com").token
      post confirm_sign_in_path,params:{token:sign_in_token},headers:{"X-CSRF-Token"=>token}
      assert_response :success
      ["/api/audio_imports","/api/projects/from_backing"].each do |path|
        post path,params:{url:"https://youtu.be/9rPbKNMjuzI"},as: :json
        assert_response :unprocessable_content
        assert_equal "Invalid CSRF token",response.parsed_body["error"]
      end
    end
  end

  test "quota failure and cancellation before publication clean temporary files without creating a project" do
    download=YoutubeDownloader.instance_method(:download)
    storage=Separation.method(:storage_bytes)
    source=file_fixture("studio-mix.mp3").to_s
    paths=[]
    YoutubeDownloader.define_method(:download) do
      path=File.join(@directory,"audio.mp3");FileUtils.cp(source,path);paths << @directory
      [path,{"kind"=>"youtube","videoId"=>"9rPbKNMjuzI","title"=>"Quota test"}]
    end
    Separation.define_singleton_method(:storage_bytes) { |*| Separation::USER_QUOTA }
    record=users(:alice).audio_imports.create!(url:"https://www.youtube.com/watch?v=9rPbKNMjuzI")
    assert_no_difference(["Project.count","ActiveStorage::Blob.count"]) {YoutubeImportJob.perform_now(record.id)}
    assert_equal "error",record.reload.state;assert_match(/quota/,record.message)
    assert paths.none? { |path| File.exist?(path) }
    YoutubeDownloader.define_method(:download) do
      @record.update!(state:"cancelled")
      [source,{"kind"=>"youtube","videoId"=>"9rPbKNMjuzI","title"=>"Cancelled test"}]
    end
    record=users(:alice).audio_imports.create!(url:"https://www.youtube.com/watch?v=9rPbKNMjuzI")
    assert_no_difference(["Project.count","ActiveStorage::Blob.count"]) {YoutubeImportJob.perform_now(record.id)}
    assert_equal "cancelled",record.reload.state
  ensure
    YoutubeDownloader.define_method(:download,download) if download
    Separation.define_singleton_method(:storage_bytes,storage) if storage
  end

end
