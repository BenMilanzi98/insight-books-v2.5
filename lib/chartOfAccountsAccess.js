import { hasPermission } from '@/lib/auth';
import { isFullAccessTenantRole } from '@/lib/tenantRoleAccess';
import { hasAnySalesPermission } from '@/lib/posPermissions';

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

/** POS users may read postable income accounts without full Chart of Accounts access. */
export function canAccessPosIncomeAccounts(user) {
  return (
    isFullAccessTenantRole(user) ||
    hasAnySalesPermission(user?.role?.permissions)
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

/**
 * Read-only GL account lists for dropdowns (journal, GL filter, BF, payroll, rentals, etc.)
 * without requiring full Chart of Accounts admin access.
 */
export function canUseCoaAccountPicker(user) {
  if (canViewChartOfAccounts(user)) return true;
  if (hasAnySalesPermission(user?.role?.permissions)) return true;
  return (
    hasPermission(user, 'budgets.view') ||
    hasPermission(user, 'budgets.create') ||
    hasPermission(user, 'journalEntries.view') ||
    hasPermission(user, 'journalEntries.create') ||
    hasPermission(user, 'generalLedger.view') ||
    hasPermission(user, 'payroll.view') ||
    hasPermission(user, 'hr.view') ||
    hasPermission(user, 'rentals.view') ||
    hasPermission(user, 'invoices.view')
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
