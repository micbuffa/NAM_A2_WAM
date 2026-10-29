class AddPresetCreationKeys < ActiveRecord::Migration[8.1]
  def change
    add_column :presets, :creation_key, :string
    add_index :presets, [:user_id, :creation_key], unique: true
  end
end
