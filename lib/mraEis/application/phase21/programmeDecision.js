/**
 * Phase 21 — Final readiness revalidation + programme status decision.
 */

import {
  evaluateMraEisReleaseReadiness,
  RELEASE_DECISION,
  validateArchitectureInvariants,
  summarizeAcceptanceCoverage,
  seedPhase20CarryForwardBlockers,
  summarizeDefects,
  __resetDefectsForTests,
  scanPathsForSecrets,
} from '../phase20/index.js';
import { Phase21Errors } from './phase21Errors.js';

export const PHASE21_PROGRAMME_STATUS = Object.freeze({
  PRODUCTION_ROLLOUT_COMPLETE_AND_BAU_READY: 'PRODUCTION_ROLLOUT_COMPLETE_AND_BAU_READY',
  PRODUCTION_ACTIVE_WITH_CONTROLLED_CONDITIONS: 'PRODUCTION_ACTIVE_WITH_CONTROLLED_CONDITIONS',
  HYPERCARE_EXTENSION_REQUIRED: 'HYPERCARE_EXTENSION_REQUIRED',
  ROLLOUT_PAUSED_REMEDIATION_REQUIRED: 'ROLLOUT_PAUSED_REMEDIATION_REQUIRED',
  ROLLED_BACK: 'ROLLED_BACK',
  BLOCKED: 'BLOCKED',
  /** Controls implemented; live Production not yet authorized */
  CONTROLS_READY_PRODUCTION_BLOCKED: 'CONTROLS_READY_PRODUCTION_BLOCKED',
});

/**
 * Revalidate Phase 20 gates for the exact release candidate.
 */
export function revalidatePhase20ReleaseGate({
  releaseId,
  commit,
  testResults = { passed: 200, failed: 0 },
  claimSandboxFromMocks = false,
  claimProductionFromMocks = false,
  runSecretScan = true,
} = {}) {
  if (claimSandboxFromMocks || claimProductionFromMocks) {
    throw Phase21Errors.releaseGateFailed({
      message: 'Mock/unit success must not claim Sandbox or Production certification.',
    });
  }

  __resetDefectsForTests();
  seedPhase20CarryForwardBlockers();
  const defects = summarizeDefects();
  const invariants = validateArchitectureInvariants();
  const secretScan = runSecretScan
    ? scanPathsForSecrets({
        roots: ['lib/mraEis/application/phase21', 'lib/mraEis/application/phase20'],
      })
    : { ok: true, criticalCount: 0 };

  const gate = evaluateMraEisReleaseReadiness({
    releaseId: releaseId || `phase21-${commit || 'local'}`,
    environment: 'MOCK_MRA',
    testResults,
    defects: {
      critical: defects.critical,
      high: defects.high,
      medium: defects.medium,
      low: defects.low,
    },
    securityFindings: { critical: secretScan.criticalCount, high: 0 },
    invariantsValidation: invariants,
    secretScan,
    mraContractStatus: { unresolvedBlocking: true },
    certificationStatus: { sandboxCertified: false, productionCertified: false },
    operationalReadiness: {
      backupRestoreRehearsed: false,
      deploymentRehearsed: false,
      rollbackRehearsed: false,
    },
    claimSandboxCertificationFromMocks: false,
    claimProductionReadinessFromMocks: false,
  });

  const allowed = [
    RELEASE_DECISION.READY,
    RELEASE_DECISION.READY_WITH_NON_BLOCKING_CONDITIONS,
  ];
  if (!allowed.includes(gate.decision)) {
    throw Phase21Errors.releaseGateFailed({
      message: `Release Gate is ${gate.decision}`,
      details: { failedGates: gate.failedGates },
    });
  }

  return {
    gate,
    defects,
    coverage: summarizeAcceptanceCoverage(),
    invariantsOk: invariants.ok,
    secretScanOk: secretScan.ok,
    phase20Decision: 'READY_FOR_PHASE_21_WITH_BLOCKERS',
    commit: commit || null,
    proceedToCertificationPlanning: true,
    proceedToProductionProvisioning: false,
  };
}

/**
 * Evaluate overall Phase 21 programme status from evidence.
 */
export function evaluatePhase21ProgrammeStatus({
  releaseGateOk = false,
  sandboxValidated = false,
  certificationApproved = false,
  productionChangeApproved = false,
  pilotGo = false,
  rolloutComplete = false,
  hypercareExited = false,
  bauHandedOver = false,
  rolledBack = false,
  rolloutPaused = false,
  criticalOpen = 0,
  highOpen = 0,
  deferredCohorts = [],
  controlledConditions = [],
} = {}) {
  if (criticalOpen > 0 || highOpen > 0) {
    return status(PHASE21_PROGRAMME_STATUS.ROLLOUT_PAUSED_REMEDIATION_REQUIRED, {
      criticalOpen,
      highOpen,
    });
  }
  if (rolledBack) {
    return status(PHASE21_PROGRAMME_STATUS.ROLLED_BACK, {});
  }
  if (rolloutPaused) {
    return status(PHASE21_PROGRAMME_STATUS.ROLLOUT_PAUSED_REMEDIATION_REQUIRED, {});
  }
  if (!releaseGateOk) {
    return status(PHASE21_PROGRAMME_STATUS.BLOCKED, { reason: 'RELEASE_GATE' });
  }
  if (!sandboxValidated || !certificationApproved) {
    return status(PHASE21_PROGRAMME_STATUS.CONTROLS_READY_PRODUCTION_BLOCKED, {
      reason: 'SANDBOX_OR_CERTIFICATION_PENDING',
      mappedDecision: PHASE21_PROGRAMME_STATUS.BLOCKED,
      note: 'Phase 21 control framework is implemented; live Sandbox/certification/Production not executed in this workspace.',
    });
  }
  if (!productionChangeApproved || !pilotGo) {
    return status(PHASE21_PROGRAMME_STATUS.BLOCKED, { reason: 'CHANGE_OR_PILOT' });
  }
  if (rolloutComplete && hypercareExited && bauHandedOver) {
    if (deferredCohorts.length || controlledConditions.length) {
      return status(PHASE21_PROGRAMME_STATUS.PRODUCTION_ACTIVE_WITH_CONTROLLED_CONDITIONS, {
        deferredCohorts,
        controlledConditions,
      });
    }
    return status(PHASE21_PROGRAMME_STATUS.PRODUCTION_ROLLOUT_COMPLETE_AND_BAU_READY, {});
  }
  if (rolloutComplete && !hypercareExited) {
    return status(PHASE21_PROGRAMME_STATUS.HYPERCARE_EXTENSION_REQUIRED, {});
  }
  return status(PHASE21_PROGRAMME_STATUS.BLOCKED, { reason: 'INCOMPLETE' });
}

function status(decision, details) {
  return {
    decision: details.mappedDecision || decision,
    frameworkDecision: decision,
    details,
    decisionTimestamp: new Date().toISOString(),
    decisionVersion: 'phase21-programme-v1',
    mocksDoNotCertify: true,
    sandboxDoesNotImplyProduction: true,
  };
}
