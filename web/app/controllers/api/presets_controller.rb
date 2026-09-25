class Api::PresetsController < Api::BaseController
  def index
    render json: current_user.presets.order(updated_at: :desc).map(&:summary_json)
  end

  def show
    render json: preset.full_json
  end

  def create
    created = current_user.presets.create!(name: json_body["name"], state: json_body["state"])
    render json: created.full_json, status: :created
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
