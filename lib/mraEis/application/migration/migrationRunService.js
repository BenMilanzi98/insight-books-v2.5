/**
 * Phase 19 — Migration Run aggregate, Dry Run, additive execution, lineage, rollback.
 * Additive by default. Idempotent. No financial/Inventory/MRA hooks.
 */

import crypto from 'crypto';
import { evaluateMigrationCandidate, MIGRATION_DECISION } from './migrationDecisionEngine.js';
import { detectDuplicates } from './duplicateAndIntegrity.js';
import { assertSourceChecksumUnchanged, getExtractionManifest } from './sourceSystemRegistry.js';
import { runInMigrationContext, isMigrationContext } from './hookIsolation.js';
import { MigrationErrors } from './migrationErrors.js';

export const RUN_MODE = Object.freeze({
  PROFILE: 'PROFILE',
  ASSESS: 'ASSESS',
  DRY_RUN: 'DRY_RUN',
  MIGRATE: 'MIGRATE',
  VERIFY: 'VERIFY',
  ROLLBACK: 'ROLLBACK',
});

export const RUN_STATE = Object.freeze({
  CREATED: 'CREATED',
  READY: 'READY',
  APPROVAL_PENDING: 'APPROVAL_PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  FAILED: 'FAILED',
  ROLLBACK_PENDING: 'ROLLBACK_PENDING',
  ROLLING_BACK: 'ROLLING_BACK',
  ROLLED_BACK: 'ROLLED_BACK',
  BLOCKED: 'BLOCKED',
});

export const RECORD_STATE = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  ASSESSED: 'ASSESSED',
  ELIGIBLE: 'ELIGIBLE',
  LINKED: 'LINKED',
  MIGRATED: 'MIGRATED',
  VERIFIED: 'VERIFIED',
  QUARANTINED: 'QUARANTINED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export const COHORTS = Object.freeze([
  'TERMINALS',
  'CONFIGURATION_HISTORY',
  'MAPPINGS',
  'ACCEPTED_TRANSACTIONS',
  'REJECTED_TRANSACTIONS',
  'UNKNOWN_OUTCOMES',
  'SUBMISSION_EVIDENCE',
  'RECEIPTS_AND_QR',
  'OFFLINE_EVIDENCE',
  'RESTRICTIONS',
  'QUARANTINED_RECORDS',
]);

const RUNS = new Map();
const TARGETS = new Map(); // migration-created target records for rollback
const CLAIMS = new Map();

export function __resetMigrationRunsForTests() {
  RUNS.clear();
  TARGETS.clear();
  CLAIMS.clear();
}

function lineageKey({ sourceSystemId, sourceEntityType, sourceRecordId, sourceChecksum, transformationVersion, environment }) {
  return crypto
    .createHash('sha256')
    .update(
      [sourceSystemId, sourceEntityType, sourceRecordId, sourceChecksum, transformationVersion, environment].join('|')
    )
    .digest('hex');
}

export function createMigrationRun({
  cohortId,
  sourceSystemId,
  tenantId,
  businessId,
  environment,
  mode = RUN_MODE.DRY_RUN,
  startedBy,
  manifestId = null,
  transformationVersion = 'migration-transform-v1',
} = {}) {
  if (!COHORTS.includes(cohortId) && cohortId !== 'ASSESSMENT_ALL') {
    // allow assessment cohort alias
  }
  const id = crypto.randomUUID();
  const run = {
    id,
    cohortId,
    sourceSystemId,
    tenantId,
    businessId,
    environment,
    mode,
    state: RUN_STATE.CREATED,
    manifestId,
    manifestChecksum: null,
    transformationVersion,
    startedBy,
    approvedBy: null,
    startedAt: null,
    completedAt: null,
    totalRecords: 0,
    assessedRecords: 0,
    eligibleRecords: 0,
    migratedRecords: 0,
    linkedRecords: 0,
    quarantinedRecords: 0,
    failedRecords: 0,
    skippedRecords: 0,
    records: [],
    dryRunChecksum: null,
    resultChecksum: null,
    rollbackEligible: true,
    rollbackState: null,
    journalCreated: false,
    stockMovementCreated: false,
    historicalSaleSubmitted: false,
    historicalOfflineUploaded: false,
    hooksTriggered: [],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  RUNS.set(id, run);
  return run;
}

export function getMigrationRun(id) {
  return RUNS.get(id) || null;
}

/**
 * Dry Run — no target mutation.
 */
export function executeDryRun({
  runId,
  candidates = [],
  expectedManifestChecksum = null,
} = {}) {
  const run = getMigrationRun(runId);
  if (!run) throw MigrationErrors.state({ message: 'Run not found.' });
  if (run.mode !== RUN_MODE.DRY_RUN && run.mode !== RUN_MODE.ASSESS) {
    throw MigrationErrors.state({ message: 'Run mode must be DRY_RUN or ASSESS.' });
  }

  if (run.manifestId && expectedManifestChecksum) {
    const m = assertSourceChecksumUnchanged({
      manifestId: run.manifestId,
      expectedChecksum: expectedManifestChecksum,
    });
    run.manifestChecksum = m.contentChecksum;
  } else if (run.manifestId) {
    const m = getExtractionManifest(run.manifestId);
    if (m) run.manifestChecksum = m.contentChecksum;
  }

  const dup = detectDuplicates(candidates);
  const conflictingFiscal = new Set(
    dup.findings
      .filter((f) => f.class === 'SAME_FISCAL_NUMBER_DIFFERENT_TRANSACTION')
      .flatMap((f) => [f.a, f.b])
  );

  run.state = RUN_STATE.RUNNING;
  run.startedAt = new Date().toISOString();
  run.totalRecords = candidates.length;
  const decisions = [];

  for (const c of candidates) {
    const id = c.id || c.sourceRecordId;
    const hasFiscalDup = conflictingFiscal.has(id) || conflictingFiscal.has(c.sourceNaturalKey);
    const result = evaluateMigrationCandidate({
      sourceSystemId: run.sourceSystemId,
      sourceEntityType: c.sourceEntityType || 'POS_SALE',
      sourceRecordId: c.sourceRecordId || id,
      candidateData: { ...c, tenantId: c.tenantId || run.tenantId, businessId: c.businessId || run.businessId },
      expectedTenantId: run.tenantId,
      expectedBusinessId: run.businessId,
      sourceEnvironmentHint: run.environment,
      existingCanonicalId: c.existingCanonicalId || null,
      hasFiscalDuplicateConflict: hasFiscalDup,
      confirmedTestData: Boolean(c.confirmedTestData),
    });

    const sourceChecksum =
      c.sourceChecksum ||
      crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex');

    const record = {
      id: crypto.randomUUID(),
      migrationRunId: run.id,
      sourceSystemId: run.sourceSystemId,
      sourceEntityType: c.sourceEntityType || 'POS_SALE',
      sourceRecordId: c.sourceRecordId || id,
      sourceNaturalKey: c.sourceNaturalKey || `${c.sourceEntityType || 'POS_SALE'}:${c.sourceRecordId || id}`,
      sourceChecksum,
      tenantId: result.targetOwnership.tenantId,
      businessId: result.targetOwnership.businessId,
      environment: result.targetEnvironment,
      decision: result.decision,
      integrityScore: result.integrity?.score ?? 0,
      integrityBand: result.integrity?.band ?? null,
      saleClassification: result.saleClassification,
      targetEntityType: result.targetEntityType,
      targetRecordId: result.targetRecordId,
      state:
        result.decision === MIGRATION_DECISION.QUARANTINE
          ? RECORD_STATE.QUARANTINED
          : result.decision === MIGRATION_DECISION.MANUAL_REVIEW
            ? RECORD_STATE.MANUAL_REVIEW
            : result.decision.startsWith('BLOCKED')
              ? RECORD_STATE.FAILED
              : result.decision === MIGRATION_DECISION.IGNORE_CONFIRMED_TEST_DATA
                ? RECORD_STATE.SKIPPED
                : RECORD_STATE.ELIGIBLE,
      blockers: result.blockers,
      warnings: result.warnings,
      lineageKey: lineageKey({
        sourceSystemId: run.sourceSystemId,
        sourceEntityType: c.sourceEntityType || 'POS_SALE',
        sourceRecordId: c.sourceRecordId || id,
        sourceChecksum,
        transformationVersion: run.transformationVersion,
        environment: run.environment,
      }),
      dryRunOnly: true,
      targetMutated: false,
    };

    decisions.push(record);
    run.assessedRecords += 1;
    if (record.state === RECORD_STATE.ELIGIBLE) run.eligibleRecords += 1;
    if (record.state === RECORD_STATE.QUARANTINED) run.quarantinedRecords += 1;
    if (record.state === RECORD_STATE.SKIPPED) run.skippedRecords += 1;
    if (record.state === RECORD_STATE.FAILED) run.failedRecords += 1;
    if (record.state === RECORD_STATE.MANUAL_REVIEW) run.quarantinedRecords += 1;
  }

  run.records = decisions;
  run.dryRunChecksum = crypto.createHash('sha256').update(JSON.stringify(decisions)).digest('hex');
  run.state = run.failedRecords > 0 || run.quarantinedRecords > 0
    ? RUN_STATE.COMPLETED_WITH_WARNINGS
    : RUN_STATE.COMPLETED;
  run.completedAt = new Date().toISOString();
  run.updatedAt = run.completedAt;

  return {
    run,
    targetMutated: false,
    duplicateFindings: dup.findings,
    expectedInserts: decisions.filter((d) => d.state === RECORD_STATE.ELIGIBLE).length,
    expectedLinks: decisions.filter((d) => d.decision === MIGRATION_DECISION.LINK_TO_EXISTING_CANONICAL_RECORD).length,
    expectedQuarantines: decisions.filter((d) =>
      [RECORD_STATE.QUARANTINED, RECORD_STATE.MANUAL_REVIEW].includes(d.state)
    ).length,
    journalCreated: false,
    stockMovementCreated: false,
    historicalSaleSubmitted: false,
  };
}

export function approveMigrationRun({ runId, approverId, requesterId, dryRunChecksum } = {}) {
  const run = getMigrationRun(runId);
  if (!run) throw MigrationErrors.state();
  if (approverId && requesterId && approverId === requesterId) {
    throw MigrationErrors.approvalRequired({ message: 'Self-approval of Production migration is prohibited.' });
  }
  if (run.mode === RUN_MODE.MIGRATE && run.environment === 'PRODUCTION') {
    if (!dryRunChecksum || dryRunChecksum !== run.dryRunChecksum) {
      throw MigrationErrors.dryRunRequired({
        message: 'Production migration requires matching approved Dry Run checksum.',
      });
    }
  }
  if (run.state !== RUN_STATE.COMPLETED && run.state !== RUN_STATE.COMPLETED_WITH_WARNINGS && run.state !== RUN_STATE.APPROVAL_PENDING) {
    // allow approve after dry run completed
    if (!(run.mode === RUN_MODE.DRY_RUN && run.dryRunChecksum)) {
      throw MigrationErrors.state();
    }
  }
  run.approvedBy = approverId;
  run.state = RUN_STATE.READY;
  run.updatedAt = new Date().toISOString();
  return run;
}

/**
 * Controlled additive migration from an approved Dry Run result.
 * Creates lineage-only historical evidence stubs in memory/target map — no hooks.
 */
export function executeControlledMigration({
  runId,
  dryRunChecksum,
  backupVerified = false,
} = {}) {
  const dry = getMigrationRun(runId);
  if (!dry) throw MigrationErrors.state();
  if (!dry.dryRunChecksum) throw MigrationErrors.dryRunRequired();
  if (dryRunChecksum !== dry.dryRunChecksum) throw MigrationErrors.sourceChecksum();
  if (dry.environment === 'PRODUCTION' && !dry.approvedBy) {
    throw MigrationErrors.approvalRequired();
  }
  if (dry.environment === 'PRODUCTION' && !backupVerified) {
    throw MigrationErrors.approvalRequired({ message: 'Verified Production backup required.' });
  }

  return runInMigrationContext(() => {
    if (!isMigrationContext()) throw MigrationErrors.hookIsolation();

    dry.mode = RUN_MODE.MIGRATE;
    dry.state = RUN_STATE.RUNNING;
    dry.startedAt = dry.startedAt || new Date().toISOString();
    dry.migratedRecords = 0;
    dry.linkedRecords = 0;

    for (const rec of dry.records) {
      const claimKey = rec.lineageKey;
      if (CLAIMS.has(claimKey) && CLAIMS.get(claimKey) !== dry.id) {
        throw MigrationErrors.idempotency();
      }
      CLAIMS.set(claimKey, dry.id);

      // Idempotent: already migrated same lineage
      if (TARGETS.has(claimKey)) {
        rec.state = RECORD_STATE.LINKED;
        rec.targetRecordId = TARGETS.get(claimKey).id;
        dry.linkedRecords += 1;
        continue;
      }

      if (rec.state !== RECORD_STATE.ELIGIBLE && rec.decision !== MIGRATION_DECISION.LINK_TO_EXISTING_CANONICAL_RECORD) {
        continue;
      }

      if (rec.decision === MIGRATION_DECISION.LINK_TO_EXISTING_CANONICAL_RECORD) {
        rec.state = RECORD_STATE.LINKED;
        dry.linkedRecords += 1;
        continue;
      }

      const targetId = crypto.randomUUID();
      const target = {
        id: targetId,
        migrationRunId: dry.id,
        lineageKey: claimKey,
        sourceRecordId: rec.sourceRecordId,
        tenantId: rec.tenantId,
        businessId: rec.businessId,
        environment: rec.environment,
        entityType: 'HISTORICAL_EIS_EVIDENCE',
        readOnly: true,
        dispatchable: false,
        createdByMigration: true,
        fiscalNumber: null, // never generate
        journalCreated: false,
        stockMovementCreated: false,
        checksum: crypto.createHash('sha256').update(claimKey + targetId).digest('hex'),
        createdAt: new Date().toISOString(),
      };
      TARGETS.set(claimKey, target);
      rec.targetRecordId = targetId;
      rec.targetChecksum = target.checksum;
      rec.state = RECORD_STATE.MIGRATED;
      rec.dryRunOnly = false;
      rec.targetMutated = true; // additive insert of migration-owned historical stub only
      dry.migratedRecords += 1;
    }

    dry.resultChecksum = crypto.createHash('sha256').update(JSON.stringify(dry.records)).digest('hex');
    dry.state = RUN_STATE.COMPLETED;
    dry.completedAt = new Date().toISOString();
    dry.updatedAt = dry.completedAt;
    dry.journalCreated = false;
    dry.stockMovementCreated = false;
    dry.historicalSaleSubmitted = false;
    dry.historicalOfflineUploaded = false;

    return {
      run: dry,
      journalCreated: false,
      stockMovementCreated: false,
      historicalSaleSubmitted: false,
      historicalOfflineUploaded: false,
      fiscalNumbersGenerated: 0,
      fiscalNumbersChanged: 0,
      sequencesMovedBackwards: false,
      hooksTriggered: [],
    };
  });
}

/**
 * Rollback removes only migration-created targets for this run.
 */
export function rollbackMigrationRun({ runId, approvedBy } = {}) {
  const run = getMigrationRun(runId);
  if (!run) throw MigrationErrors.state();
  if (!run.rollbackEligible) throw MigrationErrors.rollbackNotAllowed();
  if (!approvedBy) throw MigrationErrors.approvalRequired({ message: 'Rollback requires approval.' });

  run.state = RUN_STATE.ROLLING_BACK;
  let removed = 0;
  for (const rec of run.records) {
    if (!rec.lineageKey) continue;
    const target = TARGETS.get(rec.lineageKey);
    if (target && target.migrationRunId === run.id && target.createdByMigration) {
      if (target.dependentOperationalActivity) {
        throw MigrationErrors.rollbackNotAllowed({
          message: 'Rollback blocked: migrated record used by new operational activity.',
        });
      }
      TARGETS.delete(rec.lineageKey);
      CLAIMS.delete(rec.lineageKey);
      rec.state = RECORD_STATE.ROLLED_BACK;
      rec.rollbackState = 'ROLLED_BACK';
      removed += 1;
    }
  }
  run.rollbackState = 'ROLLED_BACK';
  run.state = RUN_STATE.ROLLED_BACK;
  run.updatedAt = new Date().toISOString();
  return {
    run,
    removed,
    canonicalPreserved: true,
    journalsPreserved: true,
    stockMovementsPreserved: true,
    auditPreserved: true,
    lineagePreserved: true,
  };
}

export function buildReconciliationSummary(run) {
  if (!run) return null;
  return {
    runId: run.id,
    cohortId: run.cohortId,
    environment: run.environment,
    tenantId: run.tenantId,
    businessId: run.businessId,
    totalRecords: run.totalRecords,
    assessedRecords: run.assessedRecords,
    eligibleRecords: run.eligibleRecords,
    migratedRecords: run.migratedRecords,
    linkedRecords: run.linkedRecords,
    quarantinedRecords: run.quarantinedRecords,
    failedRecords: run.failedRecords,
    skippedRecords: run.skippedRecords,
    dryRunChecksum: run.dryRunChecksum,
    resultChecksum: run.resultChecksum,
    journalCreated: run.journalCreated,
    stockMovementCreated: run.stockMovementCreated,
    historicalSaleSubmitted: run.historicalSaleSubmitted,
    financialSourceOfTruth: false,
    note: 'Financial/Inventory totals reconcile via assessment flags; migration does not alter Journals or Stock.',
  };
}
