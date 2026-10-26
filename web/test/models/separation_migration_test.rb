require "test_helper"
require Rails.root.join("db/migrate/20261026140000_create_separations")

class SeparationMigrationTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  class MigrationDatabase < ActiveRecord::Base
    self.abstract_class = true
  end

  test "SQLite migration preserves tracks, DI settings, shares and attachment references" do
    assert CreateSeparations.disable_ddl_transaction, "SQLite foreign-key rebuilding must run outside the outer migration transaction"
    MigrationDatabase.establish_connection(adapter: "sqlite3", database: ":memory:")
    connection = MigrationDatabase.connection
    connection.create_table(:users)
    connection.create_table(:projects) { |t| t.references :user, foreign_key: true; t.string :name }
    connection.create_table(:tracks) { |t| t.references :project, foreign_key: { on_delete: :cascade }; t.string :name; t.string :origin; t.integer :preset_id; t.boolean :input_monitoring }
    connection.create_table(:project_shares) { |t| t.references :project, foreign_key: { on_delete: :cascade }; t.references :user }
    connection.create_table(:active_storage_attachments) { |t| t.string :record_type; t.integer :record_id; t.integer :blob_id }
    connection.execute("INSERT INTO users (id) VALUES (1)")
    connection.execute("INSERT INTO projects (id,user_id,name) VALUES (2,1,'Existing project')")
    connection.execute("INSERT INTO tracks (id,project_id,name,origin,preset_id,input_monitoring) VALUES (3,2,'DI','legacy',42,1)")
    connection.execute("INSERT INTO project_shares (id,project_id,user_id) VALUES (4,2,1)")
    connection.execute("INSERT INTO active_storage_attachments (record_type,record_id,blob_id) VALUES ('Track',3,7)")
    migration = CreateSeparations.new
    migration.define_singleton_method(:connection) { connection }
    migration.suppress_messages { migration.migrate(:up) }
    track = connection.select_one("SELECT * FROM tracks WHERE id=3")
    assert_equal [2,'DI','legacy',42,1,1], track.values_at('project_id','name','origin','preset_id','input_monitoring','creator_id')
    assert_equal 1, connection.select_value("SELECT count(*) FROM project_shares")
    assert_equal 3, connection.select_value("SELECT record_id FROM active_storage_attachments")
    assert_empty connection.select_all("PRAGMA foreign_key_check")
  ensure
    MigrationDatabase.remove_connection
  end
end
