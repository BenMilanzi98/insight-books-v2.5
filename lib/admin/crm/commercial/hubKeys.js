/**
 * Commercial hubs — permissions / search / cache key notes (Phase 15 Wave 4).
 * Thin contract only; UI stubs consume these keys.
 */

export const CRM_COMMERCIAL_HUB_ROUTES = Object.freeze({
  overview: '/insightbooks/crm/commercial/overview',
  myWork: '/insightbooks/crm/commercial/my-work',
  approvals: '/insightbooks/crm/commercial-approvals',
  expiring: '/insightbooks/crm/commercial/expiring',
  responses: '/insightbooks/crm/commercial/responses',
  reports: '/insightbooks/crm/commercial-reports',
});

/** Permission notes (resolve via resolveCrmAccess — Super Admin bypass). */
export const CRM_COMMERCIAL_PERMISSION_NOTES = Object.freeze({
  overview: 'canViewOpportunities || canView',
  myWork: 'canViewOpportunities || canEditOpportunities',
  approvals: 'canEditOpportunities || canExport (SoD decide at API)',
  expiring: 'canViewOpportunities',
  responses: 'canViewOpportunities',
  reports: 'canViewOpportunities || canExport',
  handoff: 'canEditOpportunities',
  dqRecon: 'canRunReconciliation || isSuperAdmin',
});

/** Search index subject keys (future FTS) — do not invent hits. */
export const CRM_COMMERCIAL_SEARCH_KEYS = Object.freeze([
  'crm.commercial.documentNumber',
  'crm.commercial.proposalRequestNumber',
  'crm.commercial.accountName',
  'crm.commercial.opportunityNumber',
  'crm.commercial.title',
]);

/** Cache key prefixes — invalidate on issue/accept/handoff; never cache fabricated KPIs. */
export const CRM_COMMERCIAL_CACHE_KEYS = Object.freeze({
  overview: 'crm:commercial:overview:v1',
  report: 'crm:commercial:report:v1',
  readiness: 'crm:commercial:closed-won-readiness:v1',
  handoff: 'crm:commercial:phase16-handoff:v1',
  /** Honesty: UNAVAILABLE reports must not be cached as zero KPIs */
  inventZeroCacheForbidden: true,
});
