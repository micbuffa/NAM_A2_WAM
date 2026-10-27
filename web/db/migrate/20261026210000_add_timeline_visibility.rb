# Preserve saved audio/history while making each project one ordered track list.
class AddTimelineVisibility < ActiveRecord::Migration[8.1]
  def up
    add_column :tracks, :timeline_visible, :boolean, null: false, default: true
    add_column :audio_imports, :destination, :json, null: false, default: {}
    execute <<~SQL
      UPDATE tracks SET timeline_visible = 0
      WHERE origin = 'mix' OR (origin = 'stem' AND NOT EXISTS (
        SELECT 1 FROM projects WHERE projects.id = tracks.project_id
        AND projects.active_separation_id = tracks.separation_id))
    SQL
    execute <<~SQL
      UPDATE tracks SET timeline_visible = 0 WHERE id IN (
        SELECT separations.source_track_id FROM separations
        JOIN projects ON projects.active_separation_id = separations.id)
    SQL
  end

  def down
    remove_column :audio_imports, :destination
    remove_column :tracks, :timeline_visible
  end
end
