const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Get sender email from environment
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

/**
 * Sends a welcome email to the newly registered user using Resend API.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} name - The recipient's name or username.
 * @returns {Promise<boolean>} - Returns true if email sent successfully, false otherwise.
 */
exports.sendWelcomeEmail = async (toEmail, name) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('Warning: RESEND_API_KEY is not defined in .env. Skipping welcome email.');
    return false;
  }

  const subject = 'Welcome to SVVV_Notes! 🚀';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .email-wrapper { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; }
        .header p { margin: 8px 0 0 0; font-size: 14px; font-weight: 500; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; margin-bottom: 20px; }
        .greeting strong { color: #4f46e5; }
        .features { margin: 30px 0; }
        .feature-item { display: flex; margin-bottom: 16px; align-items: flex-start; }
        .feature-icon { font-size: 24px; margin-right: 12px; flex-shrink: 0; }
        .feature-text { flex: 1; }
        .feature-text strong { display: block; color: #1e293b; margin-bottom: 4px; }
        .feature-text span { color: #64748b; font-size: 14px; }
        .cta-section { text-align: center; margin: 40px 0; }
        .cta-button { display: inline-block; background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: all 0.3s ease; }
        .cta-button:hover { background-color: #4338ca; box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4); }
        .divider { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
        .footer { background-color: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; }
        .footer strong { color: #4f46e5; }
        @media (max-width: 600px) {
          .container { padding: 10px; }
          .content { padding: 25px 20px; }
          .header { padding: 30px 20px; }
          .header h1 { font-size: 24px; }
          .cta-button { padding: 12px 24px; font-size: 14px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="email-wrapper">
          <div class="header">
            <h1>SVVV_Notes</h1>
            <p>Study Smarter, Together 📚</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hey <strong>${name}</strong>! 👋
            </div>
            
            <p>Welcome to <strong>SVVV_Notes</strong>! We're thrilled to have you join our vibrant community of SVVV students dedicated to collaborative learning.</p>
            
            <div class="features">
              <div class="feature-item">
                <div class="feature-icon">📖</div>
                <div class="feature-text">
                  <strong>Browse Premium Study Materials</strong>
                  <span>Access course-specific syllabi, previous year questions, handwritten notes, and more from your peers.</span>
                </div>
              </div>
              
              <div class="feature-item">
                <div class="feature-icon">📤</div>
                <div class="feature-text">
                  <strong>Share Your Knowledge</strong>
                  <span>Upload your study materials to help classmates ace their exams and build your reputation.</span>
                </div>
              </div>
              
              <div class="feature-item">
                <div class="feature-icon">⭐</div>
                <div class="feature-text">
                  <strong>Rate & Discover Quality Content</strong>
                  <span>Upvote the best notes to help others find the most helpful resources quickly.</span>
                </div>
              </div>
            </div>

            <div class="cta-section">
              <a href="https://svvv-notes.onrender.com/notes" class="cta-button">Start Exploring Now</a>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
              Have questions? Need help? Our community is here to support you every step of the way!
            </p>

            <p style="margin-top: 20px;">
              Happy studying!<br>
              <strong style="color: #4f46e5;">The SVVV_Notes Team</strong>
            </p>
          </div>

          <div class="footer">
            <p style="margin: 0;">
              © 2024 SVVV_Notes - Student Built, Student Focused<br>
              <span>This is an automated message. Please don't reply directly to this email.</span>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const plainTextContent = `
Welcome to SVVV_Notes!

Hi ${name},

We're thrilled to have you join our community of SVVV students dedicated to collaborative learning.

With SVVV_Notes, you can:
- Browse course-specific syllabi, PYQs, handwritten notes, and more
- Upload your own study materials to help classmates
- Rate and upvote quality content to help others find the best resources

Get Started: https://svvv-notes.onrender.com/notes

Happy studying!
The SVVV_Notes Team

---
This is an automated welcome email from SVVV_Notes. Please do not reply directly to this message.
  `;

  try {
    const response = await resend.emails.send({
      from: `SVVV_Notes <${SENDER_EMAIL}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
      text: plainTextContent,
    });

    if (response.error) {
      console.error('Resend API error:', response.error);
      return false;
    }

    console.log('Welcome email sent successfully to:', toEmail);
    return true;
  } catch (error) {
    console.error('Error sending welcome email via Resend:', error.message);
    return false;
  }
};

/**
 * Sends OTP verification email to user
 * @param {string} toEmail - The recipient's email address.
 * @param {string} name - The recipient's name or username.
 * @param {string} otp - The 6-digit OTP code.
 * @returns {Promise<boolean>}
 */
exports.sendOTPEmail = async (toEmail, name, otp) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Warning: RESEND_API_KEY is not defined in .env. Skipping OTP email.');
    return false;
  }

  const subject = 'Verify Your Email - OTP Code';
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .email-wrapper { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
        .content { padding: 40px 30px; }
        .otp-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; font-family: 'Courier New', monospace; }
        .otp-hint { color: #64748b; font-size: 14px; margin-top: 15px; }
        .footer { background-color: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; }
        @media (max-width: 600px) {
          .otp-code { font-size: 28px; letter-spacing: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="email-wrapper">
          <div class="header">
            <h1>Email Verification</h1>
          </div>
          
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for signing up! Please verify your email address using the OTP code below:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="otp-hint">This code expires in 10 minutes</div>
            </div>

            <p style="color: #64748b; font-size: 14px;">
              If you didn't request this code, please ignore this email. This code is confidential and should not be shared with anyone.
            </p>
          </div>

          <div class="footer">
            <p style="margin: 0;">
              © 2024 SVVV_Notes<br>
              <span>This is an automated message. Please do not reply.</span>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await resend.emails.send({
      from: `SVVV_Notes <${SENDER_EMAIL}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
    });

    if (response.error) {
      console.error('Resend OTP email error:', response.error);
      return false;
    }

    console.log('OTP email sent successfully to:', toEmail);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error.message);
    return false;
  }
};

/**
 * Sends password reset email to user
 * @param {string} toEmail - The recipient's email address.
 * @param {string} name - The recipient's name or username.
 * @param {string} resetToken - The password reset token.
 * @returns {Promise<boolean>}
 */
exports.sendPasswordResetEmail = async (toEmail, name, resetToken) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Warning: RESEND_API_KEY is not defined in .env. Skipping password reset email.');
    return false;
  }

  const resetUrl = `https://svvv-notes.onrender.com/reset-password/${resetToken}`;
  const subject = 'Password Reset - SVVV_Notes';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .email-wrapper { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
        .content { padding: 40px 30px; }
        .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .warning p { margin: 0; color: #991b1b; font-size: 14px; }
        .cta-button { display: inline-block; background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 30px 0; }
        .cta-button:hover { background-color: #4338ca; }
        .footer { background-color: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; }
        .reset-link { word-break: break-all; color: #4f46e5; font-family: monospace; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="email-wrapper">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="cta-button">Reset Password</a>
            </div>

            <p style="color: #64748b; font-size: 14px;">Or paste this link in your browser:</p>
            <p class="reset-link">${resetUrl}</p>

            <div class="warning">
              <p><strong>⚠️ Important:</strong> This link expires in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
            </div>

            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              For security reasons, never share this link with anyone.
            </p>
          </div>

          <div class="footer">
            <p style="margin: 0;">
              © 2024 SVVV_Notes<br>
              <span>This is an automated message. Please do not reply.</span>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await resend.emails.send({
      from: `SVVV_Notes <${SENDER_EMAIL}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
    });

    if (response.error) {
      console.error('Resend password reset email error:', response.error);
      return false;
    }

    console.log('Password reset email sent successfully to:', toEmail);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
    return false;
  }
};
