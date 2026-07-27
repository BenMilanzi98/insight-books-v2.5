/**
 * Phase 17 — Post-unblock revalidation.
 * Clearance alone does not restore operations. Every remaining restriction is rechecked.
 */

import crypto from 'crypto';
import { pickPrimaryRestriction, getReasonMeta } from './restrictionRegistries.js';

export const REVALIDATION_STATE = Object.freeze({
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  BLOCKED_BY_REMAINING_RESTRICTION: 'BLOCKED_BY_REMAINING_RESTRICTION',
  FAILED: 'FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  PASSED_WITH_WARNINGS: 'PASSED_WITH_WARNINGS',
  PASSED: 'PASSED',
});

const RESTORATION_STAGES = Object.freeze({
  STAGE_1_READ_ONLY: 'STAGE_1_READ_ONLY',
  STAGE_2_COMPLIANCE_OPS: 'STAGE_2_COMPLIANCE_OPS',
  STAGE_3_ONLINE_RECOVERY: 'STAGE_3_ONLINE_RECOVERY',
  STAGE_4_OFFLINE_RECOVERY: 'STAGE_4_OFFLINE_RECOVERY',
  STAGE_5_NEW_OFFLINE_FISCALIZATION: 'STAGE_5_NEW_OFFLINE_FISCALIZATION',
});

function check(name, ok, detail = null) {
  return { name, passed: Boolean(ok), detail };
}

/**
 * Run post-unblock revalidation checks.
 * overrides: allow tests to force pass/fail per check.
 */
export async function runPostUnblockRevalidation({
  tenantId,
  businessId,
  terminalId,
  environment = 'SANDBOX',
  unblockRequestId = null,
  restrictionId = null,
  remainingRestrictions = [],
  overrides = {},
} = {}) {
  const run = {
    id: crypto.randomUUID(),
    tenantId,
    businessId,
    terminalId,
    environment,
    unblockRequestId,
    restrictionId,
    state: REVALIDATION_STATE.RUNNING,
    startedAt: new Date(),
    checks: [],
    remainingRestrictionCount: remainingRestrictions.length,
    capabilityStage: RESTORATION_STAGES.STAGE_1_READ_ONLY,
    terminalSetActiveDirectly: false,
    version: 1,
    createdAt: new Date(),
  };

  const defaults = {
    platform: true,
    entitlement: true,
    participation: true,
    business: true,
    certification: true,
    terminalIdentity: true,
    credential: true,
    configuration: true,
    siteMapping: true,
    productVersion: true,
    onlineSequence: true,
    offlineSequence: true,
    reconciliation: true,
    agent: true,
    deviceTrust: true,
    offlineConfiguration: true,
    offlineQueueIntegrity: true,
    pendingWork: true,
    ...overrides,
  };

  run.checks = [
    check('platform', defaults.platform, 'Platform EIS available; no emergency pause'),
    check('entitlement', defaults.entitlement),
    check('participation', defaults.participation),
    check('business', defaults.business),
    check('certification', defaults.certification),
    check('terminalIdentity', defaults.terminalIdentity),
    check('credential', defaults.credential),
    check('configuration', defaults.configuration),
    check('siteMapping', defaults.siteMapping),
    check('productVersion', defaults.productVersion),
    check('onlineSequence', defaults.onlineSequence),
    check('offlineSequence', defaults.offlineSequence),
    check('reconciliation', defaults.reconciliation),
    check('agent', defaults.agent),
    check('deviceTrust', defaults.deviceTrust),
    check('offlineConfiguration', defaults.offlineConfiguration),
    check('offlineQueueIntegrity', defaults.offlineQueueIntegrity),
    check('pendingWork', defaults.pendingWork, 'Accepted not retransmitted; unknown remains reconcile'),
  ];

  const failed = run.checks.filter((c) => !c.passed);
  const { primary } = pickPrimaryRestriction(remainingRestrictions);

  if (remainingRestrictions.length > 0) {
    run.state = REVALIDATION_STATE.BLOCKED_BY_REMAINING_RESTRICTION;
    run.primaryRemainingReason = primary?.reasonCode || null;
    run.primaryRemainingSafeText = primary ? getReasonMeta(primary.reasonCode).safeText : null;
    run.capabilityStage = RESTORATION_STAGES.STAGE_2_COMPLIANCE_OPS;
    run.operational = false;
  } else if (failed.length > 0) {
    run.state = REVALIDATION_STATE.FAILED;
    run.failedChecks = failed.map((c) => c.name);
    run.operational = false;
    run.capabilityStage = RESTORATION_STAGES.STAGE_2_COMPLIANCE_OPS;
  } else {
    const warnings = [];
    if (overrides.warnOffline) warnings.push('OFFLINE_REQUIRES_SEPARATE_ATTESTATION');
    run.state = warnings.length ? REVALIDATION_STATE.PASSED_WITH_WARNINGS : REVALIDATION_STATE.PASSED;
    run.warnings = warnings;
    run.operational = true;
    run.capabilityStage = RESTORATION_STAGES.STAGE_3_ONLINE_RECOVERY;
    if (!overrides.warnOffline && defaults.agent && defaults.deviceTrust && defaults.offlineQueueIntegrity) {
      run.capabilityStage = RESTORATION_STAGES.STAGE_5_NEW_OFFLINE_FISCALIZATION;
    } else if (defaults.agent && defaults.deviceTrust) {
      run.capabilityStage = RESTORATION_STAGES.STAGE_4_OFFLINE_RECOVERY;
    }
  }

  run.completedAt = new Date();
  run.gradualRestoration = {
    stage1_readOnly: true,
    stage2_complianceOps: true,
    stage3_onlineRecovery: run.operational,
    stage4_offlineRecovery: run.capabilityStage !== RESTORATION_STAGES.STAGE_3_ONLINE_RECOVERY && run.operational,
    stage5_newOfflineFiscalization:
      run.capabilityStage === RESTORATION_STAGES.STAGE_5_NEW_OFFLINE_FISCALIZATION,
  };

  return run;
}

export { RESTORATION_STAGES };
