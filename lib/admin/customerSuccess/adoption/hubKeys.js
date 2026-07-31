/**
 * Adoption hubs — routes / permissions / search notes (Phase 19 Wave 4).
 */

export const ADOPTION_HUB_ROUTES = Object.freeze({
  overview: '/insightbooks/customer-success/adoption',
  myWork: '/insightbooks/customer-success/adoption/my-work',
  team: '/insightbooks/customer-success/adoption/team',
  portfolio: '/insightbooks/customer-success/adoption/portfolio',
  queues: '/insightbooks/customer-success/adoption/queues',
  attention: '/insightbooks/customer-success/adoption/attention',
  dormancy: '/insightbooks/customer-success/adoption/dormancy',
  requests: '/insightbooks/customer-success/adoption/requests',
  plans: '/insightbooks/customer-success/adoption/plans',
  reports: '/insightbooks/customer-success/adoption/reports',
});

export const ADOPTION_PERMISSION_NOTES_WAVE4 = Object.freeze({
  overview: 'customerSuccess.read',
  myWork: 'customerSuccess.read (owner-scoped)',
  queues: 'customerSuccess.read',
  reports: 'customerSuccess.read + manageCases for export',
  dqRecon: 'customerSuccess.read || Super Admin',
});

export const ADOPTION_SEARCH_KEYS = Object.freeze([
  'cs.adoption.planNumber',
  'cs.adoption.requestNumber',
  'cs.adoption.expansionHandoffId',
]);
