/**
 * Roles and Permissions Configuration
 * Defines all roles and their permissions for RBAC
 */

// Role definitions
const ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// Permission definitions
const PERMISSIONS = {
  // User permissions
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  
  // Influencer permissions
  INFLUENCER_READ: 'influencer:read',
  INFLUENCER_CREATE: 'influencer:create',
  INFLUENCER_UPDATE: 'influencer:update',
  INFLUENCER_DELETE: 'influencer:delete',
  
  // Campaign permissions
  CAMPAIGN_READ: 'campaign:read',
  CAMPAIGN_CREATE: 'campaign:create',
  CAMPAIGN_UPDATE: 'campaign:update',
  CAMPAIGN_DELETE: 'campaign:delete',
  
  // Data Model permissions
  MODEL_READ: 'model:read',
  MODEL_CREATE: 'model:create',
  MODEL_UPDATE: 'model:update',
  MODEL_DELETE: 'model:delete',
  
  // Analytics permissions
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_EXPORT: 'analytics:export',
  
  // Admin permissions
  ADMIN_ACCESS: 'admin:access',
  SYSTEM_CONFIG: 'system:config',
  ROLE_MANAGE: 'role:manage'
};

// Role-Permission mapping
const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.INFLUENCER_READ,
    PERMISSIONS.INFLUENCER_CREATE,
    PERMISSIONS.INFLUENCER_UPDATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_UPDATE,
    PERMISSIONS.MODEL_READ,
    PERMISSIONS.MODEL_CREATE,
    PERMISSIONS.MODEL_UPDATE,
    PERMISSIONS.ANALYTICS_READ
  ],
  
  [ROLES.MODERATOR]: [
    ...ROLES_USER_PERMISSIONS,
    PERMISSIONS.INFLUENCER_DELETE,
    PERMISSIONS.CAMPAIGN_DELETE,
    PERMISSIONS.MODEL_DELETE,
    PERMISSIONS.ANALYTICS_EXPORT
  ],
  
  [ROLES.ADMIN]: [
    ...ROLES_MODERATOR_PERMISSIONS,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.ADMIN_ACCESS
  ],
  
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS)
};

// Helper function to get user permissions
const ROLES_USER_PERMISSIONS = ROLE_PERMISSIONS[ROLES.USER];
const ROLES_MODERATOR_PERMISSIONS = ROLE_PERMISSIONS[ROLES.MODERATOR];
const ROLES_ADMIN_PERMISSIONS = ROLE_PERMISSIONS[ROLES.ADMIN];

/**
 * Get all permissions for a role
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 */
function roleHasPermission(role, permission) {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Check if a user has a specific permission
 */
function userHasPermission(user, permission) {
  if (!user || !user.role) return false;
  const permissions = getRolePermissions(user.role);
  return permissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
function userHasAnyPermission(user, permissionList) {
  if (!user || !user.role) return false;
  const permissions = getRolePermissions(user.role);
  return permissionList.some(p => permissions.includes(p));
}

/**
 * Check if a user has all of the specified permissions
 */
function userHasAllPermissions(user, permissionList) {
  if (!user || !user.role) return false;
  const permissions = getRolePermissions(user.role);
  return permissionList.every(p => permissions.includes(p));
}

/**
 * Get all available roles
 */
function getAvailableRoles() {
  return Object.values(ROLES);
}

/**
 * Check if a role is valid
 */
function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

/**
 * Role hierarchy (higher number = more permissions)
 */
const ROLE_HIERARCHY = {
  [ROLES.USER]: 1,
  [ROLES.MODERATOR]: 2,
  [ROLES.ADMIN]: 3,
  [ROLES.SUPER_ADMIN]: 4
};

/**
 * Check if role1 has higher or equal permission level than role2
 */
function isRoleHigherOrEqual(role1, role2) {
  const level1 = ROLE_HIERARCHY[role1] || 0;
  const level2 = ROLE_HIERARCHY[role2] || 0;
  return level1 >= level2;
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  roleHasPermission,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
  getAvailableRoles,
  isValidRole,
  ROLE_HIERARCHY,
  isRoleHigherOrEqual
};
