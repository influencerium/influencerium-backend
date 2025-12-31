/**
 * Email Service
 * Handles sending transactional emails (password reset, notifications)
 */

const nodemailer = require('nodemailer');
const config = require('../config');

// Create transporter
let transporter = null;

async function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const emailConfig = config.email;
  
  if (!emailConfig.enabled) {
    // Return a mock transporter for development
    return {
      sendMail: async (options) => {
        console.log('📧 [DEV] Email would be sent:');
        console.log('  To:', options.to);
        console.log('  Subject:', options.subject);
        console.log('  Preview URL:', nodemailer.getTestMessageUrl(options));
        return {
          messageId: 'dev-' + Date.now(),
          previewUrl: nodemailer.getTestMessageUrl(options)
        };
      }
    };
  }

  transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.auth.user,
      pass: emailConfig.auth.pass
    }
  });

  return transporter;
}

/**
 * Send password reset email
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.resetToken - Reset token
 * @param {string} options.resetUrl - Reset URL (optional)
 */
async function sendPasswordResetEmail(options) {
  const { to, name, resetToken, resetUrl } = options;
  
  const transporter = await getTransporter();
  
  // Build reset URL
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const url = resetUrl || `${baseUrl}/reset-password.html?token=${resetToken}`;
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 40px auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0; color: #000000; font-size: 24px; font-weight: 700;">Influencerium</h1>
      </div>
      
      <!-- Content -->
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; color: #000000; font-size: 20px; font-weight: 600;">
          Password Reset Request
        </h2>
        <p style="margin: 0 0 16px 0; color: #495057; font-size: 14px; line-height: 1.6;">
          Hi ${name},
        </p>
        <p style="margin: 0 0 24px 0; color: #495057; font-size: 14px; line-height: 1.6;">
          You requested a password reset for your Influencerium account. Click the button below to reset your password.
        </p>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${url}" style="display: inline-block; padding: 14px 28px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Reset Password
          </a>
        </div>
        
        <p style="margin: 0 0 16px 0; color: #495057; font-size: 14px; line-height: 1.6;">
          This link will expire in 1 hour for security purposes.
        </p>
        
        <p style="margin: 0; color: #6c757d; font-size: 12px; line-height: 1.6;">
          If you didn't request this password reset, please ignore this email or contact support if you have concerns.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="border-top: 1px solid #dee2e6; padding-top: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 12px;">
          © 2025 Influencerium. All rights reserved.
        </p>
        <p style="margin: 0; color: #6c757d; font-size: 12px;">
          <a href="#" style="color: #000000; text-decoration: none;">Privacy Policy</a> · 
          <a href="#" style="color: #000000; text-decoration: none;">Terms of Service</a> · 
          <a href="#" style="color: #000000; text-decoration: none;">Help Center</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Password Reset Request

Hi ${name},

You requested a password reset for your Influencerium account.

Click the link below to reset your password:
${url}

This link will expire in 1 hour for security purposes.

If you didn't request this password reset, please ignore this email.

© 2025 Influencerium. All rights reserved.
  `;

  try {
    const result = await transporter.sendMail({
      from: config.email.from,
      to: to,
      subject: 'Password Reset Request - Influencerium',
      text: textContent,
      html: htmlContent
    });

    console.log('✅ Password reset email sent to:', to);
    return {
      success: true,
      messageId: result.messageId,
      previewUrl: result.previewUrl
    };
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send welcome email to new user
 * @param {object} options - Email options
 */
async function sendWelcomeEmail(options) {
  const { to, name } = options;
  
  const transporter = await getTransporter();
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Influencerium</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 40px auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0; color: #000000; font-size: 24px; font-weight: 700;">Influencerium</h1>
      </div>
      
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; color: #000000; font-size: 20px; font-weight: 600;">
          Welcome to Influencerium, ${name}! 🎉
        </h2>
        <p style="margin: 0 0 16px 0; color: #495057; font-size: 14px; line-height: 1.6;">
          Thank you for joining Influencerium! We're excited to have you on board.
        </p>
        <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.6;">
          With Influencerium, you can:
        </p>
        <ul style="margin: 16px 0; padding-left: 20px; color: #495057; font-size: 14px; line-height: 1.8;">
          <li>Manage influencer data models</li>
          <li>Track campaigns and performance</li>
          <li>Analyze engagement metrics</li>
          <li>Connect with influencers</li>
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" style="display: inline-block; padding: 14px 28px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Get Started
        </a>
      </div>
      
      <div style="border-top: 1px solid #dee2e6; padding-top: 24px; margin-top: 32px; text-align: center;">
        <p style="margin: 0; color: #6c757d; font-size: 12px;">
          © 2025 Influencerium. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: config.email.from,
      to: to,
      subject: 'Welcome to Influencerium!',
      html: htmlContent
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  getTransporter
};
