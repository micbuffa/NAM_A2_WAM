# Tracks of a project. Create and update accept JSON, or multipart when an
# audio file is sent (field "audio"). Only the project owner writes.
class Api::Projects::TracksController < Api::BaseController
  include ProjectAccess

  ATTRIBUTES = {
    "origin" => :origin, "name" => :name, "instrument" => :instrument, "presetId" => :preset_id, "factoryPreset" => :factory_preset,
    "volume" => :volume, "pan" => :pan, "mute" => :mute, "solo" => :solo, "inputMonitoring" => :input_monitoring
  }.freeze

  def create
    attributes = track_attributes
    # Generated stems/mixes and the migration-only legacy origin are reserved
    # for the server-side workflows, not selectable by a generic upload client.
    unless %w[personal original].include?(attributes.fetch(:origin, "personal"))
      return render json: { error: "origin must be personal or original" }, status: :unprocessable_content
    end
    track = owned_project.tracks.new(position: next_position, creator: current_user, **attributes)
    track.audio.attach(json_body["audio"]) if uploaded_audio?
    track.save!
    render json: ProjectJson.track(track), status: :created
  end

  def update
    attributes = track_attributes
    raise ActionController::ParameterMissing, :track if attributes.empty? && !uploaded_audio?

    if uploaded_audio? && (track.origin == "mix" || track.separation_id || track.source_separations.exists?)
      return render json: { error: "Import a new original instead of replacing saved separation audio" }, status: :unprocessable_content
    end
    track.assign_attributes(attributes)
    track.audio.attach(json_body["audio"]) if uploaded_audio?
    track.save!
    render json: ProjectJson.track(track)
  end

  def destroy
    if track.origin == "mix" || track.separation_id || track.source_separations.exists?
      return render json: { error: "This track belongs to a saved separation" }, status: :unprocessable_content
    end
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
