# Projects the user owns or that were shared with them (read-only). Only the
# owner writes: a shared viewer gets 403, anyone else 404.
class Api::ProjectsController < Api::BaseController
  include ProjectAccess

  def index
    projects = Project.visible_to(current_user).includes(:user).order(updated_at: :desc)
    track_counts = Track.where(project: projects).group(:project_id).count
    render json: projects.map { |project| ProjectJson.summary(project, current_user, track_count: track_counts.fetch(project.id, 0)) }
  end

  def show
    render json: ProjectJson.full(visible_project, current_user)
  end

  def create
    project = current_user.projects.create!(json_body.slice("name", "bpm"))
    render json: ProjectJson.full(project, current_user), status: :created
  end

  def update
    attributes = json_body.slice("name", "bpm")
    raise ActionController::ParameterMissing, :name if attributes.empty?

    owned_project.update!(attributes)
    render json: ProjectJson.full(owned_project, current_user)
  end

  def destroy
    owned_project.destroy!
    head :no_content
  end

  private
    def project_id = params[:id]
end
