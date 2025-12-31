/**
 * Password Reset Service
 * Handles password reset token generation and validation
 */

const { query } = require('../database');
const crypto = require('crypto');
const config = require('../config');

/**
 * Generate a secure reset token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash the reset token for secure storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a password reset request
 * @param {string} email - User's email address
 * @returns {object} - Reset info including the raw token
 */
async function createResetRequest(email) {
  // Check if user exists
  const userResult = await query(
    'SELECT id, name FROM users WHERE email = $1 AND status = $1',
    [email.toLowerCase()]
  );

  // Always return success to prevent email enumeration
  if (userResult.rows.length === 0) {
    return {
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.',
      userFound: false
    };
  }

  const user = userResult.rows[0];
  const expiresIn = config.password.reset_expires_in || 3600; // 1 hour default
  
  // Generate tokens
  const rawToken = generateResetToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Delete any existing reset tokens for this user
  await query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1',
    [user.id]
  );

  // Store the hashed token
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [user.id, hashedToken, expiresAt]
  );

  return {
    success: true,
    message: 'Password reset link sent',
    userFound: true,
    userId: user.id,
    userName: user.name,
    // In development, return the token for testing
    // In production, this would be sent via email
    resetToken: rawToken,
    expiresIn: expiresIn,
    expiresAt: expiresAt
  };
}

/**
 * Verify a reset token
 * @param {string} token - Raw reset token
 * @returns {object} - Verification result
 */
async function verifyResetToken(token) {
  const hashedToken = hashToken(token);

  const result = await query(
    `SELECT prt.*, u.id as user_id, u.email, u.name, u.status
     FROM password_reset_tokens prt
     JOIN users u ON prt.user_id = u.id
     WHERE prt.token_hash = $1 AND prt.used = false`,
    [hashedToken]
  );

  if (result.rows.length === 0) {
    return {
      valid: false,
      error: 'Invalid or expired reset token'
    };
  }

  const record = result.rows[0];

  // Check if token has expired
  if (new Date(record.expires_at) < new Date()) {
    return {
      valid: false,
      error: 'Reset token has expired'
    };
  }

  // Check if user is active
  if (record.status !== 'active') {
    return {
      valid: false,
      error: 'User account is not active'
    };
  }

  return {
    valid: true,
    userId: record.user_id,
    email: record.email,
    name: record.name
  };
}

/**
 * Reset password with token
 * @param {string} token - Raw reset token
 * @param {string} newPassword - New password
 * @returns {object} - Reset result
 */
async function resetPassword(token, newPassword) {
  // Verify token first
  const verification = await verifyResetToken(token);
  
  if (!verification.valid) {
    return {
      success: false,
      error: verification.error
    };
  }

  const bcrypt = require('bcryptjs');
  const saltRounds = config.password.salt_rounds || 12;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update user password
  await query(
    'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, verification.userId]
  );

  // Mark token as used
  const hashedToken = hashToken(token);
  await query(
    'UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE token_hash = $1',
    [hashedToken]
  );

  return {
    success: true,
    message: 'Password reset successfully'
  };
}

/**
 * Clean up expired reset tokens
 */
async function cleanupExpiredTokens() {
  const result = await query(
    'DELETE FROM password_reset_tokens WHERE expires_at < NOW()',
    []
  );
  
  return result.rowCount;
}

module.exports = {
  createResetRequest,
  verifyResetToken,
  resetPassword,
  cleanupExpiredTokens,
  generateResetToken,
  hashToken
};
