/**
 * Permission Middleware
 * RBAC permission checking middleware
 */

const { authenticate } = require('./auth');
const { 
  userHasPermission, 
  userHasAnyPermission, 
  userHasAllPermissions,
  ROLES,
  ROLE_HIERARCHY 
} = require('./rbac');
const { AuthorizationError, AuthenticationError } = require('./error');

/**
 * Middleware factory to check for specific permissions
 * @param  {...string} permissions - Permission strings to check
 * @returns Middleware function
 * 
 * @example
 * // Require a single permission
 * router.get('/admin', requirePermission('admin:access'), handler);
 * 
 * // Require any of the permissions
 * router.get('/data', requireAnyPermission('data:read', 'admin:access'), handler);
 * 
 * // Require all permissions
 * router.get('/secure', requireAllPermissions('data:read', 'data:write'), handler);
 */
function requirePermission(...permissions) {
  return async (req, res, next) => {
    try {
      // First authenticate the user
      await authenticate(req, res, async () => {
        // Check if user has the permission
        if (userHasPermission(req.user, permissions[0])) {
          next();
        } else {
          next(new AuthorizationError(`Permission denied. Required: ${permissions[0]}`));
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory to check for ANY of the specified permissions
 * @param  {...string} permissions - Permission strings to check
 * @returns Middleware function
 */
function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    try {
      await authenticate(req, res, async () => {
        if (userHasAnyPermission(req.user, permissions)) {
          next();
        } else {
          next(new AuthorizationError(
            `Permission denied. Required one of: ${permissions.join(', ')}`
          ));
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory to check for ALL of the specified permissions
 * @param  {...string} permissions - Permission strings to check
 * @returns Middleware function
 */
function requireAllPermissions(...permissions) {
  return async (req, res, next) => {
    try {
      await authenticate(req, res, async () => {
        if (userHasAllPermissions(req.user, permissions)) {
          next();
        } else {
          next(new AuthorizationError(
            `Permission denied. Required all: ${permissions.join(', ')}`
          ));
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory to check for minimum role level
 * @param {string} minimumRole - Minimum role required
 * @returns Middleware function
 * 
 * @example
 * // Require admin or higher
 * router.delete('/system', requireMinRole('admin'), handler);
 */
function requireMinRole(minimumRole) {
  return async (req, res, next) => {
    try {
      await authenticate(req, res, async () => {
        const userRole = req.user.role;
        const minRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;
        const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
        
        if (userRoleLevel >= minRoleLevel) {
          next();
        } else {
          next(new AuthorizationError(
            `Access denied. Minimum role required: ${minimumRole}`
          ));
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory to require specific roles
 * @param  {...string} roles - Allowed roles
 * @returns Middleware function
 * 
 * @example
 * // Allow only admin or super_admin
 * router.post('/users', requireRole('admin', 'super_admin'), handler);
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      await authenticate(req, res, async () => {
        if (roles.includes(req.user.role)) {
          next();
        } else {
          next(new AuthorizationError(
            `Access denied. Allowed roles: ${roles.join(', ')}`
          ));
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user owns the resource or has permission
 * @param {string} userIdParam - Request parameter name containing user ID
 * @param {string} permission - Permission to check if not owner
 * @returns Middleware function
 * 
 * @example
 * // Check if user owns the profile or has user:manage permission
 * router.put('/users/:id', ownsResource('id', 'user:manage'), handler);
 */
function ownsResource(userIdParam = 'id', permission = null) {
  return async (req, res, next) => {
    try {
      await authenticate(req, res, async () => {
        const resourceUserId = req.params[userIdParam];
        
        // Check if user owns the resource
        if (resourceUserId === req.user.id) {
          return next();
        }
        
        // Check if user has the required permission
        if (permission && userHasPermission(req.user, permission)) {
          return next();
        }
        
        next(new AuthorizationError('Access denied. You do not own this resource.'));
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to attach user permissions to request
 * Useful for template rendering or passing to services
 */
function attachPermissions() {
  return async (req, res, next) => {
    try {
      if (req.user) {
        const rbac = require('./rbac');
        req.userPermissions = rbac.getRolePermissions(req.user.role);
        req.hasPermission = (perm) => rbac.userHasPermission(req.user, perm);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express route middleware wrapper for async handlers
 * Catches errors and passes to next()
 */
function handleAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireMinRole,
  requireRole,
  ownsResource,
  attachPermissions,
  handleAsync
};
