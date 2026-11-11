# Projects the user owns or that were shared with them (read-only). Only the
# owner writes: a shared viewer gets 403, anyone else 404.
class Api::ProjectsController < Api::BaseController
  include ProjectAccess

  def index
    projects = Project.visible_to(current_user).includes(:user, tracks: { audio_attachment: :blob }).order(updated_at: :desc)
    render json: projects.map { |project| ProjectJson.summary(project, current_user) }
  end

  def from_backing
    project, track = BackingProjectImport.call(user: current_user, id: json_body["id"], audio: json_body["audio"], title: json_body["title"], project_id: json_body["projectId"], name: json_body["name"])
    render json: ProjectJson.full(project, current_user).merge(importedTrackId: track.id), status: :created
  rescue ArgumentError => error
    render json: {error: error.message}, status: :unprocessable_content
  end

  def show
    render json: ProjectJson.full(visible_project, current_user)
  end

  def create
    project = current_user.projects.create!(project_attributes)
    render json: ProjectJson.full(project, current_user), status: :created
  end

  def update
    attributes = project_attributes
    raise ActionController::ParameterMissing, :name if attributes.empty?

    owned_project.update!(attributes)
    render json: ProjectJson.full(owned_project, current_user)
  end

  def destroy
    owned_project.destroy!
    head :no_content
  end

  private
    def project_attributes
      attributes = json_body.slice("name", "bpm")
      attributes["time_signature"] = json_body["timeSignature"] if json_body.key?("timeSignature")
      # A tempo sent without its origin was chosen by someone, never left as "default".
      if json_body.key?("bpmSource") then attributes["bpm_source"] = json_body["bpmSource"]
      elsif attributes.key?("bpm") then attributes["bpm_source"] = "user"
      end
      attributes
    end
    def project_id = params[:id]
end
