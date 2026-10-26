require "tmpdir"
class YoutubeImportJob < ApplicationJob
  queue_as :default
  def perform(id)
    record=AudioImport.find(id)
    return unless AudioImport::ACTIVE.include?(record.state)
    Dir.mktmpdir("studio-youtube-") do |directory|
      path,metadata=YoutubeDownloader.new(record,directory).download
      record.user.with_lock do
        return unless AudioImport::ACTIVE.include?(record.reload.state)
        size=File.size(path)
        raise "Account audio quota exceeded" if Separation.storage_bytes(record.user.projects)+size>Separation::USER_QUOTA
        project=record.user.projects.create!(name:metadata["title"].presence||"YouTube audio",bpm:120)
        track=project.tracks.new(origin:"original",instrument:"other",position:0,name:project.name.truncate(80),creator:record.user,import_metadata:metadata)
        blob=File.open(path,"rb") { |io| ActiveStorage::Blob.build_after_unfurling(io:,filename:"youtube-#{metadata["videoId"]}.mp3",content_type:"audio/mpeg") }
        begin
          blob.save!;File.open(path,"rb") { |io| blob.upload_without_unfurling(io) };track.audio.attach(blob);track.save!
          record.update!(state:"ready",progress:100,project_id:project.id,message:"Audio ready in Studio",metadata:)
        rescue
          blob.purge;raise
        end
      end
    end
  rescue ActiveRecord::RecordNotFound
    # Deleted account/task: nothing to publish.
  rescue => error
    AudioImport.where(id:,state:AudioImport::ACTIVE).update_all(state:"error",message:error.message.to_s.truncate(300),progress:nil,updated_at:Time.current)
  end
end
