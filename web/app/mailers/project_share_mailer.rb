class ProjectShareMailer < ApplicationMailer
  # Tells someone a project was shared with them; the link opens it in the rack.
  def shared
    share = params[:share]
    @project = share.project
    @owner = @project.user.display_name
    @url = rack_url(trailing_slash: true, project: @project.id)
    mail to: share.user.email, subject: "#{@owner} shared “#{@project.name}” with you"
  end
end
