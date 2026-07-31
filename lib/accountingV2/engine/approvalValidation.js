/**
 * Posting engine — approval validation (Phase 4).
 *
 * The legacy codebase has no dedicated approval framework beyond role checks,
 * so the engine defines the approval contract natively:
 *   - approval requirements are resolved server-side from event type, amount
 *     and business policy — never from the frontend;
 *   - the approval is recorded on the source (journal row `approvedById`) or
 *     the opening-balance batch by an authorized approver;
 *   - separation of duties: the approver must differ from the creator where
 *     the policy requires it;
 *   - the engine re-validates approval at posting time inside the transaction —
 *     an approval supplied only in the request body is never trusted.
 */

import { ApprovalRequiredError, ApprovalInvalidError } from '../domain/errors.js';
import { AccountingEventType } from '../domain/enums.js';

/** Events that ALWAYS require approval before posting. */
const ALWAYS_REQUIRE_APPROVAL = new Set([
  AccountingEventType.ADJUSTMENT_POSTED,
  AccountingEventType.OPENING_BALANCE_POSTED,
  AccountingEventType.OPENING_STOCK_POSTED,
  AccountingEventType.REVERSAL_POSTED,
  AccountingEventType.HISTORICAL_REPAIR_POSTED,
]);

/** Manual journals above this transaction-currency amount (minor units) require approval. */
const DEFAULT_MANUAL_JOURNAL_APPROVAL_THRESHOLD_MINOR = 0; // approve everything by default

/**
 * @typedef {object} ApprovalRequirement
 * @property {boolean} required
 * @property {boolean} separationOfDuties approver must differ from initiator
 * @property {string} reason
 */

/**
 * Resolve whether an event requires approval.
 * @param {object} params
 * @param {string} params.eventType
 * @param {number|null} [params.amountMinor]
 * @param {boolean} [params.backdated]
 * @param {string} [params.periodStatus]
 * @returns {ApprovalRequirement}
 */
export function resolveApprovalRequirement(params) {
  if (ALWAYS_REQUIRE_APPROVAL.has(params.eventType)) {
    return Object.freeze({
      required: true,
      separationOfDuties: true,
      reason: `${params.eventType} always requires approval`,
    });
  }
  if (params.eventType === AccountingEventType.MANUAL_JOURNAL_POSTED) {
    const threshold = DEFAULT_MANUAL_JOURNAL_APPROVAL_THRESHOLD_MINOR;
    const required = (params.amountMinor ?? 0) >= threshold;
    return Object.freeze({
      required,
      separationOfDuties: true,
      reason: required ? 'manual journal policy' : 'below approval threshold',
    });
  }
  if (params.backdated || params.periodStatus === 'REOPENED') {
    return Object.freeze({
      required: true,
      separationOfDuties: true,
      reason: 'backdated or reopened-period posting',
    });
  }
  return Object.freeze({ required: false, separationOfDuties: false, reason: 'not required by policy' });
}

/**
 * Validate a recorded approval against the requirement.
 * @param {object} params
 * @param {import('../domain/accountingContext.js').AccountingContext} params.context
 * @param {ApprovalRequirement} params.requirement
 * @param {{approvedById: string|null, approvedAt: Date|string|null, createdById?: string|null}|null} params.approval
 *        approval facts loaded from the SOURCE row inside the posting transaction
 * @param {string|null} params.initiatorId
 */
export function validateApproval(params) {
  const { context, requirement, approval, initiatorId } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };

  if (!requirement.required) return;

  if (!approval?.approvedById) {
    throw new ApprovalRequiredError({ ...ids, diagnostic: { reason: requirement.reason } });
  }
  if (!approval.approvedAt) {
    throw new ApprovalInvalidError('Approval is missing its approval timestamp.', ids);
  }
  if (requirement.separationOfDuties) {
    const creator = approval.createdById ?? initiatorId;
    if (creator && approval.approvedById === creator) {
      throw new ApprovalInvalidError(
        'Separation of duties: the approver must be different from the creator.',
        { ...ids, diagnostic: { approvedById: approval.approvedById } }
      );
    }
  }
}
