# litestream-ruby reads LITESTREAM_* environment variables directly (see
# config/litestream.yml); nothing to map from credentials here.
Rails.application.configure do
  config.litestream.config_path = Rails.root.join("config", "litestream.yml")
end
