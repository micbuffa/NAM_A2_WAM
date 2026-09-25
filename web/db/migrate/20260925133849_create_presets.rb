class CreatePresets < ActiveRecord::Migration[8.1]
  def change
    # state = full WAM chain as produced by "Save WAM state":
    # { version, nam: NamNode#getState, cabinet: CabinetNode#getState }
    create_table :presets do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.json :state, null: false
      t.timestamps
    end
    add_index :presets, [ :user_id, :updated_at ]
  end
end
