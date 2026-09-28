# Delivers mails whose parameters are secrets (the sign-in token):
# identical to ActionMailer::MailDeliveryJob, but never logs its arguments.
class SensitiveMailDeliveryJob < ActionMailer::MailDeliveryJob
  self.log_arguments = false
end
