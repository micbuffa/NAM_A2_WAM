# Finds the project of a request: visible (owned or shared with the user) for
# reads, owned for writes. Shared viewers get 403 on writes, others 404.
module ProjectAccess
  extend ActiveSupport::Concern

  included do
    rescue_from NotProjectOwner, with: -> { render json: { error: "This project is shared with you read-only" }, status: :forbidden }
  end

  class NotProjectOwner < StandardError; end

  private
    def project_id = params[:project_id]

    def visible_project
      @visible_project ||= Project.visible_to(current_user).find(project_id)
    end

    def owned_project
      visible_project.owned_by?(current_user) ? visible_project : raise(NotProjectOwner)
    end
end
