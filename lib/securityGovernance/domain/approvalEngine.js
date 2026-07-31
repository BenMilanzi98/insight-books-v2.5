/**
 * Approval Policy Engine — versioned policies, checksums, stale invalidation.
 * Exact decimal thresholds via minor units (bigint).
 */

import { createHash } from 'crypto';
import {
  ApprovalDecisionType,
  ApprovalMode,
  ApprovalRequestStatus,
} from './enums.js';
import {
  ApprovalChecksumMismatchError,
  ApprovalRequestExpiredError,
  ApprovalRequestInvalidatedError,
  SelfApprovalNotAllowedError,
} from './errors.js';
import { evaluateMakerChecker } from './segregationOfDuties.js';

/**
 * Canonical payload checksum for stale-approval detection.
 */
export function computeApprovalPayloadChecksum(payload) {
  const normalized = canonicalize(payload);
  return createHash('sha256').update(normalized).digest('hex');
}

function canonicalize(value) {
  if (value == null) return 'null';
  if (typeof value === 'bigint') return `n:${value.toString()}`;
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

/**
 * Compare amount threshold using minor units (exact).
 * @param {bigint|string|number} amountMinor
 * @param {bigint|string|number} thresholdMinor
 * @param {string} currency
 * @param {string} thresholdCurrency
 */
export function exceedsThreshold(amountMinor, thresholdMinor, currency, thresholdCurrency) {
  if (currency && thresholdCurrency && currency !== thresholdCurrency) {
    throw new Error('Currency conversion policy required before cross-currency threshold compare.');
  }
  const a = BigInt(amountMinor ?? 0);
  const t = BigInt(thresholdMinor ?? 0);
  return a >= t;
}

/**
 * Resolve whether approval is required for an action under a policy version.
 */
export function resolveApprovalRequirement(policyVersion, context = {}) {
  if (!policyVersion || policyVersion.status !== 'PUBLISHED') {
    return { required: false, reason: 'NO_PUBLISHED_POLICY' };
  }
  const amountMinor = context.amountMinor ?? 0;
  const threshold = policyVersion.thresholdAmountMinor ?? 0;
  const currency = context.currency || policyVersion.currency || 'MWK';
  if (threshold > 0 && !exceedsThreshold(amountMinor, threshold, currency, policyVersion.currency || currency)) {
    return { required: false, reason: 'BELOW_THRESHOLD' };
  }
  return {
    required: true,
    reason: 'POLICY_MATCH',
    mode: policyVersion.approvalMode || ApprovalMode.SEQUENTIAL,
    minimumApprovers: policyVersion.minimumApprovers || 1,
    selfApprovalAllowed: Boolean(policyVersion.selfApprovalAllowed),
    mfaRequired: Boolean(policyVersion.mfaRequired),
    expiryHours: policyVersion.expiryHours || 72,
    routeSnapshot: policyVersion.routeSnapshot || [],
  };
}

/**
 * Build a new approval request record (pure).
 */
export function buildApprovalRequest({
  businessId,
  policyId,
  policyVersion,
  sourceModule,
  sourceType,
  sourceId,
  sourceNumber,
  action,
  amountMinor,
  currency,
  riskLevel,
  requestedBy,
  payload,
  correlationId,
} = {}) {
  const payloadChecksum = computeApprovalPayloadChecksum(payload);
  const requirement = resolveApprovalRequirement(policyVersion, {
    amountMinor,
    currency,
  });
  const expiryHours = requirement.expiryHours || 72;
  const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();

  return {
    businessId,
    policyId,
    policyVersion: policyVersion?.version || 1,
    sourceModule,
    sourceType,
    sourceId,
    sourceNumber: sourceNumber || null,
    action,
    amountMinor: String(amountMinor ?? 0),
    currency: currency || 'MWK',
    riskLevel: riskLevel || 'MODERATE',
    status: ApprovalRequestStatus.SUBMITTED,
    currentStep: 0,
    requestedBy,
    requestedAt: new Date().toISOString(),
    expiresAt,
    payloadChecksum,
    sourceVersion: payload?.version || payload?.updatedAt || null,
    correlationId: correlationId || null,
    routeSnapshot: requirement.routeSnapshot || [],
    requirement,
    neverPostsToGl: true,
  };
}

/**
 * Apply an immutable decision; returns updated request status (pure).
 */
export function applyApprovalDecision(request, decisionInput = {}) {
  if (!request) throw new Error('Approval request required.');
  if (
    [
      ApprovalRequestStatus.APPROVED,
      ApprovalRequestStatus.REJECTED,
      ApprovalRequestStatus.CANCELLED,
      ApprovalRequestStatus.EXPIRED,
      ApprovalRequestStatus.INVALIDATED,
      ApprovalRequestStatus.SUPERSEDED,
      ApprovalRequestStatus.EXECUTED,
    ].includes(request.status)
  ) {
    throw new ApprovalRequestInvalidatedError(`Request is already ${request.status}.`);
  }
  if (request.expiresAt && new Date(request.expiresAt).getTime() < Date.now()) {
    throw new ApprovalRequestExpiredError();
  }

  const currentChecksum = decisionInput.currentPayloadChecksum || request.payloadChecksum;
  if (currentChecksum !== request.payloadChecksum) {
    throw new ApprovalChecksumMismatchError();
  }

  const sod = evaluateMakerChecker({
    creatorId: request.requestedBy,
    approverId: decisionInput.approverId,
    selfApprovalAllowed: request.requirement?.selfApprovalAllowed || request.selfApprovalAllowed,
  });
  if (sod.conflict && decisionInput.decision === ApprovalDecisionType.APPROVE) {
    throw new SelfApprovalNotAllowedError(sod.message);
  }

  const decision = {
    step: request.currentStep ?? 0,
    approverId: decisionInput.approverId,
    effectiveApproverId: decisionInput.effectiveApproverId || decisionInput.approverId,
    delegatedFromId: decisionInput.delegatedFromId || null,
    decision: decisionInput.decision,
    reason: decisionInput.reason || null,
    decisionAt: new Date().toISOString(),
    sourceChecksum: request.payloadChecksum,
    requestId: decisionInput.requestId || null,
    correlationId: decisionInput.correlationId || request.correlationId,
    immutable: true,
  };

  let status = request.status;
  if (decisionInput.decision === ApprovalDecisionType.REJECT) {
    status = ApprovalRequestStatus.REJECTED;
  } else if (decisionInput.decision === ApprovalDecisionType.RETURN_FOR_CORRECTION) {
    status = ApprovalRequestStatus.CANCELLED;
  } else if (decisionInput.decision === ApprovalDecisionType.APPROVE) {
    const min = request.requirement?.minimumApprovers || 1;
    const prior = (request.decisions || []).filter((d) => d.decision === ApprovalDecisionType.APPROVE)
      .length;
    const approvedCount = prior + 1;
    const mode = request.requirement?.mode || ApprovalMode.SEQUENTIAL;
    if (mode === ApprovalMode.ANY_ONE || approvedCount >= min) {
      status = ApprovalRequestStatus.APPROVED;
    } else {
      status = ApprovalRequestStatus.PARTIALLY_APPROVED;
    }
  }

  return {
    request: {
      ...request,
      status,
      currentStep: status === ApprovalRequestStatus.APPROVED ? request.currentStep : (request.currentStep || 0) + 1,
      decisions: [...(request.decisions || []), decision],
    },
    decision,
  };
}

/**
 * Invalidate when source payload changes.
 */
export function invalidateIfStale(request, currentPayload) {
  const checksum = computeApprovalPayloadChecksum(currentPayload);
  if (checksum !== request.payloadChecksum) {
    return {
      ...request,
      status: ApprovalRequestStatus.INVALIDATED,
      invalidatedAt: new Date().toISOString(),
      invalidationReason: 'SOURCE_PAYLOAD_CHANGED',
      previousChecksum: request.payloadChecksum,
      newChecksum: checksum,
    };
  }
  return request;
}
