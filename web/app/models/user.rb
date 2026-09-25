class User < ApplicationRecord
  has_many :sessions, dependent: :destroy

  normalizes :email, with: ->(email) { email.strip.downcase }

  validates :email, presence: true, uniqueness: true, length: { maximum: 254 },
    format: { with: URI::MailTo::EMAIL_REGEXP }

  def display_name
    name.presence || email
  end

  # Payload injected in the rack page and returned by /api/me.
  def account_json
    { id:, email:, name: display_name, preferences: }
  end
end
