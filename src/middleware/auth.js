/**
 * Authentication Middleware
 * JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../database');
const { AuthenticationError, AuthorizationError } = require('./error');

// Verify JWT token middleware
async function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token has expired');
      }
      throw new AuthenticationError('Invalid token');
    }
    
    // Get user from database
    const result = await query(
      'SELECT id, email, name, role, status, created_at, updated_at FROM users WHERE id = $1 AND status = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      throw new AuthenticationError('User not found or inactive');
    }
    
    // Attach user to request
    req.user = result.rows[0];
    req.token = token;
    
    next();
  } catch (error) {
    next(error);
  }
}

// Optional authentication (doesn't fail if no token)
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      const result = await query(
        'SELECT id, email, name, role, status FROM users WHERE id = $1 AND status = $1',
        [decoded.userId]
      );
      
      if (result.rows.length > 0) {
        req.user = result.rows[0];
        req.token = token;
      }
    } catch (err) {
      // Token invalid but that's okay for optional auth
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

// Role-based authorization middleware
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError());
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`));
    }
    
    next();
  };
}

// Admin-only middleware
function adminOnly(req, res, next) {
  return authorize('admin')(req, res, next);
}

// Generate JWT token
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expires_in,
  });
}

// Generate refresh token
function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
    type: 'refresh',
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refresh_expires_in || '30d',
  });
}

// Verify refresh token
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new AuthenticationError('Invalid refresh token');
  }
}

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  adminOnly,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
};
