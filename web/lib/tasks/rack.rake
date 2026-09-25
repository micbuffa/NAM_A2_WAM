namespace :rack do
  desc "Copy the static rack distribution into public/rack (RACK_FULL=1 rebuilds WASM and manifests)"
  task :sync do
    args = ENV["RACK_FULL"].present? ? [ "--full" ] : []
    system(Rails.root.join("bin/rack-sync").to_s, *args, exception: true)
  end
end
