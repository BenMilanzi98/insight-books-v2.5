/**
 * Phase 15 — Retry Policy Registry. Unknown outcomes never auto-retry.
 */

export const RETRY_DECISION = Object.freeze({
  RETRY_ALLOWED_AUTOMATIC: 'RETRY_ALLOWED_AUTOMATIC',
  RETRY_ALLOWED_AFTER_DELAY: 'RETRY_ALLOWED_AFTER_DELAY',
  RETRY_ALLOWED_AFTER_AUTHENTICATION_REMEDIATION: 'RETRY_ALLOWED_AFTER_AUTHENTICATION_REMEDIATION',
  RETRY_ALLOWED_AFTER_CONFIGURATION_REFRESH: 'RETRY_ALLOWED_AFTER_CONFIGURATION_REFRESH',
  RETRY_ALLOWED_AFTER_RATE_LIMIT: 'RETRY_ALLOWED_AFTER_RATE_LIMIT',
  RETRY_ALLOWED_AFTER_MAINTENANCE: 'RETRY_ALLOWED_AFTER_MAINTENANCE',
  RETRY_ALLOWED_WITH_APPROVAL: 'RETRY_ALLOWED_WITH_APPROVAL',
  RECONCILE_BEFORE_RETRY: 'RECONCILE_BEFORE_RETRY',
  RETRY_NOT_ALLOWED_ACCEPTED: 'RETRY_NOT_ALLOWED_ACCEPTED',
  RETRY_NOT_ALLOWED_REJECTED: 'RETRY_NOT_ALLOWED_REJECTED',
  RETRY_NOT_ALLOWED_UNKNOWN: 'RETRY_NOT_ALLOWED_UNKNOWN',
  RETRY_NOT_ALLOWED_TERMINAL_BLOCKED: 'RETRY_NOT_ALLOWED_TERMINAL_BLOCKED',
  RETRY_NOT_ALLOWED_CONTRACT_ERROR: 'RETRY_NOT_ALLOWED_CONTRACT_ERROR',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
  BLOCKED: 'BLOCKED',
});

export const RETRY_POLICY_VERSION = 'retry-policy-mock-v1';

const POLICY = Object.freeze({
  policyVersion: RETRY_POLICY_VERSION,
  maximumAttempts: 5,
  initialDelayMs: 30_000,
  maximumDelayMs: 3_600_000,
  backoffFactor: 2,
  jitter: 'full',
  retryWindowMs: 7 * 24 * 60 * 60 * 1000,
  sameSnapshotRequired: true,
  sameFiscalNumberRequired: true,
  inventPayloadForbidden: true,
  unknownRequiresReconcile: true,
  acceptedNeverRetry: true,
  rejectedNeverBlindRetry: true,
  terminalBlockStopsRetry: true,
  offlineModeNeverAutoEnabled: true,
  productionRequiresApproval: true,
  contractStatus: 'PROVISIONAL_SANDBOX_ONLY',
});

/**
 * Evaluate retry decision from reconciliation outcome + context.
 */
export function evaluateRetryPolicyDecision({
  transmissionStatus,
  reconciliationOutcome,
  dispatchCertainty,
  terminalBlocked = false,
  configurationReady = true,
  credentialsReady = true,
  circuitBreakerState = 'CLOSED',
  attemptCount = 0,
  environment = 'SANDBOX',
  mode = 'MOCK',
} = {}) {
  const warnings = [];
  const blockers = [];

  if (['ACCEPTED_ONLINE', 'ACCEPTED_OFFLINE', 'RECONCILED_ACCEPTED'].includes(transmissionStatus)) {
    return pack(RETRY_DECISION.RETRY_NOT_ALLOWED_ACCEPTED, { blockers: ['TRANSMISSION_ACCEPTED'] });
  }
  if (transmissionStatus === 'REJECTED' || reconciliationOutcome === 'REJECTED_CONFIRMED') {
    return pack(RETRY_DECISION.RETRY_NOT_ALLOWED_REJECTED, {
      blockers: ['TRANSMISSION_REJECTED_NON_RETRYABLE'],
    });
  }
  if (terminalBlocked || reconciliationOutcome === 'TERMINAL_BLOCKED') {
    return pack(RETRY_DECISION.RETRY_NOT_ALLOWED_TERMINAL_BLOCKED, {
      blockers: ['TERMINAL_BLOCKED'],
    });
  }
  if (circuitBreakerState === 'OPEN' || circuitBreakerState === 'FORCED_OPEN') {
    return pack(RETRY_DECISION.BLOCKED, { blockers: ['CIRCUIT_BREAKER_OPEN'] });
  }
  if (attemptCount >= POLICY.maximumAttempts) {
    return pack(RETRY_DECISION.MANUAL_REVIEW_REQUIRED, {
      blockers: ['ATTEMPT_LIMIT_EXCEEDED'],
    });
  }

  if (
    reconciliationOutcome === 'STILL_UNKNOWN' ||
    reconciliationOutcome === 'TARGET_NOT_RETURNED' ||
    reconciliationOutcome === 'RESPONSE_WINDOW_INSUFFICIENT' ||
    transmissionStatus === 'UNKNOWN_OUTCOME'
  ) {
    // UNKNOWN never auto-retries — even if still on UNKNOWN before reconcile completes
    if (reconciliationOutcome !== 'DEFINITELY_NOT_PROCESSED') {
      return pack(RETRY_DECISION.RETRY_NOT_ALLOWED_UNKNOWN, {
        blockers: ['OUTCOME_STILL_UNKNOWN'],
        warnings: ['RECONCILE_FIRST_DO_NOT_RETRY'],
      });
    }
  }

  if (reconciliationOutcome === 'CONFIGURATION_REFRESH_REQUIRED' || !configurationReady) {
    return pack(RETRY_DECISION.RETRY_ALLOWED_AFTER_CONFIGURATION_REFRESH, {
      blockers: configurationReady ? [] : ['CONFIGURATION_NOT_REFRESHED'],
    });
  }

  if (!credentialsReady) {
    return pack(RETRY_DECISION.RETRY_ALLOWED_AFTER_AUTHENTICATION_REMEDIATION, {
      blockers: ['CREDENTIAL_NOT_REMEDIATED'],
    });
  }

  if (reconciliationOutcome === 'DEFINITELY_NOT_PROCESSED') {
    if (
      dispatchCertainty === 'DEFINITELY_NOT_SENT' ||
      dispatchCertainty === 'PREPARED_NOT_DISPATCHED' ||
      dispatchCertainty === 'DEFINITELY_NOT_PREPARED'
    ) {
      const env = String(environment).toUpperCase();
      if (env === 'PRODUCTION' || mode === 'PRODUCTION') {
        return pack(RETRY_DECISION.RETRY_ALLOWED_WITH_APPROVAL, {
          warnings: ['PRODUCTION_RETRY_REQUIRES_APPROVAL'],
        });
      }
      return pack(RETRY_DECISION.RETRY_ALLOWED_AFTER_DELAY, { warnings });
    }
    return pack(RETRY_DECISION.RECONCILE_BEFORE_RETRY, {
      blockers: ['DISPATCH_CERTAINTY_INSUFFICIENT_FOR_AUTO_RETRY'],
    });
  }

  if (reconciliationOutcome === 'MANUAL_REVIEW_REQUIRED' || reconciliationOutcome === 'EVIDENCE_CONFLICT') {
    return pack(RETRY_DECISION.MANUAL_REVIEW_REQUIRED, {
      blockers: ['MANUAL_REVIEW_REQUIRED'],
    });
  }

  if (reconciliationOutcome === 'CONTRACT_MISMATCH') {
    return pack(RETRY_DECISION.RETRY_NOT_ALLOWED_CONTRACT_ERROR, {
      blockers: ['CONTRACT_UNVERIFIED'],
    });
  }

  // Default: reconcile first
  return pack(RETRY_DECISION.RECONCILE_BEFORE_RETRY, {
    blockers: ['RECONCILE_BEFORE_RETRY'],
  });
}

function pack(decision, { blockers = [], warnings = [] } = {}) {
  return {
    decision,
    allowed: decision.startsWith('RETRY_ALLOWED'),
    policyVersion: POLICY.policyVersion,
    policy: POLICY,
    blockers,
    warnings,
    sameSnapshotRequired: true,
    sameFiscalNumberRequired: true,
  };
}

export function getRetryPolicyRegistry() {
  return { [POLICY.policyVersion]: POLICY };
}

export function computeBackoffDelayMs({ attemptNumber = 1, retryAfterSeconds = null } = {}) {
  if (retryAfterSeconds != null && Number.isFinite(Number(retryAfterSeconds))) {
    return Math.min(Number(retryAfterSeconds) * 1000, POLICY.maximumDelayMs);
  }
  const exp = Math.min(
    POLICY.initialDelayMs * POLICY.backoffFactor ** Math.max(0, attemptNumber - 1),
    POLICY.maximumDelayMs
  );
  // full jitter
  return Math.floor(Math.random() * exp);
}
