/**
 * Mail configuration adapter.
 * Re-exports the unified Resend email service from utils/emailService.js
 */
const emailService = require('../utils/emailService');

module.exports = {
  sendMail: emailService.sendEmail,
  sendEmail: emailService.sendEmail,
  sendOTPEmail: emailService.sendOTPEmail,
  sendPasswordResetEmail: emailService.sendPasswordResetEmail,
  sendWelcomeEmail: emailService.sendWelcomeEmail,
  getBaseUrl: emailService.getBaseUrl,
  getSenderAddress: emailService.getSenderAddress,
};
