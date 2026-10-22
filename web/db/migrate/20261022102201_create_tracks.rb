class CreateTracks < ActiveRecord::Migration[8.1]
  def change
    # The audio file is an Active Storage attachment (Track#audio). The preset
    # (guitar and bass only) is an account preset or a Factory key
    # ("factory:twin-clean"), never both.
    create_table :tracks do |t|
      t.references :project, null: false, foreign_key: { on_delete: :cascade }
      t.integer :position, null: false, default: 0
      t.string :name, null: false
      t.string :instrument, null: false, default: "guitar"
      t.references :preset, foreign_key: { on_delete: :nullify }
      t.string :factory_preset
      t.integer :volume, null: false, default: 80
      t.integer :pan, null: false, default: 0
      t.boolean :mute, null: false, default: false
      t.boolean :solo, null: false, default: false
      t.boolean :input_monitoring, null: false, default: false
      t.timestamps
    end
    add_index :tracks, [ :project_id, :position ]
  end
end
