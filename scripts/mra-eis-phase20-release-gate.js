#!/usr/bin/env node
/**
 * Phase 20 — MRA EIS release-gate + secret scan CLI.
 * Does NOT call Production MRA. Does NOT claim Sandbox certification from mocks.
 *
 * Usage:
 *   node scripts/mra-eis-phase20-release-gate.js
 *   node scripts/mra-eis-phase20-release-gate.js --secrets-only
 */

import { spawnSync } from 'child_process';
import {
  validateArchitectureInvariants,
  scanPathsForSecrets,
  evaluateMraEisReleaseReadiness,
  seedPhase20CarryForwardBlockers,
  summarizeDefects,
  __resetDefectsForTests,
  summarizeAcceptanceCoverage,
} from '../lib/mraEis/application/phase20/index.js';

const secretsOnly = process.argv.includes('--secrets-only');

const secretScan = scanPathsForSecrets({
  roots: [
    'lib/mraEis',
    'app/api/mra-eis',
    'app/settings/integrations/mra-eis',
    'docs/mra-eis/phase-20',
  ],
});

console.log(
  JSON.stringify(
    {
      secretScan: {
        ok: secretScan.ok,
        findingCount: secretScan.findingCount,
        criticalCount: secretScan.criticalCount,
        findings: secretScan.findings.slice(0, 20),
      },
    },
    null,
    2
  )
);

if (secretsOnly) {
  process.exit(secretScan.ok ? 0 : 2);
}

__resetDefectsForTests();
seedPhase20CarryForwardBlockers();
const defects = summarizeDefects();
const invariants = validateArchitectureInvariants();
const coverage = summarizeAcceptanceCoverage();

let testFailed = 0;
let testPassed = 0;
const vitest = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'test/mraEis'],
  { encoding: 'utf8', shell: false }
);
const out = `${vitest.stdout || ''}\n${vitest.stderr || ''}`;
const passedMatch = out.match(/Tests\s+(\d+)\s+passed/);
const failedMatch = out.match(/(\d+)\s+failed/);
if (passedMatch) testPassed = Number(passedMatch[1]);
if (failedMatch) testFailed = Number(failedMatch[1]);
if (vitest.status !== 0 && testFailed === 0) testFailed = 1;

const result = evaluateMraEisReleaseReadiness({
  releaseId: `local-${Date.now()}`,
  environment: 'MOCK_MRA',
  testResults: { passed: testPassed, failed: testFailed },
  defects: {
    critical: defects.critical,
    high: defects.high,
    medium: defects.medium,
    low: defects.low,
  },
  securityFindings: {
    critical: secretScan.criticalCount,
    high: 0,
  },
  invariantsValidation: invariants,
  secretScan,
  migrationResults: {
    journalCreated: false,
    stockMovementCreated: false,
    historicalSaleSubmitted: false,
    historicalOfflineUploaded: false,
  },
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

console.log(
  JSON.stringify(
    {
      acceptanceCoverage: coverage,
      invariantsOk: invariants.ok,
      defects,
      releaseGate: {
        decision: result.decision,
        phase20Readiness: result.phase20Readiness,
        passedGates: result.passedGates,
        failedGates: result.failedGates,
        blockers: result.blockers,
        conditions: result.conditions,
        warnings: result.warnings,
      },
      vitestStatus: vitest.status,
      testPassed,
      testFailed,
    },
    null,
    2
  )
);

const ok =
  result.phase20Readiness === 'READY_FOR_PHASE_21' ||
  result.phase20Readiness === 'READY_FOR_PHASE_21_WITH_BLOCKERS';
process.exit(ok && testFailed === 0 && secretScan.ok ? 0 : 1);
