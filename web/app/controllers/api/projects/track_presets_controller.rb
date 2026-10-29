# The account preset a track plays through, for every user who can see the
# project: a shared viewer cannot read the owner's presets from /api/presets.
class Api::Projects::TrackPresetsController < Api::BaseController
  include ProjectAccess

  def show
    track = visible_project.tracks.find(params[:id])
    return head :not_found unless track.plays_through_preset?

    return render json: { state: track.preset_snapshot } if track.preset_snapshot

    preset = track.preset
    return head :not_found unless preset

    render json: preset.full_json
  end
end
