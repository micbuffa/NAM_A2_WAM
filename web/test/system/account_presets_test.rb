require "application_system_test_case"

class AccountPresetsTest < ApplicationSystemTestCase
  include RackAssets
  include ActionMailer::TestHelper
  include ActiveJob::TestHelper

  CHAIN_SNAPSHOT_JS = <<~JS.freeze
    const done = arguments[arguments.length - 1];
    const {node, cabinetNode} = window.phase3Debug;
    Promise.all([node.getState(), cabinetNode.getState()]).then(([nam, cabinet]) => done(JSON.stringify({
      params: Object.fromEntries(Object.entries(nam.parameterValues).map(([id, entry]) => [id, Math.round(entry.value * 1e4) / 1e4])),
      model: nam.model?.name || null, variant: nam.modelVariant, ir: cabinet.ir?.id || null,
      irTrim: cabinet.parameterValues?.irTrim?.value ?? null
    }))).catch((error) => done('ERROR ' + error.message));
  JS

  test "sign in with the emailed link, save a preset, alter the chain and restore it" do
    skip_unless_rack_synced
    visit "/rack/"
    assert_text "Chain ready", wait: 40
    assert page.evaluate_script("window.crossOriginIsolated")

    click_on "Sign in"
    within("dialog[open]") do
      fill_in "Email", with: "player@example.com"
      perform_enqueued_jobs do # the server enqueues the mail while we wait
        click_on "Send link"
        assert_text "Open it on this computer"
      end
    end
    link = ActionMailer::Base.deliveries.last.text_part.body.to_s[%r{http\S+/sign_in/confirm\?token=[\w-]+}]
    link_window = open_like_a_mail_client(URI(link).request_uri)
    within_window(link_window) { click_on "Sign in" }
    within("#accountPanel") { assert_text "player@example.com", wait: 10 }
    wait_until("the sign-in tab closes itself") { link_window.closed? }
    assert_no_css "dialog[open]", text: "Sign in or create an account"
    click_on "Not now" if page.has_css?("dialog[open]", text: "Import", wait: 2)

    saved = chain_snapshot
    assert saved["model"], "a default model should be loaded"
    click_on "Save as new…"
    within("dialog[open]") do
      fill_in "Preset name", with: "System test crunch"
      click_on "Save preset"
    end
    within("#presetList") { assert_button "System test crunch" }
    assert_selector "#presetList li[aria-current=true]", text: "System test crunch"
    preset = User.find_by!(email: "player@example.com").presets.find_by!(name: "System test crunch")
    # A preset is the whole rack state (what "Save WAM state" captures).
    nam_entry = preset.state.dig("a", "entries").find { |entry| entry["kind"] == "nam" }
    assert_equal saved["model"], nam_entry.dig("state", "model", "name")

    page.evaluate_async_script(<<~JS)
      const done = arguments[0];
      const {node} = window.phase3Debug;
      node.setParameterValues({inputGain: {id: 'inputGain', value: -7, normalized: false},
        outputGain: {id: 'outputGain', value: 4.5, normalized: false}}).then(() => done());
    JS
    assert_not_equal saved["params"], chain_snapshot["params"]

    within("#presetList") { click_on "System test crunch" }
    assert_selector "#presetStatus", text: "Loaded “System test crunch”.", wait: 20
    assert_equal saved, chain_snapshot
    assert_selector "#presetList li[aria-current=true]", count: 1, text: "System test crunch"
    assert_selector "#hostStatus", text: "Preset “System test crunch” active."

    # A second preset of the same chain gets a distinct default name and
    # becomes the active one; loading the first switches back to it.
    model_name = saved["model"].delete_suffix(".nam")
    click_on "Save as new…"
    within("dialog[open]") do
      assert_field "Preset name", with: model_name
      click_on "Save preset"
    end
    assert_selector "#presetList li[aria-current=true]", count: 1, text: model_name
    click_on "Save as new…"
    within("dialog[open]") do
      assert_field "Preset name", with: "#{model_name} 2"
      click_on "Cancel"
    end
    within("#presetList") { click_on "System test crunch" }
    assert_selector "#presetList li[aria-current=true]", count: 1, text: "System test crunch", wait: 20

    # The account survives a reload; the preset is listed from the server.
    visit "/rack/"
    assert_text "Chain ready", wait: 40
    within("#accountPanel") { assert_text "player@example.com" }
    within("#presetList") { assert_button "System test crunch" }
  end

  test "confirming the magic link in another tab updates the open rack without reloading" do
    skip_unless_rack_synced
    visit "/rack/"
    assert_text "Chain ready", wait: 40
    page.execute_script("window.__sameDocument = true")
    within("#accountPanel") { assert_button "Sign in" }

    token = SignInToken.issue!(email: "linker@example.com").token
    link_window = open_like_a_mail_client(confirm_sign_in_path(token:))
    within_window(link_window) do
      assert_text "Confirm sign-in"
      click_on "Sign in"
    end

    within("#accountPanel") { assert_text "linker@example.com", wait: 10 }
    assert page.evaluate_script("window.__sameDocument === true"), "the rack tab must not reload"
    wait_until("the sign-in tab closes itself") { link_window.closed? }
  end

  test "a sign-in tab that cannot close says the rack is signed in" do
    skip_unless_rack_synced
    visit "/rack/"
    assert_text "Chain ready", wait: 40
    token = SignInToken.issue!(email: "inplace@example.com").token
    link_window = open_new_window # starts at about:blank: window.close() is refused, as in letter_opener
    within_window(link_window) do
      visit confirm_sign_in_path(token:)
      click_on "Sign in"
      assert_selector "h1", text: "You are signed in"
      assert_text "Your open rack tab is now signed in"
      assert_link "Open the rack in this tab"
      refresh # the used link now leads to the rack
      assert_current_path "/rack/"
    end
    within("#accountPanel") { assert_text "inplace@example.com", wait: 10 }
  end

  test "signing out puts the rack back to the guest default" do
    skip_unless_rack_synced
    visit "/rack/"
    assert_text "Chain ready", wait: 40
    guest = chain_snapshot

    token = SignInToken.issue!(email: "leaver@example.com").token
    within_window(open_like_a_mail_client(confirm_sign_in_path(token:))) { click_on "Sign in" }
    within("#accountPanel") { assert_text "leaver@example.com", wait: 10 }
    click_on "Not now" if page.has_css?("dialog[open]", text: "Import", wait: 2)
    page.evaluate_async_script(<<~JS)
      const done = arguments[0];
      window.phase3Debug.node.setParameterValues({inputGain: {id: 'inputGain', value: -7, normalized: false}}).then(() => done());
    JS
    assert_not_equal guest["params"], chain_snapshot["params"]

    click_on "Account: leaver@example.com"
    within("dialog[open]") do
      assert_text "leaver@example.com"
      click_on "Sign out"
    end
    assert_no_css "dialog[open]"
    within("#accountPanel") { assert_button "Sign in" }
    assert_text "the rack is back to its default settings", wait: 20
    assert_equal guest, chain_snapshot
  end

  test "confirming the magic link with no rack open opens the rack signed in" do
    skip_unless_rack_synced
    token = SignInToken.issue!(email: "solo@example.com").token
    visit confirm_sign_in_path(token:)
    click_on "Sign in"
    assert_current_path "/rack/", wait: 10
    within("#accountPanel") { assert_text "solo@example.com", wait: 10 }
  end

  private
    # A new tab whose history starts at the link, like a webmail's
    # target=_blank rel=noopener (open_new_window starts at about:blank, which
    # forbids window.close()).
    def open_like_a_mail_client(path)
      window_opened_by { page.execute_script("window.open(arguments[0], '_blank', 'noopener')", path) }
    end

    def wait_until(what, timeout: 5)
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + timeout
      until yield
        flunk "timed out waiting until #{what}" if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
        sleep 0.05
      end
    end

    def chain_snapshot
      result = page.evaluate_async_script(CHAIN_SNAPSHOT_JS)
      flunk result if result.start_with?("ERROR")
      JSON.parse(result)
    end
end
