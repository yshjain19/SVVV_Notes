/**
 * Mail configuration adapter.
 * Re-exports the unified urBackend email service from utils/emailService.js
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
  getUrBackendClient: emailService.getUrBackendClient,
};
