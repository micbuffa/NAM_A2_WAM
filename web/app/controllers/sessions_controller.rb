class SessionsController < ApplicationController
  before_action :require_session

  # DELETE /session
  def destroy
    terminate_session
    respond_to do |format|
      format.html { redirect_to rack_path, status: :see_other }
      format.json { render json: account_payload }
    end
  end

  private
    def require_session
      return if authenticated?

      respond_to do |format|
        format.html { redirect_to rack_path, status: :see_other }
        format.json { render json: { error: "Not signed in" }, status: :unauthorized }
      end
    end
end
