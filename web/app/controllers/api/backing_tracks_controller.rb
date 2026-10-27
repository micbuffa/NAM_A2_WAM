class Api::BackingTracksController < Api::BaseController
  def index
    # Metadata only; bytes use the existing private, project-authorized route.
    tracks = Track.where(project: Project.visible_to(current_user), origin: %w[mix original], removed_at: nil).with_attached_audio.includes(:project).order(created_at: :desc)
    render json: tracks.filter_map { |track|
      next unless track.audio.attached?
      if track.origin == "mix"
        ProjectJson.backing(track)
      elsif track.import_metadata&.dig("kind") == "youtube"
        ProjectJson.youtube_backing(track)
      end
    }
  end
end
