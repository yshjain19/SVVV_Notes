const dns = require('dns');

// Apply DNS fallback for development environment to prevent connection errors
if (process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['1.1.1.1', '8.8.8.8']);
  } catch (e) {
    console.warn('Could not set custom DNS servers for mail:', e.message);
  }
}

/**
 * Sends a welcome email to the newly registered user using urBackend Transactional Mail API.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} name - The recipient's name or username.
 * @returns {Promise<boolean>} - Returns true if email sent successfully, false otherwise.
 */
exports.sendWelcomeEmail = async (toEmail, name) => {
  const apiKey = process.env.URBACKEND_API_KEY;
  if (!apiKey) {
    console.warn('Warning: URBACKEND_API_KEY is not defined in .env. Skipping welcome email.');
    return false;
  }

  const subject = 'Welcome to SVVV_Notes! 🚀';
  const htmlContent = `
    <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">SVVV_Notes</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Study smarter, together</p>
      </div>
      <div style="color: #1e293b; line-height: 1.6; font-size: 16px;">
        <p>Hi <strong>${name}</strong>,</p>
        <p>Welcome to <strong>SVVV_Notes</strong>! We are thrilled to have you join our student-built notes sharing community for SVVV students.</p>
        <p>With SVVV_Notes, you can easily:</p>
        <ul style="padding-left: 20px; margin: 15px 0;">
          <li style="margin-bottom: 8px;">Browse and download course-specific syllabus, PYQs, and handwritten notes.</li>
          <li style="margin-bottom: 8px;">Upload your own study materials to help your classmates.</li>
          <li style="margin-bottom: 8px;">Upvote high-quality notes to make them easier for others to find.</li>
        </ul>
        <div style="text-align: center; margin: 35px 0;">
          <a href="https://svvv-notes.onrender.com/notes" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Get Started</a>
        </div>
        <p style="margin-top: 25px;">Happy studying,<br><span style="color: #4f46e5; font-weight: 600;">The SVVV_Notes Team</span></p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        This is an automated welcome email from SVVV_Notes. Please do not reply directly to this message.
      </p>
    </div>
  `;

  try {
    const response = await fetch('https://api.ub.bitbros.in/api/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        to: toEmail,
        subject: subject,
        html: htmlContent
      })
    });

    if (response.ok) {
      console.log(`Welcome email successfully sent to ${toEmail}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Failed to send welcome email via urBackend: ${response.status} ${response.statusText} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('Error occurred while sending welcome email:', error.message);
    return false;
  }
};
