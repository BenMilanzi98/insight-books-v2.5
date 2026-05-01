import { hasPermission } from '@/lib/auth';
import { isFullAccessTenantRole } from '@/lib/tenantRoleAccess';

/**
 * Legacy gate: role names that historically had full COA access before RBAC was enforced.
 * Owner/Admin are handled by `hasPermission` via {@link isFullAccessTenantRole}; this covers
 * legacy Finance-* titles when permission JSON is partial or empty.
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
  return (
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'accounts.view') ||
    isLegacyFinanceAdminRole(user)
  );
}

/** Create GL accounts — `accounts.create`. */
export function canCreateChartOfAccount(user) {
  return (
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'accounts.create') ||
    isLegacyFinanceAdminRole(user)
  );
}

/** Update / merge / deactivate / bootstrap financial defaults — `accounts.update`. */
export function canUpdateChartOfAccount(user) {
  return (
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'accounts.update') ||
    isLegacyFinanceAdminRole(user)
  );
}

/** Bootstrap / apply defaults: needs create or update (or legacy finance/admin role). */
export function canBootstrapChartOfAccounts(user) {
  return (
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'accounts.create') ||
    hasPermission(user, 'accounts.update') ||
    isLegacyFinanceAdminRole(user)
  );
}
