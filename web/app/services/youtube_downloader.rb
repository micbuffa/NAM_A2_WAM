require "open3"
require "timeout"

class YoutubeDownloader
  MAX_BYTES = 100.megabytes
  MAX_DURATION = 1800
  def self.binary = ENV.fetch("YT_DLP_PATH", "/opt/youtube/bin/yt-dlp")
  def self.available? = File.executable?(binary) && system("ffmpeg", "-version", out:File::NULL, err:File::NULL)
  def initialize(record, directory)
    @record=record;@directory=directory
  end
  def active!
    raise "Import cancelled" unless AudioImport::ACTIVE.include?(@record.reload.state)
  end
  def progress(state, message, percent=nil)
    active!
    AudioImport.where(id:@record.id,state:AudioImport::ACTIVE).update_all(state:,message:,progress:percent,heartbeat_at:Time.current,updated_at:Time.current)
  end
  def run(args, timeout:600)
    output=+"";errors=+"";last_check=Process.clock_gettime(Process::CLOCK_MONOTONIC)
    Open3.popen3(*args,pgroup:true) do |stdin,stdout,stderr,thread|
      stdin.close;streams=[stdout,stderr];deadline=last_check+timeout
      begin
        until streams.empty? && !thread.alive?
          now=Process.clock_gettime(Process::CLOCK_MONOTONIC)
          raise "YouTube import timed out" if now>deadline
          if now-last_check>=1
            active!;last_check=now
            total=Dir.glob(File.join(@directory,"*")).sum { |p| File.file?(p) ? File.size(p) : 0 }
            raise "Audio exceeds storage limit" if total>MAX_BYTES*2
          end
          IO.select(streams,nil,nil,0.2)&.first&.each do |io|
            chunk=io.read_nonblock(8192,exception:false)
            if chunk.nil? then streams.delete(io)
            elsif chunk != :wait_readable
              if io==stdout
                output << chunk
                raise "Downloader response too large" if output.bytesize>4.megabytes
                chunk.scan(/PROGRESS:\s*([\d.]+)%/).each { |v| progress("downloading","Downloading YouTube audio…",[v.first.to_f,99].min) }
              else errors=(errors+chunk).byteslice(-8192,8192) || (errors+chunk)
              end
            end
          end
        end
        raise "YouTube unavailable or downloader needs updating" unless thread.value.success?
        output
      ensure
        if thread.alive?
          Process.kill("TERM",-thread.pid) rescue nil
          unless thread.join(1)
            Process.kill("KILL",-thread.pid) rescue nil
            thread.join
          end
        end
      end
    end
  end
  def download
    raise "YouTube service is not installed" unless self.class.available?
    progress("metadata","Reading YouTube video…")
    base=[self.class.binary,"--ignore-config","--no-playlist","--no-warnings","--no-plugin-dirs","--no-js-runtimes","--js-runtimes","node","--use-extractors","^youtube$","--socket-timeout","20"]
    data=JSON.parse(run(base+["--dump-single-json","--skip-download",@record.url],timeout:60))
    duration=data["duration"]
    raise "Only videos up to 30 minutes, excluding live streams" unless duration.is_a?(Numeric) && duration.positive? && duration<=MAX_DURATION && !data["is_live"] && !%w[is_live is_upcoming].include?(data["live_status"])
    metadata={"kind"=>"youtube","url"=>@record.url,"videoId"=>data["id"],"title"=>data["title"].to_s.truncate(120),"duration"=>duration,"importedAt"=>Time.current.iso8601}
    active!;@record.update!(metadata:)
    progress("downloading","Downloading YouTube audio…",0)
    run(base+["-f","bestaudio/best","--max-filesize",MAX_BYTES.to_s,"--newline","--progress-template","download:PROGRESS:%(progress._percent_str)s","-x","--audio-format","mp3","--audio-quality","192K","-o",File.join(@directory,"audio.%(ext)s"),@record.url])
    progress("converting","Checking audio…",99)
    path=File.join(@directory,"audio.mp3")
    raise "Downloaded audio is missing or too large" unless File.file?(path) && !File.symlink?(path) && File.size(path).between?(1,MAX_BYTES)
    probe=JSON.parse(run(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type","-of","json",path],timeout:30))
    raise "Invalid audio duration" unless probe.dig("format","duration").to_f.between?(0.01,MAX_DURATION+2) && probe.fetch("streams").any? { |s| s["codec_type"]=="audio" }
    [path,metadata]
  end
end
