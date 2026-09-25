# GET /api/me — current user (or null) and a fresh CSRF token. The rack calls
# it when another tab signs in or out, so it can update without reloading.
class AccountsController < ApplicationController
  def show
    response.headers["Cache-Control"] = "no-store"
    render json: account_payload
  end
end
