class AddTrackRecordingSnapshots < ActiveRecord::Migration[8.1]
  def change
    add_column :tracks, :recording, :json
    add_column :tracks, :preset_snapshot, :json
    add_column :tracks, :snapshot_id, :string
  end
end
