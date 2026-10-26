class CreateSeparations < ActiveRecord::Migration[8.1]
  # SQLite cannot disable foreign keys inside the migrator's outer transaction.
  # Rebuilding projects there would execute tracks' ON DELETE CASCADE.
  disable_ddl_transaction!

  def change
    create_table :separations do |t|
      t.references :project, null: false, foreign_key: true
      t.references :source_track, null: false, foreign_key: { to_table: :tracks }
      t.references :creator, null: false, foreign_key: { to_table: :users }
      t.string :token, null: false
      t.string :state, null: false, default: "uploading"
      t.json :manifest, null: false, default: {}
      t.string :source_checksum, null: false
      t.timestamps
    end
    add_index :separations, [ :project_id, :token ], unique: true
    create_table :separation_parts do |t|
      t.references :separation, null: false, foreign_key: true
      t.string :role, null: false
      t.string :sha256
      t.integer :volume, null: false, default: 80
      t.integer :pan, null: false, default: 0
      t.boolean :mute, null: false, default: false
      t.boolean :solo, null: false, default: false
      t.timestamps
    end
    add_index :separation_parts, [ :separation_id, :role ], unique: true
    add_reference :tracks, :creator, foreign_key: { to_table: :users }
    reversible { |dir| dir.up { execute "UPDATE tracks SET creator_id = (SELECT user_id FROM projects WHERE projects.id = tracks.project_id)" } }
    add_reference :tracks, :separation, foreign_key: true
    add_column :tracks, :source_role, :string
    add_reference :projects, :active_separation, foreign_key: { to_table: :separations, on_delete: :nullify }
  end
end
