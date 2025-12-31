/**
 * User Routes
 * Endpoints: Profile, Password, Account Management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../database');
const { authenticate, authorize, adminOnly } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, AuthenticationError, ConflictError, AuthorizationError } = require('../middleware/error');
const config = require('../config');
const Joi = require('joi');

// Validation Schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional()
}).min(1);

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
  confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

// @route   GET /api/v1/users/profile
// @desc    Get current user's profile
// @access  Private
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, role, status, avatar, created_at, updated_at 
     FROM users WHERE id = $1`,
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

// @route   PUT /api/v1/users/profile
// @desc    Update current user's profile
// @access  Private
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = updateProfileSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (value.name) {
    updates.push(`name = $${paramIndex}`);
    values.push(value.name);
    paramIndex++;
  }

  if (value.email) {
    // Check if email is already taken
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [value.email.toLowerCase(), req.user.id]
    );

    if (existing.rows.length > 0) {
      throw new ConflictError('Email already in use');
    }

    updates.push(`email = $${paramIndex}`);
    values.push(value.email.toLowerCase());
    paramIndex++;
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.user.id);

  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} 
     RETURNING id, name, email, role, status, created_at, updated_at`,
    values
  );

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: result.rows[0]
  });
}));

// @route   PUT /api/v1/users/password
// @desc    Update password
// @access  Private
router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = updatePasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const { currentPassword, newPassword } = value;

  // Get current password hash
  const result = await query(
    'SELECT password FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  const user = result.rows[0];

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const saltRounds = config.password.salt_rounds || 12;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await query(
    'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, req.user.id]
  );

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
}));

// @route   DELETE /api/v1/users/account
// @desc    Delete current user's account
// @access  Private
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  // Soft delete - just mark as inactive
  await query(
    'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
    ['deleted', req.user.id]
  );

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

// @route   GET /api/v1/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let whereClause = '1=1';
  const values = [];
  let paramIndex = 1;

  if (search) {
    whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    values.push(`%${search}%`);
    paramIndex++;
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM users WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  // Get users
  const result = await query(
    `SELECT id, name, email, role, status, created_at, updated_at
     FROM users WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  res.json({
    success: true,
    data: {
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// @route   GET /api/v1/users/:id
// @desc    Get user by ID (admin only)
// @access  Private (Admin)
router.get('/:id', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, role, status, created_at, updated_at 
     FROM users WHERE id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// @route   PUT /api/v1/users/:id/role
// @desc    Update user role (admin only)
// @access  Private (Admin)
router.put('/:id/role', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { role } = req.body;
  const validRoles = ['user', 'moderator', 'admin'];
  
  if (!validRoles.includes(role)) {
    throw new ValidationError(`Role must be one of: ${validRoles.join(', ')}`);
  }
  
  // Prevent changing super_admin role (only super_admin can do this)
  const targetUser = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (targetUser.rows.length === 0) {
    throw new NotFoundError('User');
  }
  
  if (targetUser.rows[0].role === 'super_admin' && req.user.role !== 'super_admin') {
    throw new AuthorizationError('Cannot modify super_admin role');
  }
  
  const result = await query(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, email, role, status, created_at, updated_at`,
    [role, req.params.id]
  );

  res.json({
    success: true,
    message: 'User role updated successfully',
    data: result.rows[0]
  });
}));

// @route   PUT /api/v1/users/:id/status
// @desc    Update user status (admin only)
// @access  Private (Admin)
router.put('/:id/status', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
  
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Prevent modifying super_admin status
  const targetUser = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (targetUser.rows.length === 0) {
    throw new NotFoundError('User');
  }
  
  if (targetUser.rows[0].role === 'super_admin') {
    throw new AuthorizationError('Cannot modify super_admin status');
  }
  
  const result = await query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, email, role, status, created_at, updated_at`,
    [status, req.params.id]
  );

  res.json({
    success: true,
    message: 'User status updated successfully',
    data: result.rows[0]
  });
}));

// @route   GET /api/v1/users/:id/permissions
// @desc    Get user permissions (admin or self)
// @access  Private
router.get('/:id/permissions', authenticate, asyncHandler(async (req, res) => {
  // Users can view their own permissions, admins can view any
  if (req.params.id !== req.user.id && req.user.role !== 'admin') {
    throw new AuthorizationError('Access denied');
  }
  
  const rbac = require('../middleware/rbac');
  const permissions = rbac.getRolePermissions(req.user.role);
  
  res.json({
    success: true,
    data: {
      userId: req.params.id,
      role: req.user.role,
      permissions
    }
  });
}));

// @route   GET /api/v1/users/roles
// @desc    Get all available roles (admin only)
// @access  Private (Admin)
router.get('/roles/list', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const rbac = require('../middleware/rbac');
  
  const roles = Object.values(rbac.ROLES).map(role => ({
    name: role,
    permissions: rbac.getRolePermissions(role)
  }));
  
  res.json({
    success: true,
    data: roles
  });
}));

module.exports = router;