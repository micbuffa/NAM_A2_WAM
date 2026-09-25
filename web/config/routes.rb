Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # The rack page. /rack/index.html is the TONE3000 OAuth redirect URI
  # derived by public/rack/config.js, so it renders the same page.
  get "rack", to: "rack#show", as: :rack
  get "rack/index.html", to: "rack#show"
  root to: redirect("/rack/")
end
