ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require_relative "support/rack_assets"
require_relative "support/sign_in_helper"
require_relative "support/rack_sign_in"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    setup { Rails.cache.clear } # rate_limit counters
  end
end

module ActionDispatch
  class IntegrationTest
    include SignInHelper
  end
end
