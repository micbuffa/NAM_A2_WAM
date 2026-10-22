# The account preset a track plays through, for every user who can see the
# project: a shared viewer cannot read the owner's presets from /api/presets.
class Api::Projects::TrackPresetsController < Api::BaseController
  include ProjectAccess

  def show
    preset = visible_project.tracks.find(params[:id]).preset
    return head :not_found unless preset

    render json: preset.full_json
  end
end
