class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAIL_FROM", "Fretwork <no-reply@localhost>")
  layout "mailer"
end
