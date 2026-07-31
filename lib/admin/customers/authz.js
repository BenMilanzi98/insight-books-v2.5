/**
 * Shared Customer Intelligence auth helpers.
 * View: intel.customers.read OR dashboard.view
 * Finance: financialMetrics OR intel.customers.read OR intel.revenue.read;
 *          dashboard.view alone → ALLOW_MASKED
 */

import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { AUTHZ_OUTCOMES } from '@/lib/admin/authorization/outcomes';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * @param {object|null|undefined} admin
 */
export function resolveCustomerAccess(admin) {
  const view = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
  });
  const customers = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  });
  const revenue = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  });
  const finance = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.financialMetrics,
  });

  const canView = view.allowed || customers.allowed;
  const financeFull =
    finance.outcome === AUTHZ_OUTCOMES.ALLOW ||
    customers.allowed ||
    revenue.allowed;
  const financeMasked =
    !financeFull && finance.outcome === AUTHZ_OUTCOMES.ALLOW_MASKED;
  const financeOk = financeFull || financeMasked;

  return {
    canView,
    financeOk,
    financeMasked,
    customersAllowed: customers.allowed,
    revenueAllowed: revenue.allowed,
    viewAllowed: view.allowed,
    finance,
  };
}
