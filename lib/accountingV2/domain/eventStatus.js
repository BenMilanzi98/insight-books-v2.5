/**
 * Accounting V2 — event registry status machine (Phase 4).
 *
 * The persisted status values are unchanged from Phase 2 (backward compatible).
 * This module adds the enforced transition map so no status change can skip a
 * required control. Conceptual mapping to the specification vocabulary:
 *   RECEIVED       → RECEIVED / VALIDATING / VALIDATED (pre-claim stages are in-memory)
 *   IN_PROGRESS    → PROCESSING / WAITING_FOR_APPROVAL
 *   POSTED         → POSTED
 *   SHADOWED       → SHADOW_POSTED
 *   FAILED         → FAILED_RETRYABLE (row `failureRetryable=true`) / FAILED_FINAL
 *   REJECTED       → DUPLICATE / CANCELLED (non-processable)
 *   SUPERSEDED     → replaced by a newer event version
 */

import { EventRegistryStatus } from './enums.js';
import { AccountingValidationError } from './errors.js';

/** Permitted transitions (from → to[]). Terminal statuses have controlled exits only. */
export const EVENT_STATUS_TRANSITIONS = Object.freeze({
  [EventRegistryStatus.RECEIVED]: [
    EventRegistryStatus.IN_PROGRESS,
    EventRegistryStatus.SHADOWED,
    EventRegistryStatus.POSTED, // single-transaction claim+post
    EventRegistryStatus.FAILED,
    EventRegistryStatus.REJECTED,
    EventRegistryStatus.SUPERSEDED,
  ],
  [EventRegistryStatus.IN_PROGRESS]: [
    EventRegistryStatus.POSTED,
    EventRegistryStatus.SHADOWED,
    EventRegistryStatus.FAILED,
    EventRegistryStatus.REJECTED,
  ],
  [EventRegistryStatus.FAILED]: [
    // retry re-opens the same identity
    EventRegistryStatus.RECEIVED,
    EventRegistryStatus.REJECTED,
    EventRegistryStatus.SUPERSEDED,
  ],
  [EventRegistryStatus.REJECTED]: [
    EventRegistryStatus.RECEIVED, // authorized re-submission after correction
    EventRegistryStatus.SUPERSEDED,
  ],
  [EventRegistryStatus.SHADOWED]: [
    EventRegistryStatus.SUPERSEDED,
  ],
  [EventRegistryStatus.POSTED]: [
    // a posted event never becomes unposted; reversal is a NEW event
  ],
  [EventRegistryStatus.SUPERSEDED]: [],
});

/**
 * Assert a status transition is permitted. Same-status writes are idempotent no-ops.
 * @param {string} from
 * @param {string} to
 */
export function assertEventStatusTransition(from, to) {
  if (from === to) return;
  const allowed = EVENT_STATUS_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AccountingValidationError(
      `Accounting event status cannot change from ${from} to ${to}.`,
      [{ path: 'status', message: `illegal transition ${from} → ${to}` }]
    );
  }
}

/** Statuses that mean "an active accounting effect (or claim) exists". */
export const ACTIVE_EVENT_STATUSES = Object.freeze([
  EventRegistryStatus.RECEIVED,
  EventRegistryStatus.IN_PROGRESS,
  EventRegistryStatus.POSTED,
  EventRegistryStatus.SHADOWED,
]);

/** Terminal statuses that a retry may re-open. */
export const RETRYABLE_EVENT_STATUSES = Object.freeze([
  EventRegistryStatus.FAILED,
]);
