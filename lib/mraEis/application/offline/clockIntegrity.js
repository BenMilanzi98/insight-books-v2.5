/**
 * Phase 16 — Device clock integrity. Rollback / excessive drift blocks offline Sales.
 */

import { CLOCK_TRUST_STATE } from '../../domain/operationalEnums.js';

const DEFAULTS = Object.freeze({
  warningDriftMs: 2 * 60 * 1000,
  blockDriftMs: 10 * 60 * 1000,
  maxForwardJumpMs: 30 * 60 * 1000,
});

/**
 * @param {object} args
 * @param {number|Date} args.deviceWallClock
 * @param {number|Date|null} args.lastTrustedServerTime
 * @param {number|Date|null} args.lastMonotonicMark
 * @param {number|Date|null} args.previousDeviceWallClock
 */
export function evaluateClockTrust({
  deviceWallClock = Date.now(),
  lastTrustedServerTime = null,
  lastMonotonicMark = null,
  previousDeviceWallClock = null,
  expectedTimezone = null,
  deviceTimezone = null,
  policy = DEFAULTS,
} = {}) {
  const deviceMs = toMs(deviceWallClock);
  const serverMs = lastTrustedServerTime != null ? toMs(lastTrustedServerTime) : null;
  const prevMs = previousDeviceWallClock != null ? toMs(previousDeviceWallClock) : null;
  const monoMs = lastMonotonicMark != null ? toMs(lastMonotonicMark) : null;

  const blockers = [];
  const warnings = [];

  if (expectedTimezone && deviceTimezone && expectedTimezone !== deviceTimezone) {
    return pack(CLOCK_TRUST_STATE.TIMEZONE_MISMATCH, {
      blockers: ['TIMEZONE_MISMATCH'],
      allowsOfflineSale: false,
    });
  }

  if (prevMs != null && deviceMs + 1000 < prevMs) {
    return pack(CLOCK_TRUST_STATE.CLOCK_ROLLBACK_DETECTED, {
      blockers: ['CLOCK_ROLLBACK_DETECTED'],
      allowsOfflineSale: false,
      deltaMs: deviceMs - prevMs,
    });
  }

  if (prevMs != null && deviceMs - prevMs > policy.maxForwardJumpMs) {
    return pack(CLOCK_TRUST_STATE.CLOCK_JUMP_DETECTED, {
      blockers: ['CLOCK_JUMP_DETECTED'],
      allowsOfflineSale: false,
      deltaMs: deviceMs - prevMs,
    });
  }

  if (serverMs != null) {
    const drift = Math.abs(deviceMs - serverMs);
    if (drift >= policy.blockDriftMs) {
      return pack(CLOCK_TRUST_STATE.DRIFT_BLOCKED, {
        blockers: ['EXCESSIVE_CLOCK_DRIFT'],
        allowsOfflineSale: false,
        driftMs: drift,
      });
    }
    if (drift >= policy.warningDriftMs) {
      warnings.push('CLOCK_DRIFT_WARNING');
      return pack(CLOCK_TRUST_STATE.DRIFT_WARNING, {
        allowsOfflineSale: true,
        warnings,
        driftMs: drift,
      });
    }
  } else {
    warnings.push('NO_TRUSTED_SERVER_TIME');
  }

  if (monoMs != null && deviceMs + 1000 < monoMs) {
    return pack(CLOCK_TRUST_STATE.CLOCK_ROLLBACK_DETECTED, {
      blockers: ['MONOTONIC_ROLLBACK'],
      allowsOfflineSale: false,
    });
  }

  return pack(CLOCK_TRUST_STATE.TRUSTED, {
    allowsOfflineSale: true,
    warnings,
    blockers,
  });
}

function pack(state, extra = {}) {
  return {
    state,
    allowsOfflineSale: extra.allowsOfflineSale !== false,
    userClockEditCannotExtendLimits: true,
    policyVersion: 'clock-integrity-v1',
    blockers: [],
    warnings: [],
    ...extra,
  };
}

function toMs(v) {
  if (v instanceof Date) return v.getTime();
  return Number(v);
}
