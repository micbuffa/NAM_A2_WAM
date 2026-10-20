require "application_system_test_case"

# A preset is the whole rack: pedals, both lanes and gains belong to it.
class RackPresetsTest < ApplicationSystemTestCase
  include RackAssets
  include RackSignIn

  RACK_JS = <<~JS.freeze
    const done = arguments[arguments.length - 1];
    phase3Debug.rack.getState().then((s) => {
      const nam = s.a.entries.find((e) => e.kind === 'nam');
      done(JSON.stringify({chain: s.a.entries.map((e) => e.kind).join('>'), outputDbA: s.outputDbA,
        inputGain: nam?.state.parameterValues.inputGain.value}));
    });
  JS

  setup do
    skip_unless_rack_built
    open_rack_signed_in "presets@example.com"
  end

  test "pedals and gains belong to the preset that saved them" do
    save_as_new "Clean"
    add_pedal_and_gains
    save_as_new "Drive"

    load_preset "Clean"
    assert_equal({ "chain" => "nam>cabinet", "outputDbA" => 0, "inputGain" => 0 }, rack)
    load_preset "Drive"
    assert_equal({ "chain" => "effect>nam>cabinet", "outputDbA" => -6, "inputGain" => 4 }, rack)
  end

  test "Update replaces the active preset with the current rack" do
    save_as_new "Clean"
    save_as_new "Other"
    load_preset "Clean"
    add_pedal_and_gains

    click_on "Save"
    assert_selector "#presetStatus", text: "Saved “Clean”."
    load_preset "Other"
    assert_equal "nam>cabinet", rack["chain"]
    load_preset "Clean"
    assert_equal({ "chain" => "effect>nam>cabinet", "outputDbA" => -6, "inputGain" => 4 }, rack)
  end

  test "a preset saved before the FX rack does not keep the current pedals" do
    state = JSON.parse(page.evaluate_async_script(<<~JS))
      const done = arguments[0];
      (async () => {
        const {node, cabinetNode} = phase3Debug;
        done(JSON.stringify({version: 1, nam: await node.getState(), cabinet: await cabinetNode.getState()}));
      })();
    JS
    User.find_by!(email: "presets@example.com").presets.create!(name: "Legacy", state:)
    visit "/rack/"
    wait_for_rack(wait: 40)
    add_pedal_and_gains

    load_preset "Legacy"
    assert_equal({ "chain" => "nam>cabinet", "outputDbA" => 0, "inputGain" => 0 }, rack)
  end

  test "a Factory preset loads its model, is read-only and saves as a new preset" do
    add_pedal_and_gains
    load_preset "Twin Clean · Clean"
    assert_equal "Twin Clean", find("#presetTitle").text
    assert_text "Factory · Clean"
    nam = JSON.parse(page.evaluate_async_script(<<~JS))
      const done = arguments[0];
      phase3Debug.rack.getState().then((s) => {
        const nam = s.a.entries.find((e) => e.kind === 'nam');
        done(JSON.stringify({model: nam.state.model.name, bass: nam.state.parameterValues.bass.value}));
      });
    JS
    assert_equal({ "model" => "Fender Twin Reverb.nam", "bass" => 5 }, nam)
    assert_equal "nam>cabinet", rack["chain"], "a Factory preset starts from the default rack"
    assert find("#presetDelete")[:disabled]
    assert_no_selector "#presetRename", visible: true

    add_pedal_and_gains
    click_on "Save"
    within("dialog[open]") do
      assert_field "Preset name", with: "Twin Clean"
      assert_no_text "Start from"
      assert_no_field "Default rack"
      fill_in "Preset name", with: "My twin"
      click_on "Save preset"
    end
    assert_selector "#presetTitle", exact_text: "My twin"
    assert_equal "effect>nam>cabinet", rack["chain"], "Save keeps the rack as it is"
    assert_text "My preset · Synced to presets@example.com"
  end

  test "a new preset can start from the default rack" do
    add_pedal_and_gains
    click_on "New preset"
    within("dialog[open]") do
      fill_in "Preset name", with: "Fresh"
      choose "Default rack"
      click_on "Create preset"
    end
    assert_selector "#presetTitle", exact_text: "Fresh"
    assert_equal({ "chain" => "nam>cabinet", "outputDbA" => 0, "inputGain" => 0 }, rack)
  end

  private
    def rack = JSON.parse(page.evaluate_async_script(RACK_JS))

    def save_as_new(name)
      click_on "New preset"
      within("dialog[open]") do
        fill_in "Preset name", with: name
        click_on "Create preset"
      end
      assert_selector "#presetTitle", exact_text: name
    end

    def load_preset(label)
      find("#presetSelect").find("option", exact_text: label).select_option
      assert_selector "#presetStatus", exact_text: "Loaded “#{label.split(" · ").first}”.", wait: 30
    end

    def add_pedal_and_gains
      page.evaluate_async_script(<<~JS)
        const done = arguments[0];
        (async () => {
          const {rack, node} = phase3Debug;
          const pedal = rack.a.registry.records.find((r) => r.role !== 'nam' && r.role !== 'cabinet' && /overdrive|ts9/i.test(JSON.stringify(r)));
          await rack.a.insert(pedal, rack.a.entries[0].id);
          rack.a.setOutputDb(-6);
          await node.setParameterValues({inputGain: {id: 'inputGain', value: 4, normalized: false}});
        })().then(() => done());
      JS
    end
end
