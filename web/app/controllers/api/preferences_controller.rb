class Api::PreferencesController < Api::BaseController
  def show
    render json: current_user.preferences
  end

  def update
    current_user.update!(preferences: current_user.preferences.merge(User.sanitize_preferences(json_body)))
    render json: current_user.preferences
  end
end
