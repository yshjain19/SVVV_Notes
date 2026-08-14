const { Resend } = require('resend');

/**
 * Get base URL for links in emails (defaults to production custom domain)
 */
function getBaseUrl() {
  const url = process.env.BASE_URL || process.env.SITE_URL || 'https://svvvnotes.bitbros.in';
  return url.replace(/\/+$/, '');
}

/**
 * Get verified sender email address
 */
function getSenderAddress() {
  const senderEmail = process.env.SENDER_EMAIL?.trim() || 'noreply@svvvnotes.bitbros.in';
  return `SVVV Notes <${senderEmail}>`;
}

/**
 * Core email sender using Resend API.
 * Safely handles errors without crashing the Express server.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML formatted email content
 * @param {string} [options.text] - Plain text fallback
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 'your_resend_api_key') {
    const warnMsg = '[Email Service] RESEND_API_KEY is missing or not configured in environment variables.';
    console.warn(warnMsg);
    return { success: false, error: warnMsg };
  }

  if (!to || typeof to !== 'string' || !to.includes('@')) {
    const errorMsg = `[Email Service] Invalid recipient email address provided: "${to}"`;
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    const resend = new Resend(apiKey);
    const from = getSenderAddress();

    const response = await resend.emails.send({
      from,
      to: to.trim().toLowerCase(),
      subject,
      html,
      text: text || undefined,
    });

    if (response.error) {
      console.error(`[Resend Error] Failed to send email to ${to}:`, response.error.message || response.error);
      return { success: false, error: response.error };
    }

    console.log(`[Resend Success] Email delivered to: ${to} (ID: ${response.data?.id})`);
    return { success: true, id: response.data?.id };
  } catch (err) {
    console.error(`[Resend Exception] Unexpected error sending email to ${to}:`, err.message || err);
    return { success: false, error: err.message || err };
  }
}

/**
 * Sends a 6-digit OTP verification email to the user.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit verification code
 * @param {string} [name='Student'] - Recipient name/username
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
async function sendOTPEmail(toEmail, otp, name) {
  // Support flexible argument order (email, otp, name) or (email, name, otp)
  let recipientName = 'Student';
  let otpCode = otp;

  if (typeof otp === 'string' && /^\d{4,8}$/.test(otp.trim())) {
    otpCode = otp.trim();
    if (name && typeof name === 'string' && !/^\d{4,8}$/.test(name.trim())) {
      recipientName = name.trim();
    }
  } else if (typeof name === 'string' && /^\d{4,8}$/.test(name.trim())) {
    otpCode = name.trim();
    if (otp && typeof otp === 'string') {
      recipientName = otp.trim();
    }
  }

  const subject = `Your SVVV Notes Verification Code: ${otpCode}`;
  const siteUrl = getBaseUrl();
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Verify Your Email - SVVV Notes</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 580px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      padding: 36px 30px;
      text-align: center;
      color: #ffffff;
    }
    .header-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .body-content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 17px;
      margin-bottom: 16px;
      color: #1e293b;
    }
    .instruction {
      font-size: 14px;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-card {
      background: #f8fafc;
      border: 2px dashed #6366f1;
      border-radius: 12px;
      padding: 24px 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-label {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 1px;
      color: #6366f1;
      margin-bottom: 8px;
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #4f46e5;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      margin: 8px 0;
    }
    .otp-expiry {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      margin-top: 8px;
    }
    .security-callout {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      padding: 14px 16px;
      margin: 24px 0 0 0;
      font-size: 13px;
      color: #991b1b;
    }
    .security-callout strong {
      display: block;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
    }
    .footer-links {
      margin-top: 8px;
    }
    .footer-links a {
      color: #4f46e5;
      text-decoration: none;
      margin: 0 8px;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    @media (max-width: 600px) {
      .wrapper { margin: 10px; border-radius: 12px; }
      .body-content { padding: 24px 20px; }
      .otp-code { font-size: 30px; letter-spacing: 6px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-badge">SVVV Notes Security</div>
      <h1>Email Verification</h1>
      <p>Study Smarter, Together 📚</p>
    </div>

    <div class="body-content">
      <div class="greeting">Hello <strong>${recipientName}</strong>,</div>
      <p class="instruction">
        Thank you for joining <strong>SVVV Notes</strong>! Please use the 6-digit verification code below to confirm your email address and activate your student account:
      </p>

      <div class="otp-card">
        <div class="otp-label">Verification Code</div>
        <div class="otp-code">${otpCode}</div>
        <div class="otp-expiry">⏱️ This code will expire in <strong>10 minutes</strong></div>
      </div>

      <div class="security-callout">
        <strong>🔒 Security Notice</strong>
        Never share this code with anyone. SVVV Notes staff will never ask for your verification code or password.
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">This is an automated message from SVVV Notes. Please do not reply.</p>
      <div class="footer-links">
        <a href="${siteUrl}/notes">Explore Notes</a>
        <span>•</span>
        <a href="${siteUrl}/about">About</a>
        <span>•</span>
        <a href="${siteUrl}/contact">Support</a>
      </div>
      <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px;">
        © ${year} SVVV Notes. Built for SVVV CSE Students.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${recipientName},\n\nYour 6-digit SVVV Notes verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nNever share this code with anyone.\n\nSVVV Notes Team\n${siteUrl}`;

  return await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

/**
 * Sends a password reset email with secure URL token.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} resetUrlOrToken - Password reset URL or raw token
 * @param {string} [name='Student'] - Recipient name/username
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
async function sendPasswordResetEmail(toEmail, resetUrlOrToken, name) {
  let recipientName = 'Student';
  if (name && typeof name === 'string') {
    recipientName = name.trim();
  }

  const siteUrl = getBaseUrl();
  let resetUrl = resetUrlOrToken;

  // If a raw token was provided instead of a full URL, build the production URL
  if (!resetUrl.startsWith('http://') && !resetUrl.startsWith('https://')) {
    resetUrl = `${siteUrl}/reset-password/${resetUrlOrToken}`;
  }

  const subject = 'Reset Your Password - SVVV Notes';
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Reset Your Password - SVVV Notes</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 580px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      padding: 36px 30px;
      text-align: center;
      color: #ffffff;
    }
    .header-icon {
      font-size: 40px;
      margin-bottom: 8px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .body-content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 17px;
      margin-bottom: 16px;
      color: #1e293b;
    }
    .instruction {
      font-size: 14px;
      color: #475569;
      margin-bottom: 28px;
    }
    .cta-container {
      text-align: center;
      margin: 30px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 15px 38px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    }
    .fallback-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin: 28px 0;
      font-size: 12px;
    }
    .fallback-label {
      font-weight: 600;
      color: #64748b;
      margin-bottom: 6px;
    }
    .fallback-url {
      color: #4f46e5;
      word-break: break-all;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .expiry-note {
      background-color: #f1f5f9;
      border-radius: 8px;
      padding: 12px 16px;
      text-align: center;
      font-size: 12px;
      color: #475569;
      margin: 20px 0;
    }
    .security-callout {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      padding: 14px 16px;
      margin: 24px 0 0 0;
      font-size: 13px;
      color: #991b1b;
    }
    .security-callout strong {
      display: block;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
    }
    .footer-links {
      margin-top: 8px;
    }
    .footer-links a {
      color: #4f46e5;
      text-decoration: none;
      margin: 0 8px;
    }
    @media (max-width: 600px) {
      .wrapper { margin: 10px; border-radius: 12px; }
      .body-content { padding: 24px 20px; }
      .cta-button { width: 100%; box-sizing: border-box; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-icon">🔐</div>
      <h1>Password Reset Request</h1>
      <p>SVVV Notes Account Security</p>
    </div>

    <div class="body-content">
      <div class="greeting">Hello <strong>${recipientName}</strong>,</div>
      <p class="instruction">
        We received a request to reset your password for your <strong>SVVV Notes</strong> account. Click the button below to choose a new password:
      </p>

      <div class="cta-container">
        <a href="${resetUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
          Reset Password
        </a>
      </div>

      <div class="expiry-note">
        ⏱️ <strong>This reset link will expire in 60 minutes.</strong>
      </div>

      <div class="fallback-box">
        <div class="fallback-label">Having trouble with the button? Copy and paste this URL into your browser:</div>
        <div class="fallback-url">${resetUrl}</div>
      </div>

      <div class="security-callout">
        <strong>🛡️ Account Protection</strong>
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">This is an automated message from SVVV Notes. Please do not reply.</p>
      <div class="footer-links">
        <a href="${siteUrl}/about">About</a>
        <span>•</span>
        <a href="${siteUrl}/contact">Contact Us</a>
        <span>•</span>
        <a href="${siteUrl}/notes">Browse Notes</a>
      </div>
      <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px;">
        © ${year} SVVV Notes. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${recipientName},\n\nWe received a request to reset the password for your SVVV Notes account.\n\nPlease visit the following link to create a new password:\n${resetUrl}\n\nThis link will expire in 60 minutes.\n\nIf you did not make this request, you can safely ignore this email.\n\nSVVV Notes Team\n${siteUrl}`;

  return await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

/**
 * Sends a welcome email after successful email verification.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} [name='Student'] - Recipient name/username
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
async function sendWelcomeEmail(toEmail, name) {
  const recipientName = (name && typeof name === 'string') ? name.trim() : 'Student';
  const siteUrl = getBaseUrl();
  const year = new Date().getFullYear();
  const subject = 'Welcome to SVVV Notes! 🚀';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SVVV Notes</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
    .wrapper { max-width: 580px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 36px 30px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
    .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; }
    .body-content { padding: 36px 32px; }
    .features { margin: 24px 0; }
    .feature-item { margin-bottom: 16px; padding-left: 8px; }
    .feature-title { font-weight: 700; color: #1e293b; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta-button { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 34px; border-radius: 10px; font-weight: 700; font-size: 15px; }
    .footer { background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>SVVV Notes</h1>
      <p>Study Smarter, Together 📚</p>
    </div>
    <div class="body-content">
      <p style="font-size: 17px;">Hey <strong>${recipientName}</strong>! 👋</p>
      <p style="color: #475569; font-size: 14px;">Welcome to <strong>SVVV Notes</strong>! Your email has been verified and your account is ready.</p>
      
      <div class="features">
        <div class="feature-item">
          <div class="feature-title">📖 Study Materials & Syllabus</div>
          <div style="font-size: 13px; color: #64748b;">Access course-specific handwritten notes, syllabi, and previous year papers.</div>
        </div>
        <div class="feature-item">
          <div class="feature-title">📤 Share Your Knowledge</div>
          <div style="font-size: 13px; color: #64748b;">Upload notes and PDFs to help your fellow students excel.</div>
        </div>
      </div>

      <div class="cta-container">
        <a href="${siteUrl}/notes" class="cta-button">Start Exploring Notes</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">© ${year} SVVV Notes - Student Built, Student Focused</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hi ${recipientName}!\n\nWelcome to SVVV Notes! Your email is verified.\n\nExplore notes: ${siteUrl}/notes\n\nSVVV Notes Team`;

  return await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  getBaseUrl,
  getSenderAddress,
};
