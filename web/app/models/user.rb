class User < ApplicationRecord
  PREFERENCE_KEYS = %w[autoLevel modelVariant lastPresetId playAlong].freeze
  # Play along (Tone): the last bundled backing track and its settings, as numbers in their player ranges.
  PLAY_ALONG_TRACK_FORMAT = /\Abt-[0-9a-f]{16}\z/
  PLAY_ALONG_RANGES = { "rate" => 0.7..1.3, "volumeDb" => -60..6, "mix" => 0..1, "guitarPan" => -1..1 }.freeze
  PLAY_ALONG_FLAGS = %w[muted normalized autoNormalize expanded].freeze
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
    if values.key?("playAlong")
      play_along = sanitize_play_along(values["playAlong"])
      play_along ? values["playAlong"] = play_along : values.delete("playAlong")
    end
    values
  end

  # Known keys with valid values only; nil when it is not an object.
  def self.sanitize_play_along(value)
    return unless value.is_a?(Hash)
    value = value.stringify_keys
    result = {}
    result["trackId"] = value["trackId"] if value["trackId"].nil? || value["trackId"].to_s.match?(PLAY_ALONG_TRACK_FORMAT)
    PLAY_ALONG_RANGES.each { |key, range| result[key] = value[key] if value[key].is_a?(Numeric) && range.cover?(value[key]) }
    PLAY_ALONG_FLAGS.each { |key| result[key] = value[key] if [ true, false ].include?(value[key]) }
    loop = value["loop"]
    if loop.is_a?(Hash)
      loop = loop.stringify_keys
      seconds = %w[startSeconds endSeconds].all? { |key| loop[key].is_a?(Numeric) && loop[key] >= 0 && loop[key] < 86_400 }
      result["loop"] = loop.slice("enabled", "startSeconds", "endSeconds") if seconds && [ true, false ].include?(loop["enabled"])
    end
    result
  end

  def self.valid_last_preset_id?(value)
    value.nil? || (value.is_a?(Integer) && value.positive?) || (value.is_a?(String) && value.match?(LAST_PRESET_FORMAT))
  end
end
