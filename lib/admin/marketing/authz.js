/**
 * Marketing auth helpers — Phase 23 Wave 1.
 * Marketing Campaign ≠ Affiliate campaign. Lead source SoT remains CRM.
 */

import { isSuperAdminRole } from '@/lib/admin/authorization/catalogue.js';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * @param {object|null|undefined} admin
 */
export function resolveMarketingAccess(admin) {
  const view = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.view,
  });
  const manageCampaigns = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.manageCampaigns,
  });
  const createCampaigns = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.createCampaigns,
  });
  const editCampaigns = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.editCampaigns,
  });
  const manageTaxonomy = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.manageTaxonomy,
  });
  const manageNormalisation = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.manageNormalisation,
  });
  const viewLeadSourceEvidence = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.viewLeadSourceEvidence,
  });
  const exportPerm = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.marketing.export,
  });

  const isSuper = isSuperAdminRole(admin?.role);

  return {
    canView: Boolean(isSuper || view.allowed),
    canManageCampaigns: Boolean(
      isSuper || manageCampaigns.allowed || editCampaigns.allowed || createCampaigns.allowed
    ),
    canCreateCampaigns: Boolean(isSuper || createCampaigns.allowed || manageCampaigns.allowed),
    canEditCampaigns: Boolean(isSuper || editCampaigns.allowed || manageCampaigns.allowed),
    canManageTaxonomy: Boolean(isSuper || manageTaxonomy.allowed),
    canManageNormalisation: Boolean(isSuper || manageNormalisation.allowed),
    canViewLeadSourceEvidence: Boolean(
      isSuper || viewLeadSourceEvidence.allowed || view.allowed
    ),
    /** Wave 1 export stub — permission gate only; no export plane yet. */
    canExport: Boolean(isSuper || exportPerm.allowed),
    isSuperAdmin: isSuper,
  };
}
