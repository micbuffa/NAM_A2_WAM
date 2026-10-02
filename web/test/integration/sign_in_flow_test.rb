require "test_helper"

class SignInFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper
  include ActiveJob::TestHelper

  test "same response whether or not the account exists" do
    responses = [ "alice@example.com", "nobody@example.com" ].map do |email|
      post sign_in_path, params: { email: }, as: :json
      [ response.status, response.parsed_body ]
    end
    assert_equal responses.first, responses.last
    assert_equal 200, responses.first.first
  end

  test "requesting a link enqueues an email with the link" do
    assert_enqueued_emails 1 do
      post sign_in_path, params: { email: "carol@example.com" }
    end
    assert_redirected_to sent_sign_in_path
    assert_no_difference -> { User.count } do
      perform_enqueued_jobs
    end
    mail = ActionMailer::Base.deliveries.last
    assert_equal [ "carol@example.com" ], mail.to
    assert_match %r{/sign_in/confirm\?token=[\w-]+}, mail.text_part.body.to_s
  end

  test "the mail job never logs the token" do
    post sign_in_path, params: { email: "carol@example.com" }
    job = enqueued_jobs.last
    assert_equal "SensitiveMailDeliveryJob", job["job_class"]
    assert_not SensitiveMailDeliveryJob.log_arguments?
  end

  test "invalid email is rejected" do
    post sign_in_path, params: { email: "nope" }, as: :json
    assert_response :unprocessable_content
  end

  test "GET on the link only shows a confirmation; POST consumes it" do
    issued = SignInToken.issue!(email: "dave@example.com")

    2.times do # a mail scanner prefetching the link must not burn the token
      get confirm_sign_in_path(token: issued.token)
      assert_response :success
      assert_select "form[action='#{confirm_sign_in_path}'][method=post]"
    end
    assert_nil issued.record.reload.used_at
    assert_nil User.find_by(email: "dave@example.com")

    assert_difference -> { User.count } => 1, -> { Session.count } => 1 do
      post confirm_sign_in_path, params: { token: issued.token }
    end
    assert_response :success
    assert_includes response.body, "BroadcastChannel('nam-a2-wam.account')"
    assert cookies[:session_id].present?

    post confirm_sign_in_path, params: { token: issued.token }
    assert_response :not_found
  end

  test "the confirmation page's script confirms over JSON" do
    issued = SignInToken.issue!(email: "alice@example.com")
    post confirm_sign_in_path, params: { token: issued.token }, as: :json
    assert_response :success
    assert_equal "alice@example.com", response.parsed_body.dig("user", "email")

    post confirm_sign_in_path, params: { token: issued.token }, as: :json
    assert_response :not_found
    assert response.parsed_body["error"].present?
  end

  test "a used link reopened while signed in goes to the rack" do
    issued = SignInToken.issue!(email: "alice@example.com")
    post confirm_sign_in_path, params: { token: issued.token }
    get confirm_sign_in_path(token: issued.token)
    assert_redirected_to rack_path
  end

  test "session cookie is httpOnly, SameSite=Lax and long-lived" do
    issued = SignInToken.issue!(email: "alice@example.com")
    post confirm_sign_in_path, params: { token: issued.token }
    cookie = Array(response.headers["set-cookie"]).flat_map { |value| value.split("\n") }.find { |line| line.start_with?("session_id=") }
    assert_match(/httponly/i, cookie)
    assert_match(/samesite=lax/i, cookie)
    assert_match(/expires=/i, cookie)
  end

  test "link requests are rate limited per email" do
    5.times { post sign_in_path, params: { email: "alice@example.com" }, as: :json }
    assert_response :success
    post sign_in_path, params: { email: "ALICE@example.com" }, as: :json
    assert_response :too_many_requests
    post sign_in_path, params: { email: "bob@example.com" }, as: :json
    assert_response :success
  end

  test "link requests are rate limited per IP" do
    20.times { |i| post sign_in_path, params: { email: "user#{i}@example.com" }, as: :json }
    post sign_in_path, params: { email: "another@example.com" }, as: :json
    assert_response :too_many_requests
  end

  test "sign out destroys the current session" do
    sign_in_as users(:alice)
    assert_difference -> { Session.count }, -1 do
      delete session_path, as: :json
    end
    assert_response :success
    get api_me_path
    assert_nil response.parsed_body["user"]
  end

  test "sign out other devices keeps the current one" do
    other = users(:alice).sessions.create!(last_seen_at: Time.current)
    bobs = users(:bob).sessions.create!(last_seen_at: Time.current)
    sign_in_as users(:alice)

    delete other_sessions_path, as: :json
    assert_response :success
    assert_equal 1, response.parsed_body["signedOut"]
    assert_not Session.exists?(other.id)
    assert Session.exists?(bobs.id)
    get api_me_path
    assert_equal users(:alice).id, response.parsed_body.dig("user", "id")
  end

  test "sign out requires a session" do
    delete session_path, as: :json
    assert_response :unauthorized
  end

  test "rack page embeds the signed-in user" do
    sign_in_as users(:alice)
    get "/rack/"
    payload = JSON.parse(css_select("script#currentUser").first.text)
    assert_equal "alice@example.com", payload["email"]
  end
end
