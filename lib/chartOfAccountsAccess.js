import { hasPermission } from '@/lib/auth';

/**
 * Legacy gate: role names that historically had full COA access before RBAC was enforced.
 * Kept so tenants with unusual permission JSON still work if their role name matches.
 */
function isLegacyFinanceAdminRole(user) {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return (
    roleName.includes('finance') ||
    roleName.includes('admin') ||
    roleName === 'master_admin'
  );
}

/** Read chart of accounts — matches UI `PermissionGuard` `accounts.view`. */
export function canViewChartOfAccounts(user) {
  return hasPermission(user, 'accounts.view') || isLegacyFinanceAdminRole(user);
}

/** Create GL accounts — `accounts.create`. */
export function canCreateChartOfAccount(user) {
  return hasPermission(user, 'accounts.create') || isLegacyFinanceAdminRole(user);
}

/** Update / merge / deactivate / bootstrap financial defaults — `accounts.update`. */
export function canUpdateChartOfAccount(user) {
  return hasPermission(user, 'accounts.update') || isLegacyFinanceAdminRole(user);
}

/** Bootstrap / apply defaults: needs create or update (or legacy finance/admin role). */
export function canBootstrapChartOfAccounts(user) {
  return (
    hasPermission(user, 'accounts.create') ||
    hasPermission(user, 'accounts.update') ||
    isLegacyFinanceAdminRole(user)
  );
}
