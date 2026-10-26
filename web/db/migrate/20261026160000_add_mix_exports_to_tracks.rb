class AddMixExportsToTracks < ActiveRecord::Migration[8.1]
  def change
    # Additive SQLite operations only: no project/track table reconstruction.
    add_column :tracks, :mix_manifest, :json
    add_column :tracks, :render_token, :string
    add_index :tracks, [:project_id, :render_token], unique: true
  end
end
