# Renders the rack page. Everything it loads (JS modules, WASM, models, IRs)
# is served statically from public/rack/, so relative imports keep working.
class RackController < ApplicationController
  # The rack needs AudioWorklet, WASM SIMD and SharedArrayBuffer.
  allow_browser versions: :modern

  def show
    # Relative URLs in the page ("./main.js") need the trailing slash. The
    # router strips it from request.path, so check the original request.
    path = request.original_fullpath.split("?", 2).first
    return redirect_to("/rack/", status: :moved_permanently) unless path.end_with?("/", "/index.html")

    @current_user_payload = current_user&.account_json
    render layout: false
  end
end
