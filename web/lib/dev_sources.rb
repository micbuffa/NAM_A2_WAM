# Development and test only: serves the rack straight from the repository sources, so
# an edit shows up on reload without bin/rack-sync. The page's relative
# imports ("../../src/...") resolve against the URL root ("/src/..."), which is
# why mapping these four prefixes is enough. The page itself (/rack/ and
# /rack/index.html) stays with RackController. Also answers
# /api/test-audio-files like examples/wam/server.mjs (the audio file picker).
class DevSources
  REPO_ROOT = File.expand_path("../..", __dir__)
  PREFIXES = {
    "/rack/" => "examples/wam",
    "/src/" => "src",
    "/third_party/" => "third_party",
    "/build-wasm/" => "build-wasm"
  }.freeze
  AUDIO_DIRECTORY = File.join(REPO_ROOT, "examples/wam/assets/audio")
  AUDIO_EXTENSIONS = %w[.wav .mp3 .aac .m4a .ogg .flac].freeze

  def initialize(app, headers: {})
    @app = app
    @files = PREFIXES.to_h { |prefix, dir| [ prefix, Rack::Files.new(File.join(REPO_ROOT, dir), headers) ] }
  end

  def call(env)
    return audio_files if env[Rack::PATH_INFO] == "/api/test-audio-files"

    path = Rack::Utils.unescape_path(env[Rack::PATH_INFO])
    prefix = PREFIXES.each_key.find { |candidate| path.start_with?(candidate) }
    return @app.call(env) unless prefix && serve?(prefix, path)

    @files[prefix].call(env.merge(Rack::PATH_INFO => env[Rack::PATH_INFO].delete_prefix(prefix.chomp("/"))))
  end

  private

  def audio_files
    files = Dir.children(AUDIO_DIRECTORY).select do |name|
      File.file?(File.join(AUDIO_DIRECTORY, name)) && File.extname(name).downcase.in?(AUDIO_EXTENSIONS)
    end
    [ 200, { "content-type" => "application/json; charset=utf-8", "cache-control" => "no-store" }, [ files.sort_by(&:downcase).to_json ] ]
  end

  def serve?(prefix, path)
    relative = path.delete_prefix(prefix)
    return false if prefix == "/rack/" && relative.in?([ "", "index.html" ])
    return false if relative.split("/").include?("..")

    File.file?(File.join(REPO_ROOT, PREFIXES[prefix], relative))
  end
end
