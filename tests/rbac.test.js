/**
 * RBAC Unit Tests
 * Tests for role-based access control permissions
 */

// Mock the config before requiring rbac module
jest.mock('../src/config', () => ({
  jwt: {
    secret: 'test-secret',
    expires_in: '1h'
  },
  password: {
    salt_rounds: 10
  },
  app: {
    debug: true
  }
}));

// Mock database
jest.mock('../src/database', () => ({
  query: jest.fn()
}));

// Import modules under test
const { 
  ROLES, 
  PERMISSIONS, 
  getRolePermissions, 
  roleHasPermission,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
  getAvailableRoles,
  isValidRole,
  isRoleHigherOrEqual
} = require('../src/middleware/rbac');

describe('RBAC Module', () => {
  describe('Roles Definition', () => {
    test('should have all required roles', () => {
      expect(ROLES.USER).toBe('user');
      expect(ROLES.MODERATOR).toBe('moderator');
      expect(ROLES.ADMIN).toBe('admin');
      expect(ROLES.SUPER_ADMIN).toBe('super_admin');
    });

    test('should have valid roles as strings', () => {
      Object.values(ROLES).forEach(role => {
        expect(typeof role).toBe('string');
      });
    });
  });

  describe('Permissions Definition', () => {
    test('should have user permissions', () => {
      expect(PERMISSIONS.USER_READ).toBe('user:read');
      expect(PERMISSIONS.USER_UPDATE).toBe('user:update');
      expect(PERMISSIONS.USER_DELETE).toBe('user:delete');
      expect(PERMISSIONS.USER_MANAGE).toBe('user:manage');
    });

    test('should have influencer permissions', () => {
      expect(PERMISSIONS.INFLUENCER_READ).toBe('influencer:read');
      expect(PERMISSIONS.INFLUENCER_CREATE).toBe('influencer:create');
      expect(PERMISSIONS.INFLUENCER_UPDATE).toBe('influencer:update');
      expect(PERMISSIONS.INFLUENCER_DELETE).toBe('influencer:delete');
    });

    test('should have campaign permissions', () => {
      expect(PERMISSIONS.CAMPAIGN_READ).toBe('campaign:read');
      expect(PERMISSIONS.CAMPAIGN_CREATE).toBe('campaign:create');
      expect(PERMISSIONS.CAMPAIGN_UPDATE).toBe('campaign:update');
      expect(PERMISSIONS.CAMPAIGN_DELETE).toBe('campaign:delete');
    });

    test('should have analytics permissions', () => {
      expect(PERMISSIONS.ANALYTICS_READ).toBe('analytics:read');
      expect(PERMISSIONS.ANALYTICS_EXPORT).toBe('analytics:export');
    });
  });

  describe('getRolePermissions', () => {
    test('should return permissions for user role', () => {
      const permissions = getRolePermissions(ROLES.USER);
      
      expect(permissions).toBeInstanceOf(Array);
      expect(permissions).toContain(PERMISSIONS.USER_READ);
      expect(permissions).toContain(PERMISSIONS.INFLUENCER_READ);
      expect(permissions).toContain(PERMISSIONS.CAMPAIGN_READ);
      expect(permissions).not.toContain(PERMISSIONS.USER_DELETE);
      expect(permissions).not.toContain(PERMISSIONS.USER_MANAGE);
    });

    test('should return permissions for admin role', () => {
      const permissions = getRolePermissions(ROLES.ADMIN);
      
      expect(permissions).toContain(PERMISSIONS.USER_MANAGE);
      expect(permissions).toContain(PERMISSIONS.ADMIN_ACCESS);
      expect(permissions.length).toBeGreaterThan(getRolePermissions(ROLES.USER).length);
    });

    test('should return all permissions for super_admin', () => {
      const permissions = getRolePermissions(ROLES.SUPER_ADMIN);
      
      expect(permissions).toContain(PERMISSIONS.SYSTEM_CONFIG);
      expect(permissions).toContain(PERMISSIONS.ROLE_MANAGE);
      expect(permissions.length).toBeGreaterThan(getRolePermissions(ROLES.ADMIN).length);
    });

    test('should return empty array for unknown role', () => {
      const permissions = getRolePermissions('unknown_role');
      expect(permissions).toEqual([]);
    });
  });

  describe('roleHasPermission', () => {
    test('should return true for valid permission', () => {
      expect(roleHasPermission(ROLES.USER, PERMISSIONS.USER_READ)).toBe(true);
      expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.USER_MANAGE)).toBe(true);
    });

    test('should return false for invalid permission', () => {
      expect(roleHasPermission(ROLES.USER, PERMISSIONS.USER_MANAGE)).toBe(false);
      expect(roleHasPermission(ROLES.USER, PERMISSIONS.SYSTEM_CONFIG)).toBe(false);
    });

    test('should return false for unknown role', () => {
      expect(roleHasPermission('unknown', PERMISSIONS.USER_READ)).toBe(false);
    });
  });

  describe('userHasPermission', () => {
    test('should return true for user with permission', () => {
      const user = { role: ROLES.USER };
      expect(userHasPermission(user, PERMISSIONS.USER_READ)).toBe(true);
      expect(userHasPermission(user, PERMISSIONS.INFLUENCER_READ)).toBe(true);
    });

    test('should return false for user without permission', () => {
      const user = { role: ROLES.USER };
      expect(userHasPermission(user, PERMISSIONS.USER_MANAGE)).toBe(false);
    });

    test('should return false for null user', () => {
      expect(userHasPermission(null, PERMISSIONS.USER_READ)).toBe(false);
    });

    test('should return false for user without role', () => {
      expect(userHasPermission({}, PERMISSIONS.USER_READ)).toBe(false);
    });
  });

  describe('userHasAnyPermission', () => {
    test('should return true when user has any permission', () => {
      const user = { role: ROLES.USER };
      expect(userHasAnyPermission(user, [PERMISSIONS.USER_READ, PERMISSIONS.USER_DELETE])).toBe(true);
    });

    test('should return false when user has none of the permissions', () => {
      const user = { role: ROLES.USER };
      expect(userHasAnyPermission(user, [PERMISSIONS.USER_MANAGE, PERMISSIONS.SYSTEM_CONFIG])).toBe(false);
    });

    test('should return false for null user', () => {
      expect(userHasAnyPermission(null, [PERMISSIONS.USER_READ])).toBe(false);
    });
  });

  describe('userHasAllPermissions', () => {
    test('should return true when user has all permissions', () => {
      const user = { role: ROLES.ADMIN };
      expect(userHasAllPermissions(user, [PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE])).toBe(true);
    });

    test('should return false when user is missing any permission', () => {
      const user = { role: ROLES.USER };
      expect(userHasAllPermissions(user, [PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE])).toBe(false);
    });
  });

  describe('getAvailableRoles', () => {
    test('should return array of all roles', () => {
      const roles = getAvailableRoles();
      
      expect(roles).toBeInstanceOf(Array);
      expect(roles).toContain(ROLES.USER);
      expect(roles).toContain(ROLES.MODERATOR);
      expect(roles).toContain(ROLES.ADMIN);
      expect(roles).toContain(ROLES.SUPER_ADMIN);
      expect(roles).toHaveLength(4);
    });
  });

  describe('isValidRole', () => {
    test('should return true for valid roles', () => {
      expect(isValidRole(ROLES.USER)).toBe(true);
      expect(isValidRole(ROLES.ADMIN)).toBe(true);
      expect(isValidRole('super_admin')).toBe(true);
    });

    test('should return false for invalid roles', () => {
      expect(isValidRole('invalid')).toBe(false);
      expect(isValidRole('root')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('isRoleHigherOrEqual', () => {
    test('should return true for same role', () => {
      expect(isRoleHigherOrEqual(ROLES.USER, ROLES.USER)).toBe(true);
      expect(isRoleHigherOrEqual(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
    });

    test('should return true for higher role', () => {
      expect(isRoleHigherOrEqual(ROLES.ADMIN, ROLES.USER)).toBe(true);
      expect(isRoleHigherOrEqual(ROLES.SUPER_ADMIN, ROLES.ADMIN)).toBe(true);
      expect(isRoleHigherOrEqual(ROLES.SUPER_ADMIN, ROLES.USER)).toBe(true);
    });

    test('should return false for lower role', () => {
      expect(isRoleHigherOrEqual(ROLES.USER, ROLES.ADMIN)).toBe(false);
      expect(isRoleHigherOrEqual(ROLES.MODERATOR, ROLES.ADMIN)).toBe(false);
    });
  });

  describe('Permission Hierarchy', () => {
    test('user role should have least permissions', () => {
      const userPerms = getRolePermissions(ROLES.USER).length;
      const modPerms = getRolePermissions(ROLES.MODERATOR).length;
      const adminPerms = getRolePermissions(ROLES.ADMIN).length;

      expect(userPerms).toBeLessThan(modPerms);
      expect(modPerms).toBeLessThan(adminPerms);
    });

    test('all user permissions should be subset of admin permissions', () => {
      const userPerms = getRolePermissions(ROLES.USER);
      const adminPerms = getRolePermissions(ROLES.ADMIN);

      userPerms.forEach(perm => {
        expect(adminPerms).toContain(perm);
      });
    });
  });
});
