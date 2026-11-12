# Where a Play backing track comes from: a file from the user's device or a YouTube import.
class AddSourceToBackingTracks < ActiveRecord::Migration[8.1]
  def change
    add_column :backing_tracks, :source, :string, null: false, default: "upload"
    add_column :backing_tracks, :import_metadata, :json
  end
end
