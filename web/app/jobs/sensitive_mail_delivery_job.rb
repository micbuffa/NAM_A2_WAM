# Delivers mails whose parameters are secrets (sign-in token and code):
# identical to ActionMailer::MailDeliveryJob, but never logs its arguments.
class SensitiveMailDeliveryJob < ActionMailer::MailDeliveryJob
  self.log_arguments = false
end
