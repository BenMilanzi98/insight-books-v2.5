/**
 * Phase 17 — Unblock Request aggregate + mock MRA status query.
 * Approval alone does not restore Terminal. HTTP 200 ≠ clearance.
 */

import crypto from 'crypto';
import {
  getMraBlockUnblockContractDecision,
  RESTRICTION_CONTRACT_STATUS,
  getReasonMeta,
} from './restrictionRegistries.js';
import { RestrictionErrors } from './restrictionErrors.js';
import { clearRestriction, listActiveRestrictions } from './restrictionService.js';
import { runPostUnblockRevalidation } from './revalidationService.js';
import { queryMockUnblockStatus } from './mockMraBlockUnblockServer.js';

export const UNBLOCK_REQUEST_STATE = Object.freeze({
  DRAFT: 'DRAFT',
  EVIDENCE_PENDING: 'EVIDENCE_PENDING',
  APPROVAL_PENDING: 'APPROVAL_PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  MRA_REVIEW_PENDING: 'MRA_REVIEW_PENDING',
  CLEARANCE_REPORTED: 'CLEARANCE_REPORTED',
  CLEARANCE_REJECTED: 'CLEARANCE_REJECTED',
  REVALIDATION_PENDING: 'REVALIDATION_PENDING',
  REVALIDATING: 'REVALIDATING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

const MEMORY_REQUESTS = new Map();

function reqKey(tenantId, businessId) {
  return `${tenantId}:${businessId}`;
}

export function __resetUnblockRequestsForTests() {
  MEMORY_REQUESTS.clear();
}

export function createUnblockRequest({
  tenantId,
  businessId,
  terminalId = null,
  environment = 'SANDBOX',
  restriction,
  requestedBy,
  reason = '',
  supportingEvidence = {},
  mraSupportReference = null,
} = {}) {
  if (!restriction?.id) {
    throw RestrictionErrors.operationBlocked({ message: 'Restriction required for Unblock Request.' });
  }
  const meta = getReasonMeta(restriction.reasonCode);
  if (meta.clearAuthority === 'MRA' && !mraSupportReference && !supportingEvidence.mraSupportReference) {
    // Evidence may still be pending — allow draft
  }

  const list = MEMORY_REQUESTS.get(reqKey(tenantId, businessId)) || [];
  const active = list.find(
    (r) =>
      r.restrictionId === restriction.id &&
      !['COMPLETED', 'CANCELLED', 'REJECTED', 'CLEARANCE_REJECTED'].includes(r.state)
  );
  if (active) {
    return { request: active, created: false, duplicated: true };
  }

  const request = {
    id: crypto.randomUUID(),
    tenantId,
    businessId,
    terminalId: terminalId || restriction.terminalId,
    environment,
    restrictionId: restriction.id,
    sourceType: restriction.sourceType,
    reasonCode: restriction.reasonCode,
    requestType: 'STATUS_QUERY_AND_CLEARANCE',
    state: UNBLOCK_REQUEST_STATE.EVIDENCE_PENDING,
    reason,
    supportingEvidence: {
      ...supportingEvidence,
      jwt: undefined,
      privateKey: undefined,
      buyerAuthorizationCode: undefined,
    },
    mraSupportReference: mraSupportReference || supportingEvidence.mraSupportReference || null,
    requestedBy,
    requestedAt: new Date(),
    approvalId: null,
    approvedBy: null,
    lastStatusQueryAt: null,
    clearanceEvidenceId: null,
    queryAttempts: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  list.push(request);
  MEMORY_REQUESTS.set(reqKey(tenantId, businessId), list);
  return { request, created: true, duplicated: false };
}

export function submitUnblockEvidence({ tenantId, businessId, requestId, evidence = {} } = {}) {
  const list = MEMORY_REQUESTS.get(reqKey(tenantId, businessId)) || [];
  const request = list.find((r) => r.id === requestId);
  if (!request) throw RestrictionErrors.operationBlocked({ message: 'Unblock Request not found.' });
  if (!['EVIDENCE_PENDING', 'DRAFT'].includes(request.state)) {
    throw RestrictionErrors.unblockRequestState({ message: `Cannot attach evidence in state ${request.state}.` });
  }
  request.supportingEvidence = {
    ...request.supportingEvidence,
    ...evidence,
    jwt: undefined,
    privateKey: undefined,
  };
  if (evidence.mraSupportReference) request.mraSupportReference = evidence.mraSupportReference;
  request.state = UNBLOCK_REQUEST_STATE.APPROVAL_PENDING;
  request.updatedAt = new Date();
  request.version += 1;
  return request;
}

export function approveUnblockRequest({
  tenantId,
  businessId,
  requestId,
  approverId,
  requesterId,
} = {}) {
  const list = MEMORY_REQUESTS.get(reqKey(tenantId, businessId)) || [];
  const request = list.find((r) => r.id === requestId);
  if (!request) throw RestrictionErrors.operationBlocked({ message: 'Unblock Request not found.' });
  if (request.state !== UNBLOCK_REQUEST_STATE.APPROVAL_PENDING) {
    throw RestrictionErrors.unblockRequestState();
  }
  if (approverId && requesterId && approverId === requesterId) {
    throw RestrictionErrors.unblockApprovalRequired({
      message: 'Self-approval is prohibited for Unblock Requests.',
    });
  }
  request.state = UNBLOCK_REQUEST_STATE.APPROVED;
  request.approvedBy = approverId;
  request.approvalId = crypto.randomUUID();
  request.updatedAt = new Date();
  request.version += 1;
  return request;
}

/**
 * Query MRA unblock status (mock only until contract verified).
 * Does not clear restriction from HTTP status alone.
 */
export async function queryUnblockStatus({
  tenantId,
  businessId,
  requestId,
  mockScenario = 'REVIEW_PENDING',
  useMemory = true,
} = {}) {
  const contract = getMraBlockUnblockContractDecision();
  if (contract.unblockStatusProduction === RESTRICTION_CONTRACT_STATUS.BLOCKED) {
    // production path blocked — mock allowed when MRA_EIS_USE_MOCK=1
    if (process.env.MRA_EIS_USE_MOCK !== '1' && process.env.NODE_ENV === 'production') {
      throw RestrictionErrors.unblockContractUnverified();
    }
  }

  const list = MEMORY_REQUESTS.get(reqKey(tenantId, businessId)) || [];
  const request = list.find((r) => r.id === requestId);
  if (!request) throw RestrictionErrors.operationBlocked({ message: 'Unblock Request not found.' });
  if (!['APPROVED', 'MRA_REVIEW_PENDING', 'CLEARANCE_REPORTED'].includes(request.state)) {
    throw RestrictionErrors.unblockRequestState({
      message: 'Status query requires approved Unblock Request.',
    });
  }

  const attemptNumber = (request.queryAttempts?.length || 0) + 1;
  const attempt = {
    id: crypto.randomUUID(),
    attemptNumber,
    state: 'DISPATCHING',
    dispatchStartedAt: new Date(),
    contractVersion: 'mock-unblock-status-v1',
  };

  const response = queryMockUnblockStatus({
    terminalId: request.terminalId,
    environment: request.environment,
    scenario: mockScenario,
    supportReference: request.mraSupportReference,
  });

  attempt.state = 'COMPLETED';
  attempt.responseReceivedAt = new Date();
  attempt.httpStatus = response.httpStatus;
  attempt.applicationStatus = response.applicationStatus;
  attempt.normalizedOutcome = response.normalizedOutcome;
  attempt.responseChecksum = response.responseChecksum;
  request.queryAttempts.push(attempt);
  request.lastStatusQueryAt = new Date();

  // HTTP success alone must NOT clear
  if (response.httpStatus === 200 && response.normalizedOutcome === 'STILL_BLOCKED') {
    request.state = UNBLOCK_REQUEST_STATE.MRA_REVIEW_PENDING;
    return { request, attempt, response, cleared: false, reason: 'STILL_BLOCKED' };
  }

  if (response.normalizedOutcome === 'UNBLOCK_REVIEW_PENDING') {
    request.state = UNBLOCK_REQUEST_STATE.MRA_REVIEW_PENDING;
    return { request, attempt, response, cleared: false };
  }

  if (response.normalizedOutcome === 'UNBLOCK_REJECTED') {
    request.state = UNBLOCK_REQUEST_STATE.CLEARANCE_REJECTED;
    return { request, attempt, response, cleared: false };
  }

  if (
    response.normalizedOutcome === 'TERMINAL_CLEARED' ||
    response.normalizedOutcome === 'CLEARANCE_WITH_CONFIGURATION_REFRESH' ||
    response.normalizedOutcome === 'CLEARANCE_WITH_CREDENTIAL_REFRESH'
  ) {
    request.state = UNBLOCK_REQUEST_STATE.CLEARANCE_REPORTED;
    request.clearanceEvidenceId = response.evidenceId;
    return {
      request,
      attempt,
      response,
      cleared: false, // clearance reported — not operational yet
      requiresRevalidation: true,
      httpSuccessInsufficient: true,
    };
  }

  request.state = UNBLOCK_REQUEST_STATE.MANUAL_REVIEW;
  return { request, attempt, response, cleared: false, manualReview: true };
}

/**
 * Apply verified MRA clearance to the restriction, then revalidate.
 * Approval + clearance still do not set Terminal ACTIVE without revalidation pass.
 */
export async function applyClearanceAndRevalidate({
  tenantId,
  businessId,
  requestId,
  actorId = null,
  revalidationOverrides = {},
  useMemory = true,
} = {}) {
  const list = MEMORY_REQUESTS.get(reqKey(tenantId, businessId)) || [];
  const request = list.find((r) => r.id === requestId);
  if (!request) throw RestrictionErrors.operationBlocked({ message: 'Unblock Request not found.' });
  if (request.state !== UNBLOCK_REQUEST_STATE.CLEARANCE_REPORTED) {
    throw RestrictionErrors.unblockRequestState({
      message: 'Clearance must be reported before revalidation.',
    });
  }

  const lastAttempt = request.queryAttempts[request.queryAttempts.length - 1];
  if (!lastAttempt) {
    throw RestrictionErrors.clearanceNotProven({ message: 'No unblock status query attempt found.' });
  }

  const clearanceOutcomes = [
    'TERMINAL_CLEARED',
    'CLEARED',
    'CLEARANCE_WITH_CONFIGURATION_REFRESH',
    'CLEARANCE_WITH_CREDENTIAL_REFRESH',
  ];
  const clearanceProven =
    clearanceOutcomes.includes(lastAttempt?.normalizedOutcome) ||
    clearanceOutcomes.includes(lastAttempt?.applicationStatus);
  if (!clearanceProven) {
    throw RestrictionErrors.clearanceNotProven({
      message: 'Verified MRA application clearance required. HTTP status alone is insufficient.',
    });
  }

  request.state = UNBLOCK_REQUEST_STATE.REVALIDATING;

  await clearRestriction({
    tenantId,
    businessId,
    restrictionId: request.restrictionId,
    clearAuthority: 'MRA',
    clearanceEvidence: {
      applicationStatus: lastAttempt.applicationStatus || lastAttempt.normalizedOutcome,
      cleared: true,
      evidenceId: request.clearanceEvidenceId,
      httpStatus: lastAttempt?.httpStatus,
      note: 'HTTP success alone never cleared; application clearance verified.',
    },
    actorId,
    useMemory,
  });

  const remaining = await listActiveRestrictions({
    tenantId,
    businessId,
    terminalId: request.terminalId,
    environment: request.environment,
    useMemory,
  });

  const revalidation = await runPostUnblockRevalidation({
    tenantId,
    businessId,
    terminalId: request.terminalId,
    environment: request.environment,
    unblockRequestId: request.id,
    restrictionId: request.restrictionId,
    remainingRestrictions: remaining,
    overrides: revalidationOverrides,
  });

  if (revalidation.state === 'PASSED' || revalidation.state === 'PASSED_WITH_WARNINGS') {
    request.state = UNBLOCK_REQUEST_STATE.COMPLETED;
  } else if (revalidation.state === 'BLOCKED_BY_REMAINING_RESTRICTION') {
    request.state = UNBLOCK_REQUEST_STATE.COMPLETED; // this restriction cleared; others remain
  } else {
    request.state = UNBLOCK_REQUEST_STATE.MANUAL_REVIEW;
  }
  request.updatedAt = new Date();
  request.version += 1;

  return {
    request,
    revalidation,
    terminalSetActiveDirectly: false,
    remainingRestrictionCount: remaining.length,
    operational:
      remaining.length === 0 &&
      (revalidation.state === 'PASSED' || revalidation.state === 'PASSED_WITH_WARNINGS'),
  };
}

export function classifyPendingOnlineWork(item = {}) {
  const state = item.state || item.transmissionState;
  const map = {
    ACCEPTED: { action: 'NEVER_RESUME_SUBMIT', preserve: true, retransmit: false },
    UNKNOWN_OUTCOME: { action: 'RECONCILE', preserve: true, retransmit: false, blindRetry: false },
    REJECTED: { action: 'REMEDIATE', preserve: true, blindRetry: false },
    SAFE_RETRY_AUTHORIZED: { action: 'RESUME_AFTER_CLEARANCE_AND_AUTH', preserve: true, reuseFiscalNumber: true },
    READY_NOT_SUBMITTED: { action: 'RESUME_AFTER_CLEARANCE', preserve: true, reuseFiscalNumber: true },
    DISPATCHING: { action: 'PRESERVE_OUTCOME', preserve: true, classifyUncertainAs: 'UNKNOWN_OUTCOME' },
  };
  return map[state] || { action: 'MANUAL_REVIEW', preserve: true };
}

export function classifyPendingOfflineWork(item = {}) {
  const state = item.state || item.queueState;
  const map = {
    ACCEPTED: { action: 'NEVER_REUPLOAD', preserve: true },
    UNKNOWN_UPLOAD_OUTCOME: { action: 'RECONCILE', preserve: true, blindUpload: false },
    REJECTED: { action: 'REMEDIATE', preserve: true },
    SEALED_PENDING: { action: 'RESUME_UPLOAD_AFTER_CLEARANCE', preserve: true, verifyOrder: true },
    SIGNED: { action: 'FREEZE_UNTIL_CLEARANCE', preserve: true },
    UNSIGNED: { action: 'FREEZE', preserve: true },
    COMPROMISED_DEVICE_QUEUE: { action: 'FORENSIC_RECOVERY', preserve: true, reactivateDevice: false },
  };
  return map[state] || { action: 'MANUAL_REVIEW', preserve: true };
}
