# Tracks of a project. Create and update accept JSON, or multipart when an
# audio file is sent (field "audio"). Only the project owner writes.
class Api::Projects::TracksController < Api::BaseController
  include ProjectAccess

  ATTRIBUTES = {
    "name" => :name, "instrument" => :instrument, "presetId" => :preset_id, "factoryPreset" => :factory_preset,
    "volume" => :volume, "pan" => :pan, "mute" => :mute, "solo" => :solo, "inputMonitoring" => :input_monitoring
  }.freeze

  def create
    track = owned_project.tracks.new(position: next_position, **track_attributes)
    track.audio.attach(json_body["audio"]) if uploaded_audio?
    track.save!
    render json: ProjectJson.track(track), status: :created
  end

  def update
    attributes = track_attributes
    raise ActionController::ParameterMissing, :track if attributes.empty? && !uploaded_audio?

    track.assign_attributes(attributes)
    track.audio.attach(json_body["audio"]) if uploaded_audio?
    track.save!
    render json: ProjectJson.track(track)
  end

  def destroy
    track.destroy!
    head :no_content
  end

  # PATCH /api/projects/:project_id/tracks/order { ids: [...] }: every track
  # of the project, in their new timeline order.
  def reorder
    ids = Array(json_body["ids"]).map(&:to_i)
    tracks = owned_project.tracks.to_a
    unless ids.sort == tracks.map(&:id).sort
      return render json: { error: "ids must list every track of the project once" }, status: :unprocessable_content
    end

    Track.transaction { ids.each_with_index { |id, position| tracks.find { |t| t.id == id }.update!(position:) } }
    render json: ProjectJson.full(owned_project.reload, current_user)
  end

  private
    def track
      @track ||= owned_project.tracks.find(params[:id])
    end

    def track_attributes
      json_body.slice(*ATTRIBUTES.keys).transform_keys(ATTRIBUTES)
    end

    def uploaded_audio?
      json_body["audio"].is_a?(ActionDispatch::Http::UploadedFile)
    end

    def next_position
      (owned_project.tracks.maximum(:position) || -1) + 1
    end
end
