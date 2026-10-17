class Api::FavoritesController < Api::BaseController
  def index
    favorites = current_user.favorites.order(updated_at: :desc)
    favorites = favorites.where(kind: params[:kind]) if params[:kind].present?
    render json: favorites.map(&:as_api_json)
  end

  # Idempotent: favoriting the same asset twice updates its snapshot.
  def create
    favorite = current_user.favorites.find_or_initialize_by(kind: json_body["kind"], asset_ref: json_body["assetRef"])
    favorite.update!(metadata: json_body["metadata"] || {})
    render json: favorite.as_api_json, status: :created
  end

  def destroy
    current_user.favorites.find(params[:id]).destroy!
    head :no_content
  end

  # DELETE /api/favorites?kind=…&assetRef=… — the GUIs know assets by identity.
  def destroy_by_ref
    current_user.favorites.where(kind: params.require(:kind), asset_ref: params.require(:assetRef)).destroy_all
    head :no_content
  end
end
