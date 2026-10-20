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
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
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
    click_on "New preset"
    within("dialog[open]") do
      fill_in "Preset name", with: "System test crunch"
      click_on "Create preset"
    end
    assert_selector "#presetTitle", exact_text: "System test crunch"
    assert_text "My preset · Synced to player@example.com"
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

    find("#presetRevert").click # the preset is still the active one: reload it
    assert_selector "#presetStatus", text: "Loaded “System test crunch”.", wait: 20
    assert_equal saved, chain_snapshot
    assert_selector "#presetTitle", exact_text: "System test crunch"

    # A second preset of the same chain gets a distinct default name and
    # becomes the active one; loading the first switches back to it.
    model_name = saved["model"].delete_suffix(".nam")
    click_on "New preset"
    within("dialog[open]") do
      assert_field "Preset name", with: model_name
      click_on "Create preset"
    end
    assert_selector "#presetTitle", exact_text: model_name
    click_on "New preset"
    within("dialog[open]") do
      assert_field "Preset name", with: "#{model_name} 2"
      click_on "Cancel"
    end
    select_preset "System test crunch"
    assert_selector "#presetTitle", exact_text: "System test crunch", wait: 20

    # The account survives a reload; the preset is listed from the server.
    visit "/rack/"
    wait_for_rack(wait: 40)
    within("#accountPanel") { assert_text "player@example.com" }
    assert_selector "#presetSelect option", exact_text: "System test crunch"
  end

  test "confirming the magic link in another tab updates the open rack without reloading" do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
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
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
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
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
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
    within("dialog[open]", text: "Settings") do
      assert_text "leaver@example.com"
      assert_text "NAM models and impulse responses"
      click_on "Sign out"
      assert_text "Stored in this browser only", wait: 10 # the Account section re-renders as a guest
      click_on "Done"
    end
    within("#accountPanel") { assert_button "Sign in" }
    wait_until("the rack is back to its default settings", timeout: 20) { chain_snapshot == guest }
  end

  test "confirming the magic link with no rack open opens the rack signed in" do
    skip_unless_rack_built
    token = SignInToken.issue!(email: "solo@example.com").token
    visit confirm_sign_in_path(token:)
    click_on "Sign in"
    assert_current_path "/rack/", wait: 10
    within("#accountPanel") { assert_text "solo@example.com", wait: 10 }
  end

  test "the rack reopens the account's last preset after a reload, until it is deleted" do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
    sign_in_as_by_link "returner@example.com"
    set_input_gain(-7)
    saved = chain_snapshot
    click_on "New preset"
    within("dialog[open]") do
      fill_in "Preset name", with: "Reopened"
      click_on "Create preset"
    end
    assert_selector "#presetTitle", exact_text: "Reopened"
    user = User.find_by!(email: "returner@example.com")
    wait_until("the account remembers the preset") { user.reload.preferences["lastPresetId"] == user.presets.sole.id }

    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_selector "#presetTitle", exact_text: "Reopened", wait: 20
    assert_equal saved, chain_snapshot

    find("#presetDelete").click
    within("dialog[open]") { click_on "Delete" }
    assert_selector "#presetTitle", exact_text: "Untitled rack"
    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_selector "#presetTitle", exact_text: "Untitled rack"
  end

  test "signing in reopens the account's last preset unless the rack has unsaved changes" do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
    guest = chain_snapshot
    set_input_gain(-7)
    state = JSON.parse(page.evaluate_async_script("const done = arguments[0]; phase3Debug.rack.getState().then((s) => done(JSON.stringify(s)));"))
    user = User.create!(email: "comeback@example.com")
    preset = user.presets.create!(name: "Account tone", state:)
    user.update!(preferences: { "lastPresetId" => preset.id })
    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_equal guest, chain_snapshot

    sign_in_as_by_link "comeback@example.com"
    assert_selector "#presetTitle", exact_text: "Account tone", wait: 20
    assert_equal(-7, chain_snapshot.dig("params", "inputGain"))

    click_on "Account: comeback@example.com"
    within("dialog[open]", text: "Settings") do
      click_on "Sign out"
      assert_text "Stored in this browser only", wait: 10
      click_on "Done"
    end
    assert_selector "#presetTitle", exact_text: "Untitled rack"
    wait_until("the rack is back to its default settings", timeout: 20) { chain_snapshot == guest }

    set_input_gain(3)
    sign_in_as_by_link "comeback@example.com"
    assert_text "My presets are synced to comeback@example.com"
    assert_selector "#presetTitle", exact_text: "Untitled rack"
    assert_equal 3, chain_snapshot.dig("params", "inputGain"), "unsaved changes stay until the user saves them"
  end

  test "a guest signs in to save, and the rack on screen becomes the preset" do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_selector "#presetSelect option[disabled]", text: "Sign in to save presets", visible: :all
    assert_text "Sign in to save your presets and find them on every device."
    set_input_gain(-5)

    click_on "Save"
    within("dialog[open]") do
      assert_text "Sign in to save this sound as a preset."
      click_on "Cancel"
    end
    assert_no_css "dialog[open]"

    click_on "New preset"
    within("dialog[open]") { assert_text "Sign in to save this sound as a preset." }
    token = SignInToken.issue!(email: "saver@example.com").token
    within_window(open_like_a_mail_client(confirm_sign_in_path(token:))) { click_on "Sign in" }
    within("#accountPanel") { assert_text "saver@example.com", wait: 10 }
    within("dialog.new-preset-dialog[open]", wait: 10) do
      fill_in "Preset name", with: "Signed-in save"
      click_on "Create preset"
    end
    assert_selector "#presetTitle", exact_text: "Signed-in save"
    preset = User.find_by!(email: "saver@example.com").presets.find_by!(name: "Signed-in save")
    nam_entry = preset.state.dig("a", "entries").find { |entry| entry["kind"] == "nam" }
    assert_equal(-5, nam_entry.dig("state", "parameterValues", "inputGain", "value"))
  end

  test "the online rack deletes the presets an earlier version stored in this browser" do
    skip_unless_rack_built
    visit "/up"
    page.evaluate_async_script(<<~JS)
      const done = arguments[0];
      const request = indexedDB.open('nam-a2-wam-presets', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('presets', {keyPath: 'id'});
      request.onsuccess = () => {
        const tx = request.result.transaction('presets', 'readwrite');
        tx.objectStore('presets').put({id: 'old', name: 'Old guest preset', state: {version: 1}});
        tx.oncomplete = () => { request.result.close(); done(); };
      };
    JS
    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_no_selector "#presetSelect option", text: "Old guest preset", visible: :all
    wait_until("the guest preset database is deleted") do
      page.evaluate_async_script("indexedDB.databases().then((list) => arguments[0](list.map((db) => db.name)))")
        .exclude?("nam-a2-wam-presets")
    end
  end

  test "a reload brings back the unsaved rack, saving a preset drops it" do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_no_selector "#presetUnsaved"
    set_input_gain(-9)
    assert_selector "#presetUnsaved", text: /unsaved changes/i
    wait_until("the draft is saved") { draft("guest") }

    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_selector "#presetStatus", text: "Restored your unsaved changes."
    assert_selector "#presetUnsaved", text: /unsaved changes/i
    assert_equal(-9, chain_snapshot.dig("params", "inputGain"))
    assert_selector "#presetTitle", exact_text: "Untitled rack"

    user = User.create!(email: "drafter@example.com")
    sign_in_as_by_link user.email
    assert_equal(-9, chain_snapshot.dig("params", "inputGain"), "signing in keeps the rack on screen")
    wait_until("the guest draft becomes the account's") { draft("user:#{user.id}") && !draft("guest") }
    click_on "Save"
    within("dialog.new-preset-dialog[open]") do
      fill_in "Preset name", with: "Kept"
      click_on "Save preset"
    end
    assert_selector "#presetTitle", exact_text: "Kept"
    assert_no_selector "#presetUnsaved"
    wait_until("saving drops the draft") { !draft("user:#{user.id}") }

    visit "/rack/"
    wait_for_rack(wait: 40)
    assert_selector "#presetTitle", exact_text: "Kept"
    assert_no_selector "#presetStatus", text: "Restored"
  end

  private
    # The draft stored for scope ('guest' or 'user:<id>'), or nil.
    def draft(scope)
      page.evaluate_async_script(<<~JS, scope)
        const [scope, done] = arguments;
        const request = indexedDB.open('nam-a2-wam-draft', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('drafts', {keyPath: 'scope'});
        request.onsuccess = () => {
          const get = request.result.transaction('drafts').objectStore('drafts').get(scope);
          get.onsuccess = () => { request.result.close(); done(get.result ? true : null); };
        };
      JS
    end

    def sign_in_as_by_link(email)
      token = SignInToken.issue!(email:).token
      within_window(open_like_a_mail_client(confirm_sign_in_path(token:))) { click_on "Sign in" }
      within("#accountPanel") { assert_text email, wait: 10 }
      click_on "Not now" if page.has_css?("dialog[open]", text: "Import", wait: 2)
    end

    def set_input_gain(value)
      page.evaluate_async_script(<<~JS, value)
        const [value, done] = arguments;
        window.phase3Debug.node.setParameterValues({inputGain: {id: 'inputGain', value, normalized: false}}).then(() => done());
      JS
    end

    def select_preset(name)
      find("#presetSelect").find("option", exact_text: name).select_option
    end

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
