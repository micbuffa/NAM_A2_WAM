Rails.application.routes.draw do
  mount Rails::Hyperdrive::Engine => "/_hyperdrive" if Rails.env.development?
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
  get "sign_in/confirm", to: "sign_ins#show", as: :confirm_sign_in
  post "sign_in/confirm", to: "sign_ins#confirm"
  delete "session", to: "sessions#destroy", as: :session

  get "api/me", to: "accounts#show", as: :api_me

  namespace :api, defaults: { format: :json } do
    resources :presets, except: %i[new edit]
    resources :favorites, only: %i[index create destroy] do
      delete "", on: :collection, action: :destroy_by_ref
    end
    resource :preferences, only: %i[show update]
    resource :import, only: :create
    resources :projects, except: %i[new edit] do
      resources :tracks, only: %i[create update destroy], module: :projects do
        patch :order, on: :collection, action: :reorder
        get :audio, on: :member, to: "track_audios#show"
        get :preset, on: :member, to: "track_presets#show"
      end
      resources :shares, only: %i[index create destroy], module: :projects
    end
  end
end
