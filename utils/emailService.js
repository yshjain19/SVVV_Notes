const urBackend = require('@urbackend/sdk').default || require('@urbackend/sdk');

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
  const senderEmail = process.env.SENDER_EMAIL?.trim() || 'connect@svvvnotes.bitbros.in';
  return `SVVV Notes <${senderEmail}>`;
}

/**
 * Get urBackend client instance with Secret Key (sk_live_...)
 * @returns {object|null}
 */
function getUrBackendClient() {
  const apiKey = (
    process.env.URBACKEND_SECRET_KEY ||
    process.env.URBACKEND_API_KEY ||
    process.env.URBACKEND_KEY ||
    ''
  ).trim();

  if (!apiKey || apiKey.startsWith('your_') || apiKey === 'YOUR_API_KEY') {
    return null;
  }

  const baseUrl = process.env.URBACKEND_BASE_URL?.trim();

  return urBackend({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

/**
 * Core transactional email sender using urBackend SDK Mail module.
 *
 * Supports two payload modes:
 * 1. Direct Mode: { to, subject, html, text }
 * 2. Template Mode: { to, templateName | templateId, variables }
 *
 * Safely handles errors without crashing the Express server.
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} [options.subject] - Email subject line (required in direct mode)
 * @param {string} [options.html] - HTML body content
 * @param {string} [options.text] - Plain text fallback content
 * @param {string} [options.templateName] - Template key or name
 * @param {string} [options.templateId] - Template ObjectId (24 hex characters)
 * @param {Record<string, unknown>} [options.variables] - Variables for template rendering ({{placeholder}} syntax)
 * @returns {Promise<{success: boolean, id?: string|null, provider?: string, monthlyUsage?: number, monthlyLimit?: number, error?: any}>}
 */
async function sendEmail(options) {
  const { to, subject, html, text, templateName, templateId, variables } = options || {};

  const apiKey = (
    process.env.URBACKEND_SECRET_KEY ||
    process.env.URBACKEND_API_KEY ||
    process.env.URBACKEND_KEY ||
    ''
  ).trim();

  if (!apiKey || apiKey.startsWith('your_') || apiKey === 'YOUR_API_KEY') {
    const warnMsg =
      '[urBackend Mail] Secret Key is missing or not configured. Set URBACKEND_SECRET_KEY (or URBACKEND_API_KEY) in .env (https://urbackend.bitbros.in/dashboard).';
    console.warn(warnMsg);
    return { success: false, error: warnMsg };
  }

  if (!to || (typeof to !== 'string' && !Array.isArray(to)) || (typeof to === 'string' && !to.includes('@'))) {
    const errorMsg = `[urBackend Mail] Invalid recipient email address provided: "${to}"`;
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    const client = getUrBackendClient();
    if (!client || !client.mail) {
      const initErr = '[urBackend Mail] Failed to initialize urBackend SDK client.';
      console.error(initErr);
      return { success: false, error: initErr };
    }

    const payload = {
      to: typeof to === 'string' ? to.trim().toLowerCase() : to,
      from: getSenderAddress(),
    };

    // Determine whether to send in Template Mode or Direct Mode
    if (templateName) {
      payload.templateName = templateName;
      if (variables && typeof variables === 'object') {
        payload.variables = variables;
      }
    } else if (templateId) {
      payload.templateId = templateId;
      if (variables && typeof variables === 'object') {
        payload.variables = variables;
      }
    } else {
      payload.subject = subject || 'SVVV Notes Notification';
      if (html) payload.html = html;
      if (text) payload.text = text;
      // Fallback if neither html nor text provided
      if (!html && !text) {
        payload.text = subject || 'SVVV Notes Notification';
      }
    }

    const response = await client.mail.send(payload);

    const messageId = response?.id || null;
    const provider = response?.provider || 'default';
    console.log(
      `[urBackend Mail Success] Email delivered to: ${Array.isArray(to) ? to.join(', ') : to} (ID: ${messageId || 'N/A'}, Provider: ${provider})`
    );

    return {
      success: true,
      id: messageId,
      provider: response?.provider,
      monthlyUsage: response?.monthlyUsage,
      monthlyLimit: response?.monthlyLimit,
    };
  } catch (err) {
    const errMsg = err?.message || err;
    console.error(
      `[urBackend Mail Error] Failed to send email to ${Array.isArray(to) ? to.join(', ') : to}:`,
      errMsg
    );
    return { success: false, error: errMsg };
  }
}

/**
 * Sends a 6-digit OTP verification email to the user via urBackend.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit verification code
 * @param {string} [name='Student'] - Recipient name/username
 * @returns {Promise<{success: boolean, id?: string|null, error?: any}>}
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

  const siteUrl = getBaseUrl();
  const year = new Date().getFullYear();

  // If a custom urBackend template name is configured in environment, use Template Mode
  const templateName = process.env.URBACKEND_OTP_TEMPLATE;
  if (templateName) {
    return await sendEmail({
      to: toEmail,
      templateName,
      variables: {
        name: recipientName,
        otp: otpCode,
        appUrl: siteUrl,
        year: String(year),
      },
    });
  }

  const subject = `Your SVVV Notes Verification Code: ${otpCode}`;

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
 * Sends a password reset email with secure URL token via urBackend.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} resetUrlOrToken - Password reset URL or raw token
 * @param {string} [name='Student'] - Recipient name/username
 * @returns {Promise<{success: boolean, id?: string|null, error?: any}>}
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

  const year = new Date().getFullYear();

  // If a custom urBackend template is configured, use Template Mode
  const templateName = process.env.URBACKEND_RESET_PASSWORD_TEMPLATE;
  if (templateName) {
    return await sendEmail({
      to: toEmail,
      templateName,
      variables: {
        name: recipientName,
        resetUrl,
        appUrl: siteUrl,
        year: String(year),
      },
    });
  }

  const subject = 'Reset Your Password - SVVV Notes';

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
 * Sends a welcome email after successful email verification via urBackend.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} [name='Student'] - Recipient name/username
 * @returns {Promise<{success: boolean, id?: string|null, error?: any}>}
 */
async function sendWelcomeEmail(toEmail, name) {
  const recipientName = name && typeof name === 'string' ? name.trim() : 'Student';
  const siteUrl = getBaseUrl();
  const year = new Date().getFullYear();

  // If a custom urBackend welcome template or default welcome is configured
  const templateName = process.env.URBACKEND_WELCOME_TEMPLATE;
  if (templateName) {
    return await sendEmail({
      to: toEmail,
      templateName,
      variables: {
        name: recipientName,
        projectName: 'SVVV Notes',
        appUrl: siteUrl,
        year: String(year),
      },
    });
  }

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

/**
 * Sends an email notification to a student informing them about a note request.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} [recipientName='Student'] - Recipient username or full name
 * @param {object} noteRequest - The note request object (title, subject, course, semester, description, _id)
 * @param {object} requester - The user who requested the note (username, fullName)
 * @returns {Promise<{success: boolean, id?: string|null, error?: any}>}
 */
async function sendNoteRequestBroadcastEmail(toEmail, recipientName, noteRequest, requester) {
  const name = recipientName && typeof recipientName === "string" ? recipientName.trim() : "Student";
  const requesterName = requester?.fullName || requester?.username || "A classmate";
  const siteUrl = getBaseUrl();
  const year = new Date().getFullYear();

  const requestUrl = `${siteUrl}/requests/${noteRequest._id}`;
  const uploadUrl = `${siteUrl}/notes/new?subject=${encodeURIComponent(noteRequest.subject || "")}&course=${encodeURIComponent(noteRequest.course || "")}&semester=${encodeURIComponent(noteRequest.semester || "")}&requestId=${noteRequest._id}`;

  const subject = `📚 Note Request: ${noteRequest.subject} (${noteRequest.course} Sem ${noteRequest.semester})`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>New Note Request - SVVV Notes</title>
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
      max-width: 600px;
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
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .body-content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 14px;
      color: #1e293b;
    }
    .request-box {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-left: 5px solid #4f46e5;
      border-radius: 12px;
      padding: 20px 22px;
      margin: 22px 0;
    }
    .request-field {
      margin-bottom: 12px;
      font-size: 14px;
    }
    .request-field:last-child {
      margin-bottom: 0;
    }
    .field-label {
      font-weight: 700;
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 3px;
    }
    .field-val {
      color: #0f172a;
      font-size: 15px;
      font-weight: 600;
    }
    .field-desc {
      color: #475569;
      font-size: 14px;
      line-height: 1.5;
      background: #ffffff;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #edf2f7;
      margin-top: 4px;
    }
    .cta-container {
      text-align: center;
      margin: 30px 0 15px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 34px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    }
    .secondary-link {
      display: inline-block;
      color: #4f46e5;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
      margin-top: 6px;
    }
    .secondary-link:hover {
      text-decoration: underline;
    }
    .help-banner {
      background: #eff6ff;
      border-radius: 10px;
      padding: 14px 16px;
      margin-top: 24px;
      font-size: 13px;
      color: #1e40af;
      border: 1px solid #bfdbfe;
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
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-badge">📢 Community Note Request</div>
      <h1>A Classmate Needs Notes!</h1>
      <p>SVVV Notes Peer Sharing</p>
    </div>

    <div class="body-content">
      <div class="greeting">Hello <strong>${name}</strong>,</div>
      <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0;">
        <strong>${requesterName}</strong> posted a request for study material on SVVV Notes. If you have lecture notes, handwritten summaries, or question papers for this subject, you can help out your fellow classmate by uploading them:
      </p>

      <div class="request-box">
        <div class="request-field">
          <span class="field-label">Subject</span>
          <div class="field-val">📚 ${noteRequest.subject}</div>
        </div>
        <div class="request-field">
          <span class="field-label">Course & Semester</span>
          <div class="field-val">🎓 ${noteRequest.course} — Semester ${noteRequest.semester}</div>
        </div>
        <div class="request-field">
          <span class="field-label">Topic / Note Title</span>
          <div class="field-val" style="color: #4f46e5;">📝 ${noteRequest.title}</div>
        </div>
        ${
          noteRequest.description
            ? `<div class="request-field">
                <span class="field-label">Additional Details</span>
                <div class="field-desc">${noteRequest.description}</div>
              </div>`
            : ''
        }
      </div>

      <div class="cta-container">
        <a href="${uploadUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
          📤 Upload Notes to Help
        </a>
        <a href="${requestUrl}" class="secondary-link" target="_blank" rel="noopener noreferrer">
          View this request on the board →
        </a>
      </div>

      <div class="help-banner">
        💡 <strong>Did you know?</strong> Every note you share earns upvotes, helps peers prepare for exams, and highlights your contributions on your SVVV Notes public student profile!
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">You received this notification because you are a registered student on SVVV Notes.</p>
      <div class="footer-links">
        <a href="${siteUrl}/requests">Request Board</a>
        <span>•</span>
        <a href="${siteUrl}/notes">Browse Notes</a>
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

  const text = `Hello ${name},\n\n${requesterName} is requesting study notes on SVVV Notes:\n\nSubject: ${noteRequest.subject}\nCourse: ${noteRequest.course} (Sem ${noteRequest.semester})\nTopic: ${noteRequest.title}\n${noteRequest.description ? `Details: ${noteRequest.description}\n` : ""}\nIf you have these notes, upload them here:\n${uploadUrl}\n\nView request details: ${requestUrl}\n\nSVVV Notes Community\n${siteUrl}`;

  return await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

/**
 * Broadcasts a note request to all registered users asynchronously in background batches.
 * Safe non-blocking execution: does not throw errors or hold back HTTP response.
 *
 * @param {object} noteRequest - The saved note request document
 * @param {object} requester - The user creating the request
 * @returns {Promise<{totalRecipients: number, sentCount: number}>}
 */
async function broadcastNoteRequest(noteRequest, requester) {
  try {
    const User = require("../models/user");
    
    // Automatically find ALL registered users in the database (excluding the requester)
    const requesterId = requester?._id ? requester._id.toString() : null;
    const query = {
      email: { $exists: true, $ne: null, $ne: "" },
    };
    if (requesterId) {
      query._id = { $ne: requester._id };
    }

    const users = await User.find(query, "email username fullName").lean();
    if (!users || users.length === 0) {
      console.log("[Note Request Broadcast] No other registered users found in database to notify.");
      return { totalRecipients: 0, sentCount: 0 };
    }

    console.log(
      `[Note Request Broadcast] Automatically broadcasting note request "${noteRequest.title}" (${noteRequest.subject}) to ALL ${users.length} registered SVVV Notes users...`
    );

    // Process in batches of 5 to respect mail provider rate limits and ensure fast delivery
    const BATCH_SIZE = 5;
    let sentCount = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (user) => {
          if (!user.email || typeof user.email !== "string" || !user.email.includes("@")) return;
          const res = await sendNoteRequestBroadcastEmail(
            user.email.trim(),
            user.fullName || user.username || "Student",
            noteRequest,
            requester
          );
          if (res?.success) sentCount++;
        })
      );
    }

    console.log(
      `[Note Request Broadcast Complete] Successfully delivered note request notifications to ${sentCount}/${users.length} registered students.`
    );
    return { totalRecipients: users.length, sentCount };
  } catch (err) {
    console.error("[Note Request Broadcast Error] Failed to broadcast note request:", err.message || err);
    return { totalRecipients: 0, sentCount: 0, error: err.message };
  }
}

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNoteRequestBroadcastEmail,
  broadcastNoteRequest,
  getBaseUrl,
  getSenderAddress,
  getUrBackendClient,
};
