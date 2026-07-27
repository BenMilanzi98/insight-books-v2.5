/**
 * Phase 15 — Dispatch certainty reconstruction.
 * Timeout / HTTP 500 / worker crash after dispatch remain AMBIGUOUS (not "not processed").
 */

import { DISPATCH_CERTAINTY } from '../../domain/operationalEnums.js';

/**
 * @param {object} attempt MraEisTransmissionAttempt row
 * @param {object|null} response MraEisResponse row
 */
export function classifyDispatchCertainty(attempt, response = null) {
  if (!attempt) {
    return {
      certainty: DISPATCH_CERTAINTY.DEFINITELY_NOT_PREPARED,
      reason: 'ATTEMPT_MISSING',
      mayHaveBeenProcessed: false,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  if (response) {
    return {
      certainty: DISPATCH_CERTAINTY.RESPONSE_PERSISTED,
      reason: 'RESPONSE_EVIDENCE_EXISTS',
      mayHaveBeenProcessed: true,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  const outcome = attempt.outcome;
  const httpStatus = attempt.httpStatus;
  const retryClass = attempt.retryClassification;
  const started = Boolean(attempt.startedAt);
  const completed = Boolean(attempt.completedAt);

  // Pre-dispatch / local validation style failures
  if (outcome === 'CONTRACT_ERROR' && !httpStatus) {
    return {
      certainty: DISPATCH_CERTAINTY.DEFINITELY_NOT_SENT,
      reason: 'CONTRACT_ERROR_BEFORE_HTTP',
      mayHaveBeenProcessed: false,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  if (outcome === 'SECURITY_ERROR' && !httpStatus) {
    // Auth may have failed before or after emission — conservative
    return {
      certainty: DISPATCH_CERTAINTY.DISPATCH_STARTED,
      reason: 'SECURITY_ERROR_AMBIGUOUS',
      mayHaveBeenProcessed: true,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  if (outcome === 'CANCELLED' && !httpStatus) {
    return {
      certainty: DISPATCH_CERTAINTY.PREPARED_NOT_DISPATCHED,
      reason: 'CANCELLED_BEFORE_HTTP',
      mayHaveBeenProcessed: false,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  if (outcome === 'UNKNOWN_OUTCOME' || retryClass === 'RECONCILE_BEFORE_RETRY') {
    if (httpStatus == null && started && !completed) {
      return {
        certainty: DISPATCH_CERTAINTY.WORKER_CRASH_AFTER_DISPATCH,
        reason: 'INCOMPLETE_ATTEMPT_NO_HTTP',
        mayHaveBeenProcessed: true,
        version: 'phase15-dispatch-certainty-v1',
      };
    }
    if ([408, 504, 502, 500, 503].includes(Number(httpStatus))) {
      return {
        certainty: DISPATCH_CERTAINTY.REQUEST_BYTES_MAY_HAVE_LEFT_PROCESS,
        reason: `HTTP_${httpStatus}_AMBIGUOUS`,
        mayHaveBeenProcessed: true,
        version: 'phase15-dispatch-certainty-v1',
      };
    }
    if (httpStatus != null) {
      return {
        certainty: DISPATCH_CERTAINTY.REQUEST_CONFIRMED_SENT,
        reason: `HTTP_${httpStatus}_WITHOUT_APP_ACCEPTANCE`,
        mayHaveBeenProcessed: true,
        version: 'phase15-dispatch-certainty-v1',
      };
    }
    return {
      certainty: DISPATCH_CERTAINTY.UNKNOWN,
      reason: 'UNKNOWN_OUTCOME_NO_RESPONSE',
      mayHaveBeenProcessed: true,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  if (outcome === 'TEMPORARY_FAILURE') {
    return {
      certainty: DISPATCH_CERTAINTY.REQUEST_BYTES_MAY_HAVE_LEFT_PROCESS,
      reason: 'TEMPORARY_FAILURE',
      mayHaveBeenProcessed: true,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  if (outcome === 'STARTED' && !completed) {
    return {
      certainty: DISPATCH_CERTAINTY.DISPATCH_STARTED,
      reason: 'ATTEMPT_STARTED_INCOMPLETE',
      mayHaveBeenProcessed: true,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  if (!started) {
    return {
      certainty: DISPATCH_CERTAINTY.PREPARED_NOT_DISPATCHED,
      reason: 'ATTEMPT_NOT_STARTED',
      mayHaveBeenProcessed: false,
      version: 'phase15-dispatch-certainty-v1',
    };
  }

  return {
    certainty: DISPATCH_CERTAINTY.UNKNOWN,
    reason: 'UNCLASSIFIED',
    mayHaveBeenProcessed: true,
    version: 'phase15-dispatch-certainty-v1',
  };
}

/** Explicit local pre-dispatch failure markers for safe definitely-not-processed paths. */
export function isDefinitelyNotSent(certainty) {
  return [
    DISPATCH_CERTAINTY.DEFINITELY_NOT_PREPARED,
    DISPATCH_CERTAINTY.PREPARED_NOT_DISPATCHED,
    DISPATCH_CERTAINTY.DEFINITELY_NOT_SENT,
  ].includes(certainty);
}
