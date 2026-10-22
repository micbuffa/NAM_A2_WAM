class Project < ApplicationRecord
  belongs_to :user
  has_many :tracks, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :project
  has_many :shares, class_name: "ProjectShare", dependent: :delete_all
  has_many :shared_with, through: :shares, source: :user

  normalizes :name, with: ->(name) { name.squish }
  validates :name, presence: true, length: { maximum: 120 }
  validates :bpm, numericality: { only_integer: true, in: 30..300 }

  # Projects a user can open: their own and those shared with them.
  scope :visible_to, ->(user) {
    where(user:).or(where(id: ProjectShare.where(user:).select(:project_id)))
  }

  def owned_by?(user)
    user_id == user&.id
  end
end
