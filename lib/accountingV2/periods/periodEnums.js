/**
 * Phase 8 — Financial Calendar domain enumerations and transition rules.
 * Single source for period/year lifecycle values; do not re-declare elsewhere.
 */

export const FinancialYearStatus = Object.freeze({
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
  ARCHIVED: 'ARCHIVED',
});

export const AccountingPeriodStatus = Object.freeze({
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
});

/** Allowed period status transitions. CLOSED never goes directly to OPEN. */
export const PERIOD_TRANSITIONS = Object.freeze({
  DRAFT: ['OPEN'],
  OPEN: ['CLOSING'],
  CLOSING: ['OPEN', 'REOPENED', 'CLOSED'], // OPEN/REOPENED = close cancelled
  CLOSED: ['REOPENED'],
  REOPENED: ['CLOSING'],
});

export const PeriodStatusAction = Object.freeze({
  CREATE: 'CREATE',
  OPEN: 'OPEN',
  BEGIN_CLOSE: 'BEGIN_CLOSE',
  CANCEL_CLOSE: 'CANCEL_CLOSE',
  CLOSE: 'CLOSE',
  REQUEST_REOPEN: 'REQUEST_REOPEN',
  APPROVE_REOPEN: 'APPROVE_REOPEN',
  REJECT_REOPEN: 'REJECT_REOPEN',
  REOPEN: 'REOPEN',
  BEGIN_RECLOSE: 'BEGIN_RECLOSE',
  RECLOSE: 'RECLOSE',
  ARCHIVE: 'ARCHIVE',
  LOCK_DATE_CHANGED: 'LOCK_DATE_CHANGED',
  MIGRATED: 'MIGRATED',
});

export const CloseRunStatus = Object.freeze({
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
});

export const CloseTaskStatus = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PASSED: 'PASSED',
  PASSED_WITH_WARNING: 'PASSED_WITH_WARNING',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  WAIVED: 'WAIVED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

/** Terminal task states that satisfy a close-run submission. */
export const TASK_TERMINAL_OK = Object.freeze([
  CloseTaskStatus.PASSED,
  CloseTaskStatus.PASSED_WITH_WARNING,
  CloseTaskStatus.WAIVED,
  CloseTaskStatus.NOT_APPLICABLE,
]);

export const CloseExceptionStatus = Object.freeze({
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACCEPTED_TEMPORARILY: 'ACCEPTED_TEMPORARILY',
  ACCEPTED_FOR_CLOSE: 'ACCEPTED_FOR_CLOSE',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
});

export const ReopenRequestStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  CANCELLED: 'CANCELLED',
});

/** Business readiness statuses for strict period enforcement. */
export const PeriodReadinessStatus = Object.freeze({
  READY: 'READY',
  READY_WITH_WARNINGS: 'READY_WITH_WARNINGS',
  REQUIRES_PERIOD_MAPPING: 'REQUIRES_PERIOD_MAPPING',
  REQUIRES_CALENDAR_CONFIGURATION: 'REQUIRES_CALENDAR_CONFIGURATION',
  REQUIRES_HISTORICAL_REPAIR: 'REQUIRES_HISTORICAL_REPAIR',
  BLOCKED: 'BLOCKED',
});

/**
 * @param {string} current @param {string} next
 * @returns {boolean} whether the period transition is allowed
 */
export function isPeriodTransitionAllowed(current, next) {
  return (PERIOD_TRANSITIONS[current] ?? []).includes(next);
}
