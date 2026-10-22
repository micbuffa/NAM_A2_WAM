# Read-only access to a project for another user.
class ProjectShare < ApplicationRecord
  belongs_to :project
  belongs_to :user

  validates :user_id, uniqueness: { scope: :project_id, message: "already has access to this project" }
  validate :not_the_owner

  private
    def not_the_owner
      errors.add(:base, "You own this project: share it with someone else") if project && project.user_id == user_id
    end
end
