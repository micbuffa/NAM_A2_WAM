require "application_system_test_case"

# A preset is the whole rack: pedals, both lanes and gains belong to it.
class RackPresetsTest < ApplicationSystemTestCase
  include RackAssets

  RACK_JS = <<~JS.freeze
    const done = arguments[arguments.length - 1];
    phase3Debug.rack.getState().then((s) => {
      const nam = s.a.entries.find((e) => e.kind === 'nam');
      done(JSON.stringify({chain: s.a.entries.map((e) => e.kind).join('>'), outputDbA: s.outputDbA,
        inputGain: nam?.state.parameterValues.inputGain.value}));
    });
  JS

  setup do
    skip_unless_rack_synced
    visit "/rack/"
    # Guest presets live in IndexedDB, which survives between tests.
    page.evaluate_async_script("const done = arguments[0]; const r = indexedDB.deleteDatabase('nam-a2-wam-presets'); r.onsuccess = r.onerror = r.onblocked = () => done();")
    visit "/rack/"
    assert_text "Chain ready", wait: 40
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

    click_on "Update “Clean”"
    assert_selector "#presetStatus", text: "Updated “Clean”."
    load_preset "Other"
    assert_equal "nam>cabinet", rack["chain"]
    load_preset "Clean"
    assert_equal({ "chain" => "effect>nam>cabinet", "outputDbA" => -6, "inputGain" => 4 }, rack)
  end

  test "a preset saved before the FX rack does not keep the current pedals" do
    page.evaluate_async_script(<<~JS)
      const done = arguments[0];
      (async () => {
        const {node, cabinetNode} = phase3Debug;
        const state = {version: 1, nam: await node.getState(), cabinet: await cabinetNode.getState()};
        const request = indexedDB.open('nam-a2-wam-presets', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('presets', {keyPath: 'id'});
        request.onsuccess = () => {
          const tx = request.result.transaction('presets', 'readwrite');
          tx.objectStore('presets').put({id: 'legacy', name: 'Legacy', state, createdAt: '2026-01-01', updatedAt: '2026-01-01'});
          tx.oncomplete = () => done();
        };
      })();
    JS
    visit "/rack/"
    assert_text "Chain ready", wait: 40
    add_pedal_and_gains

    load_preset "Legacy"
    assert_equal({ "chain" => "nam>cabinet", "outputDbA" => 0, "inputGain" => 0 }, rack)
  end

  private
    def rack = JSON.parse(page.evaluate_async_script(RACK_JS))

    def save_as_new(name)
      click_on "Save as new…"
      within("dialog[open]") do
        fill_in "Preset name", with: name
        click_on "Save preset"
      end
      assert_selector "#presetList li[aria-current=true]", text: name
    end

    def load_preset(name)
      button = find("#presetList .preset-load", exact_text: name)
      button.execute_script("this.scrollIntoView({block: 'center'})")
      button.click
      assert_selector "#presetStatus", exact_text: "Loaded “#{name}”.", wait: 20
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
