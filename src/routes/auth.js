/**
 * Authentication Routes
 * Endpoints: Register, Login, Logout, Password Reset
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, verifyPassword, hashPassword } = require('../database');
const { generateToken, generateRefreshToken, authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, AuthenticationError, NotFoundError, ConflictError } = require('../middleware/error');
const config = require('../config');
const Joi = require('joi');
const passwordResetService = require('../services/passwordReset');

// Validation Schemas
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email().required()
});

const passwordResetSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
});

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const { name, email, password } = value;

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    throw new ConflictError('Email already registered');
  }

  // Hash password (use SHA256 for mock mode consistency)
  const hashedPassword = await hashPassword(password);

  // Create user
  const result = await query(
    `INSERT INTO users (name, email, password, role, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, name, email, role, status, created_at`,
    [name, email.toLowerCase(), hashedPassword, 'user', 'active']
  );

  const user = result.rows[0];

  // Generate tokens
  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    }
  });
}));

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const { email, password } = value;

  // Find user
  const result = await query(
    'SELECT id, name, email, password, role, status FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new AuthenticationError('Invalid email or password');
  }

  const user = result.rows[0];

  // Check if user is active
  if (user.status !== 'active') {
    throw new AuthenticationError('Account is not active');
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate tokens
  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    }
  });
}));

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // In a production environment, you might want to:
  // 1. Add the token to a blacklist
  // 2. Store logout events for security auditing
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// @route   POST /api/v1/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { error, value } = passwordResetRequestSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const { email } = value;

  // Create reset request (returns token in dev mode)
  const resetResult = await passwordResetService.createResetRequest(email);

  // If user found and in production, send email
  if (resetResult.userFound && config.email.enabled) {
    const emailService = require('../services/email');
    await emailService.sendPasswordResetEmail({
      to: email,
      name: resetResult.userName,
      resetToken: resetResult.resetToken
    });
  }

  // Always return success to prevent email enumeration
  res.json({
    success: true,
    message: 'If an account exists with this email, a password reset link will be sent.'
  });
}));

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { error, value } = passwordResetSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const { token, password } = value;

  // Reset password using the service
  const resetResult = await passwordResetService.resetPassword(token, password);

  if (!resetResult.success) {
    throw new AuthenticationError(resetResult.error);
  }

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
}));

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AuthenticationError('Refresh token required');
  }

  // Verify refresh token
  const decoded = require('jsonwebtoken').verify(refreshToken, config.jwt.secret);
  
  // Get user from database
  const result = await query(
    'SELECT id, name, email, role, status FROM users WHERE id = $1 AND status = $1',
    [decoded.userId]
  );

  if (result.rows.length === 0) {
    throw new AuthenticationError('User not found');
  }

  const user = result.rows[0];

  // Generate new access token
  const newToken = generateToken(user);

  res.json({
    success: true,
    data: {
      token: newToken
    }
  });
}));

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, status, created_at, updated_at FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// @route   GET /api/v1/auth/sessions
// @desc    Get all sessions for current user
// @access  Private
router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
  const sessionService = require('../services/session');
  
  const { status = 'all', page = 1, limit = 20 } = req.query;
  
  const result = await sessionService.getUserSessions(req.user.id, {
    status,
    page: parseInt(page),
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    data: result
  });
}));

// @route   GET /api/v1/auth/sessions/:id
// @desc    Get specific session
// @access  Private
router.get('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
  const sessionService = require('../services/session');
  
  const session = await sessionService.getSessionById(req.params.id, req.user.id);
  
  if (!session) {
    throw new NotFoundError('Session');
  }

  res.json({
    success: true,
    data: session
  });
}));

// @route   DELETE /api/v1/auth/sessions/:id
// @desc    Revoke specific session
// @access  Private
router.delete('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
  const sessionService = require('../services/session');
  
  const revoked = await sessionService.revokeSession(req.params.id, req.user.id);
  
  if (!revoked) {
    throw new NotFoundError('Session');
  }

  res.json({
    success: true,
    message: 'Session revoked successfully'
  });
}));

// @route   DELETE /api/v1/auth/sessions
// @desc    Revoke all sessions except current
// @access  Private
router.delete('/sessions', authenticate, asyncHandler(async (req, res) => {
  const sessionService = require('../services/session');
  
  // Get current session ID from token or header
  const currentSessionId = req.headers['x-session-id'];
  
  const count = await sessionService.revokeAllSessions(req.user.id, currentSessionId);

  res.json({
    success: true,
    message: `${count} session(s) revoked successfully`
  });
}));

// @route   DELETE /api/v1/auth/sessions/all
// @desc    Revoke all sessions including current (logout everywhere)
// @access  Private
router.delete('/sessions/all', authenticate, asyncHandler(async (req, res) => {
  const sessionService = require('../services/session');
  
  const count = await sessionService.revokeAllSessions(req.user.id);

  res.json({
    success: true,
    message: `${count} session(s) revoked. You have been logged out from all devices.`
  });
}));

// @route   GET /api/v1/auth/sessions/count
// @desc    Get active session count
// @access  Private
router.get('/sessions/count', authenticate, asyncHandler(async (req, res) => {
  const sessionService = require('../services/session');
  
  const count = await sessionService.countActiveSessions(req.user.id);

  res.json({
    success: true,
    data: {
      active_sessions: count
    }
  });
}));

module.exports = router;
