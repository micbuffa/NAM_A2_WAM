# Captures the TONELAB GUI of every bundled WAM plugin as its catalogue / rack card thumbnail.
#
#   npm start                                    # serves the rack on http://localhost:8765/rack/
#   cd web && bundle exec ruby ../tools/capture-plugin-thumbnails.rb [rack url] [plugin folder...]
#
# Each GUI is built in the fx-test page (headless Chrome), shown once its fonts and pictures are loaded, and saved
# as <plugin folder>/tonelab-thumbnail.png; plugins.json then points the entry's `thumbnail` at it. The tuner and the
# NAM/Cabinet plugins (src/) keep their own pictures. Run it again whenever a plugin's look changes.
require "json"
require "selenium-webdriver"

ROOT = File.expand_path("..", __dir__)
CATALOGUE = File.join(ROOT, "examples/wam/wamPlugins/plugins.json")
THUMBNAIL = "tonelab-thumbnail.png"

rack = ARGV.first&.start_with?("http") ? ARGV.shift : "http://localhost:8765/rack/"
only = ARGV
catalogue = JSON.parse(File.read(CATALOGUE))
entries = catalogue["plugins"].select do |entry|
  entry["uri"].start_with?("./") && entry["role"] != "tuner" &&
    (only.empty? || only.include?(entry["uri"].delete_prefix("./").split("/").first))
end

options = Selenium::WebDriver::Chrome::Options.new
options.add_argument("--headless=new")
options.add_argument("--window-size=1600,1200")
options.add_argument("--force-device-scale-factor=1")
options.add_argument("--autoplay-policy=no-user-gesture-required")
driver = Selenium::WebDriver.for(:chrome, options: options)
driver.manage.timeouts.script_timeout = 60

BUILD = <<~JS
  const [uri, done] = arguments;
  (async () => {
    window.thumbContext ||= new AudioContext();
    const {default: initializeWamHost} = await import('/third_party/wam-examples/packages/sdk/src/initializeWamHost.js');
    window.thumbHost ||= (await initializeWamHost(window.thumbContext))[0];
    const {default: Plugin} = await import(new URL(uri, new URL('../wamPlugins/', location.href)).href);
    const plugin = await Plugin.createInstance(window.thumbHost, window.thumbContext);
    const gui = await plugin.createGui();
    const stage = document.getElementById('thumb-stage') || document.body.appendChild(Object.assign(document.createElement('div'), {id: 'thumb-stage'}));
    // Rounded corners show the stage: paint it like the card picture slot.
    const slot = getComputedStyle(document.documentElement).getPropertyValue('--tl-surface-sunken').trim() || '#0b0d0c';
    stage.style.cssText = `position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-start;justify-content:flex-start;padding:0;background:${slot}`;
    stage.replaceChildren(gui);
    // Wait for the faceplate picture and the title font before the shot.
    const pedal = gui.shadowRoot?.querySelector('.pedal');
    const picture = pedal && getComputedStyle(pedal).getPropertyValue('--skin-image').match(/url\\("?([^")]+)"?\\)/)?.[1];
    if (picture) await new Promise(resolve => Object.assign(new Image(), {onload: resolve, onerror: resolve, src: picture}));
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 400));
    done({ok: true});
  })().catch(error => done({ok: false, error: String(error)}));
JS

failures = []
begin
  driver.navigate.to(File.join(rack, "fx-test/"))
  sleep 2
  entries.each do |entry|
    folder = File.dirname(entry["uri"].delete_prefix("./"))
    result = driver.execute_async_script(BUILD, entry["uri"].delete_prefix("./"))
    unless result["ok"]
      failures << "#{folder}: #{result['error']}"
      next
    end
    gui = driver.find_element(css: "#thumb-stage > *")
    path = File.join(ROOT, "examples/wam/wamPlugins", folder, THUMBNAIL)
    gui.save_screenshot(path)
    entry["thumbnail"] = "./#{THUMBNAIL}"
    puts "#{folder} -> #{File.size(path) / 1024} KB"
  end
ensure
  driver.quit
end

File.write(CATALOGUE, JSON.pretty_generate(catalogue) + "\n")
abort("Failed: #{failures.join(' | ')}") unless failures.empty?
