require "test_helper"

class TrackTest < ActiveSupport::TestCase
  def track(**attributes)
    Track.new(project: projects(:alice_song), name: "Lead", **attributes)
  end

  test "has mixer defaults" do
    created = track
    assert created.valid?
    assert_equal [ "guitar", 80, 0, false, false, false ],
      [ created.instrument, created.volume, created.pan, created.mute, created.solo, created.input_monitoring ]
  end

  test "validates name, instrument, volume and pan" do
    assert_not track(name: " ").valid?
    assert_not track(instrument: "kazoo").valid?
    assert_not track(volume: 101).valid?
    assert_not track(volume: -1).valid?
    assert_not track(pan: 101).valid?
    assert_not track(pan: -101).valid?
  end

  test "only guitar and bass tracks use a preset, account or Factory but not both" do
    assert track(instrument: "bass", factory_preset: "factory:svt-bass").valid?
    assert track(instrument: "guitar", preset: presets(:alice_clean)).valid?
    assert_not track(instrument: "vocals", factory_preset: "factory:svt-bass").valid?
    assert_not track(instrument: "drums", preset: presets(:alice_clean)).valid?
    assert_not track(preset: presets(:alice_clean), factory_preset: "factory:twin-clean").valid?
    assert_not track(factory_preset: "twin-clean").valid?
  end

  test "the preset must belong to the project owner" do
    assert_not track(preset: presets(:bob_lead)).valid?
  end

  test "deleting a preset leaves its tracks without one" do
    presets(:alice_clean).destroy!
    assert_nil tracks(:alice_rhythm).reload.preset_id
  end

  test "accepts audio files only" do
    with_audio = track
    with_audio.audio.attach(io: file_fixture("silence.wav").open, filename: "take 1.wav", content_type: "audio/wav")
    assert with_audio.save
    assert_equal "take 1.wav", with_audio.audio.filename.to_s

    not_audio = track
    not_audio.audio.attach(io: StringIO.new("hello"), filename: "notes.txt", content_type: "text/plain")
    assert_not not_audio.valid?
    assert_includes not_audio.errors[:audio].first, "audio file"
  end
end
