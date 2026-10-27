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
        destination=record.destination
        project=if destination["projectId"].present?
          record.user.projects.find_by(id:destination["projectId"]) || raise("Destination project is no longer available")
        else
          record.user.projects.create!(name:(destination["name"].presence || metadata["title"].presence || "YouTube audio").truncate(120),bpm:120)
        end
        raise "Project audio quota exceeded" if Separation.storage_bytes(Project.where(id:project.id))+size>Separation::PROJECT_QUOTA
        track=project.tracks.new(origin:"original",instrument:"other",position:(project.tracks.maximum(:position) || -1)+1,name:(metadata["title"].presence || project.name).truncate(80),creator:record.user,import_metadata:metadata)
        blob=File.open(path,"rb") { |io| ActiveStorage::Blob.build_after_unfurling(io:,filename:"youtube-#{metadata["videoId"]}.mp3",content_type:"audio/mpeg") }
        begin
          blob.save!;File.open(path,"rb") { |io| blob.upload_without_unfurling(io) };track.audio.attach(blob);track.save!
          metadata=metadata.merge("sourceTrackId"=>track.id)
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
