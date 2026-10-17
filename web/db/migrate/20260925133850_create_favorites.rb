class CreateFavorites < ActiveRecord::Migration[8.1]
  def change
    # asset_ref = the asset identity used by the plugin GUIs; metadata keeps
    # the asset snapshot so TONE3000 favorites can be listed on any device.
    create_table :favorites do |t|
      t.references :user, null: false, foreign_key: true
      t.string :kind, null: false
      t.string :asset_ref, null: false
      t.json :metadata, null: false, default: {}
      t.timestamps
    end
    add_index :favorites, [ :user_id, :kind, :asset_ref ], unique: true
  end
end
