/**
 * Phase 17 — Platform emergency pause (environment-scoped).
 */

import {
  ingestRestriction,
  clearRestriction,
  listActiveRestrictions,
} from './restrictionService.js';
import { RESTRICTION_SOURCE, RESTRICTION_SCOPE } from './restrictionRegistries.js';
import { RestrictionErrors } from './restrictionErrors.js';

export async function activatePlatformEmergencyPause({
  environment = 'PRODUCTION',
  reasonCode = 'PLATFORM_EMERGENCY_PAUSE',
  reasonDetail = 'SECURITY_INCIDENT',
  actorId,
  useMemory = false,
} = {}) {
  if (!actorId) {
    throw RestrictionErrors.operationBlocked({
      message: 'Elevated actor required to activate emergency pause.',
      httpStatus: 403,
    });
  }
  return ingestRestriction({
    tenantId: null,
    businessId: null,
    environment,
    sourceType: RESTRICTION_SOURCE.PLATFORM_EMERGENCY_CONTROL,
    sourceReference: `emergency:${environment}:${reasonDetail}`,
    reasonCode,
    scopeType: RESTRICTION_SCOPE.ENVIRONMENT,
    scopeId: environment,
    evidence: {
      safe: { reasonDetail, activatedBy: actorId },
      checksum: undefined,
    },
    useMemory,
  });
}

export async function clearPlatformEmergencyPause({
  environment = 'PRODUCTION',
  actorId,
  useMemory = false,
} = {}) {
  const active = await listActiveRestrictions({
    tenantId: 'platform',
    businessId: 'platform',
    environment,
    useMemory,
  });
  const pause = active.find(
    (r) =>
      r.reasonCode === 'PLATFORM_EMERGENCY_PAUSE' &&
      r.environment === environment &&
      r.scopeType === RESTRICTION_SCOPE.ENVIRONMENT
  );
  if (!pause) {
    return { cleared: false, reason: 'NO_ACTIVE_PAUSE' };
  }
  return clearRestriction({
    tenantId: pause.tenantId,
    businessId: pause.businessId,
    restrictionId: pause.id,
    clearAuthority: 'PLATFORM',
    clearanceEvidence: { platformClearanceApproved: true, clearedBy: actorId },
    actorId,
    useMemory,
  });
}
