require "test_helper"

# The rack's buttons are <tl-button role="button"> custom elements: let
# click_on / assert_button find them by role.
Capybara.enable_aria_role = true

class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  driven_by :selenium, using: :headless_chrome, screen_size: [ 1400, 1000 ] do |options|
    # No microphone prompt or real devices during tests.
    options.add_argument("--use-fake-ui-for-media-stream")
    options.add_argument("--use-fake-device-for-media-stream")
    options.add_argument("--autoplay-policy=no-user-gesture-required")
  end

  # Exercise real CSRF protection in the browser (the rack's account UI also
  # needs the csrf-token meta tag to enable itself).
  setup do
    @forgery_protection = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true
  end

  teardown { ActionController::Base.allow_forgery_protection = @forgery_protection }

  # Every test starts as a fresh guest: Capybara only clears the storage of
  # the window a test ends on, and the rack reopens the guest's last preset
  # (localStorage) from IndexedDB. /up is same-origin and loads no rack.
  setup do
    visit "/up"
    page.evaluate_async_script(<<~JS)
      const done = arguments[0];
      localStorage.clear();
      const request = indexedDB.deleteDatabase('nam-a2-wam-presets');
      request.onsuccess = request.onerror = request.onblocked = () => done();
    JS
  end
end
