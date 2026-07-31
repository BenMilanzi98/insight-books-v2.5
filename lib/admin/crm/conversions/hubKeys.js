/**
 * Conversion hubs — permissions / search / cache key notes
 * (Phase 16 Wave 4 / Phase 20 Wave 4).
 * Thin contract only; UI stubs consume these keys.
 * Optional `/crm/closed-won/*` aliases → readiness / conversion queues.
 */

export const CRM_CONVERSION_HUB_ROUTES = Object.freeze({
  overview: '/insightbooks/crm/conversions/overview',
  queues: '/insightbooks/crm/conversions/queues',
  myWork: '/insightbooks/crm/conversions/my-work',
  detail: '/insightbooks/crm/conversions',
  reports: '/insightbooks/crm/conversion-reports',
  requests: '/insightbooks/crm/conversions/requests',
  /** Thin alias — same readiness / conversion queues, not a second domain */
  closedWonAlias: '/insightbooks/crm/closed-won',
  closedWonQueuesAlias: '/insightbooks/crm/closed-won/queues',
});

export const CRM_CONVERSION_PERMISSION_NOTES = Object.freeze({
  overview: 'canViewOpportunities || canView',
  queues: 'canViewOpportunities || canEditOpportunities',
  myWork: 'canViewOpportunities || canEditOpportunities',
  detail: 'canViewOpportunities',
  reports: 'canViewOpportunities || canExport',
  dqRecon: 'canRunReconciliation || isSuperAdmin',
  finalize: 'canEditOpportunities || isSuperAdmin',
});

export const CRM_CONVERSION_SEARCH_KEYS = Object.freeze([
  'crm.conversion.conversionNumber',
  'crm.conversion.requestNumber',
  'crm.conversion.opportunityNumber',
  'crm.conversion.tenantId',
  'crm.conversion.acceptanceId',
]);

export const CRM_CONVERSION_CACHE_KEYS = Object.freeze({
  overview: 'crm:conversion:overview:v1',
  report: 'crm:conversion:report:v1',
  recon: 'crm:conversion:recon:v1',
  inventZeroCacheForbidden: true,
});
