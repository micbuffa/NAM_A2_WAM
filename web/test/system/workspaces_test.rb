require "application_system_test_case"

# Tone / Projects: switching changes what is shown, never what is playing
# (see ProjectsTest for a project playing on in Tone).
class WorkspacesTest < ApplicationSystemTestCase
  include RackAssets

  setup do
    skip_unless_rack_built
    visit "/rack/"
    wait_for_rack
  end

  teardown { switch_to "tone" if page.has_css?("#workspaceSwitch", wait: 0) }

  test "each workspace shows its own panels" do
    assert_selector "#presetsPanel", visible: true
    assert_selector ".fx-rack", visible: true
    assert_selector "#audioSource", visible: true # DI files play through the rack in Tone
    assert_no_selector "#projectsWorkspace", visible: true

    switch_to "projects"
    assert_selector "#projectsWorkspace", visible: true
    assert_selector "#projectsPanel", visible: true
    assert_no_selector "#audioSource", visible: true
    assert_no_selector "#presetsPanel", visible: true
    assert_no_selector ".fx-rack", visible: true
    assert_selector "#inputDevice", visible: true # Audio devices belong to both

    visit "/rack/"
    wait_for_rack
    assert_selector "#projectsWorkspace", visible: true # the workspace is remembered
  end

  test "a guest is invited to sign in to use projects" do
    switch_to "projects"
    assert_selector "#projectsPanel", visible: true
    assert_selector "#projectsEmptyTitle", text: "Sign in to use projects"
    assert_selector "#projectSelect option", text: "Sign in to see your projects", visible: :all
  end

  private
    def switch_to(workspace)
      page.execute_script("const s = document.getElementById('workspaceSwitch'); s.value = arguments[0]; s.dispatchEvent(new Event('change'))", workspace)
      assert_selector "body[data-workspace=#{workspace}]"
    end
end
