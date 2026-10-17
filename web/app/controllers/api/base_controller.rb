# JSON API for signed-in users. Every query goes through current_user, so a
# user can only ever reach their own records (others 404). Writes need the
# X-CSRF-Token header (Rails forgery protection is on for JSON too).
class Api::BaseController < ApplicationController
  before_action :require_authentication

  rescue_from ActiveRecord::RecordNotFound, with: -> { render json: { error: "Not found" }, status: :not_found }
  rescue_from ActiveRecord::RecordInvalid, with: ->(error) { render_invalid(error.record) }
  rescue_from ActionController::InvalidAuthenticityToken,
    with: -> { render json: { error: "Invalid CSRF token" }, status: :unprocessable_content }
  rescue_from ActionController::ParameterMissing, with: ->(error) { render json: { error: error.message }, status: :bad_request }

  private
    def require_authentication
      render json: { error: "Not signed in" }, status: :unauthorized unless authenticated?
    end

    def render_invalid(record)
      render json: { error: record.errors.full_messages.to_sentence }, status: :unprocessable_content
    end

    # Raw JSON body: WAM states are arbitrary nested JSON, which strong
    # parameters are not designed for. Keys are whitelisted by each action.
    def json_body
      @json_body ||= request.request_parameters
    end
end
