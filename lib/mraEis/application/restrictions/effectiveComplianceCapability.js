/**
 * Phase 17 — Effective Compliance Capability Policy (server-authoritative).
 */

import { pickPrimaryRestriction, getReasonMeta } from './restrictionRegistries.js';
import {
  evaluateCapabilityAgainstRestrictions,
  COMPLIANCE_OPERATION,
} from './capabilityMatrix.js';

export function evaluateEffectiveComplianceCapabilities({
  tenantId = null,
  businessId = null,
  terminalId = null,
  agentId = null,
  deviceId = null,
  environment = 'SANDBOX',
  requestedOperation = COMPLIANCE_OPERATION.FINALIZE_EIS_SALE,
  restrictions = [],
  actorOrServiceContext = null,
} = {}) {
  const { primary, secondary } = pickPrimaryRestriction(restrictions);
  const opResult = evaluateCapabilityAgainstRestrictions({
    requestedOperation,
    restrictions,
  });

  const ops = Object.values(COMPLIANCE_OPERATION);
  const capabilities = {};
  for (const op of ops) {
    capabilities[op] = evaluateCapabilityAgainstRestrictions({
      requestedOperation: op,
      restrictions,
    }).allowed;
  }

  const primaryMeta = primary ? getReasonMeta(primary.reasonCode) : null;

  return {
    tenantId,
    businessId,
    terminalId,
    agentId,
    deviceId,
    environment,
    requestedOperation,
    allowed: opResult.allowed,
    effectiveState: primary
      ? primary.reasonCode === 'MRA_TERMINAL_BLOCKED'
        ? 'BLOCKED_MRA'
        : primary.reasonCode === 'PLATFORM_EMERGENCY_PAUSE'
          ? 'BLOCKED_PLATFORM'
          : 'BLOCKED'
      : 'ACTIVE',
    primaryRestriction: primary
      ? {
          id: primary.id,
          reasonCode: primary.reasonCode,
          sourceType: primary.sourceType,
          safeText: primaryMeta.safeText,
          clearAuthority: primaryMeta.clearAuthority,
        }
      : null,
    allApplicableRestrictions: [primary, ...secondary].filter(Boolean).map((r) => ({
      id: r.id,
      reasonCode: r.reasonCode,
      sourceType: r.sourceType,
      state: r.state,
      severity: getReasonMeta(r.reasonCode).severity,
    })),
    secondaryRestrictions: secondary.map((r) => r.reasonCode),
    blockers: opResult.blockers,
    warnings: secondary.map((r) => r.reasonCode),
    requiredActions: primary
      ? [
          primaryMeta.clearAuthority === 'MRA'
            ? 'Create Unblock Request and query verified MRA status.'
            : `Clear via ${primaryMeta.clearAuthority} authority, then revalidate.`,
        ]
      : [],
    capabilities,
    tenantCannotClearMra: true,
    browserCannotSetActive: true,
    offlineCannotBypassBlock: true,
    httpSuccessNotClearance: true,
    policyVersion: 'effective-compliance-capability-v1',
    evaluatedAt: new Date().toISOString(),
    actorType: actorOrServiceContext?.actorType || null,
  };
}

export { COMPLIANCE_OPERATION };
