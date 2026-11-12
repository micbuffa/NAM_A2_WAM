require "test_helper"

class BackingTrackTest < ActiveSupport::TestCase
  def build(name: "  My   jam ", file: "tone.wav", content_type: "audio/wav", **attributes)
    track = BackingTrack.new(user: users(:alice), name:, **attributes)
    track.audio.attach(io: file_fixture(file).open, filename: file, content_type:) if file
    track
  end

  test "saves a named audio file for its creator" do
    track = build(duration: 12.5)
    assert track.save
    assert_equal "My jam", track.name
    assert_equal [ track ], users(:alice).backing_tracks.to_a
  end

  test "requires a name and an audio file" do
    assert_not build(name: " ").valid?
    assert_not build(name: "x" * 81).valid?
    track = build(file: nil)
    assert_not track.valid?
    assert_includes track.errors[:audio], "is missing"
  end

  test "rejects files that are not audio and impossible durations" do
    assert_not build(file: "microphone_permission_mock.js", content_type: "text/javascript").valid?
    assert_not build(duration: 0).valid?
    assert_not build(duration: 86_400).valid?
    assert_not build(source: "elsewhere").valid?
    assert build(source: "youtube").valid?
  end

  test "is listed for its creator only" do
    track = build.tap(&:save!)
    assert_equal [ track ], BackingTrack.owned_by(users(:alice)).to_a
    assert_empty BackingTrack.owned_by(users(:bob))
    assert_empty BackingTrack.owned_by(nil)
  end

  test "goes away with its creator" do
    build.save!
    assert_difference("BackingTrack.count", -1) { users(:alice).destroy }
  end
end
