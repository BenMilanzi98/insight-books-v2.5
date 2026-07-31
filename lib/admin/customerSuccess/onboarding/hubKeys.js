/**
 * Onboarding hubs — routes / permissions / search / cache notes.
 * PRD Phase 21 Wave 4 (tree phase-17 alias).
 */

export const ONBOARDING_HUB_ROUTES = Object.freeze({
  overview: '/insightbooks/customer-success/onboarding',
  myWork: '/insightbooks/customer-success/onboarding/my-work',
  team: '/insightbooks/customer-success/onboarding/team',
  calendar: '/insightbooks/customer-success/onboarding/calendar',
  queues: '/insightbooks/customer-success/onboarding/queues',
  requests: '/insightbooks/customer-success/onboarding/requests',
  projects: '/insightbooks/customer-success/onboarding/projects',
  templates: '/insightbooks/customer-success/onboarding/templates',
  reports: '/insightbooks/customer-success/onboarding/reports',
});

export const ONBOARDING_PERMISSION_NOTES = Object.freeze({
  overview: 'customerSuccess.read',
  myWork: 'customerSuccess.read (owner-scoped)',
  queues: 'customerSuccess.read',
  reports: 'customerSuccess.read + manageCases for export',
  dqRecon: 'customerSuccess.read || Super Admin',
});

export const ONBOARDING_SEARCH_KEYS = Object.freeze([
  'cs.onboarding.projectNumber',
  'cs.onboarding.requestNumber',
]);
