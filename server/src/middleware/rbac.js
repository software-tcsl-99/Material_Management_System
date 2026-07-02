/**
 * RBAC Middleware - Role-Based Access Control
 * 
 * Permission Matrix:
 * - super_admin: Everything
 * - department_admin (store): Store operations + employee actions in dept
 * - department_admin (accounts): Financial operations + employee actions in dept
 * - department_admin (management): Approvals, escalations + employee actions
 * - team_lead: Team approval, team requests + employee actions
 * - employee: Create requests, receive, transfer, return, own history
 */

const PERMISSIONS = {
  // Dashboard
  'dashboard:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'dashboard:view_all': ['super_admin'],
  'dashboard:view_department': ['department_admin'],
  'dashboard:view_team': ['team_lead'],

  // Transactions
  'transaction:create': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'transaction:view_own': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'transaction:view_all': ['super_admin'],
  'transaction:view_department': ['department_admin'],
  'transaction:view_team': ['team_lead'],
  'transaction:edit': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'transaction:cancel': ['super_admin', 'department_admin', 'team_lead', 'employee'],

  // Approvals
  'approval:view': ['super_admin', 'department_admin', 'team_lead'],
  'approval:approve': ['super_admin', 'department_admin', 'team_lead'],
  'approval:reject': ['super_admin', 'department_admin', 'team_lead'],
  'approval:bulk': ['super_admin', 'department_admin'],

  // Store operations
  'store:accept': ['super_admin', 'department_admin'],
  'store:assign_handler': ['super_admin', 'department_admin'],
  'store:inventory': ['super_admin', 'department_admin'],
  'store:receive_return': ['super_admin', 'department_admin'],

  // Materials & Barcodes
  'material:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'barcode:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'barcode:scan': ['super_admin', 'department_admin', 'team_lead', 'employee'],

  // Transfers
  'transfer:create': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'transfer:approve': ['super_admin', 'department_admin'],
  'transfer:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],

  // Returns
  'return:create': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'return:accept': ['super_admin', 'department_admin'],
  'return:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],

  // Receiving
  'receiving:receive': ['super_admin', 'department_admin', 'team_lead', 'employee'],

  // Chat
  'chat:send': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'chat:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],

  // Documents
  'document:upload': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'document:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],

  // Reports
  'report:view': ['super_admin', 'department_admin', 'team_lead'],
  'report:export': ['super_admin', 'department_admin'],
  'report:view_all': ['super_admin'],

  // Audit
  'audit:view': ['super_admin', 'department_admin'],
  'audit:view_all': ['super_admin'],

  // User Management
  'user:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'user:create': ['super_admin'],
  'user:edit': ['super_admin', 'department_admin'],
  'user:delete': ['super_admin'],
  'user:manage_department': ['department_admin'],

  // Masters
  'master:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],
  'master:create': ['super_admin'],
  'master:edit': ['super_admin'],
  'master:delete': ['super_admin'],

  // Settings
  'settings:view': ['super_admin'],
  'settings:edit': ['super_admin'],

  // Notifications
  'notification:view': ['super_admin', 'department_admin', 'team_lead', 'employee'],
};

/**
 * Check if user role has the required permission
 */
const hasPermission = (role, permission) => {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
};

/**
 * Middleware factory: requires specific permission(s)
 */
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const userRole = req.user.role;
    const hasAccess = permissions.some((perm) => hasPermission(userRole, perm));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

/**
 * Middleware: requires specific role(s)
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient role.' });
    }

    next();
  };
};

/**
 * Check if user is store admin
 */
const isStoreAdmin = (req) => {
  return req.user.role === 'department_admin' && req.user.departmentAdminType === 'store';
};

/**
 * Check if user is management admin
 */
const isManagementAdmin = (req) => {
  return req.user.role === 'department_admin' && req.user.departmentAdminType === 'management';
};

/**
 * Check if user is accounts admin
 */
const isAccountsAdmin = (req) => {
  return req.user.role === 'department_admin' && req.user.departmentAdminType === 'accounts';
};

module.exports = {
  PERMISSIONS,
  hasPermission,
  requirePermission,
  requireRole,
  isStoreAdmin,
  isManagementAdmin,
  isAccountsAdmin,
};
