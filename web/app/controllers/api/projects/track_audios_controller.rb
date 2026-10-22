# Serves a track's audio file to the users who can see the project (the
# public Active Storage routes are off: config.active_storage.draw_routes).
# Byte ranges are honoured so <audio> can seek without a full download.
class Api::Projects::TrackAudiosController < Api::BaseController
  include ProjectAccess
  include ActiveStorage::Streaming

  def show
    audio = visible_project.tracks.find(params[:id]).audio
    return head :not_found unless audio.attached?

    blob = audio.blob
    if request.headers["Range"].present?
      send_blob_byte_range_data blob, request.headers["Range"]
    else
      response.headers["Accept-Ranges"] = "bytes"
      response.headers["Content-Length"] = blob.byte_size.to_s
      response.headers["Cache-Control"] = "private, max-age=3600"
      send_blob_stream blob
    end
  end
end
