class Track < ApplicationRecord
  ORIGINS = %w[personal original stem mix legacy].freeze
  PRESET_ORIGINS = %w[personal legacy].freeze
  INSTRUMENTS = %w[guitar bass vocals drums keys other].freeze
  # Instruments played through a tone preset (the recorded file is a DI).
  PRESET_INSTRUMENTS = %w[guitar bass].freeze
  FACTORY_PRESET_FORMAT = User::LAST_PRESET_FORMAT
  AUDIO_CONTENT_TYPES = %w[
    audio/mpeg audio/mp3 audio/wav audio/x-wav audio/wave audio/vnd.wave audio/mp4 audio/x-m4a
    audio/aiff audio/x-aiff audio/ogg audio/flac audio/x-flac
  ].freeze
  MAX_AUDIO_BYTES = 100.megabytes

  belongs_to :project, touch: true
  belongs_to :creator, class_name: "User", optional: true
  belongs_to :separation, optional: true
  has_many :source_separations, class_name: "Separation", foreign_key: :source_track_id, dependent: :restrict_with_error
  belongs_to :preset, optional: true
  has_one_attached :audio

  normalizes :name, with: ->(name) { name.squish }
  normalizes :factory_preset, with: ->(key) { key.presence } # multipart sends "" for none
  validates :name, presence: true, length: { maximum: 80 }
  validates :origin, inclusion: { in: ORIGINS }
  validate :origin_is_immutable
  before_validation :clear_ineligible_monitoring
  validates :instrument, inclusion: { in: INSTRUMENTS }
  validates :volume, numericality: { only_integer: true, in: 0..100 }
  validates :pan, numericality: { only_integer: true, in: -100..100 }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :factory_preset, format: { with: FACTORY_PRESET_FORMAT }, allow_nil: true
  validate :preset_fits_instrument
  validate :preset_belongs_to_owner
  validate :audio_is_a_sound_file
  validate :snapshot_is_a_personal_tone

  def plays_through_preset?
    PRESET_ORIGINS.include?(origin) && PRESET_INSTRUMENTS.include?(instrument)
  end

  private
    def snapshot_is_a_personal_tone
      return if preset_snapshot.nil?
      unless plays_through_preset? && preset_snapshot.is_a?(Hash) && preset_snapshot["version"] == 2 && preset_snapshot["a"].is_a?(Hash) && preset_snapshot.to_json.bytesize <= Preset::MAX_STATE_BYTES
        errors.add(:preset_snapshot, "must be a personal track rack state (maximum 8 MiB)")
      end
      errors.add(:preset_snapshot, "cannot be combined with another preset") if preset_id || factory_preset
    end

    def origin_is_immutable
      errors.add(:origin, "cannot be changed after creation") if persisted? && will_save_change_to_origin?
    end

    def clear_ineligible_monitoring
      self.input_monitoring = false unless plays_through_preset?
    end

    def preset_fits_instrument
      if preset_id && factory_preset
        errors.add(:base, "A track uses an account preset or a Factory preset, not both")
      elsif (preset_id || factory_preset) && !plays_through_preset?
        errors.add(:base, "Only personal guitar and bass tracks use a preset")
      end
    end

    def preset_belongs_to_owner
      errors.add(:preset, "is not one of the project owner's presets") if preset && preset.user_id != project&.user_id
    end

    def audio_is_a_sound_file
      return unless audio.attached?

      errors.add(:audio, "must be an audio file (MP3, WAV, M4A, AIFF, OGG or FLAC)") unless AUDIO_CONTENT_TYPES.include?(audio.content_type)
      limit = origin == "stem" ? Separation::MAX_STEM_BYTES : MAX_AUDIO_BYTES
      errors.add(:audio, "is too large (maximum #{limit / 1.megabyte} MB)") if audio.byte_size > limit
    end
end
