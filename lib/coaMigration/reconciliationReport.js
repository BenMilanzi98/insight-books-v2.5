import prisma from '@/lib/prisma';

/**
 * Phase 7: lightweight GL checks (posted journal lines balance; optional BS hint).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 * @param {string} tenantId
 */
export async function buildCoaReconciliationReport(tenantId, db = prisma) {
  const statusList = ['Posted', 'posted'];

  const [jlAgg, tlAgg] = await Promise.all([
    db.journalEntryLine.aggregate({
      where: {
        journalEntry: { tenantId, status: { in: statusList } },
      },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    db.transactionLine.aggregate({
      where: {
        transaction: { tenantId, status: { in: ['posted', 'Posted'] } },
      },
      _sum: { debitAmount: true, creditAmount: true },
    }),
  ]);

  const jlDebit = jlAgg._sum.debitAmount ?? 0;
  const jlCredit = jlAgg._sum.creditAmount ?? 0;
  const jlBalanced = Math.abs(jlDebit - jlCredit) < 0.02;

  const tlDebit = tlAgg._sum.debitAmount ?? 0;
  const tlCredit = tlAgg._sum.creditAmount ?? 0;
  const tlBalanced = Math.abs(tlDebit - tlCredit) < 0.02;

  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true },
    select: { accountType: true, balance: true, accountCode: true },
  });

  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  for (const a of accounts) {
    const b = Number(a.balance) || 0;
    const t = (a.accountType || '').toLowerCase();
    if (t === 'asset') assets += b;
    else if (t === 'liability') liabilities += b;
    else if (t === 'equity') equity += b;
  }

  const bsResidual = Math.abs(assets - (liabilities + equity));
  const bsBalanced = bsResidual < 1;

  const cy = await db.account.findFirst({
    where: { tenantId, accountCode: '3300', isActive: true },
    select: { balance: true },
  });

  const [orphanedJournalLines, orphanedTransactionLines, migrationLogRows] = await Promise.all([
    db.journalEntryLine.count({
      where: {
        journalEntry: { tenantId, status: { in: statusList } },
        account: { tenantId, isActive: false },
      },
    }),
    db.transactionLine.count({
      where: {
        transaction: { tenantId, status: { in: ['posted', 'Posted'] } },
        account: { tenantId, isActive: false },
      },
    }),
    db.coaMigrationLog.count({ where: { tenantId, status: 'completed' } }),
  ]);

  const blocking =
    !jlBalanced ||
    !tlBalanced ||
    orphanedJournalLines > 0 ||
    orphanedTransactionLines > 0;

  return {
    tenantId,
    journalLines: { debit: jlDebit, credit: jlCredit, balanced: jlBalanced },
    transactionLines: { debit: tlDebit, credit: tlCredit, balanced: tlBalanced },
    balanceSheetHint: {
      assets,
      liabilities,
      equity,
      residual: bsResidual,
      balanced: bsBalanced,
    },
    currentYearEarnings3300: cy?.balance ?? null,
    orphanedPostedLines: {
      journalEntryLinesOnInactiveAccounts: orphanedJournalLines,
      transactionLinesOnInactiveAccounts: orphanedTransactionLines,
    },
    migrationLogCompletedRows: migrationLogRows,
    blocking,
    summary: blocking
      ? 'Blocking: journal/transaction imbalance or posted lines still pointing at inactive (retired) accounts.'
      : 'No blocking journal imbalance detected.',
  };
}
