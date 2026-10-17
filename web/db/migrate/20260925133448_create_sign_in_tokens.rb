class CreateSignInTokens < ActiveRecord::Migration[8.1]
  def change
    # Keyed by email: the account is only created on the first successful
    # sign-in, so a token may exist for an address without a user yet.
    create_table :sign_in_tokens do |t|
      t.string :email, null: false
      t.string :token_digest, null: false
      t.string :code_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :used_at
      t.integer :failed_attempts, null: false, default: 0
      t.string :request_ip
      t.timestamps
    end
    add_index :sign_in_tokens, :token_digest, unique: true
    add_index :sign_in_tokens, [ :email, :used_at ]
  end
end
