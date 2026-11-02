class AddTimeSignatureToProjects < ActiveRecord::Migration[8.1]
  def change
    add_column :projects, :time_signature, :string, null: false, default: "4/4"
  end
end
