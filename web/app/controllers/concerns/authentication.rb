# Passwordless session handling (modelled on the Rails 8 authentication
# generator, without passwords). A signed, httpOnly, long-lived cookie holds
# the id of a Session row; destroying the row signs that device out.
module Authentication
  extend ActiveSupport::Concern

  COOKIE = :session_id

  included do
    before_action :resume_session
    helper_method :authenticated?, :current_user
  end

  private
    def authenticated? = Current.session.present?
    def current_user = Current.user

    def resume_session
      Current.session ||= find_session_by_cookie&.tap(&:touch_last_seen)
    end

    def find_session_by_cookie
      Session.find_by(id: cookies.signed[COOKIE]) if cookies.signed[COOKIE]
    end

    def start_new_session_for(user)
      reset_session # new CSRF token + no session fixation
      user.sessions.create!(user_agent: request.user_agent.to_s.first(255), ip_address: request.remote_ip,
        last_seen_at: Time.current).tap do |session|
        Current.session = session
        cookies.signed.permanent[COOKIE] = { value: session.id, httponly: true, same_site: :lax,
          secure: Rails.env.production? }
      end
    end

    def terminate_session
      Current.session&.destroy
      Current.session = nil
      cookies.delete(COOKIE)
      reset_session
    end

    def account_payload
      { user: current_user&.account_json, csrfToken: form_authenticity_token }
    end
end
