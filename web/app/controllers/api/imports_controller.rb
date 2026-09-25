# POST /api/import — one-shot import of a guest's browser data after sign-in.
# Favorites are upserted, presets appended, and local preferences only fill
# keys the account does not have yet (another device may have set them).
class Api::ImportsController < Api::BaseController
  MAX_PRESETS = 50
  MAX_FAVORITES = 1000

  def create
    presets = Array(json_body["presets"]).first(MAX_PRESETS)
    favorites = Array(json_body["favorites"]).first(MAX_FAVORITES)
    preferences = User.sanitize_preferences(json_body["preferences"] || {})

    ActiveRecord::Base.transaction do
      presets.each { |preset| current_user.presets.create!(name: preset["name"], state: preset["state"]) }
      favorites.each do |entry|
        current_user.favorites.find_or_initialize_by(kind: entry["kind"], asset_ref: entry["assetRef"])
          .update!(metadata: entry["metadata"] || {})
      end
      current_user.update!(preferences: preferences.merge(current_user.preferences))
    end

    render json: { presets: presets.size, favorites: favorites.size, preferences: current_user.preferences }
  end
end
