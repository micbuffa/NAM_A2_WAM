class AddRemovedAtToTracks < ActiveRecord::Migration[8.1]
  def change
    add_column :tracks, :removed_at, :datetime
  end
end
