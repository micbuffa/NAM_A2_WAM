require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
# require "action_cable/engine"
require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Web
  # SharedArrayBuffer (WAM SDK ring buffers) requires a cross-origin isolated
  # page. Sent on Rails responses (default_headers) and on every static file
  # under public/ (public_file_server.headers, set in each environment).
  CROSS_ORIGIN_ISOLATION_HEADERS = {
    "cross-origin-opener-policy" => "same-origin",
    "cross-origin-embedder-policy" => "require-corp",
    "cross-origin-resource-policy" => "same-origin"
  }.freeze

  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks dev_sources.rb])

    # Track audio is served by Api::Projects::TrackAudiosController, which checks
    # the project access; the public /rails/active_storage routes are not drawn.
    config.active_storage.draw_routes = false

    config.action_dispatch.default_headers = config.action_dispatch.default_headers.merge(CROSS_ORIGIN_ISOLATION_HEADERS)
    config.public_file_server.headers = CROSS_ORIGIN_ISOLATION_HEADERS

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")
  end
end
