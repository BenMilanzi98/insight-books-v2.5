/**
 * Phase 6 — Repair batch framework.
 *
 * A batch is the unit of review, approval, execution, verification and
 * sign-off. Batches are business-scoped, checksummed over their action set,
 * carry before/after snapshots, and follow the controlled status machine in
 * the repair catalogue. Batch approval enforces separation of duties.
 */

import crypto from 'node:crypto';
import { RepairBatchStatus, BATCH_TRANSITIONS } from './repairCatalogue.js';
import { AccountingValidationError, ApprovalInvalidError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import {
  getCanonicalAccountTotals,
  canonicalTransactionWhere,
  canonicalJournalEntryWhere,
} from '../ledger/canonicalJournalSource.js';
import { getBusinessLedgerSummary } from '../ledger/ledgerQueryService.js';

function assertContext(context) {
  if (!context?.businessId) {
    throw new AccountingValidationError('Repair batches require a business-scoped context.', [
      { path: 'context.businessId', message: 'required' },
    ]);
  }
}

function assertTransition(from, to) {
  const allowed = BATCH_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AccountingValidationError(`Batch status cannot move ${from} → ${to}.`, [
      { path: 'status', message: `allowed from ${from}: ${allowed.join(', ') || '(terminal)'}` },
    ]);
  }
}

async function nextBatchNumber(db, tenantId) {
  const year = new Date().getFullYear();
  const count = await db.acctV2RepairBatch.count({ where: { tenantId } });
  return `REP-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function createBatch(db, context, input) {
  assertContext(context);
  if (!input.repairCategory || !input.description) {
    throw new AccountingValidationError('Repair batches require a category and description.', [
      { path: 'repairCategory/description', message: 'required' },
    ]);
  }
  const batch = await db.acctV2RepairBatch.create({
    data: {
      batchNumber: await nextBatchNumber(db, context.businessId),
      tenantId: context.businessId,
      financialYearLabel: input.financialYearLabel ?? null,
      accountingPeriodId: input.accountingPeriodId ?? null,
      repairCategory: input.repairCategory,
      description: input.description,
      status: RepairBatchStatus.DRAFT,
      dryRun: true,
      requestedBy: context.userId ?? null,
      requestId: context.requestId ?? null,
      correlationId: context.correlationId ?? null,
      backupReference: input.backupReference ?? null,
      rollbackPlan: input.rollbackPlan ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.batchCreated',
      entityType: 'AcctV2RepairBatch',
      entityId: batch.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { batchNumber: batch.batchNumber, repairCategory: batch.repairCategory },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return batch;
}

export async function getBatch(db, context, batchId) {
  assertContext(context);
  const batch = await db.acctV2RepairBatch.findFirst({
    where: { id: batchId, tenantId: context.businessId },
  });
  if (!batch) {
    throw new AccountingValidationError('Repair batch not found in this business.', [
      { path: 'batchId', message: 'unknown or cross-business batch' },
    ]);
  }
  return batch;
}

export async function listBatches(db, context, filters = {}) {
  assertContext(context);
  return db.acctV2RepairBatch.findMany({
    where: {
      tenantId: context.businessId,
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, filters.limit ?? 50),
  });
}

/** Deterministic checksum over the batch's action identities + command hashes. */
export async function computeBatchChecksum(db, context, batchId) {
  const actions = await db.acctV2RepairAction.findMany({
    where: { batchId, tenantId: context.businessId },
    orderBy: { id: 'asc' },
  });
  const payload = actions.map((a) => `${a.anomalyId}:${a.repairType}:${a.repairVersion}:${a.commandHash}`).join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** Controlled batch status transition with audit. */
export async function transitionBatch(db, context, batchId, toStatus, details = {}) {
  assertContext(context);
  const batch = await getBatch(db, context, batchId);
  assertTransition(batch.status, toStatus);

  if (toStatus === RepairBatchStatus.APPROVED) {
    // Separation of duties: the requester cannot approve their own batch.
    if (batch.requestedBy && batch.requestedBy === context.userId) {
      throw new ApprovalInvalidError(
        'Separation of duties: the batch requester cannot approve their own repair batch.'
      );
    }
    // An executable batch must carry a validated backup reference.
    if (!batch.backupReference && !details.backupReference) {
      throw new AccountingValidationError(
        'A validated backup reference is required before a repair batch can be approved.',
        [{ path: 'backupReference', message: 'required (see BACKUP_AND_RESTORE_VALIDATION.md)' }]
      );
    }
  }

  const data = { status: toStatus };
  if (toStatus === RepairBatchStatus.READY_FOR_REVIEW) {
    data.checksum = await computeBatchChecksum(db, context, batchId);
    data.recordCount = await db.acctV2RepairAction.count({
      where: { batchId, tenantId: context.businessId },
    });
  }
  if (toStatus === RepairBatchStatus.APPROVED) {
    data.approvedBy = context.userId ?? null;
    data.approvedAt = new Date();
    if (details.backupReference) data.backupReference = details.backupReference;
    // Refuse approval when the action set changed after review.
    const checksum = await computeBatchChecksum(db, context, batchId);
    if (batch.checksum && batch.checksum !== checksum) {
      throw new AccountingValidationError(
        'The batch action set changed after review; re-review is required before approval.',
        [{ path: 'checksum', message: 'stale review checksum' }]
      );
    }
  }
  if (toStatus === RepairBatchStatus.EXECUTING) {
    data.executedBy = context.userId ?? null;
    data.startedAt = batch.startedAt ?? new Date();
    data.dryRun = false;
  }
  if ([RepairBatchStatus.COMPLETED, RepairBatchStatus.PARTIALLY_COMPLETED, RepairBatchStatus.FAILED].includes(toStatus)) {
    data.completedAt = new Date();
    if (details.errorSummary) data.errorSummary = details.errorSummary;
  }
  if (toStatus === RepairBatchStatus.VERIFIED) {
    data.verifiedBy = context.userId ?? null;
  }

  const updated = await db.acctV2RepairBatch.update({ where: { id: batch.id }, data });
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.batchTransition',
      entityType: 'AcctV2RepairBatch',
      entityId: batch.id,
      userId: context.userId,
      tenantId: context.businessId,
      oldValues: { status: batch.status },
      newValues: { status: toStatus, ...details },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/**
 * Capture a business-scoped BEFORE or AFTER accounting snapshot for a batch:
 * canonical totals, per-account balances and a reproducible checksum.
 */
export async function captureSnapshot(db, context, batchId, phase) {
  assertContext(context);
  const batch = await getBatch(db, context, batchId);
  const totalsMap = await getCanonicalAccountTotals(db, context, {});
  let totalDebitMinor = 0;
  let totalCreditMinor = 0;
  let lineCount = 0;
  for (const [, t] of totalsMap) {
    totalDebitMinor += t.debitMinor;
    totalCreditMinor += t.creditMinor;
    lineCount += t.lineCount;
  }
  const [txCount, jeCount] = await Promise.all([
    db.transaction.count({ where: canonicalTransactionWhere(context.businessId) }),
    db.journalEntry.count({ where: canonicalJournalEntryWhere(context.businessId) }),
  ]);
  const summary = await getBusinessLedgerSummary(db, context, {});
  const balances = summary.accounts.map((a) => ({
    accountId: a.accountId,
    accountCode: a.accountCode ?? null,
    closingSignedMinor: a.closing.signedMinor,
  }));
  const body = {
    journalCount: txCount + jeCount,
    lineCount,
    totalDebitMinor,
    totalCreditMinor,
    balances,
  };
  const checksum = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const existing = await db.acctV2RepairSnapshot.findFirst({
    where: { batchId: batch.id, phase },
  });
  const data = {
    tenantId: context.businessId,
    batchId: batch.id,
    phase,
    journalCount: body.journalCount,
    lineCount: body.lineCount,
    totalDebitMinor: BigInt(body.totalDebitMinor),
    totalCreditMinor: BigInt(body.totalCreditMinor),
    balances,
    checksum,
  };
  if (existing) {
    return db.acctV2RepairSnapshot.update({ where: { id: existing.id }, data });
  }
  return db.acctV2RepairSnapshot.create({ data });
}
