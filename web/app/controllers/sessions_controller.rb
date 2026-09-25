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

  # DELETE /sessions/others — keep this device, sign every other one out.
  def destroy_others
    count = current_user.sessions.where.not(id: Current.session.id).destroy_all.size
    respond_to do |format|
      format.html { redirect_to rack_path, status: :see_other }
      format.json { render json: { signedOut: count } }
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
