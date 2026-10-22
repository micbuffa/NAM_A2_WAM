require "test_helper"

class ProjectShareTest < ActiveSupport::TestCase
  test "shares a project once with a user other than its owner" do
    assert_not ProjectShare.new(project: projects(:bob_jam), user: users(:alice)).valid?
    assert_not ProjectShare.new(project: projects(:bob_jam), user: users(:bob)).valid?
    assert ProjectShare.new(project: projects(:alice_song), user: users(:bob)).valid?
  end

  test "deleting a user deletes their projects and the shares they received" do
    assert_difference -> { Project.count } => -1, -> { ProjectShare.count } => -1 do
      users(:alice).destroy!
    end
  end
end
