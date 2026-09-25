require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot for better performance and memory savings (ignored by Rake tasks).
  config.eager_load = true

  # Full error reports are disabled.
  config.consider_all_requests_local = false

  # Turn on fragment caching in view templates.
  config.action_controller.perform_caching = true

  # public/rack has no digested filenames: revalidate (cheap 304s) instead of
  # caching for a year, so a deploy never mixes old and new ES modules.
  config.public_file_server.headers = Web::CROSS_ORIGIN_ISOLATION_HEADERS.merge("cache-control" => "public, no-cache")

  # Enable serving of images, stylesheets, and JavaScripts from an asset server.
  # config.asset_host = "http://assets.example.com"

  # Assume all access to the app is happening through a SSL-terminating reverse proxy.
  config.assume_ssl = ENV.fetch("ASSUME_SSL", "true") == "true"

  # Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
  config.force_ssl = ENV.fetch("FORCE_SSL", "true") == "true"

  # Skip http-to-https redirect for the default health check endpoint.
  config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT with the current request id as a default log tag.
  config.log_tags = [ :request_id ]
  config.logger   = ActiveSupport::TaggedLogging.logger(STDOUT)

  # Change to "debug" to log everything (including potentially personally-identifiable information!).
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  # Prevent health checks from clogging up the logs.
  config.silence_healthcheck_path = "/up"

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Replace the default in-process memory cache store with a durable alternative.
  config.cache_store = :solid_cache_store

  # Replace the default in-process and non-durable queuing backend for Active Job.
  config.active_job.queue_adapter = :solid_queue
  config.solid_queue.connects_to = { database: { writing: :queue } }
  # Mail jobs carry the plaintext sign-in token and code: drop them once sent.
  config.solid_queue.preserve_finished_jobs = false

  # Ignore bad email addresses and do not raise email delivery errors.
  # Set this to true and configure the email server for immediate delivery to raise delivery errors.
  # config.action_mailer.raise_delivery_errors = false

  # Links in sign-in emails. APP_HOST is the public host name (e.g. rack.example.com).
  config.action_mailer.default_url_options = { host: ENV.fetch("APP_HOST", "localhost"), protocol: "https" }

  # Outgoing mail through any SMTP relay (Brevo, Postmark, ...), see README.
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.raise_delivery_errors = true
  config.action_mailer.smtp_settings = {
    address: ENV.fetch("SMTP_ADDRESS", "localhost"),
    port: Integer(ENV.fetch("SMTP_PORT", 587)),
    enable_starttls_auto: true
  }
  if ENV["SMTP_USERNAME"].present?
    config.action_mailer.smtp_settings.merge!(user_name: ENV["SMTP_USERNAME"], password: ENV["SMTP_PASSWORD"],
      authentication: ENV.fetch("SMTP_AUTHENTICATION", "plain").to_sym)
  end

  # Enable DNS rebinding protection and other `Host` header attacks.
  config.hosts = [ ENV["APP_HOST"] ] if ENV["APP_HOST"].present?
  config.host_authorization = { exclude: ->(request) { request.path == "/up" } }
end
