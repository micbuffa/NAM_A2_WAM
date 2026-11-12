class Api::BackingTracksController < Api::BaseController
  include ActiveStorage::Streaming

  # Play's My tracks: the user's own backing tracks (uploads, YouTube imports, mixes sent from Studio).
  def index
    render json: owned.with_attached_audio.order(created_at: :desc).map(&:api_json)
  end

  def create
    audio = params.require(:audio)
    track = current_user.with_lock do
      raise ArgumentError, "Account audio quota exceeded" if audio.respond_to?(:size) && BackingTrack.quota_exceeded?(current_user, audio.size)
      owned.new(name: params[:name], duration: params[:duration].presence).tap { |track| track.audio.attach(audio); track.save! }
    end
    render json: track.api_json, status: :created
  rescue ArgumentError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  # Only the creator can rename it (others get a 404).
  def update
    track = owned.find(params[:id])
    track.update!(name: params[:name].to_s)
    render json: track.api_json
  end

  def destroy
    owned.find(params[:id]).destroy!
    head :no_content
  end

  # Private bytes for the creator, with byte ranges so <audio> can seek.
  def audio
    blob = owned.find(params[:id]).audio.blob
    if request.headers["Range"].present?
      send_blob_byte_range_data blob, request.headers["Range"]
    else
      response.headers["Accept-Ranges"] = "bytes"
      response.headers["Content-Length"] = blob.byte_size.to_s
      response.headers["Cache-Control"] = "private, max-age=3600"
      send_blob_stream blob
    end
  end

  private
    def owned = BackingTrack.owned_by(current_user)
end
