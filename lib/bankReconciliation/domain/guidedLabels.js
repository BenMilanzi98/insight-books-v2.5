import { RECONCILABLE_PAYMENT_TYPES, StatementMatchingStatus } from './enums.js';

export function isGuidedReconcilableAccountType(accountType) {
  return RECONCILABLE_PAYMENT_TYPES.includes(accountType);
}

/** Guide §5 statuses for statement rows */
export function guidedStatementStatusLabel(matchingStatus) {
  if (matchingStatus === StatementMatchingStatus.MATCHED) return 'Matched';
  if (matchingStatus === StatementMatchingStatus.CLASSIFIED) return 'Matched';
  return 'Unmatched bank';
}

export function guidedOutstandingLabel() {
  return 'Outstanding';
}
