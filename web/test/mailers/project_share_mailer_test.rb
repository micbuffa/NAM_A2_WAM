require "test_helper"

class ProjectShareMailerTest < ActionMailer::TestCase
  test "tells the viewer who shared which project, with a link that opens it" do
    share = project_shares(:bob_jam_with_alice)
    mail = ProjectShareMailer.with(share:).shared
    assert_equal [ "alice@example.com" ], mail.to
    assert_equal "bob@example.com shared “Bob jam” with you", mail.subject
    [ mail.text_part, mail.html_part ].each do |part|
      assert_includes part.body.to_s, "http://example.com/rack/?project=#{share.project_id}"
      assert_includes part.body.to_s, "read-only"
    end
  end
end
