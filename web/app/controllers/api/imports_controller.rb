# POST /api/import — one-shot import of a guest's browser data after sign-in.
# Favorites are upserted, and local preferences only fill keys the account
# does not have yet (another device may have set them). Presets are not
# imported: on the online rack, saving one needs an account.
class Api::ImportsController < Api::BaseController
  MAX_FAVORITES = 1000

  def create
    favorites = Array(json_body["favorites"]).first(MAX_FAVORITES)
    preferences = User.sanitize_preferences(json_body["preferences"] || {})

    ActiveRecord::Base.transaction do
      favorites.each do |entry|
        current_user.favorites.find_or_initialize_by(kind: entry["kind"], asset_ref: entry["assetRef"])
          .update!(metadata: entry["metadata"] || {})
      end
      current_user.update!(preferences: preferences.merge(current_user.preferences))
    end

    render json: { favorites: favorites.size, preferences: current_user.preferences }
  end
end
