require "test_helper"
require Rails.root.join("db/migrate/20261026210000_add_timeline_visibility")

class TimelineVisibilityMigrationTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  class MigrationDatabase < ActiveRecord::Base
    self.abstract_class = true
  end
  test "existing active stems survive, old versions and original become reserve, other parts and attachments stay intact" do
    MigrationDatabase.establish_connection(adapter:"sqlite3",database:":memory:")
    connection=MigrationDatabase.connection
    connection.create_table(:projects) { |t| t.integer :active_separation_id }
    connection.create_table(:separations) { |t| t.integer :source_track_id }
    connection.create_table(:tracks) { |t| t.integer :project_id; t.integer :separation_id; t.string :origin; t.integer :volume }
    connection.create_table(:audio_imports)
    connection.create_table(:active_storage_attachments) { |t| t.integer :record_id; t.integer :blob_id }
    connection.execute("INSERT INTO projects (id,active_separation_id) VALUES (1,10)")
    connection.execute("INSERT INTO separations (id,source_track_id) VALUES (10,1),(20,1)")
    connection.execute("INSERT INTO tracks (id,project_id,separation_id,origin,volume) VALUES (1,1,NULL,'original',80),(2,1,NULL,'personal',44),(3,1,10,'stem',65),(4,1,20,'stem',70),(5,1,NULL,'mix',80)")
    connection.execute("INSERT INTO active_storage_attachments (record_id,blob_id) VALUES (1,99),(3,100),(4,101)")
    migration=AddTimelineVisibility.new
    migration.define_singleton_method(:connection) {connection}
    migration.suppress_messages {migration.migrate(:up)}
    assert_equal [0,1,1,0,0],connection.select_values("SELECT timeline_visible FROM tracks ORDER BY id")
    assert_equal 44,connection.select_value("SELECT volume FROM tracks WHERE id=2")
    assert_equal 5,connection.select_value("SELECT count(*) FROM tracks")
    assert_equal [99,100,101],connection.select_values("SELECT blob_id FROM active_storage_attachments ORDER BY id")
    assert_equal 10,connection.select_value("SELECT active_separation_id FROM projects WHERE id=1")
  ensure
    MigrationDatabase.remove_connection
  end
end
