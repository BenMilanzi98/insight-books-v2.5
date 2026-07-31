/**
 * Training hubs — routes / permissions / search / cache notes (Phase 22 Wave 4).
 */

export const TRAINING_HUB_ROUTES = Object.freeze({
  overview: '/insightbooks/customer-success/training',
  myWork: '/insightbooks/customer-success/training/my-work',
  team: '/insightbooks/customer-success/training/team',
  calendar: '/insightbooks/customer-success/training/calendar',
  queues: '/insightbooks/customer-success/training/queues',
  atRisk: '/insightbooks/customer-success/training/at-risk',
  completion: '/insightbooks/customer-success/training/completion',
  requests: '/insightbooks/customer-success/training/requests',
  programs: '/insightbooks/customer-success/training/programs',
  reports: '/insightbooks/customer-success/training/reports',
});

export const TRAINING_PERMISSION_NOTES = Object.freeze({
  overview: 'customerSuccess.read',
  myWork: 'customerSuccess.read (owner-scoped)',
  queues: 'customerSuccess.read',
  reports: 'customerSuccess.read + manageCases for export',
  dqRecon: 'customerSuccess.read || Super Admin',
});

export const TRAINING_SEARCH_KEYS = Object.freeze([
  'cs.training.programNumber',
  'cs.training.requestNumber',
  'cs.training.certificateNumber',
]);
