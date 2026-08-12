const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

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
      from: 'SVVV_Notes <onboarding@resend.dev>',
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
