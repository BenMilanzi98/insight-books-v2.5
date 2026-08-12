/** Phase 10 — Bank Reconciliation domain enums. */

export const BankRecStatus = Object.freeze({
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  REOPENED: 'REOPENED',
  REVERSED: 'REVERSED',
});

export const StatementMatchingStatus = Object.freeze({
  UNMATCHED: 'UNMATCHED',
  SUGGESTED: 'SUGGESTED',
  MATCHED: 'MATCHED',
  PARTIAL: 'PARTIAL',
  EXCLUDED: 'EXCLUDED',
  CLASSIFIED: 'CLASSIFIED',
});

export const MatchType = Object.freeze({
  ONE_TO_ONE: 'ONE_TO_ONE',
  ONE_TO_MANY: 'ONE_TO_MANY',
  MANY_TO_ONE: 'MANY_TO_ONE',
  MANY_TO_MANY: 'MANY_TO_MANY',
  PARTIAL: 'PARTIAL',
});

export const MatchConfidence = Object.freeze({
  EXACT: 'EXACT',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  CONFLICTED: 'CONFLICTED',
  MANUAL: 'MANUAL',
});

export const MatchStatus = Object.freeze({
  SUGGESTED: 'SUGGESTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  REVERSED: 'REVERSED',
});

export const ImportBatchStatus = Object.freeze({
  PENDING: 'PENDING',
  PREVIEWED: 'PREVIEWED',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
});

export const OutstandingItemType = Object.freeze({
  OUTSTANDING_PAYMENT: 'OUTSTANDING_PAYMENT',
  DEPOSIT_IN_TRANSIT: 'DEPOSIT_IN_TRANSIT',
  OTHER: 'OTHER',
});

export const AdjustmentType = Object.freeze({
  BANK_CHARGE: 'BANK_CHARGE',
  INTEREST_INCOME: 'INTEREST_INCOME',
  TRANSFER: 'TRANSFER',
  MANUAL_JOURNAL: 'MANUAL_JOURNAL',
  RETURNED_PAYMENT: 'RETURNED_PAYMENT',
});

export const StatementClassification = Object.freeze({
  BANK_CHARGE: 'BANK_CHARGE',
  INTEREST: 'INTEREST',
  TRANSFER: 'TRANSFER',
  DIRECT_DEBIT: 'DIRECT_DEBIT',
  DIRECT_DEPOSIT: 'DIRECT_DEPOSIT',
  MOBILE_MONEY_SETTLEMENT: 'MOBILE_MONEY_SETTLEMENT',
  RETURNED_PAYMENT: 'RETURNED_PAYMENT',
  UNKNOWN: 'UNKNOWN',
});

/** Confidence rank — higher is better for auto-match gating. */
export const CONFIDENCE_RANK = Object.freeze({
  CONFLICTED: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  EXACT: 4,
  MANUAL: 5,
});

export const RECONCILABLE_PAYMENT_TYPES = Object.freeze(['Bank', 'Mobile Money', 'Cash']);

export const COMPLETED_STATUSES = Object.freeze([BankRecStatus.COMPLETED]);
export const OPEN_RECON_STATUSES = Object.freeze([
  BankRecStatus.DRAFT,
  BankRecStatus.IN_PROGRESS,
  BankRecStatus.IN_REVIEW,
  BankRecStatus.APPROVED,
  BankRecStatus.REOPENED,
]);
