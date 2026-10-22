class CreateProjectShares < ActiveRecord::Migration[8.1]
  def change
    # Read-only access to a project for another user.
    create_table :project_shares do |t|
      t.references :project, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :project_shares, [ :project_id, :user_id ], unique: true
  end
end
