/**
 * Phase 6 — Post-repair verification.
 *
 * A batch (and its anomalies) reach VERIFIED only when, after the ledger
 * rebuild, the post-repair reconciliation passes and the measured impact
 * matches the approved expected impact. A completed rebuild alone is never
 * sufficient.
 */

import { RepairBatchStatus, RepairActionStatus, AnomalyStatus } from './repairCatalogue.js';
import { getBatch, transitionBatch, captureSnapshot } from './repairBatchService.js';
import { runLedgerReconciliation } from '../ledger/ledgerReconciliationService.js';
import { rebuildLedgerProjection } from '../ledger/ledgerRebuildService.js';
import { AccountingValidationError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';

/**
 * Verify a completed repair batch:
 *  1. every action completed (or explicitly failed and excluded),
 *  2. every repair journal balances (engine guarantees; re-checked),
 *  3. ledger projection rebuilt for the business,
 *  4. post-repair reconciliation findings reviewed: no NEW critical findings,
 *  5. AFTER snapshot captured and delta compared to expected impact.
 */
export async function verifyBatch(db, context, batchId, options = {}) {
  const batch = await getBatch(db, context, batchId);
  if (![RepairBatchStatus.COMPLETED, RepairBatchStatus.PARTIALLY_COMPLETED, RepairBatchStatus.VERIFYING].includes(batch.status)) {
    throw new AccountingValidationError(
      `Only completed batches can be verified (status: ${batch.status}).`,
      [{ path: 'batchId', message: 'complete execution first' }]
    );
  }
  if (batch.status !== RepairBatchStatus.VERIFYING) {
    await transitionBatch(db, context, batchId, RepairBatchStatus.VERIFYING);
  }

  const failures = [];

  // 1. Action states.
  const actions = await db.acctV2RepairAction.findMany({
    where: { batchId, tenantId: context.businessId },
  });
  const incomplete = actions.filter(
    (a) => ![RepairActionStatus.COMPLETED, RepairActionStatus.ROLLED_BACK].includes(a.status)
  );
  if (incomplete.length > 0) {
    failures.push(`${incomplete.length} action(s) not completed: ${incomplete.map((a) => a.id).join(', ')}`);
  }

  // 2. Every repair journal created by this batch balances and still exists.
  const journalIds = actions.flatMap((a) => (Array.isArray(a.journalEntryIds) ? a.journalEntryIds : []));
  for (const journalId of journalIds) {
    const journal = await db.journalEntry.findFirst({
      where: { id: journalId },
      include: { lines: true },
    });
    if (!journal) {
      failures.push(`Repair journal ${journalId} is missing — posted journals must never be deleted.`);
      continue;
    }
    let debit = 0;
    let credit = 0;
    for (const line of journal.lines) {
      debit += Math.round(Number(line.debitAmount ?? 0) * 100);
      credit += Math.round(Number(line.creditAmount ?? 0) * 100);
    }
    if (debit !== credit) failures.push(`Repair journal ${journalId} is unbalanced (${debit} vs ${credit}).`);
    if (journal.tenantId !== context.businessId) {
      failures.push(`Repair journal ${journalId} crossed business scope.`);
    }
  }

  // 3. Rebuild the ledger projection for this business (business-scoped).
  if (options.rebuildProjection !== false) {
    try {
      await rebuildLedgerProjection(db, context, {});
    } catch (err) {
      failures.push(`Ledger rebuild failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Post-repair reconciliation.
  const reconciliation = await runLedgerReconciliation(db, context, {
    compareStoredBalances: true,
    compareProjection: true,
    runJournalChecks: true,
  });
  const critical = reconciliation.findings.filter((f) =>
    ['GL-112', 'GL-117'].includes(f.rule)
  );
  if (critical.length > 0) {
    failures.push(
      `Post-repair reconciliation reports ${critical.length} critical finding(s): ${critical
        .map((f) => f.rule)
        .join(', ')}`
    );
  }

  // 5. AFTER snapshot + expected-vs-actual comparison.
  const after = await captureSnapshot(db, context, batchId, 'AFTER');
  const before = await db.acctV2RepairSnapshot.findFirst({
    where: { batchId, phase: 'BEFORE' },
  });
  let delta = null;
  if (before) {
    delta = {
      journalCount: after.journalCount - before.journalCount,
      lineCount: after.lineCount - before.lineCount,
      debitMinor: Number(after.totalDebitMinor) - Number(before.totalDebitMinor),
      creditMinor: Number(after.totalCreditMinor) - Number(before.totalCreditMinor),
    };
    if (delta.debitMinor !== delta.creditMinor) {
      failures.push(`Batch impact is unbalanced: Δdebit ${delta.debitMinor} vs Δcredit ${delta.creditMinor}.`);
    }
    const expectedDebit = Number(batch.expectedDebitMinor ?? 0);
    if (expectedDebit !== 0 && delta.debitMinor !== expectedDebit) {
      failures.push(`Actual debit impact ${delta.debitMinor} differs from expected ${expectedDebit}.`);
    }
  } else {
    failures.push('No BEFORE snapshot exists for this batch; capture it before execution next time.');
  }

  const passed = failures.length === 0;
  await db.acctV2RepairBatch.update({
    where: { id: batch.id },
    data: {
      actualDebitMinor: BigInt(delta?.debitMinor ?? 0),
      actualCreditMinor: BigInt(delta?.creditMinor ?? 0),
      ...(passed ? {} : { errorSummary: failures.join(' | ') }),
    },
  });
  await transitionBatch(
    db,
    context,
    batchId,
    passed ? RepairBatchStatus.VERIFIED : RepairBatchStatus.FAILED,
    passed ? {} : { errorSummary: failures.join(' | ') }
  );

  if (passed) {
    // Anomalies repaired by this batch move to VERIFIED only now.
    const repairedAnomalies = await db.acctV2HistoricalAnomaly.findMany({
      where: { repairBatchId: batchId, status: AnomalyStatus.REPAIRED },
    });
    for (const anomaly of repairedAnomalies) {
      await db.acctV2HistoricalAnomaly.update({
        where: { id: anomaly.id },
        data: {
          status: AnomalyStatus.VERIFIED,
          verificationStatus: 'PASSED',
          verifiedBy: context.userId ?? null,
          verifiedAt: new Date(),
        },
      });
    }
  }

  await recordAccountingAudit(
    {
      action: passed ? 'acctv2.repair.batchVerified' : 'acctv2.repair.batchVerificationFailed',
      entityType: 'AcctV2RepairBatch',
      entityId: batch.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { passed, failures, delta },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return {
    passed,
    failures,
    delta,
    reconciliationStatus: reconciliation.status,
    findingCount: reconciliation.findings.length,
    snapshot: { before: before?.checksum ?? null, after: after.checksum },
  };
}
