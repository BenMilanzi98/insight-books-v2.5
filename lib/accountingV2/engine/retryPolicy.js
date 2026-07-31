/**
 * Posting engine — retry policy (Phase 4).
 *
 * Failures are classified once, at the point of failure:
 *   RETRYABLE     — transient infrastructure conditions (deadlock, connection
 *                   loss, lock/pool timeout). A retry reuses the same
 *                   idempotency key, event identity and command hash.
 *   NON_RETRYABLE — business rejections (missing mapping, closed period,
 *                   unbalanced journal, invalid approval, conflicting
 *                   idempotency, cross-business reference). Retrying without
 *                   correcting the cause is pointless and is refused.
 *
 * Retries are capped; each attempt is recorded in AcctV2PostingAttempt.
 */

import { AccountingV2Error, classifyError } from '../domain/errors.js';

/** Maximum posting attempts per accounting event (initial + retries). */
export const MAX_POSTING_ATTEMPTS = 5;

/** Base backoff in ms; attempt n waits base * 2^(n-1), capped. */
export const RETRY_BACKOFF_BASE_MS = 500;
export const RETRY_BACKOFF_MAX_MS = 30_000;

/**
 * @param {unknown} error
 * @returns {{retryable: boolean, code: string, safeMessage: string}}
 */
export function classifyPostingFailure(error) {
  if (error instanceof AccountingV2Error) {
    return { retryable: error.retryable, code: error.code, safeMessage: error.userMessage };
  }
  const { retryable, code } = classifyError(error);
  return {
    retryable,
    code,
    safeMessage: retryable
      ? 'A temporary database condition interrupted the posting. It is safe to retry.'
      : 'The posting failed. See the recorded failure code.',
  };
}

/**
 * Whether another attempt is permitted.
 * @param {{retryable: boolean}} classification
 * @param {number} attemptCount attempts already recorded
 */
export function canRetry(classification, attemptCount) {
  return classification.retryable && attemptCount < MAX_POSTING_ATTEMPTS;
}

/** @param {number} attemptNumber 1-based */
export function backoffMs(attemptNumber) {
  return Math.min(RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attemptNumber - 1), RETRY_BACKOFF_MAX_MS);
}
