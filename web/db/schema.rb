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

ActiveRecord::Schema[8.1].define(version: 2026_09_25_133850) do
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
    t.index ["user_id", "updated_at"], name: "index_presets_on_user_id_and_updated_at"
    t.index ["user_id"], name: "index_presets_on_user_id"
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
    t.string "code_digest", null: false
    t.datetime "expires_at", null: false
    t.datetime "used_at"
    t.integer "failed_attempts", default: 0, null: false
    t.string "request_ip"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email", "used_at"], name: "index_sign_in_tokens_on_email_and_used_at"
    t.index ["token_digest"], name: "index_sign_in_tokens_on_token_digest", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "name"
    t.json "preferences", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "favorites", "users"
  add_foreign_key "presets", "users"
  add_foreign_key "sessions", "users"
end
