# Existing tracks keep their historical DI/preset behavior. New imports declare
# their origin explicitly; an instrument label alone never makes a stem a DI.
class AddOriginToTracks < ActiveRecord::Migration[8.1]
  def up
    add_column :tracks, :origin, :string, null: false, default: "personal"
    execute "UPDATE tracks SET origin = 'legacy'"
  end

  def down
    remove_column :tracks, :origin
  end
end
