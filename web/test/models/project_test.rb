require "test_helper"

class ProjectTest < ActiveSupport::TestCase
  test "requires a name and a bpm between 30 and 300" do
    assert_not Project.new(user: users(:alice), name: " ").valid?
    assert_not Project.new(user: users(:alice), name: "x", bpm: 29).valid?
    assert_not Project.new(user: users(:alice), name: "x", bpm: 301).valid?
    assert_not Project.new(user: users(:alice), name: "x", bpm: 120.5).valid?
    project = Project.new(user: users(:alice), name: "  Late   night ")
    assert project.valid?
    assert_equal "Late night", project.name
    assert_equal 120, project.bpm
  end

  test "lists tracks in timeline order" do
    assert_equal %w[Rhythm Drums], projects(:alice_song).tracks.map(&:name)
  end

  test "is visible to its owner and to the users it is shared with" do
    assert_equal [ projects(:alice_song), projects(:bob_jam) ].sort, Project.visible_to(users(:alice)).sort
    assert_equal [ projects(:bob_jam) ], Project.visible_to(users(:bob)).to_a
    assert projects(:bob_jam).owned_by?(users(:bob))
    assert_not projects(:bob_jam).owned_by?(users(:alice))
  end

  test "deleting a project deletes its tracks and shares" do
    assert_difference [ "Track.count", "ProjectShare.count" ], -1 do
      projects(:bob_jam).destroy!
    end
  end
end
