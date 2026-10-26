class AudioImport < ApplicationRecord
  ACTIVE = %w[queued metadata downloading converting].freeze
  TERMINAL = %w[ready error cancelled].freeze
  belongs_to :user
  validates :state, inclusion: {in: ACTIVE + TERMINAL}
  def self.expire_stale!
    where(state:ACTIVE).where("updated_at < ?",20.minutes.ago).update_all(state:"error",message:"Import interrupted; start again",updated_at:Time.current)
  end
  def self.youtube_url(value)
    uri = URI.parse(value.to_s)
    raise ArgumentError, "Choose a YouTube HTTPS video URL" unless uri.scheme == "https" && uri.userinfo.nil? && uri.port == 443
    id = if uri.host == "youtu.be"
      uri.path.delete_prefix("/")
    elsif %w[youtube.com www.youtube.com m.youtube.com music.youtube.com].include?(uri.host)
      uri.path == "/watch" ? URI.decode_www_form(uri.query.to_s).to_h["v"] : uri.path.match(%r{\A/(?:shorts|embed)/([\w-]{11})/?\z})&.captures&.first
    end
    raise ArgumentError, "Choose a single YouTube video" unless id&.match?(/\A[\w-]{11}\z/)
    "https://www.youtube.com/watch?v=#{id}"
  rescue URI::InvalidURIError
    raise ArgumentError, "Invalid YouTube URL"
  end
  def snapshot
    {id:,state:,progress:,message:,metadata:,projectId:project_id}
  end
end
