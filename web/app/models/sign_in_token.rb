# One-time magic link, stored as a keyed digest (HMAC with a key derived from
# secret_key_base, so a leaked table is useless on its own). Issuing a token
# revokes the previous ones for the same address.
class SignInToken < ApplicationRecord
  TTL = 15.minutes

  Issued = Data.define(:record, :token)

  normalizes :email, with: ->(email) { email.strip.downcase }
  validates :email, presence: true, length: { maximum: 254 }, format: { with: URI::MailTo::EMAIL_REGEXP }

  scope :active, -> { where(used_at: nil).where(expires_at: Time.current..) }

  class << self
    def issue!(email:, request_ip: nil)
      email = normalize_value_for(:email, email.to_s)
      token = SecureRandom.urlsafe_base64(32)
      transaction do
        # "used_at" doubles as revocation: only the latest request stays valid.
        where(email:, used_at: nil).update_all(used_at: Time.current)
        record = create!(email:, token_digest: digest(token), expires_at: TTL.from_now, request_ip:)
        Issued.new(record:, token:)
      end
    end

    def find_active_by_token(token)
      active.find_by(token_digest: digest(token.to_s)) if token.present?
    end

    def digest(value)
      OpenSSL::HMAC.hexdigest("SHA256", digest_key, value)
    end

    private
      def digest_key
        @digest_key ||= Rails.application.key_generator.generate_key("sign_in_tokens/v1", 32)
      end
  end

  def expired? = expires_at <= Time.current

  # Single use, race-safe: only the request that flips used_at signs in.
  def consume
    claimed = self.class.active.where(id:).update_all(used_at: Time.current)
    return unless claimed == 1

    User.find_or_create_by!(email:)
  rescue ActiveRecord::RecordNotUnique
    User.find_by!(email:) # concurrent first sign-in for the same address
  end
end
