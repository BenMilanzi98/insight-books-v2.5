/** Phase 10 — bankReconciliation.* permission keys. */

export const BANK_RECON_PERMISSIONS = Object.freeze({
  VIEW: 'bankReconciliation.view',
  CONFIGURE: 'bankReconciliation.configure',
  IMPORT: 'bankReconciliation.import',
  MATCH: 'bankReconciliation.match',
  ADJUST: 'bankReconciliation.adjust',
  REVIEW: 'bankReconciliation.review',
  APPROVE: 'bankReconciliation.approve',
  COMPLETE: 'bankReconciliation.complete',
  REOPEN: 'bankReconciliation.reopen',
  REVERSE: 'bankReconciliation.reverse',
  EXPORT: 'bankReconciliation.export',
});

export const BANK_RECON_PERMISSION_ACTIONS = Object.freeze([
  'view',
  'configure',
  'import',
  'match',
  'adjust',
  'review',
  'approve',
  'complete',
  'reopen',
  'reverse',
  'export',
]);
