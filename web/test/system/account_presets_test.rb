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

  test "sign in with the emailed code, save a preset, alter the chain and restore it" do
    skip_unless_rack_synced
    visit "/rack/"
    assert_text "NAM WAM instantiated", wait: 40
    assert page.evaluate_script("window.crossOriginIsolated")

    click_on "Sign in / Sign up"
    within("dialog[open]") do
      fill_in "Email", with: "player@example.com"
      perform_enqueued_jobs do # the server enqueues the mail while we wait
        click_on "Send link and code"
        assert_field "6-digit code"
      end
    end
    code = ActionMailer::Base.deliveries.last.text_part.body.to_s[/^\d{6}$/]
    within("dialog[open]") do
      fill_in "6-digit code", with: code
      click_on "Sign in"
    end
    within("#accountPanel") { assert_text "player@example.com" }
    click_on "Not now" if page.has_css?("dialog[open]", text: "Import", wait: 2)

    saved = chain_snapshot
    assert saved["model"], "a default model should be loaded"
    click_on "Save current chain…"
    within("dialog[open]") do
      fill_in "Preset name", with: "System test crunch"
      click_on "Save preset"
    end
    within("#presetList") { assert_button "System test crunch" }
    assert_selector "#presetList li[aria-current=true]", text: "System test crunch"
    preset = User.find_by!(email: "player@example.com").presets.find_by!(name: "System test crunch")
    assert_equal saved["model"], preset.state.dig("nam", "model", "name")

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
    click_on "Save current chain…"
    within("dialog[open]") do
      assert_field "Preset name", with: model_name
      click_on "Save preset"
    end
    assert_selector "#presetList li[aria-current=true]", count: 1, text: model_name
    click_on "Save current chain…"
    within("dialog[open]") do
      assert_field "Preset name", with: "#{model_name} 2"
      click_on "Cancel"
    end
    within("#presetList") { click_on "System test crunch" }
    assert_selector "#presetList li[aria-current=true]", count: 1, text: "System test crunch", wait: 20

    # The account survives a reload; the preset is listed from the server.
    visit "/rack/"
    assert_text "NAM WAM instantiated", wait: 40
    within("#accountPanel") { assert_text "player@example.com" }
    within("#presetList") { assert_button "System test crunch" }
  end

  test "confirming the magic link in another tab updates the open rack without reloading" do
    skip_unless_rack_synced
    visit "/rack/"
    assert_text "NAM WAM instantiated", wait: 40
    page.execute_script("window.__sameDocument = true")
    within("#accountPanel") { assert_button "Sign in / Sign up" }

    token = SignInToken.issue!(email: "linker@example.com").token
    rack_window = current_window
    link_window = open_new_window
    within_window(link_window) do
      visit confirm_sign_in_path(token:)
      assert_text "Confirm sign-in"
      click_on "Sign in"
      assert_text "You are signed in"
    end

    switch_to_window(rack_window)
    within("#accountPanel") { assert_text "linker@example.com", wait: 10 }
    assert page.evaluate_script("window.__sameDocument === true"), "the rack tab must not reload"
  end

  private
    def chain_snapshot
      result = page.evaluate_async_script(CHAIN_SNAPSHOT_JS)
      flunk result if result.start_with?("ERROR")
      JSON.parse(result)
    end
end
