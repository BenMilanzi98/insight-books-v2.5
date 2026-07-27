/**
 * Phase 20 — Machine-readable acceptance-criteria registry for Phases 1–19.
 * Every criterion has a status; none may disappear because automation is hard.
 */

export const AUTOMATION_STATUS = Object.freeze({
  AUTOMATED: 'AUTOMATED',
  PARTIALLY_AUTOMATED: 'PARTIALLY_AUTOMATED',
  MANUAL: 'MANUAL',
  BLOCKED: 'BLOCKED',
});

/** Compact indexed criteria — one row per major acceptance theme per phase. */
export const ACCEPTANCE_CRITERIA = Object.freeze([
  // Phase 1–3 research / architecture
  c(1, 'P1-001', 'CONTRACT', 'Official MRA contracts researched and discrepancy register created', 'CRITICAL', 'PARTIALLY_AUTOMATED', ['docs/mra-eis/phase-1'], true),
  c(2, 'P2-001', 'ARCHITECTURE', 'Target EIS architecture and bounded context defined', 'CRITICAL', 'PARTIALLY_AUTOMATED', ['docs/mra-eis/phase-2', 'test/mraEis.phase20.releaseReadiness.test.js'], true),
  c(3, 'P3-001', 'CONTROL', 'Platform availability, entitlement, participation controls', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase4.capability.test.js', 'test/mraEis.phase4.hasEISAccess.test.js'], true),
  // Phase 4–5
  c(4, 'P4-001', 'CAPABILITY', 'Effective EIS capability policies and state machines', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase4.capability.test.js', 'test/mraEis.phase4.stateMachines.test.js'], true),
  c(5, 'P5-001', 'SCHEMA', 'EIS schema, outbox, no plaintext secrets', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase5.noSecrets.test.js', 'test/mraEis.phase5.stateMachines.test.js'], true),
  c(5, 'P5-002', 'SECURITY', 'Value objects / domain events without secrets', 'HIGH', 'AUTOMATED', ['test/mraEis.phase5.valueObjects.test.js', 'test/mraEis.phase5.domainEvents.test.js'], true),
  // Phase 6–8
  c(6, 'P6-001', 'SECURITY', 'Credential references, vault metadata, no JWT persistence', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase6.security.test.js'], true),
  c(7, 'P7-001', 'TERMINAL', 'Terminal activation / readiness; browser cannot own secrets', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase7.activation.test.js', 'test/mraEis.phase7.readiness.test.js'], true),
  c(8, 'P8-001', 'CONFIGURATION', 'Configuration sync + immutable snapshots', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase8.configuration.test.js'], true),
  // Phase 9–11
  c(9, 'P9-001', 'MAPPING', 'Site/tax/levy/payment mappings with isolation', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase9.mapping.test.js'], true),
  c(10, 'P10-001', 'CATALOGUE', 'Product/Service catalogue sync + mappings', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase10.catalogue.test.js'], true),
  c(11, 'P11-001', 'ELIGIBILITY', 'POS/Invoice eligibility + local bridge', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase11.eligibility.test.js'], true),
  // Phase 12–15
  c(12, 'P12-001', 'FISCAL', 'Immutable Fiscal Snapshots + atomic sequences (no MAX+1)', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase12.fiscalSnapshot.test.js', 'test/mraEis.phase20.releaseReadiness.test.js'], true),
  c(13, 'P13-001', 'TRANSMISSION', 'Online transmission, attempts, evidence; HTTP≠acceptance', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase13.salesTransmission.test.js'], true),
  c(13, 'P13-002', 'CONTRACT', 'Live Sandbox sales contract verification', 'CRITICAL', 'BLOCKED', ['docs/mra-eis/phase-13'], true),
  c(14, 'P14-001', 'RECEIPT', 'Fiscal Receipt + QR; reprint immutability; no Journal', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase14.fiscalReceipt.test.js'], true),
  c(15, 'P15-001', 'RECONCILIATION', 'Reconciliation + safe retry; no blind unknown retry', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase15.reconciliation.test.js'], true),
  // Phase 16–17
  c(16, 'P16-001', 'OFFLINE', 'Certified offline, queues, signatures; no uncertified upload', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase16.offline.test.js'], true),
  c(16, 'P16-002', 'CONTRACT', 'Live Offline certification contracts', 'CRITICAL', 'BLOCKED', ['docs/mra-eis/phase-16'], true),
  c(17, 'P17-001', 'RESTRICTION', 'Multi-source restrictions; post-unblock revalidation', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase17.restrictions.test.js'], true),
  c(17, 'P17-002', 'CONTRACT', 'Live MRA unblock status contract', 'HIGH', 'BLOCKED', ['docs/mra-eis/phase-17'], true),
  // Phase 18–19
  c(18, 'P18-001', 'ADMIN', 'Admin Centre; intent-only commands; failed≠zero', 'HIGH', 'AUTOMATED', ['test/mraEis.phase18.admin.test.js'], true),
  c(19, 'P19-001', 'MIGRATION', 'Read-only sources, Dry Run, lineage, no historical transmit', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase19.migration.test.js'], true),
  c(19, 'P19-002', 'MIGRATION', 'Live Production source extraction', 'HIGH', 'BLOCKED', ['docs/mra-eis/phase-19'], false),
  // Cross-cutting Phase 20 validations
  c(20, 'P20-001', 'ISOLATION', 'Multi-Tenant / Environment isolation gates', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase20.releaseReadiness.test.js'], true),
  c(20, 'P20-002', 'SECURITY', 'Secret / JWT / private-key / BAC leak scanning', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase20.releaseReadiness.test.js'], true),
  c(20, 'P20-003', 'ACCOUNTING', 'No Journal/Stock from EIS secondary paths', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase20.releaseReadiness.test.js'], true),
  c(20, 'P20-004', 'RELEASE', 'Release-gate engine evaluates readiness from evidence', 'CRITICAL', 'AUTOMATED', ['test/mraEis.phase20.releaseReadiness.test.js'], true),
  c(20, 'P20-005', 'PERFORMANCE', 'Load/soak/chaos against Production-like staging', 'HIGH', 'BLOCKED', ['docs/mra-eis/phase-20'], false),
  c(20, 'P20-006', 'SANDBOX', 'Authorized live MRA Sandbox validation', 'CRITICAL', 'BLOCKED', ['docs/mra-eis/phase-20'], true),
]);

function c(phase, id, category, text, severity, automationStatus, testReferences, releaseBlocking) {
  return Object.freeze({
    id,
    phase,
    category,
    text,
    severity,
    automationStatus,
    testReferences,
    environmentRequirements:
      automationStatus === 'BLOCKED' ? ['MRA_SANDBOX_OR_OPS'] : ['LOCAL_UNIT', 'CI_UNIT', 'MOCK_MRA'],
    evidenceReferences: testReferences,
    releaseBlocking,
    currentResult: automationStatus === 'BLOCKED' ? 'BLOCKED' : 'PASS_WHEN_SUITE_GREEN',
  });
}

export function listAcceptanceCriteria({ phase = null, releaseBlockingOnly = false } = {}) {
  return ACCEPTANCE_CRITERIA.filter((r) => {
    if (phase != null && r.phase !== phase) return false;
    if (releaseBlockingOnly && !r.releaseBlocking) return false;
    return true;
  });
}

export function summarizeAcceptanceCoverage() {
  const all = ACCEPTANCE_CRITERIA;
  const byStatus = {};
  for (const r of all) {
    byStatus[r.automationStatus] = (byStatus[r.automationStatus] || 0) + 1;
  }
  const missingTests = all.filter(
    (r) => r.automationStatus !== 'BLOCKED' && (!r.testReferences || r.testReferences.length === 0)
  );
  return {
    total: all.length,
    byStatus,
    releaseBlocking: all.filter((r) => r.releaseBlocking).length,
    blockedReleaseBlocking: all.filter((r) => r.releaseBlocking && r.automationStatus === 'BLOCKED').length,
    missingTestReferences: missingTests.map((r) => r.id),
    everyCriterionHasStatus: all.every((r) => r.automationStatus && r.currentResult),
  };
}
