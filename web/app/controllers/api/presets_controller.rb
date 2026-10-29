class Api::PresetsController < Api::BaseController
  def index
    render json: current_user.presets.order(updated_at: :desc).map(&:summary_json)
  end

  def show
    render json: preset.full_json
  end

  def create
    key = json_body["requestId"]
    if key.present? && (!key.is_a?(String) || !key.match?(/\A[0-9a-f-]{36}\z/))
      return render json: { error: "Invalid preset requestId" }, status: :unprocessable_content
    end
    created = nil
    replay = false
    current_user.with_lock do
      created = current_user.presets.find_by(creation_key: key) if key.present?
      if created
        unless created.name == json_body["name"].to_s.squish && created.state == json_body["state"]
          return render json: { error: "Preset creation request already used" }, status: :conflict
        end
        replay = true
      else
        created = current_user.presets.create!(name: json_body["name"], state: json_body["state"], creation_key: key.presence)
      end
    end
    render json: created.full_json, status: replay ? :ok : :created
  end

  def update
    attributes = json_body.slice("name", "state")
    raise ActionController::ParameterMissing, :name if attributes.empty?

    preset.update!(attributes)
    render json: preset.summary_json
  end

  def destroy
    preset.destroy!
    head :no_content
  end

  private
    def preset
      @preset ||= current_user.presets.find(params[:id])
    end
end
