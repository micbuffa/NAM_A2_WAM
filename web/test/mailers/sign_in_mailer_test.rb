require "test_helper"

class SignInMailerTest < ActionMailer::TestCase
  test "contains the confirmation link and the code" do
    mail = SignInMailer.with(email: "alice@example.com", token: "tok_123", code: "042042").sign_in
    assert_equal [ "alice@example.com" ], mail.to
    assert_includes mail.subject, "042042"
    [ mail.text_part, mail.html_part ].each do |part|
      assert_includes part.body.to_s, "http://example.com/sign_in/confirm?token=tok_123"
      assert_includes part.body.to_s, "042042"
    end
  end
end
