/**
 * Session Service Unit Tests
 * Tests for session management functionality
 */

// Mock dependencies
jest.mock('../src/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/config', () => ({
  session: {
    cookie_max_age: 604800000 // 7 days
  }
}));

// Import modules under test
const { 
  SESSION_STATUS,
  generateSessionToken,
  createSession,
  validateSession,
  getUserSessions,
  getSessionById,
  revokeSession,
  revokeAllSessions,
  countActiveSessions
} = require('../src/services/session');

const database = require('../src/database');

describe('Session Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SESSION_STATUS Constants', () => {
    test('should have all session statuses', () => {
      expect(SESSION_STATUS.ACTIVE).toBe('active');
      expect(SESSION_STATUS.EXPIRED).toBe('expired');
      expect(SESSION_STATUS.REVOKED).toBe('revoked');
    });
  });

  describe('generateSessionToken', () => {
    test('should generate a secure token', () => {
      const token = generateSessionToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(128); // 64 bytes = 128 hex chars
    });

    test('should generate unique tokens', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      
      expect(token1).not.toBe(token2);
    });

    test('should only contain hex characters', () => {
      const token = generateSessionToken();
      const hexRegex = /^[0-9a-f]+$/;
      
      expect(hexRegex.test(token)).toBe(true);
    });
  });

  describe('createSession', () => {
    test('should create session with valid user id', async () => {
      const mockSession = {
        id: 'session-uuid',
        session_token: 'token123',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        status: 'active'
      };

      database.query.mockResolvedValue({ rows: [mockSession] });

      const session = await createSession('user-uuid', {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      expect(session).toBeDefined();
      expect(session.session_token).toBe('token123');
      expect(database.query).toHaveBeenCalledTimes(1);
    });

    test('should call database with correct query', async () => {
      database.query.mockResolvedValue({ rows: [] });

      await createSession('user-uuid', {});

      expect(database.query).toHaveBeenCalled();
      const query = database.query.mock.calls[0][0];
      expect(query).toContain('INSERT INTO sessions');
      expect(query).toContain('user_id');
    });

    test('should return session data from database', async () => {
      const mockSession = {
        id: 'test-id',
        session_token: 'test-token',
        ip_address: null,
        user_agent: null,
        status: 'active',
        created_at: new Date(),
        expires_at: new Date()
      };

      database.query.mockResolvedValue({ rows: [mockSession] });

      const session = await createSession('user-uuid');

      expect(session.id).toBe('test-id');
      expect(session.session_token).toBe('test-token');
    });
  });

  describe('validateSession', () => {
    test('should return null for empty token', async () => {
      const result = await validateSession(null);
      expect(result).toBeNull();
    });

    test('should return null for empty string token', async () => {
      const result = await validateSession('');
      expect(result).toBeNull();
    });

    test('should return null when no session found', async () => {
      database.query.mockResolvedValue({ rows: [] });

      const result = await validateSession('invalid-token');
      expect(result).toBeNull();
    });

    test('should return session data when valid', async () => {
      const mockSession = {
        id: 'session-uuid',
        user_id: 'user-uuid',
        name: 'Test User',
        email: 'test@example.com',
        status: 'active'
      };

      database.query.mockResolvedValue({ rows: [mockSession] });

      const result = await validateSession('valid-token');

      expect(result).toBeDefined();
      expect(result.id).toBe('session-uuid');
      expect(result.user_id).toBe('user-uuid');
    });
  });

  describe('getUserSessions', () => {
    test('should return sessions with pagination', async () => {
      const mockSessions = [
        { id: 'session-1', session_token: 'token1...token1', status: 'active' },
        { id: 'session-2', session_token: 'token2...token2', status: 'active' }
      ];

      database.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: mockSessions }); // sessions query

      const result = await getUserSessions('user-uuid');

      expect(result.sessions).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    test('should filter by status', async () => {
      database.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await getUserSessions('user-uuid', { status: 'active' });

      expect(database.query).toHaveBeenCalled();
      const query = database.query.mock.calls[1][0];
      expect(query).toContain('status');
    });

    test('should mask session tokens', async () => {
      const mockSession = {
        id: 'session-uuid',
        session_token: 'very-long-session-token-that-should-be-masked',
        status: 'active'
      };

      database.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockSession] });

      const result = await getUserSessions('user-uuid');

      expect(result.sessions[0].session_token).toContain('...');
      expect(result.sessions[0].session_token.length).toBeLessThan(mockSession.session_token.length);
    });
  });

  describe('getSessionById', () => {
    test('should return session when found', async () => {
      const mockSession = { id: 'session-uuid', status: 'active' };
      database.query.mockResolvedValue({ rows: [mockSession] });

      const result = await getSessionById('session-uuid', 'user-uuid');

      expect(result).toBeDefined();
      expect(result.id).toBe('session-uuid');
    });

    test('should return null when not found', async () => {
      database.query.mockResolvedValue({ rows: [] });

      const result = await getSessionById('invalid-uuid', 'user-uuid');

      expect(result).toBeNull();
    });

    test('should filter by user id', async () => {
      database.query.mockResolvedValue({ rows: [] });

      await getSessionById('session-uuid', 'user-uuid');

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id'),
        ['session-uuid', 'user-uuid']
      );
    });
  });

  describe('revokeSession', () => {
    test('should return true when session revoked', async () => {
      database.query.mockResolvedValue({ rowCount: 1 });

      const result = await revokeSession('session-uuid', 'user-uuid');

      expect(result).toBe(true);
    });

    test('should return false when session not found', async () => {
      database.query.mockResolvedValue({ rowCount: 0 });

      const result = await revokeSession('invalid-uuid', 'user-uuid');

      expect(result).toBe(false);
    });

    test('should update status to revoked', async () => {
      database.query.mockResolvedValue({ rowCount: 1 });

      await revokeSession('session-uuid', 'user-uuid');

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['revoked', 'session-uuid', 'user-uuid'])
      );
    });
  });

  describe('revokeAllSessions', () => {
    test('should revoke all user sessions', async () => {
      database.query.mockResolvedValue({ rowCount: 5 });

      const result = await revokeAllSessions('user-uuid');

      expect(result).toBe(5);
    });

    test('should exclude current session when specified', async () => {
      database.query.mockResolvedValue({ rowCount: 3 });

      await revokeAllSessions('user-uuid', 'current-session-id');

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('id !='),
        expect.arrayContaining(['revoked', 'user-uuid', 'active', 'current-session-id'])
      );
    });

    test('should return 0 when no sessions to revoke', async () => {
      database.query.mockResolvedValue({ rowCount: 0 });

      const result = await revokeAllSessions('user-uuid');

      expect(result).toBe(0);
    });
  });

  describe('countActiveSessions', () => {
    test('should return active session count', async () => {
      database.query.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await countActiveSessions('user-uuid');

      expect(result).toBe(3);
    });

    test('should return 0 when no active sessions', async () => {
      database.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await countActiveSessions('user-uuid');

      expect(result).toBe(0);
    });
  });
});

describe('Session Token Security', () => {
  test('session tokens should be cryptographically secure', () => {
    const tokens = new Set();
    
    // Generate many tokens to check uniqueness
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken());
    }

    // All tokens should be unique
    expect(tokens.size).toBe(100);
  });

  test('session tokens should be long enough', () => {
    const token = generateSessionToken();
    
    // 64 bytes = 128 hex characters = 512 bits of entropy
    expect(token.length).toBeGreaterThanOrEqual(100);
  });
});
