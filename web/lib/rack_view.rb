# Builds the Rails rack page from examples/wam/index.html, so it cannot drift
# from the static one. Development and test render generate on every request;
# bin/rack-sync writes app/views/rack/show.html.erb (not committed) for a
# production image. Plain Ruby (no Rails) so the script stays fast.
module RackView
  WEB_ROOT = File.expand_path("..", __dir__)
  SOURCE = File.join(WEB_ROOT, "../examples/wam/index.html")
  TARGET = File.join(WEB_ROOT, "app/views/rack/show.html.erb")

  # What Rails adds to the static page, inserted right after <title>.
  HEAD_ADDITIONS = <<~ERB.lines.map { |line| "  #{line}" }.join
    <%# Generated from examples/wam/index.html by bin/rack-sync (lib/rack_view.rb); edit the source, not this file. %>
    <%= csrf_meta_tags %>
    <link rel="icon" href="./plugins/nam-wam/neuralwamp-logo.svg" type="image/svg+xml">
    <script type="application/json" id="currentUser"><%= json_escape(@current_user_payload.to_json).html_safe %></script>
  ERB

  def self.generate(source = File.read(SOURCE))
    head, title, rest = source.gsub("<%", "<%%").partition(%r{^.*</title>\n})
    raise "#{SOURCE}: no <title> line to anchor the Rails additions" if title.empty?
    head + title + HEAD_ADDITIONS + rest
  end

  # The view is not committed, so app/views/rack/ may not exist yet.
  def self.write
    Dir.mkdir(File.dirname(TARGET)) unless Dir.exist?(File.dirname(TARGET))
    File.write(TARGET, generate)
  end
end

RackView.write if $PROGRAM_NAME == __FILE__
