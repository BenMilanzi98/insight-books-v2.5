/**
 * Phase 16 — Offline Certification Policy.
 * Tenants cannot self-declare production offline certification.
 */

import { OFFLINE_CERTIFICATION_STATUS } from '../../domain/operationalEnums.js';

const ACTIVE_PRODUCTION = new Set([OFFLINE_CERTIFICATION_STATUS.CERTIFIED_PRODUCTION]);
const ACTIVE_SANDBOX = new Set([
  OFFLINE_CERTIFICATION_STATUS.CERTIFIED_SANDBOX,
  OFFLINE_CERTIFICATION_STATUS.SANDBOX_TESTING,
]);

export function evaluateOfflineCertification({
  certification = null,
  environment = 'SANDBOX',
  mode = 'MOCK',
  now = new Date(),
} = {}) {
  const env = String(environment).toUpperCase();
  const m = String(mode).toUpperCase();

  if (m === 'MOCK' || env === 'DEVELOPMENT' || env === 'TEST') {
    return {
      valid: true,
      status: OFFLINE_CERTIFICATION_STATUS.SANDBOX_TESTING,
      productionAllowed: false,
      sandboxAllowed: true,
      mockOnly: true,
      blockers: [],
      warnings: ['MOCK_OFFLINE_NOT_CERTIFICATION_EVIDENCE'],
      policyVersion: 'offline-cert-policy-v1',
    };
  }

  if (!certification) {
    return pack(false, OFFLINE_CERTIFICATION_STATUS.NOT_STARTED, {
      blockers: ['PRODUCTION_CERTIFICATION_MISSING'],
    });
  }

  const status = certification.status || OFFLINE_CERTIFICATION_STATUS.NOT_STARTED;
  const until = certification.effectiveUntil ? new Date(certification.effectiveUntil) : null;
  if (until && until.getTime() < now.getTime()) {
    return pack(false, OFFLINE_CERTIFICATION_STATUS.CERTIFICATION_EXPIRED, {
      blockers: ['CERTIFICATION_EXPIRED'],
    });
  }
  if (
    [
      OFFLINE_CERTIFICATION_STATUS.CERTIFICATION_SUSPENDED,
      OFFLINE_CERTIFICATION_STATUS.CERTIFICATION_REVOKED,
      OFFLINE_CERTIFICATION_STATUS.REQUIRES_RECERTIFICATION,
    ].includes(status)
  ) {
    return pack(false, status, {
      blockers: [`CERTIFICATION_${status}`],
    });
  }

  if (env === 'PRODUCTION' || m === 'PRODUCTION') {
    if (!ACTIVE_PRODUCTION.has(status)) {
      return pack(false, status, {
        blockers: ['PRODUCTION_CERTIFICATION_MISSING'],
      });
    }
    return pack(true, status, { productionAllowed: true, sandboxAllowed: false });
  }

  // live sandbox
  if (!ACTIVE_SANDBOX.has(status) && !ACTIVE_PRODUCTION.has(status)) {
    return pack(false, status, {
      blockers: ['SANDBOX_CERTIFICATION_MISSING'],
    });
  }
  return pack(true, status, { productionAllowed: false, sandboxAllowed: true });
}

function pack(valid, status, extra = {}) {
  return {
    valid,
    status,
    productionAllowed: false,
    sandboxAllowed: false,
    mockOnly: false,
    blockers: [],
    warnings: [],
    policyVersion: 'offline-cert-policy-v1',
    selfDeclarationForbidden: true,
    ...extra,
  };
}

export function certificationBlocksNewOfflineSales(certEval) {
  return !certEval?.valid;
}
