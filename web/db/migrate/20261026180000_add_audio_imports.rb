class AddAudioImports < ActiveRecord::Migration[8.1]
  def change
    add_column :tracks, :import_metadata, :json
    create_table :audio_imports do |t|
      t.references :user, null: false, foreign_key: true
      t.string :url, null: false
      t.string :state, null: false, default: "queued"
      t.float :progress
      t.string :message
      t.json :metadata, null: false, default: {}
      t.integer :project_id
      t.datetime :heartbeat_at
      t.timestamps
    end
    add_index :audio_imports, [:user_id, :created_at]
  end
end
