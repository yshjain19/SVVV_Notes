const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Returns a valid sender email for Resend API.
 * Free email providers (@gmail.com, etc.) cannot be verified directly on Resend,
 * so we fall back to 'onboarding@resend.dev' with a reply-to header.
 */
function getSenderEmail() {
  const configured = process.env.SENDER_EMAIL?.trim();
  if (!configured || configured.endsWith('@gmail.com') || configured.endsWith('@yahoo.com') || configured.endsWith('@outlook.com') || configured.endsWith('@hotmail.com')) {
    return 'onboarding@resend.dev';
  }
  return configured;
}

function getSiteUrl() {
  return (process.env.SITE_URL || process.env.BASE_URL || 'https://svvv-notes.onrender.com').replace(/\/+$/, '');
}

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
  const siteUrl = getSiteUrl();
  
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

            <div class="cta-section" style="text-align: center; margin: 40px 0;">
              <a href="${siteUrl}/notes" class="cta-button" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                <span style="color: #ffffff !important; text-decoration: none;">Start Exploring Now</span>
              </a>
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
    const sender = getSenderEmail();
    const replyTo = process.env.SENDER_EMAIL?.trim() || undefined;

    const response = await resend.emails.send({
      from: `SVVV_Notes <${sender}>`,
      to: toEmail,
      reply_to: replyTo,
      subject: subject,
      html: htmlContent,
      text: plainTextContent,
    });

    if (response.error) {
      console.error('Resend API error sending welcome email:', response.error);
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
    const sender = getSenderEmail();
    const replyTo = process.env.SENDER_EMAIL?.trim() || undefined;

    const response = await resend.emails.send({
      from: `SVVV_Notes <${sender}>`,
      to: toEmail,
      reply_to: replyTo,
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

  const siteUrl = getSiteUrl();
  const resetUrl = `${siteUrl}/reset-password/${resetToken}`;
  const year = new Date().getFullYear();
  
  // Professional password reset email template
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; background-color: #f5f5f5; line-height: 1.6; color: #333;">
    <div style="background-color: #f5f5f5; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
            <!-- Header Section -->
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 40px 30px; text-align: center; border-bottom: none;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔐</div>
                <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.5px;">SVVV_Notes</h1>
                <p style="font-size: 12px; color: rgba(255, 255, 255, 0.85); margin: 6px 0 0 0; font-weight: 500;">Password Reset Request</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">
                <!-- Greeting -->
                <p style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">
                    Hello <span style="color: #4f46e5;">${name}</span>,
                </p>

                <!-- Main Message -->
                <p style="font-size: 14px; line-height: 1.8; color: #475569; margin: 0 0 20px 0;">
                    We received a request to reset your password. Click the button below to create a new, secure password for your account.
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                        Reset Password
                    </a>
                </div>

                <!-- Fallback Link Section -->
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #4f46e5;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px; display: block;">📋 Link Not Working?</span>
                    <p style="font-size: 12px; font-weight: 400; margin-bottom: 8px; color: #475569;">Copy and paste this URL into your browser:</p>
                    <p style="font-size: 13px; color: #4f46e5; word-break: break-all; font-family: 'Courier New', monospace; line-height: 1.6; margin: 0;">
                        ${resetUrl}
                    </p>
                </div>

                <!-- Expiry Time Info -->
                <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; font-size: 12px; color: #64748b;">
                    ⏱️ <strong>This link will expire in 60 minutes.</strong> After that, you'll need to request a new password reset.
                </div>

                <!-- Security Section -->
                <div style="background-color: #fef2f2; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 25px 0;">
                    <p style="font-weight: 600; color: #991b1b; font-size: 13px; margin: 0 0 6px 0;">🛡️ Your Account Security</p>
                    <p style="font-size: 13px; color: #7c2d12; margin: 0; line-height: 1.6;">
                        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged, and your account will remain secure.
                    </p>
                </div>

                <!-- Additional Security Info -->
                <p style="font-size: 12px; color: #64748b; margin-top: 20px; margin-bottom: 0;">
                    <strong>🔒 Security Reminder:</strong> We will never ask for your password via email. Never share this link with anyone else. SVVV_Notes staff will never ask you to click on suspicious links.
                </p>
            </div>

            <!-- Divider -->
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;">

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 12px; color: #64748b; margin: 0 0 10px 0; line-height: 1.6;">
                    This is an automated message from SVVV_Notes. Please do not reply to this email.
                </p>
                <div style="font-size: 11px; margin: 10px 0;">
                    <a href="${siteUrl}/about" style="color: #4f46e5; text-decoration: none;">About</a>
                    <span style="color: #cbd5e1;"> | </span>
                    <a href="${siteUrl}/contact" style="color: #4f46e5; text-decoration: none;">Contact Us</a>
                </div>
                <p style="font-size: 11px; color: #94a3b8; margin: 12px 0 0 0;">
                    © ${year} SVVV_Notes. All rights reserved.
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;

  const subject = 'Reset Your Password - SVVV_Notes';

  try {
    const sender = getSenderEmail();
    const replyTo = process.env.SENDER_EMAIL?.trim() || undefined;

    const response = await resend.emails.send({
      from: `SVVV_Notes <${sender}>`,
      to: toEmail,
      reply_to: replyTo,
      subject: subject,
      html: htmlContent,
    });

    if (response.error) {
      console.error('Resend password reset email error:', response.error);
      return false;
    }

    console.log('✅ Password reset email sent successfully to:', toEmail);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    return false;
  }
};
