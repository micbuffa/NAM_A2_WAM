# Saving presets needs an account on the online rack: system tests that save
# open the rack signed in, through the real magic-link page.
module RackSignIn
  def open_rack_signed_in(email, wait: 40)
    visit confirm_sign_in_path(token: SignInToken.issue!(email:).token)
    click_on "Sign in"
    assert_current_path "/rack/", wait: 10
    wait_for_rack(wait:)
    within("#accountPanel") { assert_text email, wait: 10 }
    click_on "Not now" if page.has_css?("dialog[open]", text: "Import", wait: 1)
  end
end
