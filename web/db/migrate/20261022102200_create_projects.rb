class CreateProjects < ActiveRecord::Migration[8.1]
  def change
    create_table :projects do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :bpm, null: false, default: 120
      t.timestamps
    end
    add_index :projects, [ :user_id, :updated_at ]
  end
end
