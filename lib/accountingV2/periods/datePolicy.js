/**
 * Phase 8 — date policy framework.
 *
 * Defines the financial date taxonomy and the server-side posting-date
 * policy evaluation (backdating, future-dating, lock date). Pure logic —
 * the resolver applies the outcome against canonical periods and permissions.
 */

import { toDateOnly, isoDate } from './periodGeneration.js';

/**
 * Financial date taxonomy (§13). One generic `date` field is never reused
 * for all meanings; each posting stores transaction and posting dates
 * separately, and document/due/settlement dates stay on the source.
 */
export const DATE_KINDS = Object.freeze({
  TRANSACTION_DATE: 'The date the business transaction economically occurred. Preserved on every journal (legacy `entryDate` / command transactionDate).',
  POSTING_DATE: 'The date the accounting effect enters the General Ledger. Determines financial year and accounting period. Server-validated.',
  DOCUMENT_DATE: 'The date on the source document. May differ from the posting date; never determines the period by itself.',
  DUE_DATE: 'The date payment falls due. Never determines the accounting period.',
  CREATED_DATE: 'System row-creation timestamp. Never a substitute for transaction or posting date.',
  SETTLEMENT_DATE: 'The date payment/settlement occurred — a separate accounting event from the original document.',
});

export const BACKDATING_POLICIES = Object.freeze({
  PERMISSION_AND_REASON: 'PERMISSION_AND_REASON',
  PERMISSION_ONLY: 'PERMISSION_ONLY',
  REJECT: 'REJECT',
});

export const FUTURE_DATING_POLICIES = Object.freeze({
  REJECT: 'REJECT',
  TOLERANCE: 'TOLERANCE',
  ALLOW_WITH_APPROVAL: 'ALLOW_WITH_APPROVAL',
});

/**
 * Evaluate the requested posting date against business date policy.
 * Does NOT consult periods — the resolver combines this with period status.
 *
 * @param {object} config calendar configuration (defaults applied by caller)
 * @param {object} params
 * @param {string} params.transactionDate ISO date
 * @param {string|null} [params.requestedPostingDate] ISO date
 * @param {Date} [params.now] injection point for tests
 * @returns {{
 *  resolvedPostingDate: string,
 *  transactionDate: string,
 *  today: string,
 *  isBackdated: boolean,
 *  isFutureDated: boolean,
 *  violations: Array<{code: string, message: string}>,
 *  requiresBackdatingPermission: boolean,
 *  requiresBackdatingReason: boolean,
 *  requiresFutureDatingPermission: boolean,
 * }}
 */
export function evaluatePostingDate(config, params) {
  const violations = [];
  const txDate = toDateOnly(params.transactionDate);
  if (!txDate) violations.push({ code: 'INVALID_TRANSACTION_DATE', message: 'Transaction date is not a valid date.' });
  const posting = toDateOnly(params.requestedPostingDate ?? params.transactionDate);
  if (!posting) violations.push({ code: 'INVALID_POSTING_DATE', message: 'Posting date is not a valid date.' });
  if (violations.length > 0) {
    return { resolvedPostingDate: null, transactionDate: null, today: null, isBackdated: false, isFutureDated: false, violations, requiresBackdatingPermission: false, requiresBackdatingReason: false, requiresFutureDatingPermission: false };
  }

  const today = toDateOnly(params.now ?? new Date());
  const isBackdated = posting.getTime() < today.getTime();
  const isFutureDated = posting.getTime() > today.getTime();

  // Lock date: normal posting on or before the configured lock date is refused.
  const lockDate = config.lockDate ? toDateOnly(config.lockDate) : null;
  if (lockDate && posting.getTime() <= lockDate.getTime()) {
    violations.push({
      code: 'LOCK_DATE',
      message: `Posting date ${isoDate(posting)} is on or before the lock date ${isoDate(lockDate)}.`,
    });
  }

  let requiresBackdatingPermission = false;
  let requiresBackdatingReason = false;
  if (isBackdated) {
    const policy = config.backdatingPolicy ?? BACKDATING_POLICIES.PERMISSION_AND_REASON;
    if (policy === BACKDATING_POLICIES.REJECT) {
      violations.push({ code: 'BACKDATING_REJECTED', message: 'Backdated posting is not allowed by business policy.' });
    } else {
      requiresBackdatingPermission = true;
      requiresBackdatingReason = policy === BACKDATING_POLICIES.PERMISSION_AND_REASON;
    }
  }

  let requiresFutureDatingPermission = false;
  if (isFutureDated) {
    const policy = config.futureDatingPolicy ?? FUTURE_DATING_POLICIES.TOLERANCE;
    const toleranceDays = Number(config.futureToleranceDays ?? 31);
    const daysAhead = Math.round((posting.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (policy === FUTURE_DATING_POLICIES.REJECT) {
      violations.push({ code: 'FUTURE_DATING_REJECTED', message: 'Future-dated posting is not allowed by business policy.' });
    } else if (daysAhead > toleranceDays) {
      violations.push({
        code: 'FUTURE_DATE_BEYOND_TOLERANCE',
        message: `Posting date is ${daysAhead} days in the future; policy allows at most ${toleranceDays}.`,
      });
    } else if (policy === FUTURE_DATING_POLICIES.ALLOW_WITH_APPROVAL) {
      requiresFutureDatingPermission = true;
    }
  }

  return {
    resolvedPostingDate: isoDate(posting),
    transactionDate: isoDate(txDate),
    today: isoDate(today),
    isBackdated,
    isFutureDated,
    violations,
    requiresBackdatingPermission,
    requiresBackdatingReason,
    requiresFutureDatingPermission,
  };
}
