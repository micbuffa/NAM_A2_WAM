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

  # Keep audio and separation provenance: removing an instrument must not
  # corrupt a published batch, and reactivating history must not resurrect it.
  def destroy
    if track.origin == "mix" || (!track.timeline_visible && !track.removed_at)
      return render json: { error: "Only timeline tracks can be removed" }, status: :unprocessable_content
    end
    track.update!(removed_at: track.removed_at || Time.current, timeline_visible: false, input_monitoring: false)
    render json: ProjectJson.track(track)
  end

  def restore
    if track.timeline_visible && !track.removed_at && track.origin != "mix"
      return render json: ProjectJson.track(track)
    end
    unless track.removed_at && track.origin != "mix"
      return render json: { error: "This track is not removed" }, status: :unprocessable_content
    end
    track.update!(removed_at: nil, timeline_visible: true, input_monitoring: false)
    render json: ProjectJson.track(track)
  end

  # Undo/redo a published group without deleting blobs or replaying inference.
  # Preconditions are checked for the whole group before any row is changed.
  def visibility
    project = owned_project
    changes = json_body["changes"]
    boolean_state = ->(state) { state.is_a?(Hash) && [true, false].include?(state["visible"]) && [true, false].include?(state["removed"]) && !(state["visible"] && state["removed"]) }
    unless changes.is_a?(Array) && changes.any? && changes.length <= 200 && changes.all? { |change| change.is_a?(Hash) && change["id"].is_a?(Integer) && boolean_state.call(change["before"]) && boolean_state.call(change["after"]) } && changes.map { |c| c["id"] }.uniq.size == changes.size
      return render json: { error: "Invalid visibility command" }, status: :unprocessable_content
    end
    project.with_lock do
      rows = project.tracks.where(id: changes.map { |change| change["id"] }).includes(:separation).index_by(&:id)
      unless rows.size == changes.size && rows.values.all? { |row| row.origin != "mix" && (!row.separation || row.separation.state == "ready") }
        return render json: { error: "Invalid command tracks" }, status: :unprocessable_content
      end
      active = json_body["afterSeparationId"]
      unless active.nil? || project.separations.where(id: active, state: "ready").exists?
        return render json: { error: "Invalid saved separation" }, status: :unprocessable_content
      end
      matches = ->(side) { changes.all? { |change| row = rows.fetch(change["id"]); row.timeline_visible == change[side]["visible"] && row.removed_at.present? == change[side]["removed"] } }
      already_applied = project.active_separation_id == active && matches.call("after")
      unless already_applied || (project.active_separation_id == json_body["beforeSeparationId"] && matches.call("before"))
        return render json: { error: "Project changed in another window; reopen it before undoing" }, status: :conflict
      end
      unless already_applied
        changes.each do |change|
          state = change["after"]
          rows.fetch(change["id"]).update!(timeline_visible: state["visible"], removed_at: state["removed"] ? Time.current : nil, input_monitoring: false)
        end
        project.update!(active_separation_id: active)
      end
      render json: { tracks: rows.values.map { |row| ProjectJson.track(row) }, activeSeparationId: active }
    end
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
