# Where a project's tempo comes from: "default" (nobody set it), "estimated"
# (tempo analysis) or "user". Existing projects become "user" so an estimate
# never overwrites a tempo someone may have chosen.
class AddBpmSourceToProjects < ActiveRecord::Migration[8.1]
  def change
    add_column :projects, :bpm_source, :string, null: false, default: "user"
    change_column_default :projects, :bpm_source, from: "user", to: "default"
  end
end
