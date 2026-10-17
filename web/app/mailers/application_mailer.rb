class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAIL_FROM", "NAM A2 WAM <no-reply@localhost>")
  layout "mailer"
end
