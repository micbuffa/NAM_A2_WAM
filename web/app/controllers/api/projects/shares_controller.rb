# Read-only shares of a project, managed by its owner. A project is shared
# with an existing account, found by email, who gets an email about it. A
# shared viewer can leave it.
class Api::Projects::SharesController < Api::BaseController
  include ProjectAccess

  def index
    render json: owned_project.shares.includes(:user).order(:created_at).map { |share| ProjectJson.share(share) }
  end

  def create
    email = json_body["email"].to_s.strip.downcase
    user = User.find_by(email:)
    return render json: { error: "No account uses #{email.presence || 'this email'}" }, status: :unprocessable_content unless user

    share = owned_project.shares.create!(user:)
    ProjectShareMailer.with(share:).shared.deliver_later
    render json: ProjectJson.share(share), status: :created
  end

  def destroy
    owned_project.shares.find(params[:id]).destroy!
    head :no_content
  end

  # DELETE /api/projects/:project_id/shares/mine: the viewer's own access.
  def leave
    visible_project.shares.find_by!(user: current_user).destroy!
    head :no_content
  end
end
