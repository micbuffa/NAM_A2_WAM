# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_29_100000) do
  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "audio_imports", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "url", null: false
    t.string "state", default: "queued", null: false
    t.float "progress"
    t.string "message"
    t.json "metadata", default: {}, null: false
    t.integer "project_id"
    t.datetime "heartbeat_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.json "destination", default: {}, null: false
    t.index ["user_id", "created_at"], name: "index_audio_imports_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_audio_imports_on_user_id"
  end

  create_table "favorites", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "kind", null: false
    t.string "asset_ref", null: false
    t.json "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "kind", "asset_ref"], name: "index_favorites_on_user_id_and_kind_and_asset_ref", unique: true
    t.index ["user_id"], name: "index_favorites_on_user_id"
  end

  create_table "presets", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "name", null: false
    t.json "state", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "creation_key"
    t.index ["user_id", "creation_key"], name: "index_presets_on_user_id_and_creation_key", unique: true
    t.index ["user_id", "updated_at"], name: "index_presets_on_user_id_and_updated_at"
    t.index ["user_id"], name: "index_presets_on_user_id"
  end

  create_table "project_shares", force: :cascade do |t|
    t.integer "project_id", null: false
    t.integer "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id", "user_id"], name: "index_project_shares_on_project_id_and_user_id", unique: true
    t.index ["project_id"], name: "index_project_shares_on_project_id"
    t.index ["user_id"], name: "index_project_shares_on_user_id"
  end

  create_table "projects", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "name", null: false
    t.integer "bpm", default: 120, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "active_separation_id"
    t.index ["active_separation_id"], name: "index_projects_on_active_separation_id"
    t.index ["user_id", "updated_at"], name: "index_projects_on_user_id_and_updated_at"
    t.index ["user_id"], name: "index_projects_on_user_id"
  end

  create_table "separation_parts", force: :cascade do |t|
    t.integer "separation_id", null: false
    t.string "role", null: false
    t.string "sha256"
    t.integer "volume", default: 80, null: false
    t.integer "pan", default: 0, null: false
    t.boolean "mute", default: false, null: false
    t.boolean "solo", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.json "peaks"
    t.index ["separation_id", "role"], name: "index_separation_parts_on_separation_id_and_role", unique: true
    t.index ["separation_id"], name: "index_separation_parts_on_separation_id"
  end

  create_table "separations", force: :cascade do |t|
    t.integer "project_id", null: false
    t.integer "source_track_id", null: false
    t.integer "creator_id", null: false
    t.string "token", null: false
    t.string "state", default: "uploading", null: false
    t.json "manifest", default: {}, null: false
    t.string "source_checksum", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_separations_on_creator_id"
    t.index ["project_id", "token"], name: "index_separations_on_project_id_and_token", unique: true
    t.index ["project_id"], name: "index_separations_on_project_id"
    t.index ["source_track_id"], name: "index_separations_on_source_track_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "user_agent"
    t.string "ip_address"
    t.datetime "last_seen_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "sign_in_tokens", force: :cascade do |t|
    t.string "email", null: false
    t.string "token_digest", null: false
    t.datetime "expires_at", null: false
    t.datetime "used_at"
    t.string "request_ip"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email", "used_at"], name: "index_sign_in_tokens_on_email_and_used_at"
    t.index ["token_digest"], name: "index_sign_in_tokens_on_token_digest", unique: true
  end

  create_table "tracks", force: :cascade do |t|
    t.integer "project_id", null: false
    t.integer "position", default: 0, null: false
    t.string "name", null: false
    t.string "instrument", default: "guitar", null: false
    t.integer "preset_id"
    t.string "factory_preset"
    t.integer "volume", default: 80, null: false
    t.integer "pan", default: 0, null: false
    t.boolean "mute", default: false, null: false
    t.boolean "solo", default: false, null: false
    t.boolean "input_monitoring", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "origin", default: "personal", null: false
    t.integer "creator_id"
    t.integer "separation_id"
    t.string "source_role"
    t.json "waveform_peaks"
    t.json "mix_manifest"
    t.string "render_token"
    t.json "import_metadata"
    t.boolean "timeline_visible", default: true, null: false
    t.datetime "removed_at"
    t.json "recording"
    t.json "preset_snapshot"
    t.string "snapshot_id"
    t.index ["creator_id"], name: "index_tracks_on_creator_id"
    t.index ["preset_id"], name: "index_tracks_on_preset_id"
    t.index ["project_id", "position"], name: "index_tracks_on_project_id_and_position"
    t.index ["project_id", "render_token"], name: "index_tracks_on_project_id_and_render_token", unique: true
    t.index ["project_id"], name: "index_tracks_on_project_id"
    t.index ["separation_id"], name: "index_tracks_on_separation_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "name"
    t.json "preferences", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "audio_imports", "users"
  add_foreign_key "favorites", "users"
  add_foreign_key "presets", "users"
  add_foreign_key "project_shares", "projects", on_delete: :cascade
  add_foreign_key "project_shares", "users"
  add_foreign_key "projects", "separations", column: "active_separation_id", on_delete: :nullify
  add_foreign_key "projects", "users"
  add_foreign_key "separation_parts", "separations"
  add_foreign_key "separations", "projects"
  add_foreign_key "separations", "tracks", column: "source_track_id"
  add_foreign_key "separations", "users", column: "creator_id"
  add_foreign_key "sessions", "users"
  add_foreign_key "tracks", "presets", on_delete: :nullify
  add_foreign_key "tracks", "projects", on_delete: :cascade
  add_foreign_key "tracks", "separations"
  add_foreign_key "tracks", "users", column: "creator_id"
end
