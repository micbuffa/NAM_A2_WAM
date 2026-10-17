require "test_helper"

class SignInMailerTest < ActionMailer::TestCase
  test "contains the confirmation link" do
    mail = SignInMailer.with(email: "alice@example.com", token: "tok_123").sign_in
    assert_equal [ "alice@example.com" ], mail.to
    assert_equal "Your NAM A2 WAM sign-in link", mail.subject
    [ mail.text_part, mail.html_part ].each do |part|
      assert_includes part.body.to_s, "http://example.com/sign_in/confirm?token=tok_123"
      assert_no_match(/code/i, part.body.to_s)
    end
  end
end
