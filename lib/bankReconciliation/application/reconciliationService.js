/**
 * Reconciliation lifecycle — create, outstanding/DIT, calculate, approve, complete, snapshot, reopen.
 */

import {
  BankRecStatus,
  MatchStatus,
  OutstandingItemType,
  StatementMatchingStatus,
  OPEN_RECON_STATUSES,
} from '../domain/enums.js';
import { calculateReconciliation, progressPercent } from '../domain/calculation.js';
import { toSignedMinor, fromSignedMinor, daysBetween } from '../domain/signedAmount.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import {
  getPaymentAccountForRecon,
  assertReconcilablePaymentAccount,
  getConfiguration,
  upsertConfiguration,
} from './configService.js';
import { bookBalanceMinorAsOf, listGlCandidates } from './candidateService.js';

export async function createReconciliation(db, context, input) {
  const pa = await getPaymentAccountForRecon(db, context.businessId, input.paymentAccountId);
  assertReconcilablePaymentAccount(pa);

  let cfg = await getConfiguration(db, context.businessId, pa.id);
  if (!cfg) {
    cfg = await upsertConfiguration(db, context, { paymentAccountId: pa.id });
  }

  const statementDate = new Date(input.statementDate);
  const statementClosingBalance = input.statementClosingBalance;
  if (statementClosingBalance == null || statementClosingBalance === '') {
    throw new AccountingValidationError('statementClosingBalance is required.');
  }

  const open = await db.bankRecReconciliation.findFirst({
    where: {
      tenantId: context.businessId,
      paymentAccountId: pa.id,
      status: { in: [...OPEN_RECON_STATUSES] },
    },
  });
  if (open && !input.allowParallel) {
    throw new AccountingValidationError('An open reconciliation already exists for this account.', [
      { path: 'paymentAccountId', message: 'open recon', reconciliationId: open.id },
    ]);
  }

  const prior = await db.bankRecReconciliation.findMany({
    where: {
      tenantId: context.businessId,
      paymentAccountId: pa.id,
      statementDate,
    },
    orderBy: { version: 'desc' },
    take: 1,
  });
  const version = (prior[0]?.version || 0) + 1;

  const bookBalanceMinor = await bookBalanceMinorAsOf(db, context, pa.id, statementDate);

  const recon = await db.bankRecReconciliation.create({
    data: {
      tenantId: context.businessId,
      paymentAccountId: pa.id,
      coaAccountId: pa.coaAccountId,
      version,
      status: BankRecStatus.DRAFT,
      statementDate,
      periodStart: input.periodStart ? new Date(input.periodStart) : null,
      periodEnd: input.periodEnd ? new Date(input.periodEnd) : statementDate,
      statementOpeningBalance: input.statementOpeningBalance ?? null,
      statementClosingBalance,
      bookBalance: fromSignedMinor(bookBalanceMinor),
      differenceMinor: 0,
      currency: cfg.currency || input.currency || 'MWK',
      preparedBy: context.userId || null,
      preparedAt: new Date(),
      notes: input.notes || null,
      statusHistory: {
        create: {
          tenantId: context.businessId,
          fromStatus: null,
          toStatus: BankRecStatus.DRAFT,
          actorUserId: context.userId || null,
          reason: 'Created',
        },
      },
      approvals: {
        create: {
          tenantId: context.businessId,
          action: 'PREPARE',
          actorUserId: context.userId || 'system',
          comment: 'Reconciliation created',
        },
      },
    },
  });

  return recon;
}

export async function transitionStatus(db, context, reconciliationId, toStatus, reason) {
  const recon = await requireRecon(db, context, reconciliationId);
  const updated = await db.bankRecReconciliation.update({
    where: { id: recon.id },
    data: { status: toStatus },
  });
  await db.bankRecStatusHistory.create({
    data: {
      tenantId: context.businessId,
      reconciliationId: recon.id,
      fromStatus: recon.status,
      toStatus,
      reason: reason || null,
      actorUserId: context.userId || null,
    },
  });
  return updated;
}

export async function rebuildOutstandingItems(db, context, reconciliationId) {
  const recon = await requireRecon(db, context, reconciliationId);
  const cfg = await getConfiguration(db, context.businessId, recon.paymentAccountId);
  const staleDays = cfg?.staleOutstandingDays ?? 30;

  await db.bankRecOutstandingItem.deleteMany({ where: { reconciliationId: recon.id } });

  const candidates = await listGlCandidates(db, context, {
    paymentAccountId: recon.paymentAccountId,
    startDate: recon.periodStart,
    endDate: recon.periodEnd || recon.statementDate,
  });

  const asOf = recon.statementDate;
  const items = [];
  for (const c of candidates) {
    const aging = daysBetween(c.transactionDate, asOf);
    const isPayment = c.remainingAmountMinor < 0;
    items.push({
      tenantId: context.businessId,
      reconciliationId: recon.id,
      itemType: isPayment ? OutstandingItemType.OUTSTANDING_PAYMENT : OutstandingItemType.DEPOSIT_IN_TRANSIT,
      description: c.description || c.reference || c.journalEntryLineId,
      amountMinor: Math.abs(c.remainingAmountMinor),
      amount: fromSignedMinor(Math.abs(c.remainingAmountMinor)),
      itemDate: c.transactionDate,
      journalEntryLineId: c.journalEntryLineId,
      agingDays: aging,
      stale: aging > staleDays,
    });
  }

  // Statement rows still unmatched can be noted as exceptions later; outstanding are book-side
  if (items.length) {
    await db.bankRecOutstandingItem.createMany({ data: items });
  }

  const outstandingPayments = items
    .filter((i) => i.itemType === OutstandingItemType.OUTSTANDING_PAYMENT)
    .reduce((s, i) => s + i.amountMinor, 0);
  const depositsInTransit = items
    .filter((i) => i.itemType === OutstandingItemType.DEPOSIT_IN_TRANSIT)
    .reduce((s, i) => s + i.amountMinor, 0);

  await db.bankRecReconciliation.update({
    where: { id: recon.id },
    data: {
      outstandingPayments: fromSignedMinor(outstandingPayments),
      depositsInTransit: fromSignedMinor(depositsInTransit),
    },
  });

  return { items, outstandingPayments, depositsInTransit };
}

export async function calculateAndPersist(db, context, reconciliationId) {
  const recon = await requireRecon(db, context, reconciliationId);
  await rebuildOutstandingItems(db, context, reconciliationId);
  const refreshed = await requireRecon(db, context, reconciliationId);

  const adjustments = await db.bankRecAdjustmentLink.findMany({
    where: { reconciliationId: recon.id },
  });
  // Adjustments already posted to book are reflected in bookBalance; pending-only adj = 0
  // Use link amounts only when journal not yet affecting balance — treat as 0 to avoid double count
  const adjustmentsMinor = 0;

  const bookBalanceMinor = await bookBalanceMinorAsOf(
    db,
    context,
    refreshed.paymentAccountId,
    refreshed.statementDate
  );

  const cfg = await getConfiguration(db, context.businessId, refreshed.paymentAccountId);
  const calc = calculateReconciliation({
    statementClosingMinor: toSignedMinor(refreshed.statementClosingBalance),
    bookBalanceMinor,
    depositsInTransitMinor: toSignedMinor(refreshed.depositsInTransit || 0),
    outstandingPaymentsMinor: toSignedMinor(refreshed.outstandingPayments || 0),
    adjustmentsMinor,
    toleranceMinor: cfg?.amountToleranceMinor ?? 0,
  });

  const stmtStats = await db.bankRecStatementTransaction.groupBy({
    by: ['matchingStatus'],
    where: {
      tenantId: context.businessId,
      paymentAccountId: refreshed.paymentAccountId,
      OR: [{ reconciliationId: refreshed.id }, { reconciliationId: null }],
    },
    _count: true,
  });
  const matchedCount = stmtStats
    .filter((s) => [StatementMatchingStatus.MATCHED, StatementMatchingStatus.CLASSIFIED].includes(s.matchingStatus))
    .reduce((n, s) => n + s._count, 0);
  const totalCount = stmtStats.reduce((n, s) => n + s._count, 0);

  const updated = await db.bankRecReconciliation.update({
    where: { id: refreshed.id },
    data: {
      bookBalance: calc.decimals.bookBalance,
      clearedBookBalance: calc.decimals.adjustedBook,
      differenceMinor: calc.differenceMinor,
      adjustmentsTotal: fromSignedMinor(
        adjustments.reduce((s, a) => s + Number(a.amountMinor), 0)
      ),
      status: refreshed.status === BankRecStatus.DRAFT ? BankRecStatus.IN_PROGRESS : refreshed.status,
    },
  });

  return {
    reconciliation: updated,
    calculation: calc,
    progress: progressPercent({ matchedCount, totalCount }),
    matchedCount,
    totalCount,
    adjustmentCount: adjustments.length,
  };
}

export async function submitForReview(db, context, reconciliationId, comment) {
  await calculateAndPersist(db, context, reconciliationId);
  const recon = await transitionStatus(db, context, reconciliationId, BankRecStatus.IN_REVIEW, comment);
  await db.bankRecApproval.create({
    data: {
      tenantId: context.businessId,
      reconciliationId,
      action: 'REVIEW',
      actorUserId: context.userId || 'system',
      comment: comment || null,
    },
  });
  return recon;
}

export async function approveReconciliation(db, context, reconciliationId, comment) {
  const recon = await requireRecon(db, context, reconciliationId);
  const cfg = await getConfiguration(db, context.businessId, recon.paymentAccountId);
  if (cfg?.requireSeparateApprover && recon.preparedBy && recon.preparedBy === context.userId) {
    throw new AccountingValidationError('Separation of duties: preparer cannot approve.', [
      { path: 'approver', message: 'same as preparer' },
    ]);
  }
  const updated = await db.bankRecReconciliation.update({
    where: { id: recon.id },
    data: {
      status: BankRecStatus.APPROVED,
      approvedBy: context.userId || null,
      approvedAt: new Date(),
      reviewedBy: context.userId || null,
      reviewedAt: new Date(),
    },
  });
  await db.bankRecStatusHistory.create({
    data: {
      tenantId: context.businessId,
      reconciliationId: recon.id,
      fromStatus: recon.status,
      toStatus: BankRecStatus.APPROVED,
      actorUserId: context.userId || null,
      reason: comment || 'Approved',
    },
  });
  await db.bankRecApproval.create({
    data: {
      tenantId: context.businessId,
      reconciliationId,
      action: 'APPROVE',
      actorUserId: context.userId || 'system',
      comment: comment || null,
    },
  });
  return updated;
}

/**
 * Atomic complete + immutable snapshot. Difference must be within tolerance (no plug).
 */
export async function completeReconciliation(db, context, reconciliationId, comment) {
  const calcResult = await calculateAndPersist(db, context, reconciliationId);
  if (!calcResult.calculation.canComplete) {
    throw new AccountingValidationError(
      `Cannot complete: difference ${calcResult.calculation.decimals.difference} is outside tolerance.`,
      [{ path: 'differenceMinor', message: String(calcResult.calculation.differenceMinor) }]
    );
  }

  const recon = await requireRecon(db, context, reconciliationId);
  const cfg = await getConfiguration(db, context.businessId, recon.paymentAccountId);
  if (cfg?.requireSeparateApprover && recon.preparedBy && recon.preparedBy === context.userId) {
    throw new AccountingValidationError('Separation of duties: preparer cannot complete.', [
      { path: 'completer', message: 'same as preparer' },
    ]);
  }

  const matches = await db.bankRecMatch.findMany({
    where: { reconciliationId, status: MatchStatus.ACCEPTED },
    include: { links: true },
  });
  const outstanding = await db.bankRecOutstandingItem.findMany({ where: { reconciliationId } });
  const adjustments = await db.bankRecAdjustmentLink.findMany({ where: { reconciliationId } });
  const statements = await db.bankRecStatementTransaction.findMany({
    where: { reconciliationId },
  });

  const payload = {
    reconciliationId,
    version: recon.version,
    completedAt: new Date().toISOString(),
    calculation: calcResult.calculation,
    progress: calcResult.progress,
    statementClosingBalance: String(recon.statementClosingBalance),
    bookBalance: calcResult.calculation.decimals.bookBalance,
    outstandingPayments: calcResult.calculation.decimals.outstandingPayments,
    depositsInTransit: calcResult.calculation.decimals.depositsInTransit,
    difference: calcResult.calculation.decimals.difference,
    matchIds: matches.map((m) => m.id),
    outstandingItemIds: outstanding.map((o) => o.id),
    adjustmentIds: adjustments.map((a) => a.id),
    statementTransactionIds: statements.map((s) => s.id),
    paymentAccountId: recon.paymentAccountId,
    coaAccountId: recon.coaAccountId,
  };

  const completed = await db.$transaction(async (tx) => {
    const snap = await tx.bankRecSnapshot.create({
      data: {
        tenantId: context.businessId,
        reconciliationId,
        version: recon.version,
        payload,
        createdBy: context.userId || null,
      },
    });
    const row = await tx.bankRecReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: BankRecStatus.COMPLETED,
        completedBy: context.userId || null,
        completedAt: new Date(),
        differenceMinor: calcResult.calculation.differenceMinor,
        clearedBookBalance: calcResult.calculation.decimals.adjustedBook,
      },
    });
    await tx.bankRecStatusHistory.create({
      data: {
        tenantId: context.businessId,
        reconciliationId,
        fromStatus: recon.status,
        toStatus: BankRecStatus.COMPLETED,
        actorUserId: context.userId || null,
        reason: comment || 'Completed',
      },
    });
    await tx.bankRecApproval.create({
      data: {
        tenantId: context.businessId,
        reconciliationId,
        action: 'COMPLETE',
        actorUserId: context.userId || 'system',
        comment: comment || null,
      },
    });
    return { reconciliation: row, snapshot: snap };
  });

  return { ...completed, calculation: calcResult.calculation, progress: calcResult.progress };
}

/**
 * Reopen creates a new version; prior completed recon + snapshot remain immutable.
 */
export async function reopenReconciliation(db, context, reconciliationId, reason) {
  const recon = await requireRecon(db, context, reconciliationId);
  if (recon.status !== BankRecStatus.COMPLETED) {
    throw new AccountingValidationError('Only completed reconciliations can be reopened.');
  }

  await db.bankRecReconciliation.update({
    where: { id: recon.id },
    data: { status: BankRecStatus.REOPENED },
  });
  await db.bankRecStatusHistory.create({
    data: {
      tenantId: context.businessId,
      reconciliationId: recon.id,
      fromStatus: BankRecStatus.COMPLETED,
      toStatus: BankRecStatus.REOPENED,
      actorUserId: context.userId || null,
      reason: reason || 'Reopened',
    },
  });
  await db.bankRecApproval.create({
    data: {
      tenantId: context.businessId,
      reconciliationId: recon.id,
      action: 'REOPEN',
      actorUserId: context.userId || 'system',
      comment: reason || null,
    },
  });

  const next = await createReconciliation(db, context, {
    paymentAccountId: recon.paymentAccountId,
    statementDate: recon.statementDate,
    statementClosingBalance: recon.statementClosingBalance,
    statementOpeningBalance: recon.statementOpeningBalance,
    periodStart: recon.periodStart,
    periodEnd: recon.periodEnd,
    currency: recon.currency,
    notes: `Reopened from ${recon.id}: ${reason || ''}`.trim(),
    allowParallel: true,
  });

  await db.bankRecReconciliation.update({
    where: { id: next.id },
    data: { reopenedFromId: recon.id, status: BankRecStatus.IN_PROGRESS },
  });

  return { previous: recon, next: { ...next, reopenedFromId: recon.id, status: BankRecStatus.IN_PROGRESS } };
}

export async function reverseReconciliation(db, context, reconciliationId, reason) {
  const recon = await requireRecon(db, context, reconciliationId);
  if (![BankRecStatus.COMPLETED, BankRecStatus.REOPENED, BankRecStatus.APPROVED].includes(recon.status)) {
    throw new AccountingValidationError('Reconciliation cannot be reversed in current status.');
  }
  // Reverse accepted matches' statement remaining (snapshots stay)
  const matches = await db.bankRecMatch.findMany({
    where: { reconciliationId, status: MatchStatus.ACCEPTED },
    include: { links: true },
  });
  for (const match of matches) {
    for (const link of match.links) {
      if (link.side === 'STATEMENT' && link.statementTransactionId) {
        const st = await db.bankRecStatementTransaction.findUnique({ where: { id: link.statementTransactionId } });
        if (!st) continue;
        await db.bankRecStatementTransaction.update({
          where: { id: st.id },
          data: {
            remainingAmountMinor: Number(st.remainingAmountMinor) + Number(link.allocatedAmountMinor),
            matchingStatus: StatementMatchingStatus.UNMATCHED,
          },
        });
      }
    }
    await db.bankRecMatch.update({
      where: { id: match.id },
      data: { status: MatchStatus.REVERSED },
    });
  }

  const updated = await transitionStatus(db, context, reconciliationId, BankRecStatus.REVERSED, reason);
  await db.bankRecApproval.create({
    data: {
      tenantId: context.businessId,
      reconciliationId,
      action: 'REVERSE',
      actorUserId: context.userId || 'system',
      comment: reason || null,
    },
  });
  return updated;
}

export async function getReconciliationWorkspace(db, context, reconciliationId) {
  const recon = await requireRecon(db, context, reconciliationId);
  const [statements, matches, outstanding, adjustments, snapshots, calc] = await Promise.all([
    db.bankRecStatementTransaction.findMany({
      where: {
        tenantId: context.businessId,
        paymentAccountId: recon.paymentAccountId,
        OR: [{ reconciliationId }, { reconciliationId: null }],
      },
      orderBy: { transactionDate: 'asc' },
    }),
    db.bankRecMatch.findMany({
      where: { reconciliationId },
      include: { links: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.bankRecOutstandingItem.findMany({ where: { reconciliationId } }),
    db.bankRecAdjustmentLink.findMany({ where: { reconciliationId } }),
    db.bankRecSnapshot.findMany({ where: { reconciliationId } }),
    calculateAndPersist(db, context, reconciliationId),
  ]);
  return { reconciliation: calc.reconciliation, statements, matches, outstanding, adjustments, snapshots, calculation: calc };
}

async function requireRecon(db, context, id) {
  const recon = await db.bankRecReconciliation.findFirst({
    where: { id, tenantId: context.businessId },
  });
  if (!recon) {
    throw new AccountingValidationError('Reconciliation not found.', [{ path: 'reconciliationId', message: 'not found' }]);
  }
  return recon;
}

export async function listReconciliations(db, context, filters = {}) {
  return db.bankRecReconciliation.findMany({
    where: {
      tenantId: context.businessId,
      ...(filters.paymentAccountId ? { paymentAccountId: filters.paymentAccountId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: [{ statementDate: 'desc' }, { version: 'desc' }],
    take: filters.limit || 50,
  });
}
