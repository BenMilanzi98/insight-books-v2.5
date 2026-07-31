/**
 * Product Analytics auth helpers.
 * Read: intel.productAnalytics.read OR intel.product.read.
 * Super Admin still passes via authorizeAdminDecision when those permissions are granted.
 */

import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * @param {object|null|undefined} admin
 */
export function resolveProductAnalyticsAccess(admin) {
  const productAnalytics = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  });
  const productLegacy = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.productRead,
  });
  const manageDefinitions = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsManageDefinitions,
  });
  const exportPerm = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsExport,
  });
  const recon = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRunReconciliation,
  });

  const canView = Boolean(productAnalytics.allowed || productLegacy.allowed);

  return {
    canView,
    canManageDefinitions: Boolean(manageDefinitions.allowed),
    canExport: Boolean(exportPerm.allowed),
    canRunReconciliation: Boolean(recon.allowed),
    productAnalyticsAllowed: productAnalytics.allowed,
    productLegacyAllowed: productLegacy.allowed,
  };
}
