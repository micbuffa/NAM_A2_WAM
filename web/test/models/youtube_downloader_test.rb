require "test_helper"
require "tmpdir"
class YoutubeDownloaderTest < ActiveSupport::TestCase
  test "subprocess reads stdout and stderr without deadlock and reports nonzero exits" do
    job=users(:alice).audio_imports.create!(url:"https://www.youtube.com/watch?v=9rPbKNMjuzI")
    Dir.mktmpdir do |dir|
      downloader=YoutubeDownloader.new(job,dir)
      assert_equal "ok\n",downloader.run(["ruby","-e","STDERR.puts 'diagnostic'; puts 'ok'"])
      assert_raises(RuntimeError) {downloader.run(["ruby","-e","exit 1"])}
      assert_raises(RuntimeError) {downloader.run(["ruby","-e","STDOUT.close; STDERR.close; sleep 3"],timeout:0.1)}
    end
  end
  test "cancellation and disk limit stop producer before publishing" do
    job=users(:alice).audio_imports.create!(url:"https://www.youtube.com/watch?v=9rPbKNMjuzI")
    Dir.mktmpdir do |dir|
      downloader=YoutubeDownloader.new(job,dir)
      job.update!(state:"cancelled")
      assert_raises(RuntimeError) {downloader.active!}
      job.update!(state:"downloading")
      File.open(File.join(dir,"large.partial"),"wb") { |io| io.truncate(YoutubeDownloader::MAX_BYTES*2+1) }
      error=assert_raises(RuntimeError) {downloader.run(["ruby","-e","sleep 5"])}
      assert_match(/storage limit/,error.message)
      assert_nil job.project_id
    end
  end
  test "live, overlong, missing, oversized and invalid audio are refused before publication" do
    job=users(:alice).audio_imports.create!(url:"https://www.youtube.com/watch?v=9rPbKNMjuzI")
    available=YoutubeDownloader.method(:available?)
    YoutubeDownloader.define_singleton_method(:available?) {true}
    Dir.mktmpdir do |dir|
      [{duration:1801},{duration:10,is_live:true},{duration:nil}].each do |metadata|
        downloader=YoutubeDownloader.new(job,dir)
        downloader.define_singleton_method(:run) { |*,**| metadata.to_json }
        assert_raises(RuntimeError) {downloader.download}
      end
      downloader=YoutubeDownloader.new(job,dir);calls=0
      downloader.define_singleton_method(:run) { |*,**| calls+=1;calls==1 ? {duration:10,id:"9rPbKNMjuzI",title:"test"}.to_json : "" }
      assert_raises(RuntimeError) {downloader.download}
      assert_nil job.reload.project_id
    end
  ensure
    YoutubeDownloader.define_singleton_method(:available?,available) if available
  end
end
