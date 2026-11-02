class SignInMailer < ApplicationMailer
  self.delivery_job = SensitiveMailDeliveryJob

  def sign_in
    @url = confirm_sign_in_url(token: params[:token])
    @minutes = SignInToken::TTL.in_minutes.to_i
    mail to: params[:email], subject: "Your Fretwork sign-in link"
  end
end
