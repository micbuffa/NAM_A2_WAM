require "test_helper"

class Api::ProjectsTest < ActionDispatch::IntegrationTest
  test "requires a session" do
    get api_projects_path
    assert_response :unauthorized
    post api_projects_path, params: { name: "x" }, as: :json
    assert_response :unauthorized
  end

  test "lists owned projects and the ones shared with the user" do
    sign_in_as users(:alice)
    get api_projects_path
    assert_response :success
    projects = response.parsed_body.index_by { |project| project["name"] }
    assert_equal [ "Alice song", "Bob jam" ].sort, projects.keys.sort
    assert_equal [ true, 2 ], projects["Alice song"].values_at("owned", "trackCount")
    assert_equal [ false, "bob@example.com", 1 ], [ projects["Bob jam"]["owned"], projects["Bob jam"]["owner"]["name"], projects["Bob jam"]["trackCount"] ]
    assert response.parsed_body.none? { |project| project.key?("tracks") }, "index must not ship tracks"
  end

  test "CRUD round-trip" do
    sign_in_as users(:alice)

    post api_projects_path, params: { name: "Late night", bpm: 84 }, as: :json
    assert_response :created
    id = response.parsed_body["id"]
    assert_equal [ "Late night", 84, [], [] ], response.parsed_body.values_at("name", "bpm", "tracks", "shares")

    patch api_project_path(id), params: { name: "Later night", bpm: 90 }, as: :json
    assert_response :success
    assert_equal [ "Later night", 90 ], Project.find(id).values_at(:name, :bpm)

    get api_project_path(id)
    assert_equal "Later night", response.parsed_body["name"]

    delete api_project_path(id), as: :json
    assert_response :no_content
    assert_not Project.exists?(id)
  end

  test "shows tracks in timeline order; shares only to the owner" do
    sign_in_as users(:alice)
    get api_project_path(projects(:alice_song))
    tracks = response.parsed_body["tracks"]
    assert_equal %w[Rhythm Drums], tracks.map { |track| track["name"] }
    assert_equal({ "presetId" => presets(:alice_clean).id, "presetName" => "Alice clean", "factoryPreset" => nil, "volume" => 80, "pan" => 0, "mute" => false, "audio" => nil },
      tracks.first.slice("presetId", "presetName", "factoryPreset", "volume", "pan", "mute", "audio"))
    assert_equal [], response.parsed_body["shares"]

    get api_project_path(projects(:bob_jam))
    assert_response :success
    assert_not response.parsed_body.key?("shares")
  end

  test "a shared project is read-only, other projects are invisible" do
    sign_in_as users(:alice)
    bobs = projects(:bob_jam)
    patch api_project_path(bobs), params: { name: "pwned" }, as: :json
    assert_response :forbidden
    delete api_project_path(bobs), as: :json
    assert_response :forbidden
    assert_equal "Bob jam", bobs.reload.name

    sign_in_as users(:bob)
    get api_project_path(projects(:alice_song))
    assert_response :not_found
    delete api_project_path(projects(:alice_song)), as: :json
    assert_response :not_found
  end

  test "invalid projects are rejected" do
    sign_in_as users(:alice)
    post api_projects_path, params: { name: "", bpm: 120 }, as: :json
    assert_response :unprocessable_content
    post api_projects_path, params: { name: "x", bpm: 500 }, as: :json
    assert_response :unprocessable_content
    assert_includes response.parsed_body["error"], "Bpm"
  end
end
