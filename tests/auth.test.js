/**
 * Authentication Unit Tests
 * Tests for JWT, password hashing, and authentication utilities
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock config before requiring modules
jest.mock('../src/config', () => ({
  jwt: {
    secret: 'test-secret-key-for-testing-only',
    expires_in: '1h',
    refresh_expires_in: '7d'
  },
  password: {
    salt_rounds: 10
  },
  app: {
    debug: true
  }
}));

// Import modules under test
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../src/middleware/auth');
const config = require('../src/config');

describe('Authentication Module', () => {
  // Mock user data
  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    role: 'user',
    name: 'Test User'
  };

  describe('Token Generation', () => {
    test('should generate a valid JWT token', () => {
      const token = generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should generate token with correct payload', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, config.jwt.secret);

      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });

    test('should generate different tokens for different users', () => {
      const token1 = generateToken({ ...mockUser, id: 'id-1' });
      const token2 = generateToken({ ...mockUser, id: 'id-2' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('Refresh Token Generation', () => {
    test('should generate a valid refresh token', () => {
      const refreshToken = generateRefreshToken(mockUser);

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.split('.')).toHaveLength(3);
    });

    test('should include type=refresh in payload', () => {
      const refreshToken = generateRefreshToken(mockUser);
      const decoded = jwt.verify(refreshToken, config.jwt.secret);

      expect(decoded.type).toBe('refresh');
      expect(decoded.userId).toBe(mockUser.id);
    });
  });

  describe('Refresh Token Verification', () => {
    test('should verify valid refresh token', () => {
      const refreshToken = generateRefreshToken(mockUser);
      const decoded = verifyRefreshToken(refreshToken);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.type).toBe('refresh');
    });

    test('should reject invalid refresh token', () => {
      expect(() => {
        verifyRefreshToken('invalid-token');
      }).toThrow();
    });

    test('should reject access token as refresh token', () => {
      const accessToken = generateToken(mockUser);

      expect(() => {
        verifyRefreshToken(accessToken);
      }).toThrow();
    });
  });
});

describe('Password Hashing', () => {
  const plainPassword = 'TestPass123!';
  const saltRounds = 10;

  describe('bcrypt.hash', () => {
    test('should hash password successfully', async () => {
      const hash = await bcrypt.hash(plainPassword, saltRounds);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(plainPassword);
      expect(hash.length).toBeGreaterThan(plainPassword.length);
    });

    test('should generate unique hashes for same password', async () => {
      const hash1 = await bcrypt.hash(plainPassword, saltRounds);
      const hash2 = await bcrypt.hash(plainPassword, saltRounds);

      expect(hash1).not.toBe(hash2);
    });

    test('should verify correct password', async () => {
      const hash = await bcrypt.hash(plainPassword, saltRounds);
      const isValid = await bcrypt.compare(plainPassword, hash);

      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const hash = await bcrypt.hash(plainPassword, saltRounds);
      const isValid = await bcrypt.compare('WrongPass123!', hash);

      expect(isValid).toBe(false);
    });
  });
});

describe('JWT Token Expiration', () => {
  test('should set expiration time', () => {
    const token = generateToken({ id: 'test', email: 'test@test.com', role: 'user' });
    const decoded = jwt.decode(token);

    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });
});
