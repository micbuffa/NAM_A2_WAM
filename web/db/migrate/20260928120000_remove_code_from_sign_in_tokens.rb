class RemoveCodeFromSignInTokens < ActiveRecord::Migration[8.1]
  # Sign-in is by magic link only: the 6-digit code and its attempt counter go.
  def change
    remove_column :sign_in_tokens, :code_digest, :string, null: false
    remove_column :sign_in_tokens, :failed_attempts, :integer, null: false, default: 0
  end
end
