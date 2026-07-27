/**
 * Phase 16 — Connectivity state machine.
 * One failed ping / navigator.onLine must NOT enter offline mode.
 */

import { CONNECTIVITY_STATE } from '../../domain/operationalEnums.js';

const DEFAULTS = Object.freeze({
  failureThresholdToOfflineCandidate: 3,
  confirmationChecksRequired: 2,
  restorationStableChecksRequired: 3,
  debounceMs: 15_000,
  flapWindowMs: 60_000,
  maxFlapsBeforeHold: 4,
});

/**
 * @param {object} args
 * @param {string} args.currentState
 * @param {{ success: boolean, source?: string, at?: string }[]} args.recentChecks
 * @param {boolean} [args.terminalBlocked]
 * @param {boolean} [args.capabilityAllowsOfflineEntry]
 * @param {boolean} [args.navigatorOnline] — informational only; never authoritative
 */
export function evaluateConnectivityTransition({
  currentState = CONNECTIVITY_STATE.ONLINE_STABLE,
  recentChecks = [],
  terminalBlocked = false,
  capabilityAllowsOfflineEntry = false,
  navigatorOnline = null,
  policy = DEFAULTS,
  now = Date.now(),
} = {}) {
  const warnings = [];
  if (navigatorOnline != null) {
    warnings.push('NAVIGATOR_ONLINE_NOT_AUTHORITATIVE');
  }

  if (terminalBlocked) {
    return result(CONNECTIVITY_STATE.BLOCKED, {
      offlineEntryAllowed: false,
      startUploadAllowed: false,
      reason: 'TERMINAL_BLOCKED',
      warnings,
    });
  }

  const checks = [...recentChecks]
    .filter((c) => c && typeof c.success === 'boolean')
    .slice(-20);

  const flapCount = countFlaps(checks, policy.flapWindowMs, now);
  if (flapCount >= policy.maxFlapsBeforeHold) {
    return result(CONNECTIVITY_STATE.CONNECTIVITY_UNCERTAIN, {
      offlineEntryAllowed: false,
      startUploadAllowed: false,
      reason: 'CONNECTIVITY_FLAPPING',
      warnings: [...warnings, 'FLAPPING_DEBOUNCED'],
      flapCount,
    });
  }

  const consecutiveFailures = countTrailing(checks, false);
  const consecutiveSuccesses = countTrailing(checks, true);

  let next = currentState;
  let reason = 'HOLD';

  if (
    [
      CONNECTIVITY_STATE.ONLINE_STABLE,
      CONNECTIVITY_STATE.ONLINE_DEGRADED,
      CONNECTIVITY_STATE.CONNECTIVITY_UNCERTAIN,
    ].includes(currentState)
  ) {
    if (consecutiveFailures === 1) {
      next = CONNECTIVITY_STATE.ONLINE_DEGRADED;
      reason = 'SINGLE_FAILURE_NOT_OFFLINE';
    } else if (consecutiveFailures >= policy.failureThresholdToOfflineCandidate) {
      next = CONNECTIVITY_STATE.OFFLINE_CANDIDATE;
      reason = 'FAILURE_THRESHOLD_REACHED';
    } else if (consecutiveSuccesses >= 1) {
      next = CONNECTIVITY_STATE.ONLINE_STABLE;
      reason = 'HEALTHY';
    }
  } else if (currentState === CONNECTIVITY_STATE.OFFLINE_CANDIDATE) {
    if (consecutiveFailures >= policy.confirmationChecksRequired) {
      next = capabilityAllowsOfflineEntry
        ? CONNECTIVITY_STATE.OFFLINE_CONFIRMED
        : CONNECTIVITY_STATE.CONNECTIVITY_UNCERTAIN;
      reason = capabilityAllowsOfflineEntry
        ? 'OFFLINE_CONFIRMED'
        : 'OFFLINE_CAPABILITY_BLOCKED';
    } else if (consecutiveSuccesses >= 1) {
      next = CONNECTIVITY_STATE.ONLINE_DEGRADED;
      reason = 'TRANSIENT_RECOVERY';
    }
  } else if (
    [CONNECTIVITY_STATE.OFFLINE_CONFIRMED, CONNECTIVITY_STATE.OFFLINE_ACTIVE].includes(currentState)
  ) {
    if (consecutiveSuccesses >= 1 && consecutiveSuccesses < policy.restorationStableChecksRequired) {
      next = CONNECTIVITY_STATE.RESTORATION_CANDIDATE;
      reason = 'RESTORATION_CANDIDATE';
    } else if (consecutiveSuccesses >= policy.restorationStableChecksRequired) {
      next = CONNECTIVITY_STATE.ONLINE_RESTORED;
      reason = 'STABLE_RESTORATION';
    } else {
      next = CONNECTIVITY_STATE.OFFLINE_ACTIVE;
      reason = 'REMAIN_OFFLINE';
    }
  } else if (currentState === CONNECTIVITY_STATE.RESTORATION_CANDIDATE) {
    if (consecutiveSuccesses >= policy.restorationStableChecksRequired) {
      next = CONNECTIVITY_STATE.ONLINE_RESTORED;
      reason = 'STABLE_RESTORATION';
    } else if (consecutiveFailures >= 1) {
      next = CONNECTIVITY_STATE.OFFLINE_ACTIVE;
      reason = 'RESTORATION_FAILED';
    }
  } else if (currentState === CONNECTIVITY_STATE.ONLINE_RESTORED) {
    next = CONNECTIVITY_STATE.SYNCHRONIZING;
    reason = 'BEGIN_SYNC';
  }

  const offlineEntryAllowed =
    next === CONNECTIVITY_STATE.OFFLINE_CONFIRMED && capabilityAllowsOfflineEntry;
  const startUploadAllowed =
    next === CONNECTIVITY_STATE.ONLINE_RESTORED || next === CONNECTIVITY_STATE.SYNCHRONIZING;

  return result(next, {
    offlineEntryAllowed,
    startUploadAllowed,
    reason,
    warnings,
    consecutiveFailures,
    consecutiveSuccesses,
    flapCount,
    maintenanceDoesNotAutoEnableOffline: true,
  });
}

function result(state, extra) {
  return {
    state,
    previousWouldEnterOnSingleFailure: false,
    policyVersion: 'connectivity-state-v1',
    ...extra,
  };
}

function countTrailing(checks, success) {
  let n = 0;
  for (let i = checks.length - 1; i >= 0; i -= 1) {
    if (checks[i].success === success) n += 1;
    else break;
  }
  return n;
}

function countFlaps(checks, windowMs, now) {
  const recent = checks.filter((c) => {
    if (!c.at) return true;
    return now - new Date(c.at).getTime() <= windowMs;
  });
  let flaps = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].success !== recent[i - 1].success) flaps += 1;
  }
  return flaps;
}

export function assertNotBrowserOnlineAuthoritative(navigatorOnline) {
  return {
    authoritative: false,
    navigatorOnline: navigatorOnline ?? null,
    message: 'navigator.onLine is insufficient for certified offline entry.',
  };
}
