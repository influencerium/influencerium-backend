/**
 * Session Management Service
 * Handles user session tracking and management
 */

const { query, transaction } = require('../database');
const crypto = require('crypto');
const config = require('../config');

// Session status constants
const SESSION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

/**
 * Generate a secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Create a new session for a user
 */
async function createSession(userId, metadata = {}) {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + (config.session.cookie_max_age || 604800000)); // 7 days
  
  const result = await query(
    `INSERT INTO sessions (user_id, session_token, ip_address, user_agent, device_info, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id, session_token, ip_address, user_agent, device_info, status, created_at, expires_at`,
    [
      userId,
      sessionToken,
      metadata.ip || null,
      metadata.userAgent || null,
      metadata.deviceInfo || null,
      expiresAt
    ]
  );

  return result.rows[0];
}

/**
 * Validate a session token
 */
async function validateSession(token) {
  if (!token) return null;

  const result = await query(
    `SELECT s.*, u.id as user_id, u.name, u.email, u.role, u.status as user_status
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = $1 
       AND s.status = $1
       AND s.expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) return null;

  return result.rows[0];
}

/**
 * Get all sessions for a user
 */
async function getUserSessions(userId, options = {}) {
  const { status = 'active', page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE user_id = $1';
  const values = [userId];
  let paramIndex = 2;

  if (status !== 'all') {
    whereClause += ` AND status = $${paramIndex}`;
    values.push(status);
    paramIndex++;
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM sessions ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  // Get sessions
  const result = await query(
    `SELECT id, session_token, ip_address, user_agent, device_info, status, 
            created_at, last_active_at, expires_at
     FROM sessions ${whereClause}
     ORDER BY last_active_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  // Mask session tokens for security
  const sessions = result.rows.map(s => ({
    ...s,
    session_token: s.session_token.substring(0, 8) + '...' + s.session_token.substring(s.session_token.length - 8),
    sessionToken: undefined // Remove from response
  }));

  return {
    sessions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get session by ID
 */
async function getSessionById(sessionId, userId) {
  const result = await query(
    `SELECT id, session_token, ip_address, user_agent, device_info, status, 
            created_at, last_active_at, expires_at
     FROM sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  return result.rows[0] || null;
}

/**
 * Update session activity (called on each request)
 */
async function updateSessionActivity(sessionId) {
  await query(
    'UPDATE sessions SET last_active_at = NOW() WHERE id = $1',
    [sessionId]
  );
}

/**
 * Revoke a specific session
 */
async function revokeSession(sessionId, userId) {
  const result = await query(
    `UPDATE sessions SET status = $1, revoked_at = NOW() 
     WHERE id = $2 AND user_id = $3
     RETURNING id, status`,
    [SESSION_STATUS.REVOKED, sessionId, userId]
  );

  return result.rowCount > 0;
}

/**
 * Revoke all sessions for a user (except current)
 */
async function revokeAllSessions(userId, excludeSessionId = null) {
  let queryText = `UPDATE sessions SET status = $1, revoked_at = NOW() WHERE user_id = $2 AND status = $3`;
  const values = [SESSION_STATUS.REVOKED, userId, SESSION_STATUS.ACTIVE];
  
  if (excludeSessionId) {
    queryText += ' AND id != $4';
    values.push(excludeSessionId);
  }

  const result = await query(queryText, values);
  return result.rowCount;
}

/**
 * Revoke sessions by device/type
 */
async function revokeSessionsByType(userId, deviceType) {
  const result = await query(
    `UPDATE sessions SET status = $1, revoked_at = NOW() 
     WHERE user_id = $2 AND device_info = $3 AND status = $4`,
    [SESSION_STATUS.REVOKED, userId, deviceType, SESSION_STATUS.ACTIVE]
  );

  return result.rowCount;
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  const result = await query(
    `UPDATE sessions SET status = $1 WHERE status = $2 AND expires_at < NOW()`,
    [SESSION_STATUS.EXPIRED, SESSION_STATUS.ACTIVE]
  );

  return result.rowCount;
}

/**
 * Count active sessions for a user
 */
async function countActiveSessions(userId) {
  const result = await query(
    `SELECT COUNT(*) as count FROM sessions 
     WHERE user_id = $1 AND status = $2 AND expires_at > NOW()`,
    [userId, SESSION_STATUS.ACTIVE]
  );

  return parseInt(result.rows[0].count);
}

/**
 * Create session from JWT token (hybrid approach)
 */
async function createSessionFromJWT(user, metadata = {}) {
  // Check if we should create a session or just validate JWT
  const createSession = metadata.createSession !== false;
  
  if (createSession) {
    return await createSession(user.id, metadata);
  }
  
  return null;
}

/**
 * Get current session info for response headers
 */
function getSessionHeaders(session) {
  return {
    'X-Session-ID': session?.id || '',
    'X-Session-Expires': session?.expires_at || ''
  };
}

module.exports = {
  SESSION_STATUS,
  generateSessionToken,
  createSession,
  validateSession,
  getUserSessions,
  getSessionById,
  updateSessionActivity,
  revokeSession,
  revokeAllSessions,
  revokeSessionsByType,
  cleanupExpiredSessions,
  countActiveSessions,
  createSessionFromJWT,
  getSessionHeaders
};
