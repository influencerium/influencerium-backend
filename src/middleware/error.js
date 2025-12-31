/**
 * Error Handling Middleware
 * Centralized error handling for the API
 */

const config = require('../config');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

// Error response formatter
function formatErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    error: {
      message: error.message || 'An error occurred',
      code: error.code || 'INTERNAL_ERROR',
    },
  };

  if (error.errors) {
    response.error.details = error.errors;
  }

  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

// Main error handler middleware
function errorHandler(err, req, res, next) {
  // Log error
  console.error('Error:', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json(formatErrorResponse(err));
  }

  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    const errors = err.array();
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      },
    });
  }

  // Handle PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        return res.status(409).json({
          success: false,
          error: {
            message: 'Resource already exists',
            code: 'CONFLICT_ERROR',
          },
        });
      case '23503': // Foreign key violation
        return res.status(400).json({
          success: false,
          error: {
            message: 'Referenced resource does not exist',
            code: 'VALIDATION_ERROR',
          },
        });
      case '23502': // Not null violation
        return res.status(400).json({
          success: false,
          error: {
            message: 'Required field is missing',
            code: 'VALIDATION_ERROR',
          },
        });
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 'AUTHENTICATION_ERROR',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      },
    });
  }

  // Default to 500 internal server error
  const statusCode = err.statusCode || 500;
  const message = config.app.debug ? err.message : 'An unexpected error occurred';

  res.status(statusCode).json(formatErrorResponse({
    message,
    code: 'INTERNAL_ERROR',
    stack: err.stack,
  }, config.app.debug));
}

// Async handler wrapper to catch errors in async route handlers
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
};
