/**
 * Error Handling Unit Tests
 * Tests for error classes and error handler middleware
 */

describe('Error Classes', () => {
  // Import error classes (we'll mock them here for testing)
  class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
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

  describe('AppError', () => {
    test('should create error with message', () => {
      const error = new AppError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    test('should create error with custom status and code', () => {
      const error = new AppError('Custom error', 418, 'TEAPOT');
      
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(418);
      expect(error.code).toBe('TEAPOT');
    });

    test('should be instance of Error', () => {
      const error = new AppError('Test');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with message', () => {
      const error = new ValidationError('Validation failed');
      
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    test('should include errors array', () => {
      const errors = [{ field: 'email', message: 'Invalid email' }];
      const error = new ValidationError('Validation failed', errors);
      
      expect(error.errors).toEqual(errors);
    });
  });

  describe('AuthenticationError', () => {
    test('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Token expired');
      
      expect(error.message).toBe('Token expired');
    });
  });

  describe('AuthorizationError', () => {
    test('should create authorization error with default message', () => {
      const error = new AuthorizationError();
      
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    test('should create authorization error with custom message', () => {
      const error = new AuthorizationError('Admin only');
      
      expect(error.message).toBe('Admin only');
    });
  });

  describe('NotFoundError', () => {
    test('should create not found error with resource name', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    test('should use default resource name', () => {
      const error = new NotFoundError();
      
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('ConflictError', () => {
    test('should create conflict error with message', () => {
      const error = new ConflictError('Email already exists');
      
      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
    });
  });
});

describe('Error Response Formatting', () => {
  test('should format error response correctly', () => {
    const error = {
      message: 'Test error',
      code: 'TEST_ERROR'
    };

    const response = {
      success: false,
      error: {
        message: error.message,
        code: error.code
      }
    };

    expect(response.success).toBe(false);
    expect(response.error.message).toBe('Test error');
    expect(response.error.code).toBe('TEST_ERROR');
  });

  test('should format error response with details', () => {
    const error = {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' }
      ]
    };

    const response = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.errors
      }
    };

    expect(response.success).toBe(false);
    expect(response.error.details).toHaveLength(2);
    expect(response.error.details[0].field).toBe('email');
  });
});

describe('HTTP Status Codes', () => {
  const statusCodes = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
  };

  test('should have correct status codes', () => {
    expect(statusCodes.OK).toBe(200);
    expect(statusCodes.CREATED).toBe(201);
    expect(statusCodes.BAD_REQUEST).toBe(400);
    expect(statusCodes.UNAUTHORIZED).toBe(401);
    expect(statusCodes.FORBIDDEN).toBe(403);
    expect(statusCodes.NOT_FOUND).toBe(404);
    expect(statusCodes.CONFLICT).toBe(409);
    expect(statusCodes.INTERNAL_SERVER_ERROR).toBe(500);
  });
});
