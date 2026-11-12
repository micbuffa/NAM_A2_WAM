# A backing track a user uploaded in Play, saved on the server (no project, not shared).
class CreateBackingTracks < ActiveRecord::Migration[8.1]
  def change
    create_table :backing_tracks do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.string :name, null: false
      t.float :duration
      t.timestamps
    end
    add_index :backing_tracks, [ :user_id, :created_at ]
  end
end
