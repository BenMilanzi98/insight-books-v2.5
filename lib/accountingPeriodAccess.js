import { isFullAccessTenantRole } from '@/lib/tenantRoleAccess';

/**
 * Who may list/create accounting periods and close/reopen them.
 * Matches finance tooling elsewhere: tenant Owner/Admin/Master admin plus Finance-titled roles.
 */
export function canManageAccountingPeriods(user) {
  if (!user?.role?.name) return false;
  if (isFullAccessTenantRole(user)) return true;
  const roleName = String(user.role.name).toLowerCase();
  return roleName.includes('finance');
}
