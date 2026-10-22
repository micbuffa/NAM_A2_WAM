class User < ApplicationRecord
  PREFERENCE_KEYS = %w[autoLevel modelVariant lastPresetId].freeze
  # The preset the rack reopens: an account preset id, a Factory one, or none.
  LAST_PRESET_FORMAT = /\Afactory:[a-z0-9-]{1,64}\z/

  has_many :sessions, dependent: :destroy
  has_many :presets, dependent: :destroy
  has_many :favorites, dependent: :destroy
  has_many :projects, dependent: :destroy
  has_many :project_shares, dependent: :delete_all

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

  # Whitelisted, type-checked preference values; unknown keys are ignored.
  def self.sanitize_preferences(values)
    values = values.to_h.stringify_keys.slice(*PREFERENCE_KEYS)
    values.delete("autoLevel") unless [ true, false ].include?(values["autoLevel"])
    values.delete("modelVariant") unless %w[full lite].include?(values["modelVariant"])
    values.delete("lastPresetId") unless valid_last_preset_id?(values.fetch("lastPresetId", false))
    values
  end

  def self.valid_last_preset_id?(value)
    value.nil? || (value.is_a?(Integer) && value.positive?) || (value.is_a?(String) && value.match?(LAST_PRESET_FORMAT))
  end
end
