class Api::BackingTracksController < Api::BaseController
  def index
    # Metadata only; bytes use the existing private, project-authorized route.
    tracks = Track.where(project: Project.visible_to(current_user), origin: "mix").with_attached_audio.includes(:project).order(created_at: :desc)
    render json: tracks.select { |track| track.audio.attached? }.map { |track| ProjectJson.backing(track) }
  end
end
