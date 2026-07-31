/**
 * Phase 6 — Repair execution.
 *
 * One strictly-typed, idempotent path for executing an approved repair:
 *
 *   - Repair identity `(businessId, anomalyId, repairType, repairVersion)` is a
 *     database unique key: the same repair can never run twice; a safe retry
 *     replays the stored result; changed instructions under the same key are
 *     rejected via the stored command hash.
 *   - Dry run computes the complete expected impact and writes NOTHING.
 *   - Journal-creating repair classes post through the Phase 4 posting engine
 *     (HISTORICAL_REPAIR template): validation pipeline, period control,
 *     approval enforcement, numbering, audit and outbox all apply. The action
 *     and anomaly rows are stamped inside the posting transaction, so no
 *     partial repair can survive a failure.
 *   - Metadata repairs apply only whitelisted non-financial fields, preserve
 *     previous values for rollback, and refuse cross-business targets.
 *   - Projection rebuilds and report-only repairs never touch journals.
 */

import crypto from 'node:crypto';
import {
  RepairType,
  JOURNAL_CREATING_REPAIRS,
  RepairActionStatus,
  AnomalyStatus,
  isRepairPermitted,
  APPROVAL_MATRIX,
} from './repairCatalogue.js';
import { getAnomaly } from './anomalyRegistryService.js';
import { getBatch } from './repairBatchService.js';
import { AccountingValidationError, ApprovalInvalidError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { executePosting } from '../engine/postingEngine.js';
import { AccountingSourceModule, AccountingEventType } from '../domain/enums.js';
import { rebuildLedgerProjection } from '../ledger/ledgerRebuildService.js';
import { logAccountingOperation, incrementMetric } from '../observability/accountingLogger.js';

/* ── Command contract ─────────────────────────────────────────────────────── */

/**
 * Non-financial fields a metadata repair may change, per target model.
 * Financial columns (accounts, amounts, statuses of posted V2 journals) are
 * structurally absent — a command naming any other field is rejected.
 */
const METADATA_FIELD_WHITELIST = Object.freeze({
  JournalEntry: [
    'sourceType',
    'sourceId',
    'sourceNumber',
    'accountingPeriodId',
    'referenceNumber',
    'description',
    'originalJournalId',
    'reversedByJournalId',
    'reversalStatus',
  ],
  Transaction: ['sourceType', 'sourceId', 'reference', 'branchId', 'description'],
  SupplierBill: ['journalEntryId'],
  SupplierPayment: ['journalEntryId'],
});

const METADATA_TARGET_DELEGATE = Object.freeze({
  JournalEntry: 'journalEntry',
  Transaction: 'transaction',
  SupplierBill: 'supplierBill',
  SupplierPayment: 'supplierPayment',
});

/**
 * Build and validate a strictly typed repair command. Server-side only —
 * raw SQL or arbitrary field updates are impossible through this contract.
 */
export function buildRepairCommand(input) {
  const issues = [];
  const req = (field) => {
    if (input[field] == null || input[field] === '') issues.push({ path: field, message: 'required' });
  };
  req('repairBatchId');
  req('anomalyId');
  req('businessId');
  req('repairType');
  req('reason');
  if (!Object.values(RepairType).includes(input.repairType)) {
    issues.push({ path: 'repairType', message: `unknown repair class: ${input.repairType}` });
  }
  const repairVersion = Number.isInteger(input.repairVersion) ? input.repairVersion : 1;
  if (repairVersion < 1) issues.push({ path: 'repairVersion', message: 'must be >= 1' });

  if (input.metadataChanges != null) {
    const { targetType, targetId, changes } = input.metadataChanges;
    if (!METADATA_FIELD_WHITELIST[targetType]) {
      issues.push({ path: 'metadataChanges.targetType', message: `unsupported target: ${targetType}` });
    } else {
      if (!targetId) issues.push({ path: 'metadataChanges.targetId', message: 'required' });
      const allowed = METADATA_FIELD_WHITELIST[targetType];
      for (const field of Object.keys(changes ?? {})) {
        if (!allowed.includes(field)) {
          issues.push({
            path: `metadataChanges.changes.${field}`,
            message: `field is not metadata-repairable on ${targetType} (financial fields are never editable)`,
          });
        }
      }
      if (!changes || Object.keys(changes).length === 0) {
        issues.push({ path: 'metadataChanges.changes', message: 'at least one whitelisted field required' });
      }
    }
  }

  if (input.proposedJournal != null) {
    const lines = input.proposedJournal.lines;
    if (!Array.isArray(lines) || lines.length < 2) {
      issues.push({ path: 'proposedJournal.lines', message: 'at least two lines required' });
    } else {
      lines.forEach((l, i) => {
        if (!l.accountId) issues.push({ path: `proposedJournal.lines[${i}].accountId`, message: 'required' });
        const hasDebit = l.debit != null && Number(l.debit) > 0;
        const hasCredit = l.credit != null && Number(l.credit) > 0;
        if (hasDebit === hasCredit) {
          issues.push({
            path: `proposedJournal.lines[${i}]`,
            message: 'exactly one of debit or credit must be a positive amount',
          });
        }
      });
    }
  }

  if (JOURNAL_CREATING_REPAIRS.includes(input.repairType) && input.proposedJournal == null) {
    issues.push({ path: 'proposedJournal', message: `${input.repairType} requires a proposed journal` });
  }
  if (input.repairType === RepairType.METADATA_ONLY_REPAIR && input.metadataChanges == null) {
    issues.push({ path: 'metadataChanges', message: 'METADATA_ONLY_REPAIR requires metadataChanges' });
  }

  if (issues.length > 0) {
    throw new AccountingValidationError(
      `Invalid repair command: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
      issues
    );
  }

  const command = Object.freeze({
    repairBatchId: input.repairBatchId,
    anomalyId: input.anomalyId,
    businessId: input.businessId,
    repairType: input.repairType,
    repairVersion,
    sourceReference: input.sourceReference ?? null,
    originalJournalId: input.originalJournalId ?? null,
    affectedJournalIds: input.affectedJournalIds ?? [],
    proposedJournal: input.proposedJournal ?? null,
    metadataChanges: input.metadataChanges ?? null,
    reason: String(input.reason),
    evidenceReferences: input.evidenceReferences ?? [],
    financialPeriod: input.financialPeriod ?? null,
    postingDate: input.postingDate ?? null,
    approvalReference: input.approvalReference ?? null,
    requestedBy: input.requestedBy ?? null,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    dryRun: Boolean(input.dryRun),
  });
  return { command, commandHash: hashCommand(command) };
}

/** Canonical, deterministic hash of the repair instructions. */
export function hashCommand(command) {
  const identity = {
    repairType: command.repairType,
    repairVersion: command.repairVersion,
    anomalyId: command.anomalyId,
    businessId: command.businessId,
    proposedJournal: command.proposedJournal,
    metadataChanges: command.metadataChanges,
    originalJournalId: command.originalJournalId,
    postingDate: command.postingDate,
  };
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

/* ── Dry run ──────────────────────────────────────────────────────────────── */

/**
 * Mandatory dry run: full expected impact, zero writes.
 */
export async function dryRunRepair(db, context, input) {
  const { command } = buildRepairCommand({ ...input, businessId: context.businessId, dryRun: true });
  const anomaly = await getAnomaly(db, context, command.anomalyId);
  const batch = await getBatch(db, context, command.repairBatchId);

  const warnings = [];
  const blockers = [];
  if (!isRepairPermitted(anomaly.anomalyType, command.repairType)) {
    blockers.push(`Repair class ${command.repairType} is not permitted for ${anomaly.anomalyType}.`);
  }
  if (anomaly.status !== AnomalyStatus.APPROVED_FOR_REPAIR && !['REPAIR_SCHEDULED', 'REPAIRING'].includes(anomaly.status)) {
    warnings.push(`Anomaly is in ${anomaly.status}; approval is required before execution.`);
  }
  if (!batch.backupReference) {
    warnings.push('Batch has no validated backup reference; approval will be refused.');
  }

  let expectedJournal = null;
  let debitImpactMinor = 0;
  let creditImpactMinor = 0;
  if (command.proposedJournal) {
    for (const line of command.proposedJournal.lines) {
      debitImpactMinor += Math.round(Number(line.debit ?? 0) * 100);
      creditImpactMinor += Math.round(Number(line.credit ?? 0) * 100);
    }
    if (debitImpactMinor !== creditImpactMinor) {
      blockers.push(
        `Proposed journal is unbalanced: debits ${debitImpactMinor} vs credits ${creditImpactMinor} minor units.`
      );
    }
    expectedJournal = {
      lines: command.proposedJournal.lines,
      totalDebitMinor: debitImpactMinor,
      totalCreditMinor: creditImpactMinor,
      postingDate: command.postingDate,
      description: `Historical repair (${command.repairType}) — ${command.reason}`,
    };
  }

  let metadataPreview = null;
  if (command.metadataChanges) {
    const { targetType, targetId, changes } = command.metadataChanges;
    const delegate = METADATA_TARGET_DELEGATE[targetType];
    const row = await db[delegate].findFirst({ where: { id: targetId } });
    if (!row) blockers.push(`Metadata target ${targetType}:${targetId} not found.`);
    else if (row.tenantId && row.tenantId !== context.businessId) {
      blockers.push(`Metadata target ${targetType}:${targetId} belongs to another business.`);
    } else {
      metadataPreview = Object.fromEntries(
        Object.entries(changes).map(([field, next]) => [field, { previous: row[field] ?? null, next }])
      );
    }
  }

  const matrix = APPROVAL_MATRIX[command.repairType];
  return {
    dryRun: true,
    anomaly: {
      id: anomaly.id,
      anomalyType: anomaly.anomalyType,
      severity: anomaly.severity,
      confidence: anomaly.confidence,
      status: anomaly.status,
    },
    repairType: command.repairType,
    reason: command.reason,
    evidenceReferences: command.evidenceReferences,
    expectedJournal,
    metadataChanges: metadataPreview,
    debitImpactMinor,
    creditImpactMinor,
    periodImpact: command.postingDate ? { postingDate: command.postingDate } : null,
    approvalRequirement: matrix,
    rollbackPlan:
      command.metadataChanges != null
        ? 'Restore stored previous values through the rollback action.'
        : command.proposedJournal != null
          ? 'Authorized reversal of the repair journal; the repair journal is never deleted.'
          : 'Re-run projection rebuild / redeploy previous code.',
    warnings,
    blockers,
    wouldExecute: blockers.length === 0,
  };
}

/* ── Execution ────────────────────────────────────────────────────────────── */

/**
 * Execute one approved repair action idempotently.
 */
export async function executeRepair(db, context, input, options = {}) {
  const { command, commandHash } = buildRepairCommand({
    ...input,
    businessId: context.businessId,
    dryRun: false,
  });
  const anomaly = await getAnomaly(db, context, command.anomalyId);
  const batch = await getBatch(db, context, command.repairBatchId);

  // Idempotent replay FIRST: a completed repair replays its stored result even
  // after the anomaly moved on to REPAIRED/VERIFIED; changed instructions under
  // the same identity are rejected regardless of downstream state.
  const prior = await db.acctV2RepairAction.findFirst({
    where: {
      tenantId: context.businessId,
      anomalyId: anomaly.id,
      repairType: command.repairType,
      repairVersion: command.repairVersion,
    },
  });
  if (prior) {
    if (prior.commandHash !== commandHash) {
      throw new AccountingValidationError(
        'A repair with this identity already exists with DIFFERENT instructions; bump repairVersion for a new repair.',
        [{ path: 'repairVersion', message: 'conflicting instructions under the same repair identity' }]
      );
    }
    if (prior.status === RepairActionStatus.COMPLETED) {
      return { wasExistingRepair: true, action: prior };
    }
  }

  if (!isRepairPermitted(anomaly.anomalyType, command.repairType)) {
    throw new AccountingValidationError(
      `Repair class ${command.repairType} is not permitted for anomaly type ${anomaly.anomalyType}.`,
      [{ path: 'repairType', message: 'not permitted' }]
    );
  }
  if (!['APPROVED', 'SCHEDULED', 'EXECUTING'].includes(batch.status)) {
    throw new AccountingValidationError(
      `Repair batch must be approved before execution (status: ${batch.status}).`,
      [{ path: 'batch.status', message: 'approve the batch first' }]
    );
  }
  if (!['APPROVED_FOR_REPAIR', 'REPAIR_SCHEDULED', 'REPAIRING'].includes(anomaly.status)) {
    throw new AccountingValidationError(
      `Anomaly must be approved for repair (status: ${anomaly.status}).`,
      [{ path: 'anomaly.status', message: 'approval required' }]
    );
  }
  // Separation of duties for high-risk classes: approver ≠ executor.
  const matrix = APPROVAL_MATRIX[command.repairType];
  if (matrix?.separationOfDuties && anomaly.approvedBy && anomaly.approvedBy === context.userId) {
    throw new ApprovalInvalidError(
      'Separation of duties: the approver of this repair cannot also execute it.'
    );
  }

  // ── Idempotency claim ────────────────────────────────────────────────────
  let action;
  try {
    action = await db.acctV2RepairAction.create({
      data: {
        tenantId: context.businessId,
        batchId: batch.id,
        anomalyId: anomaly.id,
        repairType: command.repairType,
        repairVersion: command.repairVersion,
        commandHash,
        status: RepairActionStatus.PENDING,
        dryRun: false,
        reason: command.reason,
        approvalReference: command.approvalReference,
        approvedBy: anomaly.approvedBy,
        executedBy: context.userId ?? null,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await db.acctV2RepairAction.findFirst({
        where: {
          tenantId: context.businessId,
          anomalyId: anomaly.id,
          repairType: command.repairType,
          repairVersion: command.repairVersion,
        },
      });
      if (existing.commandHash !== commandHash) {
        throw new AccountingValidationError(
          'A repair with this identity already exists with DIFFERENT instructions; bump repairVersion for a new repair.',
          [{ path: 'repairVersion', message: 'conflicting instructions under the same repair identity' }]
        );
      }
      if (existing.status === RepairActionStatus.COMPLETED) {
        // Safe retry: replay the original result without re-executing.
        return { wasExistingRepair: true, action: existing };
      }
      // Resume an interrupted attempt: re-open the action for execution.
      action = await db.acctV2RepairAction.update({
        where: { id: existing.id },
        data: {
          status: RepairActionStatus.PENDING,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          errorMessage: null,
        },
      });
    } else {
      throw err;
    }
  }

  try {
    let result;
    if (JOURNAL_CREATING_REPAIRS.includes(command.repairType)) {
      result = await executeJournalRepair(db, context, { command, anomaly, batch, action, options });
    } else if (command.repairType === RepairType.METADATA_ONLY_REPAIR
      || command.repairType === RepairType.SOURCE_LINK_REPAIR
      || command.repairType === RepairType.SOURCE_STATUS_REPAIR) {
      result = await executeMetadataRepair(db, context, { command, anomaly, action });
    } else if (command.repairType === RepairType.PROJECTION_REBUILD) {
      const rebuild = await rebuildLedgerProjection(db, context, {});
      result = await completeNonJournalAction(db, context, action, anomaly, {
        projectionVersion: rebuild.projectionVersion ?? null,
        kind: 'PROJECTION_REBUILD',
      });
    } else if (command.repairType === RepairType.REPORT_ONLY_REPAIR) {
      result = await completeNonJournalAction(db, context, action, anomaly, {
        kind: 'REPORT_ONLY_REPAIR',
        codeChangeReference: command.evidenceReferences.join(', ') || command.reason,
      });
    } else {
      throw new AccountingValidationError(`Unhandled repair class: ${command.repairType}`, []);
    }

    incrementMetric('repair.actions.completed');
    logAccountingOperation({
      operation: 'repair.action.completed',
      tenantId: context.businessId,
      anomalyId: anomaly.id,
      batchId: batch.id,
      repairType: command.repairType,
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
    return result;
  } catch (err) {
    // Preserve the failed attempt; the anomaly stays unresolved; retry is safe.
    await db.acctV2RepairAction.update({
      where: { id: action.id },
      data: {
        status: RepairActionStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    incrementMetric('repair.actions.failed');
    throw err;
  }
}

/** Journal-creating repairs post through the Phase 4 engine. */
async function executeJournalRepair(db, context, { command, anomaly, batch, action, options }) {
  // The engine posts EXACTLY the approved proposal stored on the anomaly.
  // Guard: the command's proposed journal must equal the approved proposal.
  const approved = anomaly.proposedRepairData;
  if (!approved || JSON.stringify(approved.lines) !== JSON.stringify(command.proposedJournal.lines)) {
    throw new AccountingValidationError(
      'The proposed journal differs from the approved repair proposal; re-approval is required.',
      [{ path: 'proposedJournal', message: 'must match the approved proposal exactly' }]
    );
  }
  const postingInput = {
    context,
    sourceReference: {
      sourceModule: AccountingSourceModule.MIGRATION,
      sourceType: 'AcctV2RepairAction',
      sourceId: action.id,
      sourceNumber: batch.batchNumber,
      eventType: AccountingEventType.HISTORICAL_REPAIR_POSTED,
    },
    transactionDate: (approved.transactionDate ?? command.postingDate ?? new Date().toISOString()).slice(0, 10),
    requestedPostingDate: command.postingDate ?? null,
    currency: approved.currency ?? context.currency ?? 'MWK',
    exchangeRate: approved.exchangeRate ?? 1,
    description: `Historical repair (${command.repairType}) — ${command.reason}`,
    dimensions: approved.dimensions ?? {},
    metadata: {
      repairType: command.repairType,
      anomalyId: anomaly.id,
      repairBatchId: batch.id,
      evidenceReferences: command.evidenceReferences,
    },
    approvalReference: command.approvalReference ?? anomaly.id,
    initiatedBy: context.userId,
    hasPermission: options.hasPermission ?? (() => true),
  };
  const posting = await executePosting(postingInput, db);
  const refreshed = await db.acctV2RepairAction.findFirst({ where: { id: action.id } });
  return { wasExistingRepair: Boolean(posting.wasExistingPosting), action: refreshed, posting };
}

/** Metadata repairs: whitelisted fields, previous values preserved, atomic. */
async function executeMetadataRepair(db, context, { command, anomaly, action }) {
  const { targetType, targetId, changes } = command.metadataChanges;
  const delegate = METADATA_TARGET_DELEGATE[targetType];
  const row = await db[delegate].findFirst({ where: { id: targetId } });
  if (!row) {
    throw new AccountingValidationError(`Metadata target ${targetType}:${targetId} not found.`, [
      { path: 'metadataChanges.targetId', message: 'unknown record' },
    ]);
  }
  if (row.tenantId && row.tenantId !== context.businessId) {
    throw new AccountingValidationError('Metadata target belongs to another business.', [
      { path: 'metadataChanges.targetId', message: 'cross-business repair refused' },
    ]);
  }
  const previousValues = {};
  for (const field of Object.keys(changes)) previousValues[field] = row[field] ?? null;

  const runner = typeof db.$transaction === 'function' ? db.$transaction.bind(db) : null;
  const work = async (tx) => {
    await tx[delegate].update({ where: { id: targetId }, data: changes });
    const updatedAction = await tx.acctV2RepairAction.update({
      where: { id: action.id },
      data: {
        status: RepairActionStatus.COMPLETED,
        previousValues,
        newValues: changes,
        resultSummary: { targetType, targetId, fields: Object.keys(changes) },
      },
    });
    await tx.acctV2HistoricalAnomaly.update({
      where: { id: anomaly.id },
      data: { status: AnomalyStatus.REPAIRED, repairedAt: new Date(), repairBatchId: action.batchId },
    });
    return updatedAction;
  };
  const updatedAction = runner ? await runner(work) : await work(db);

  await recordAccountingAudit(
    {
      action: 'acctv2.repair.metadataApplied',
      entityType: targetType,
      entityId: targetId,
      userId: context.userId,
      tenantId: context.businessId,
      oldValues: previousValues,
      newValues: changes,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return { wasExistingRepair: false, action: updatedAction };
}

async function completeNonJournalAction(db, context, action, anomaly, resultSummary) {
  const updatedAction = await db.acctV2RepairAction.update({
    where: { id: action.id },
    data: { status: RepairActionStatus.COMPLETED, resultSummary },
  });
  await db.acctV2HistoricalAnomaly.update({
    where: { id: anomaly.id },
    data: { status: AnomalyStatus.REPAIRED, repairedAt: new Date(), repairBatchId: action.batchId },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.nonJournalCompleted',
      entityType: 'AcctV2RepairAction',
      entityId: action.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: resultSummary,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return { wasExistingRepair: false, action: updatedAction };
}

/* ── Rollback ─────────────────────────────────────────────────────────────── */

/**
 * Roll back a completed METADATA repair by restoring stored previous values.
 * Journal repairs are never rolled back this way — an incorrect repair
 * journal is corrected by a further approved reversal repair.
 */
export async function rollbackMetadataRepair(db, context, actionId) {
  const action = await db.acctV2RepairAction.findFirst({
    where: { id: actionId, tenantId: context.businessId },
  });
  if (!action) {
    throw new AccountingValidationError('Repair action not found in this business.', [
      { path: 'actionId', message: 'unknown or cross-business action' },
    ]);
  }
  if (action.status !== RepairActionStatus.COMPLETED || !action.previousValues) {
    throw new AccountingValidationError('Only completed metadata repairs with stored previous values can roll back.', [
      { path: 'actionId', message: `status=${action.status}` },
    ]);
  }
  const { targetType, targetId } = action.resultSummary ?? {};
  const delegate = METADATA_TARGET_DELEGATE[targetType];
  if (!delegate) {
    throw new AccountingValidationError('This action did not perform a metadata repair.', [
      { path: 'actionId', message: 'no metadata target recorded' },
    ]);
  }
  const runner = typeof db.$transaction === 'function' ? db.$transaction.bind(db) : null;
  const work = async (tx) => {
    await tx[delegate].update({ where: { id: targetId }, data: action.previousValues });
    await tx.acctV2RepairAction.update({
      where: { id: action.id },
      data: {
        status: RepairActionStatus.ROLLED_BACK,
        rolledBackAt: new Date(),
        rolledBackBy: context.userId ?? null,
      },
    });
    await tx.acctV2HistoricalAnomaly.update({
      where: { id: action.anomalyId },
      data: { status: AnomalyStatus.ROLLED_BACK },
    });
  };
  runner ? await runner(work) : await work(db);
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.metadataRolledBack',
      entityType: targetType,
      entityId: targetId,
      userId: context.userId,
      tenantId: context.businessId,
      oldValues: action.newValues,
      newValues: action.previousValues,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return db.acctV2RepairAction.findFirst({ where: { id: action.id } });
}
