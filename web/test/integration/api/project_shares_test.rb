require "test_helper"

class Api::ProjectSharesTest < ActionDispatch::IntegrationTest
  test "the owner shares a project with an existing account and revokes it" do
    sign_in_as users(:alice)
    project = projects(:alice_song)

    assert_enqueued_email_with ProjectShareMailer, :shared, params: ->(params) { params[:share].user == users(:bob) } do
      post api_project_shares_path(project), params: { email: " BOB@example.com " }, as: :json
    end
    assert_response :created
    assert_equal "bob@example.com", response.parsed_body["email"]
    share_id = response.parsed_body["id"]

    get api_project_shares_path(project)
    assert_equal [ "bob@example.com" ], response.parsed_body.map { |share| share["email"] }

    assert_no_enqueued_emails { post api_project_shares_path(project), params: { email: "bob@example.com" }, as: :json }
    assert_response :unprocessable_content
    assert_equal "User already has access to this project", response.parsed_body["error"]

    delete api_project_share_path(project, share_id), as: :json
    assert_response :no_content
    assert_not ProjectShare.exists?(share_id)
  end

  test "sharing needs an existing account other than the owner" do
    sign_in_as users(:alice)
    post api_project_shares_path(projects(:alice_song)), params: { email: "nobody@example.com" }, as: :json
    assert_response :unprocessable_content
    assert_includes response.parsed_body["error"], "No account uses nobody@example.com"

    post api_project_shares_path(projects(:alice_song)), params: { email: "alice@example.com" }, as: :json
    assert_response :unprocessable_content
    assert_equal "You own this project: share it with someone else", response.parsed_body["error"]
  end

  test "a shared viewer cannot manage the shares" do
    sign_in_as users(:alice)
    project = projects(:bob_jam)
    get api_project_shares_path(project)
    assert_response :forbidden
    delete api_project_share_path(project, project_shares(:bob_jam_with_alice)), as: :json
    assert_response :forbidden
    assert ProjectShare.exists?(project_shares(:bob_jam_with_alice).id)
  end

  test "a shared viewer leaves the project; the owner has nothing to leave" do
    sign_in_as users(:alice)
    project = projects(:bob_jam)
    share = project_shares(:bob_jam_with_alice)
    delete mine_api_project_shares_path(project), as: :json
    assert_response :no_content
    assert_not ProjectShare.exists?(share.id)
    get api_project_path(project)
    assert_response :not_found

    delete mine_api_project_shares_path(projects(:alice_song)), as: :json
    assert_response :not_found
  end
end
