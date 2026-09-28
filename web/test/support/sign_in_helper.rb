module SignInHelper
  # Signs in through the real magic-link flow so cookies are set like in a browser.
  def sign_in_as(user)
    issued = SignInToken.issue!(email: user.email)
    post confirm_sign_in_path, params: { token: issued.token }
    assert_response :success
    user
  end

  def with_forgery_protection
    previous = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true
    yield
  ensure
    ActionController::Base.allow_forgery_protection = previous
  end
end
