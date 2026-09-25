# Sign in and sign up are one flow: ask for an email, send a magic link and a
# code, create the account on the first successful sign-in.
#
# The link (GET) only shows a confirmation button; the POST consumes the
# token, so mail scanners that prefetch links cannot burn it.
class SignInsController < ApplicationController
  SENT_MESSAGE = "If this address can receive mail, a sign-in link and a 6-digit code are on their way. They expire in 15 minutes.".freeze

  rate_limit to: 5, within: 15.minutes, only: :create, name: "request-by-email",
    by: -> { normalized_email_param }, with: -> { too_many_requests }
  rate_limit to: 20, within: 1.hour, only: :create, name: "request-by-ip", with: -> { too_many_requests }
  rate_limit to: 10, within: 15.minutes, only: :verify_code, name: "code-by-email",
    by: -> { normalized_email_param }, with: -> { too_many_requests }
  rate_limit to: 30, within: 1.hour, only: :verify_code, name: "code-by-ip", with: -> { too_many_requests }

  def new
  end

  def create
    email = normalized_email_param
    unless email.match?(URI::MailTo::EMAIL_REGEXP) && email.length <= 254
      return respond_error("Enter a valid email address.", :unprocessable_content)
    end

    issued = SignInToken.issue!(email:, request_ip: request.remote_ip)
    SignInMailer.with(email:, token: issued.token, code: issued.code).sign_in.deliver_later
    session[:pending_sign_in_email] = email

    respond_to do |format|
      format.html { redirect_to sent_sign_in_path }
      format.json { render json: { ok: true, message: SENT_MESSAGE } }
    end
  end

  def sent
    @email = session[:pending_sign_in_email]
  end

  # GET /sign_in/confirm?token=… (query string, so logs filter it)
  def show
    @token = params[:token].to_s
    @sign_in_token = SignInToken.find_active_by_token(@token)
    render :invalid, status: :not_found unless @sign_in_token
  end

  # POST /sign_in/confirm
  def confirm
    user = SignInToken.find_active_by_token(params[:token])&.consume
    return render(:invalid, status: :not_found) unless user

    start_new_session_for(user)
    render :signed_in
  end

  # POST /sign_in/code — from the rack dialog (JSON) or the "sent" page.
  def verify_code
    user = SignInToken.consume_code(email: normalized_email_param, code: params[:code])
    return respond_error("This code is invalid or has expired.", :unprocessable_content) unless user

    start_new_session_for(user)
    session.delete(:pending_sign_in_email)
    respond_to do |format|
      format.html { render :signed_in }
      format.json { render json: account_payload }
    end
  end

  private
    def normalized_email_param
      params[:email].to_s.strip.downcase
    end

    def respond_error(message, status)
      respond_to do |format|
        format.html { redirect_back_or_to new_sign_in_path, alert: message }
        format.json { render json: { error: message }, status: }
      end
    end

    def too_many_requests
      respond_to do |format|
        format.html { redirect_back_or_to new_sign_in_path, alert: "Too many attempts. Try again in a few minutes." }
        format.json { render json: { error: "Too many attempts. Try again in a few minutes." }, status: :too_many_requests }
      end
    end
end
