require "application_system_test_case"

class ProjectsTest < ApplicationSystemTestCase
  include RackAssets
  include RackSignIn

  setup do
    skip_unless_rack_built
  end

  test "creates, renames and saves a project" do
    open_rack_signed_in "carol@example.com"
    switch_to_projects
    assert_selector "#projectsEmptyTitle", text: "Create your first project"

    click_on "New project", match: :first
    within("dialog[open]") do
      fill_in "Project name", with: "Late night"
      fill_in "Tempo", with: "84"
      click_on "Create project"
    end
    assert_selector "#projectTitle", text: "Late night"
    assert_selector "#projectBpm", text: "84"
    assert_selector "#projectSaveState", text: /\ASaved\z/i
    assert_selector "#projectSelect optgroup[label='My projects'] option", text: "Late night · 0 tracks", visible: :all

    find("#projectEdit").click
    within("dialog[open]") do
      fill_in "Project name", with: "Later night"
      click_on "Apply"
    end
    assert_selector "#projectSaveState", text: /\AUnsaved changes\z/i
    assert_equal "Late night", Project.last.name

    click_on "Save project"
    assert_selector "#projectSaveState", text: /\ASaved\z/i
    assert_equal [ "Later night", 84 ], Project.last.values_at(:name, :bpm)
  end

  test "imports an audio file as a new project" do
    open_rack_signed_in "carol@example.com"
    switch_to_projects
    click_on "Import audio"
    within("dialog[open]") do
      find("input[type=file]", visible: :all).attach_file(file_fixture("silence.wav"))
      assert_text "silence.wav"
      select "Bass", from: "Instrument"
      click_on "Import project"
    end
    assert_selector "#projectTitle", text: "silence"
    assert_selector ".track-row .track-meta", text: "Bass · No preset"
    assert_selector ".track-lane", text: "silence.wav"
    track = Project.last.tracks.sole
    assert_equal [ "bass", "silence.wav" ], [ track.instrument, track.audio.filename.to_s ]
  end

  test "a project shared with me is read-only" do
    open_rack_signed_in "alice@example.com"
    switch_to_projects
    find("#projectSelect").find("option", text: "Bob jam").select_option
    assert_selector "#projectKicker", text: /Shared by bob@example.com · 1 track/i
    assert_selector "#projectSaveState", text: /\ARead-only\z/i
    assert_no_selector "#projectEdit", visible: true
    assert_no_selector "#projectSave", visible: true
    assert_selector "#projectSelect optgroup[label='Shared with me'] option", text: "Bob jam", visible: :all
  end

  test "adds a track, mixes it, picks a preset and saves the project" do
    open_rack_signed_in "alice@example.com"
    switch_to_projects
    find("#projectSelect").find("option", text: "Alice song").select_option
    assert_selector ".track-row", count: 2

    click_on "Add track"
    within("dialog[open]") do
      find("input[type=file]", visible: :all).attach_file(file_fixture("silence.wav"))
      select "Bass", from: "Instrument"
      click_on "Add track"
    end
    assert_selector ".track-row.selected .track-name", text: "Bass 1"
    assert_selector "#inspectorTrackName", text: "Bass 1"
    assert_equal "silence.wav", Track.find_by(name: "Bass 1").audio.filename.to_s

    within(".track-row.selected") do
      find("button[aria-label='Mute Bass 1']").click
      find("input[aria-label='Volume for Bass 1']", visible: :all).execute_script("this.value = 60; this.dispatchEvent(new Event('input'))")
    end
    find("#inspectorPreset").find("option", text: "SVT Bass · Bass").select_option
    assert_selector ".track-row.selected .track-meta", text: "Bass · SVT Bass"
    assert_selector "#projectSaveState", text: /\AUnsaved changes\z/i

    click_on "Save project"
    assert_selector "#projectSaveState", text: /\ASaved\z/i
    assert_equal [ true, 60, "factory:svt-bass" ], Track.find_by(name: "Bass 1").values_at(:mute, :volume, :factory_preset)
  end

  test "input monitoring is for one guitar or bass track at a time" do
    open_rack_signed_in "alice@example.com"
    switch_to_projects
    find("#projectSelect").find("option", text: "Alice song").select_option
    find("button[aria-label='Input monitoring Rhythm']").click
    assert_selector "button[aria-label='Input monitoring Rhythm'][aria-pressed=true]"
    assert_selector "button[aria-label='Input monitoring Drums'][disabled]"
    find(".track-row", text: "Drums").click
    assert_selector "#inspectorPresetHelp", text: "Tone presets apply to guitar and bass tracks."
    assert_no_selector "#inspectorPresetField", visible: true
  end

  test "renames a track, changes its instrument and deletes it" do
    open_rack_signed_in "alice@example.com"
    switch_to_projects
    find("#projectSelect").find("option", text: "Alice song").select_option
    within(".track-row", text: "Rhythm") { find("tl-icon-button[aria-label='Edit Rhythm']").click }
    within("dialog[open]") do
      fill_in "Track name", with: "Lead vocal"
      select "Vocals", from: "Instrument"
      click_on "Apply"
    end
    assert_selector ".track-row.selected .track-name", text: "Lead vocal"
    click_on "Save project"
    assert_selector "#projectSaveState", text: /\ASaved\z/i
    assert_equal [ "Lead vocal", "vocals", nil ], tracks(:alice_rhythm).reload.values_at(:name, :instrument, :preset_id)

    within(".track-row", text: "Lead vocal") { find("tl-icon-button[aria-label='Edit Lead vocal']").click }
    within("dialog[open]") { click_on "Delete track" }
    within("dialog[open]") { click_on "Delete" }
    assert_no_selector ".track-row", text: "Lead vocal"
    assert_not Track.exists?(tracks(:alice_rhythm).id)
  end

  test "a shared project's mix can be tried but not saved" do
    open_rack_signed_in "alice@example.com"
    switch_to_projects
    find("#projectSelect").find("option", text: "Bob jam").select_option
    assert_no_selector "tl-icon-button[aria-label='Edit Bass']"
    find("button[aria-label='Mute Bass']").click
    assert_selector "button[aria-label='Mute Bass'][aria-pressed=true]"
    assert_selector "#projectSaveState", text: /\ARead-only\z/i
    assert_selector "#inspectorPreset[disabled]", visible: :all
    assert_no_selector "#inspectorEditPreset", visible: true
    assert_no_selector "#projectShare", visible: true
    assert_not tracks(:bob_bass).reload.mute

    click_on "Reset mix" # back to the owner's mix
    assert_selector "button[aria-label='Mute Bass'][aria-pressed=false]"
    assert_no_selector "#projectResetMix", visible: true
  end

  test "the owner shares a project read-only and stops sharing it" do
    open_rack_signed_in "alice@example.com"
    switch_to_projects
    find("#projectSelect").find("option", text: "Alice song").select_option
    click_on "Share"
    within("dialog[open]") do
      assert_text "Only you can open this project."
      fill_in "Email of their account", with: "nobody@example.com"
      click_on "Share"
      assert_selector "[role=alert]", text: "No account uses nobody@example.com"

      fill_in "Email of their account", with: "bob@example.com"
      click_on "Share"
      assert_selector ".share-person", text: users(:bob).display_name
      assert_text /People with access · 01/i
    end
    assert_selector "#projectKicker", text: /Shared with/i
    assert_equal [ users(:bob) ], projects(:alice_song).shared_with.to_a

    within("dialog[open]") do
      find("tl-icon-button[aria-label^='Stop sharing with']").click
      assert_text "Only you can open this project."
      click_on "Done"
    end
    assert_empty projects(:alice_song).shared_with.reload
  end

  test "plays a project, seeks in a lane and keeps playing in Tone" do
    open_rack_signed_in "carol@example.com"
    switch_to_projects
    click_on "Import audio"
    within("dialog[open]") do
      find("input[type=file]", visible: :all).attach_file(file_fixture("tone.wav"))
      click_on "Import project"
    end
    assert_selector ".track-clip .track-clip-name", text: "tone.wav" # decoded and drawn
    assert_selector "#projectRuler span", text: "1"

    find("#projectPlay").click
    assert_selector "#projectPlay[aria-pressed=true][aria-label=Pause]"
    switch_workspace "tone"
    position = page.evaluate_script("phase3Debug.projectPlayer.position")
    sleep 0.3
    assert page.evaluate_script("phase3Debug.projectPlayer.playing"), "switching to Tone must not stop the project"
    assert_operator page.evaluate_script("phase3Debug.projectPlayer.position"), :>, position

    switch_to_projects
    find("#projectPlay").click
    assert_selector "#projectPlay[aria-pressed=false][aria-label=Play]"
    find("#projectRewind").click
    assert_selector "#projectClock", text: "00:00.00"
    find(".track-lane-area").click(x: 5, y: 5, offset: :top_left) # near the start: 120 BPM, 16 bars = 32 s
    assert_in_delta 0.5, page.evaluate_script("phase3Debug.projectPlayer.position"), 0.5
  end

  test "guitar tracks play through their preset; input monitoring takes the live guitar" do
    open_rack_signed_in "carol@example.com"
    switch_to_projects
    click_on "Import audio"
    within("dialog[open]") do
      find("input[type=file]", visible: :all).attach_file(file_fixture("tone.wav"))
      click_on "Import project"
    end
    find("#inspectorPreset").find("option", text: "British Edge · Crunch").select_option
    assert_selector ".track-meta", text: "Guitar · British Edge (loading…)"
    assert_selector ".track-meta", text: /\AGuitar · British Edge\z/, wait: 20
    id = Project.last.tracks.sole.id
    assert_equal [ "ready", "lite" ], tone_of(id)

    find("button[aria-label='Input monitoring tone']").click
    assert_selector "#inspectorPresetHelp", text: "your live guitar plays through this preset"
    assert_equal id, page.evaluate_script("phase3Debug.projectPlayer.monitoredId")
    assert_equal "full", tone_of(id).last
    switch_workspace "tone" # Tone's rack takes the live guitar back
    assert_not page.evaluate_script("Boolean(phase3Debug.projectPlayer.liveTarget)")
    switch_to_projects
    assert page.evaluate_script("Boolean(phase3Debug.projectPlayer.liveTarget)")

    find("#inspectorPreset").find("option", text: "No preset").select_option
    assert_selector ".track-meta", text: /\AGuitar · No preset\z/
    assert_nil page.evaluate_script("phase3Debug.trackTones.status(#{id})")
  end

  private
    def tone_of(id)
      page.evaluate_script("(t => t && [t.state, t.applied])(phase3Debug.trackTones.tones.get(#{id}))")
    end

    def switch_to_projects = switch_workspace("projects")

    def switch_workspace(name)
      page.execute_script("const s = document.getElementById('workspaceSwitch'); s.value = arguments[0]; s.dispatchEvent(new Event('change'))", name)
      assert_selector "body[data-workspace=#{name}]"
    end
end
