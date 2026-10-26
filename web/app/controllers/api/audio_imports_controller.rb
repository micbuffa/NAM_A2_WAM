class Api::AudioImportsController < Api::BaseController
  def capabilities
    render json: {available:YoutubeDownloader.available?,maxDuration:YoutubeDownloader::MAX_DURATION,maxBytes:YoutubeDownloader::MAX_BYTES}
  end
  def index
    # Recover jobs interrupted by a server restart; never poll forever.
    AudioImport.expire_stale!()
    render json: current_user.audio_imports.order(created_at: :desc).limit(10).map(&:snapshot)
  end
  def create
    return render json:{error:"YouTube service unavailable on this server"},status: :service_unavailable unless YoutubeDownloader.available?
    url=AudioImport.youtube_url(json_body["url"])
    AudioImport.expire_stale!
    record=current_user.with_lock do
      raise ArgumentError,"An import is already running" if current_user.audio_imports.where(state:AudioImport::ACTIVE).exists?
      raise ArgumentError,"Import queue is full; try later" if AudioImport.where(state:AudioImport::ACTIVE).count>=3
      current_user.audio_imports.create!(url:)
    end
    begin
      YoutubeImportJob.perform_later(record.id)
    rescue
      record.update!(state:"error",message:"Import queue unavailable; start again")
      return render json:{error:record.message},status: :service_unavailable
    end
    render json:record.snapshot,status: :accepted
  rescue ArgumentError => error
    render json:{error:error.message},status: :unprocessable_content
  end
  def show
    render json: current_user.audio_imports.find(params[:id]).snapshot
  end
  def destroy
    current_user.with_lock do
      record=current_user.audio_imports.find(params[:id])
      record.update!(state:"cancelled",message:"Import cancelled",progress:nil) if AudioImport::ACTIVE.include?(record.state)
      render json:record.snapshot
    end
  end
end
