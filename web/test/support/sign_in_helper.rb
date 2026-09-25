module SignInHelper
  # Signs in through the real code flow so cookies are set like in a browser.
  def sign_in_as(user)
    issued = SignInToken.issue!(email: user.email)
    post sign_in_code_path, params: { email: user.email, code: issued.code }, as: :json
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
