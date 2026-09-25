Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # The rack page. /rack/index.html is the TONE3000 OAuth redirect URI
  # derived by public/rack/config.js, so it renders the same page.
  get "rack", to: "rack#show", as: :rack
  get "rack/index.html", to: "rack#show"
  root to: redirect("/rack/")

  # Passwordless sign-in (also sign-up).
  get "sign_in", to: "sign_ins#new", as: :new_sign_in
  post "sign_in", to: "sign_ins#create", as: :sign_in
  get "sign_in/sent", to: "sign_ins#sent", as: :sent_sign_in
  post "sign_in/code", to: "sign_ins#verify_code", as: :sign_in_code
  get "sign_in/confirm", to: "sign_ins#show", as: :confirm_sign_in
  post "sign_in/confirm", to: "sign_ins#confirm"
  delete "session", to: "sessions#destroy", as: :session
  delete "sessions/others", to: "sessions#destroy_others", as: :other_sessions

  get "api/me", to: "accounts#show", as: :api_me

  namespace :api, defaults: { format: :json } do
    resources :presets, except: %i[new edit]
    resources :favorites, only: %i[index create destroy] do
      delete "", on: :collection, action: :destroy_by_ref
    end
    resource :preferences, only: %i[show update]
    resource :import, only: :create
  end
end
