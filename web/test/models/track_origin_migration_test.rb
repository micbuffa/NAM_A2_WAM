require "test_helper"
require Rails.root.join("db/migrate/20261026090000_add_origin_to_tracks")

class TrackOriginMigrationTest < ActiveSupport::TestCase
  class MigrationDatabase < ActiveRecord::Base
    self.abstract_class = true
  end

  test "migration preserves old DI presets and gives new tracks a personal default" do
    MigrationDatabase.establish_connection(adapter: "sqlite3", database: ":memory:")
    connection = MigrationDatabase.connection
    connection.create_table(:tracks) { |t| t.string :name; t.string :instrument; t.integer :preset_id }
    connection.execute("INSERT INTO tracks (name, instrument, preset_id) VALUES ('Historical DI', 'guitar', 42)")
    migration = AddOriginToTracks.new
    migration.define_singleton_method(:connection) { connection }
    migration.suppress_messages { migration.up }
    old = connection.select_one("SELECT * FROM tracks WHERE id = 1")
    assert_equal ["Historical DI", "guitar", 42, "legacy"], old.values_at("name", "instrument", "preset_id", "origin")
    connection.execute("INSERT INTO tracks (name) VALUES ('New part')")
    assert_equal "personal", connection.select_value("SELECT origin FROM tracks WHERE id = 2")
    migration.suppress_messages { migration.down }
    assert_equal 42, connection.select_value("SELECT preset_id FROM tracks WHERE id = 1")
  ensure
    MigrationDatabase.remove_connection
  end
end
