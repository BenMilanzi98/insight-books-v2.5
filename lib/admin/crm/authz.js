/**
 * CRM auth helpers (Phase 11 Wave 1–4 + Phase 12 Wave 1 Pipeline/Opportunities).
 * Owner / team / territory scope stubs remain permissive for holders with view.
 * Never authorize CRM via Tenant POS sales.*.
 */

import { isSuperAdminRole } from '@/lib/admin/authorization/catalogue.js';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * @param {object|null|undefined} admin
 */
export function resolveCrmAccess(admin) {
  const view = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.view,
  });
  const viewLeads = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.viewLeads,
  });
  const createLeads = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.createLeads,
  });
  const editLeads = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.editLeads,
  });
  const transitionStatus = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.transitionStatus,
  });
  const viewAccounts = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.viewAccounts,
  });
  const createAccounts = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.createAccounts,
  });
  const viewContacts = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.viewContacts,
  });
  const createContacts = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.createContacts,
  });
  const assignLeads = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.assignLeads,
  });
  const qualifyLeads = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.qualifyLeads,
  });
  const scoreLeads = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.scoreLeads,
  });
  const overrideQualification = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.overrideQualification,
  });
  const manageConsent = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.manageConsent,
  });
  const mergeLeads = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.mergeLeads,
  });
  const exportPerm = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.export,
  });
  const runReconciliation = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.runReconciliation,
  });
  const pipelineView = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView,
  });
  const pipelineManageDefinitions = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.pipelineManageDefinitions,
  });
  const pipelineTransitionStages = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.pipelineTransitionStages,
  });
  const opportunitiesView = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesView,
  });
  const opportunitiesCreate = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesCreate,
  });
  const opportunitiesEdit = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesEdit,
  });
  const activitiesView = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.activitiesView,
  });
  const activitiesEdit = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.crm.activitiesEdit,
  });

  const isSuper = isSuperAdminRole(admin?.role);
  const canView =
    Boolean(
      isSuper ||
        view.allowed ||
        viewLeads.allowed ||
        viewAccounts.allowed ||
        viewContacts.allowed ||
        pipelineView.allowed ||
        opportunitiesView.allowed
    );
  const canEdit = Boolean(isSuper || editLeads.allowed || createLeads.allowed);

  return {
    canView,
    canViewLeads: Boolean(isSuper || view.allowed || viewLeads.allowed),
    canCreateLeads: Boolean(isSuper || createLeads.allowed),
    canEditLeads: canEdit,
    canTransitionStatus: Boolean(isSuper || transitionStatus.allowed || editLeads.allowed),
    canViewAccounts: Boolean(isSuper || view.allowed || viewAccounts.allowed),
    canCreateAccounts: Boolean(isSuper || createAccounts.allowed),
    canViewContacts: Boolean(isSuper || view.allowed || viewContacts.allowed),
    canCreateContacts: Boolean(isSuper || createContacts.allowed),
    /** Wave 2 — duplicate review list */
    canViewDuplicates: Boolean(isSuper || view.allowed || viewLeads.allowed),
    /** Wave 2 — review decision (no merge) */
    canReviewDuplicates: canEdit,
    /** Wave 2 — CS/Support/Product → Lead intake */
    canIntakeHandoffs: Boolean(isSuper || createLeads.allowed || editLeads.allowed),
    /** Wave 3 */
    canAssignLeads: Boolean(isSuper || assignLeads.allowed || editLeads.allowed),
    canQualifyLeads: Boolean(isSuper || qualifyLeads.allowed || editLeads.allowed),
    /** Mutating score runs — not viewLeads alone (history view may use view separately). */
    canScoreLeads: Boolean(isSuper || scoreLeads.allowed || editLeads.allowed),
    canOverrideQualification: Boolean(isSuper || overrideQualification.allowed),
    canManageConsent: Boolean(isSuper || manageConsent.allowed || editLeads.allowed),
    canViewTeams: Boolean(isSuper || view.allowed || viewLeads.allowed || assignLeads.allowed),
    canViewTerritories: Boolean(isSuper || view.allowed || viewLeads.allowed || assignLeads.allowed),
    /** Wave 4 — notes / merge / export / recon */
    canAddInternalNotes: Boolean(isSuper || editLeads.allowed),
    canAddRestrictedNotes: Boolean(isSuper || mergeLeads.allowed || manageConsent.allowed),
    canViewRestrictedNotes: Boolean(isSuper || mergeLeads.allowed || manageConsent.allowed),
    canRequestMerge: Boolean(isSuper || editLeads.allowed || mergeLeads.allowed),
    canApproveMerge: Boolean(isSuper || mergeLeads.allowed),
    canExport: Boolean(isSuper || exportPerm.allowed),
    canRunReconciliation: Boolean(isSuper || runReconciliation.allowed),
    /** Phase 12 Wave 1 — Pipeline / Opportunities */
    canViewPipeline: Boolean(isSuper || view.allowed || pipelineView.allowed),
    canManagePipelineDefinitions: Boolean(
      isSuper || pipelineManageDefinitions.allowed
    ),
    canTransitionOpportunityStages: Boolean(
      isSuper ||
        pipelineTransitionStages.allowed ||
        opportunitiesEdit.allowed
    ),
    canViewOpportunities: Boolean(
      isSuper || view.allowed || opportunitiesView.allowed || pipelineView.allowed
    ),
    canCreateOpportunities: Boolean(
      isSuper || opportunitiesCreate.allowed || editLeads.allowed
    ),
    canEditOpportunities: Boolean(
      isSuper || opportunitiesEdit.allowed || editLeads.allowed
    ),
    /** Wave 2 — probability override (reason required at call site) */
    canOverrideOpportunityProbability: Boolean(
      isSuper || opportunitiesEdit.allowed
    ),
    /** Phase 13 Wave 1 — Activities / Tasks / Follow-Ups */
    canViewActivities: Boolean(
      isSuper ||
        view.allowed ||
        activitiesView.allowed ||
        viewLeads.allowed ||
        opportunitiesView.allowed ||
        pipelineView.allowed
    ),
    canEditActivities: Boolean(
      isSuper ||
        activitiesEdit.allowed ||
        editLeads.allowed ||
        opportunitiesEdit.allowed
    ),
    isSuperAdmin: isSuper,
  };
}

/**
 * Owner / team / territory scope stub (Wave 3 foundation; Wave 1 Pipeline uses same `all` stub).
 * Holders with view see all records for now; filtering lands with ops data.
 *
 * @param {import('@prisma/client').PrismaClient} _prisma
 * @param {object|null|undefined} admin
 * @param {'leads'|'accounts'|'contacts'|'opportunities'} [domain]
 */
export async function resolveCrmScope(_prisma, admin, domain = 'leads') {
  const access = resolveCrmAccess(admin);
  const canView =
    domain === 'accounts'
      ? access.canViewAccounts
      : domain === 'contacts'
        ? access.canViewContacts
        : domain === 'opportunities'
          ? access.canViewOpportunities || access.canViewPipeline
          : access.canViewLeads;

  if (!admin || !canView) {
    return {
      mode: 'none',
      ownerAdminIds: [],
      teamIds: [],
      territoryIds: [],
      canView: false,
      stub: true,
      wave: domain === 'opportunities' ? 12 : 3,
    };
  }

  // Phase 20 — explicit team/territory/owner scopes fail-closed when membership empty
  const explicit = admin.crmScope;
  if (
    explicit &&
    (explicit.mode === 'territory' ||
      explicit.mode === 'team' ||
      explicit.mode === 'owner')
  ) {
    const territoryIds = Array.isArray(explicit.territoryIds)
      ? explicit.territoryIds.filter(Boolean)
      : [];
    const teamIds = Array.isArray(explicit.teamIds)
      ? explicit.teamIds.filter(Boolean)
      : [];
    const ownerAdminIds = Array.isArray(explicit.ownerAdminIds)
      ? explicit.ownerAdminIds.filter(Boolean)
      : [];

    if (explicit.mode === 'territory' && territoryIds.length === 0) {
      return {
        mode: 'none',
        ownerAdminIds: [],
        teamIds: [],
        territoryIds: [],
        canView: false,
        reason: 'territory_scope_empty_fail_closed',
        stub: false,
        wave: domain === 'opportunities' ? 20 : 3,
      };
    }
    if (explicit.mode === 'team' && teamIds.length === 0) {
      return {
        mode: 'none',
        ownerAdminIds: [],
        teamIds: [],
        territoryIds: [],
        canView: false,
        reason: 'team_scope_empty_fail_closed',
        stub: false,
        wave: domain === 'opportunities' ? 20 : 3,
      };
    }
    if (explicit.mode === 'owner' && ownerAdminIds.length === 0) {
      return {
        mode: 'none',
        ownerAdminIds: [],
        teamIds: [],
        territoryIds: [],
        canView: false,
        reason: 'owner_scope_empty_fail_closed',
        stub: false,
        wave: domain === 'opportunities' ? 20 : 3,
      };
    }

    return {
      mode: explicit.mode,
      ownerAdminIds: explicit.mode === 'owner' ? ownerAdminIds : null,
      teamIds: explicit.mode === 'team' ? teamIds : null,
      territoryIds: explicit.mode === 'territory' ? territoryIds : null,
      canView: true,
      stub: false,
      wave: domain === 'opportunities' ? 20 : 3,
    };
  }

  return {
    mode: 'all',
    ownerAdminIds: null,
    teamIds: null,
    territoryIds: null,
    canView: true,
    stub: true,
    wave: domain === 'opportunities' ? 12 : 3,
  };
}
