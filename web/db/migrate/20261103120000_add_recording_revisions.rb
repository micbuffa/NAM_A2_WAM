class AddRecordingRevisions < ActiveRecord::Migration[8.1]
  def change
    add_column :tracks, :recording_version_id, :string
    create_table :recording_revisions do |t|
      t.references :track, null: false, foreign_key: true
      t.string :token, null: false
      t.json :state, null: false
      t.timestamps
    end
    add_index :recording_revisions, [:track_id, :token], unique: true
  end
end
