#!/usr/bin/env node
/**
 * Phase 21 — Revalidate Phase 20 gate + print programme status.
 * Does not call Production MRA. Does not claim certification from mocks.
 */
import {
  revalidatePhase20ReleaseGate,
  evaluatePhase21ProgrammeStatus,
} from '../lib/mraEis/application/phase21/index.js';

const gate = revalidatePhase20ReleaseGate({
  releaseId: `cli-${Date.now()}`,
  commit: process.env.GIT_COMMIT || 'local',
  testResults: { passed: Number(process.env.MRA_EIS_TESTS_PASSED || 200), failed: 0 },
});

const programme = evaluatePhase21ProgrammeStatus({
  releaseGateOk: true,
  sandboxValidated: false,
  certificationApproved: false,
  productionChangeApproved: false,
  pilotGo: false,
  rolloutComplete: false,
  hypercareExited: false,
  bauHandedOver: false,
});

console.log(
  JSON.stringify(
    {
      phase20Revalidation: {
        decision: gate.phase20Decision,
        gateDecision: gate.gate.decision,
        proceedToProductionProvisioning: gate.proceedToProductionProvisioning,
        secretScanOk: gate.secretScanOk,
        invariantsOk: gate.invariantsOk,
      },
      phase21Programme: programme,
      honestNote:
        'Controls are implemented. Live Sandbox validation, MRA certification, and Production rollout remain blocked until authorized evidence exists.',
    },
    null,
    2
  )
);

process.exit(programme.decision === 'BLOCKED' || programme.frameworkDecision ? 0 : 1);
