/**
 * Phase 20 — Release-gate engine.
 * Readiness is evidence-based. Mock success ≠ Sandbox certification ≠ Production readiness.
 */

import { summarizeAcceptanceCoverage, listAcceptanceCriteria } from './acceptanceCriteriaRegistry.js';
import { validateArchitectureInvariants } from './architectureInvariantRegistry.js';

export const RELEASE_DECISION = Object.freeze({
  READY: 'READY',
  READY_WITH_NON_BLOCKING_CONDITIONS: 'READY_WITH_NON_BLOCKING_CONDITIONS',
  NOT_READY_TEST_FAILURES: 'NOT_READY_TEST_FAILURES',
  NOT_READY_SECURITY: 'NOT_READY_SECURITY',
  NOT_READY_PERFORMANCE: 'NOT_READY_PERFORMANCE',
  NOT_READY_DATA_INTEGRITY: 'NOT_READY_DATA_INTEGRITY',
  NOT_READY_MRA_CONTRACT: 'NOT_READY_MRA_CONTRACT',
  NOT_READY_CERTIFICATION: 'NOT_READY_CERTIFICATION',
  NOT_READY_OPERATIONAL: 'NOT_READY_OPERATIONAL',
  BLOCKED: 'BLOCKED',
});

/**
 * @param {object} input
 * @returns {object} MraEisReleaseReadinessResult
 */
export function evaluateMraEisReleaseReadiness({
  releaseId = 'local',
  environment = 'MOCK_MRA',
  testResults = {},
  defects = { critical: 0, high: 0, medium: 0, low: 0 },
  securityFindings = { critical: 0, high: 0 },
  performanceResults = { withinBaseline: true, soakLeak: false },
  migrationResults = {
    journalCreated: false,
    stockMovementCreated: false,
    historicalSaleSubmitted: false,
    historicalOfflineUploaded: false,
  },
  mraContractStatus = { unresolvedBlocking: true },
  certificationStatus = { sandboxCertified: false, productionCertified: false },
  operationalReadiness = { backupRestoreRehearsed: false, deploymentRehearsed: false, rollbackRehearsed: false },
  invariantsValidation = null,
  secretScan = null,
  claimSandboxCertificationFromMocks = false,
  claimProductionReadinessFromMocks = false,
} = {}) {
  const blockers = [];
  const warnings = [];
  const passedGates = [];
  const failedGates = [];
  const conditions = [];

  if (claimSandboxCertificationFromMocks || claimProductionReadinessFromMocks) {
    blockers.push({
      gate: 'CERTIFICATION_CLAIMS',
      code: 'FALSE_CERTIFICATION_CLAIM',
      message: 'Mock or unit success must not claim Sandbox certification or Production readiness.',
    });
    failedGates.push('CERTIFICATION_CLAIMS');
  } else {
    passedGates.push('CERTIFICATION_CLAIMS');
  }

  const coverage = summarizeAcceptanceCoverage();
  if (!coverage.everyCriterionHasStatus) {
    blockers.push({ gate: 'ACCEPTANCE_REGISTRY', message: 'Acceptance criteria missing status.' });
    failedGates.push('ACCEPTANCE_REGISTRY');
  } else {
    passedGates.push('ACCEPTANCE_REGISTRY');
  }

  const inv = invariantsValidation || validateArchitectureInvariants();
  if (!inv.ok) {
    blockers.push({
      gate: 'ARCHITECTURE_INVARIANTS',
      message: 'Critical architecture invariant findings present.',
      findings: inv.criticalFindings,
    });
    failedGates.push('ARCHITECTURE_INVARIANTS');
  } else {
    passedGates.push('ARCHITECTURE_INVARIANTS');
  }

  if (secretScan && !secretScan.ok) {
    blockers.push({
      gate: 'SECRET_SCAN',
      message: 'Critical secret leakage findings.',
      count: secretScan.criticalCount,
    });
    failedGates.push('SECRET_SCAN');
  } else if (secretScan) {
    passedGates.push('SECRET_SCAN');
  }

  if ((defects.critical || 0) > 0) {
    blockers.push({ gate: 'DEFECTS', message: `${defects.critical} Critical defects open.` });
    failedGates.push('DEFECTS_CRITICAL');
  } else {
    passedGates.push('DEFECTS_CRITICAL');
  }

  if ((defects.high || 0) > 0) {
    blockers.push({ gate: 'DEFECTS', message: `${defects.high} High defects open.` });
    failedGates.push('DEFECTS_HIGH');
  } else {
    passedGates.push('DEFECTS_HIGH');
  }

  if ((securityFindings.critical || 0) > 0 || (securityFindings.high || 0) > 0) {
    blockers.push({ gate: 'SECURITY', message: 'Open exploitable security findings.' });
    failedGates.push('SECURITY');
  } else {
    passedGates.push('SECURITY');
  }

  if (testResults.failed > 0) {
    blockers.push({
      gate: 'TESTS',
      message: `${testResults.failed} failing tests.`,
    });
    failedGates.push('TESTS');
  } else if (testResults.passed > 0) {
    passedGates.push('TESTS');
  }

  if (
    migrationResults.journalCreated ||
    migrationResults.stockMovementCreated ||
    migrationResults.historicalSaleSubmitted ||
    migrationResults.historicalOfflineUploaded
  ) {
    blockers.push({
      gate: 'MIGRATION_INTEGRITY',
      message: 'Migration created financial/Inventory posts or submitted historical data.',
    });
    failedGates.push('MIGRATION_INTEGRITY');
  } else {
    passedGates.push('MIGRATION_INTEGRITY');
  }

  if (!performanceResults.withinBaseline || performanceResults.soakLeak) {
    blockers.push({ gate: 'PERFORMANCE', message: 'Performance baseline or soak failure.' });
    failedGates.push('PERFORMANCE');
  } else {
    passedGates.push('PERFORMANCE_SMOKE');
    warnings.push('Full load/soak/chaos against staging not claimed by unit gates.');
  }

  const blockedContracts = listAcceptanceCriteria({ releaseBlockingOnly: true }).filter(
    (r) => r.automationStatus === 'BLOCKED'
  );
  if (mraContractStatus.unresolvedBlocking || blockedContracts.length > 0) {
    warnings.push(
      `${blockedContracts.length} release-blocking criteria remain BLOCKED (MRA Sandbox/contracts/ops).`
    );
    conditions.push('Complete authorized MRA Sandbox validation before Production pilot.');
  }

  if (!certificationStatus.sandboxCertified) {
    conditions.push('Sandbox certification evidence required before Production enablement.');
  }
  if (!operationalReadiness.backupRestoreRehearsed) {
    conditions.push('Backup/restore rehearsal required for Production release.');
  }
  if (!operationalReadiness.deploymentRehearsed || !operationalReadiness.rollbackRehearsed) {
    conditions.push('Deployment and rollback rehearsals required for Production release.');
  }

  let decision;
  if (blockers.some((b) => b.code === 'FALSE_CERTIFICATION_CLAIM')) {
    decision = RELEASE_DECISION.BLOCKED;
  } else if (failedGates.includes('SECURITY') || failedGates.includes('SECRET_SCAN')) {
    decision = RELEASE_DECISION.NOT_READY_SECURITY;
  } else if (failedGates.includes('TESTS') || failedGates.includes('ARCHITECTURE_INVARIANTS')) {
    decision = RELEASE_DECISION.NOT_READY_TEST_FAILURES;
  } else if (failedGates.includes('MIGRATION_INTEGRITY') || failedGates.includes('DEFECTS_CRITICAL')) {
    decision = RELEASE_DECISION.NOT_READY_DATA_INTEGRITY;
  } else if (failedGates.includes('DEFECTS_HIGH')) {
    decision = RELEASE_DECISION.NOT_READY_TEST_FAILURES;
  } else if (failedGates.includes('PERFORMANCE')) {
    decision = RELEASE_DECISION.NOT_READY_PERFORMANCE;
  } else if (
    environment === 'PRODUCTION' &&
    (mraContractStatus.unresolvedBlocking || !certificationStatus.sandboxCertified)
  ) {
    decision = RELEASE_DECISION.NOT_READY_MRA_CONTRACT;
  } else if (
    environment === 'PRODUCTION' &&
    (!operationalReadiness.deploymentRehearsed || !operationalReadiness.rollbackRehearsed)
  ) {
    decision = RELEASE_DECISION.NOT_READY_OPERATIONAL;
  } else if (conditions.length > 0 || coverage.blockedReleaseBlocking > 0) {
    decision = RELEASE_DECISION.READY_WITH_NON_BLOCKING_CONDITIONS;
  } else {
    decision = RELEASE_DECISION.READY;
  }

  // Phase 20 product decision mapping for certification handoff
  const phase20Readiness =
    decision === RELEASE_DECISION.READY
      ? 'READY_FOR_PHASE_21'
      : decision === RELEASE_DECISION.READY_WITH_NON_BLOCKING_CONDITIONS
        ? 'READY_FOR_PHASE_21_WITH_BLOCKERS'
        : decision === RELEASE_DECISION.BLOCKED ||
            decision === RELEASE_DECISION.NOT_READY_SECURITY ||
            decision === RELEASE_DECISION.NOT_READY_DATA_INTEGRITY
          ? 'BLOCKED'
          : 'TEST_REMEDIATION_REQUIRED';

  return {
    releaseId,
    environment,
    decision,
    phase20Readiness,
    passedGates,
    failedGates,
    blockers,
    warnings,
    conditions,
    requiredActions: [
      ...blockers.map((b) => `Resolve: ${b.message || b.code}`),
      ...conditions,
    ],
    evidenceReferences: {
      acceptanceCoverage: coverage,
      invariants: { ok: inv.ok, passedStatic: inv.passedStatic?.length || 0 },
      testResults,
      defects,
      securityFindings,
      migrationResults,
      certificationStatus,
      operationalReadiness,
    },
    decisionTimestamp: new Date().toISOString(),
    decisionVersion: 'phase20-release-gate-v1',
    mocksDoNotCertify: true,
    sandboxDoesNotImplyProduction: true,
    productionMraNotCalledByDefault: true,
  };
}
