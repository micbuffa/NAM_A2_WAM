require "test_helper"
require Rails.root.join("db/migrate/20261112110000_convert_youtube_tracks_to_backing_tracks")

class YoutubeBackingConversionTest < ActiveSupport::TestCase
  def youtube_track(project, name, removed_at: nil, kind: "youtube")
    track = project.tracks.new(name:, origin: "original", instrument: "other", creator: project.user, removed_at:,
      import_metadata: { "kind" => kind, "videoId" => "abcdefghijk", "duration" => 3.2, "url" => "https://www.youtube.com/watch?v=abcdefghijk" })
    track.audio.attach(io: file_fixture("studio-mix.mp3").open, filename: "youtube.mp3", content_type: "audio/mpeg")
    track.save!
    track
  end

  def migrate(direction) = ConvertYoutubeTracksToBackingTracks.new.tap { |m| m.suppress_messages { m.public_send(direction) } }

  test "each kept YouTube source becomes a Play backing track of its creator, sharing its audio" do
    project = projects(:alice_song)
    source = youtube_track(project, "Wicked Game")
    youtube_track(project, "Removed copy", removed_at: Time.current)
    youtube_track(project, "Local file", kind: "local")

    assert_no_difference([ "Track.count", "ActiveStorage::Blob.count" ]) { assert_difference("BackingTrack.count", 1) { migrate(:up) } }
    backing = BackingTrack.last
    assert_equal [ project.user, "Wicked Game", "youtube", 3.2, "abcdefghijk", source.id ],
      [ backing.user, backing.name, backing.source, backing.duration, backing.import_metadata["videoId"], backing.import_metadata["convertedFromTrackId"] ]
    assert_equal source.audio.blob, backing.audio.blob
    assert source.reload.audio.attached?

    assert_no_difference("BackingTrack.count") { migrate(:up) }
    migrate(:down)
    assert_not BackingTrack.exists?(backing.id)
    assert source.reload.audio.attached?
  end

  test "each kept Studio mix becomes a Play backing track of its sender, sharing its audio" do
    require Rails.root.join("db/migrate/20261112120000_convert_studio_mixes_to_backing_tracks")
    project = projects(:alice_song)
    mix = project.tracks.new(name: "Alice song · Mix", origin: "mix", instrument: "other", creator: users(:alice), timeline_visible: false,
      render_token: "token-1234567890abcdef", mix_manifest: { "frames" => 88_200, "sampleRate" => 44_100 })
    mix.audio.attach(io: file_fixture("studio-mix.mp3").open, filename: "studio-mix.mp3", content_type: "audio/mpeg")
    mix.save!
    conversion = ConvertStudioMixesToBackingTracks.new
    assert_no_difference([ "Track.count", "ActiveStorage::Blob.count" ]) { assert_difference("BackingTrack.count", 1) { conversion.suppress_messages { conversion.up } } }
    backing = BackingTrack.last
    assert_equal [ users(:alice), "Alice song · Mix", "studio", 2.0, project.id, "Alice song", "token-1234567890abcdef" ],
      [ backing.user, backing.name, backing.source, backing.duration, *backing.import_metadata.values_at("projectId", "projectName", "renderToken") ]
    assert_equal mix.audio.blob, backing.audio.blob
    assert_no_difference("BackingTrack.count") { conversion.suppress_messages { conversion.up } }
    conversion.suppress_messages { conversion.down }
    assert_not BackingTrack.exists?(backing.id)
    assert mix.reload.audio.attached?
  end
end
