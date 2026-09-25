class SignInMailer < ApplicationMailer
  def sign_in
    @code = params[:code]
    @url = confirm_sign_in_url(token: params[:token])
    @minutes = SignInToken::TTL.in_minutes.to_i
    mail to: params[:email], subject: "Your NAM A2 WAM sign-in code: #{@code}"
  end
end
