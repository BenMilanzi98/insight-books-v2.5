/**
 * Opening balance status report — reads posted onboarding transactions (single source of truth).
 */
import prisma from '@/lib/prisma';
import { resolveOpeningBalanceEquityAccount } from '@/lib/openingBalanceEquityAccount';
import { roundMoney } from '@/lib/money';
import { isOpeningBalancesLocked } from '@/lib/openingBalanceLock';

function parseNotes(raw) {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function lineTotals(lines) {
  let debits = 0;
  let credits = 0;
  for (const l of lines || []) {
    debits += Number(l.debitAmount) || 0;
    credits += Number(l.creditAmount) || 0;
  }
  return { debits: roundMoney(debits), credits: roundMoney(credits) };
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function buildOpeningBalanceStatusReport(tenantId, db = prisma) {
  const settings = await db.tenantSettings.findUnique({
    where: { tenantId },
    select: { openingBalancesAsOfDate: true },
  });

  const [equityAccount, locked, transactions] = await Promise.all([
    resolveOpeningBalanceEquityAccount(tenantId, db),
    isOpeningBalancesLocked(tenantId, db),
    db.transaction.findMany({
      where: {
        tenantId,
        status: 'posted',
        isReversal: false,
        OR: [
          { sourceType: 'onboarding' },
          { entryType: 'Opening', sourceType: { in: ['OpeningBalance', 'onboarding'] } },
        ],
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
                accountType: true,
              },
            },
          },
        },
      },
    }),
  ]);

  /** @type {Record<string, { type: string, total: number, items: object[] }>} */
  const byType = {};
  const journalEntries = [];

  for (const tx of transactions) {
    const meta = parseNotes(tx.notes);
    const type = meta.openingBalanceType || tx.sourceType || 'opening_other';
    const totals = lineTotals(tx.lines);

    if (!byType[type]) {
      byType[type] = { type, total: 0, items: [] };
    }

    const targetLines = tx.lines.filter(
      (l) => l.accountId !== equityAccount.id && (l.debitAmount > 0 || l.creditAmount > 0),
    );
    const amount = targetLines.reduce(
      (s, l) => s + Math.max(Number(l.debitAmount) || 0, Number(l.creditAmount) || 0),
      0,
    );

    byType[type].total = roundMoney(byType[type].total + amount);
    byType[type].items.push({
      transactionId: tx.id,
      reference: tx.reference,
      date: tx.date,
      description: tx.description,
      amount: roundMoney(amount),
      metadata: meta,
      debits: totals.debits,
      credits: totals.credits,
    });

    journalEntries.push({
      id: tx.id,
      reference: tx.reference,
      date: tx.date,
      description: tx.description,
      type,
      amount: roundMoney(amount),
      debits: totals.debits,
      credits: totals.credits,
    });
  }

  const equityLine = await db.transactionLine.aggregate({
    where: {
      accountId: equityAccount.id,
      transaction: {
        tenantId,
        status: 'posted',
        isReversal: false,
        OR: [{ sourceType: 'onboarding' }, { entryType: 'Opening' }],
      },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });

  const equityNet = roundMoney(
    (Number(equityLine._sum.creditAmount) || 0) - (Number(equityLine._sum.debitAmount) || 0),
  );

  const summary = {
    startingDate: settings?.openingBalancesAsOfDate || null,
    locked,
    equityAccount: {
      id: equityAccount.id,
      code: equityAccount.accountCode,
      name: equityAccount.accountName || equityAccount.name,
      balance: equityNet,
    },
    totalDebits: roundMoney(journalEntries.reduce((s, j) => s + j.debits, 0)),
    totalCredits: roundMoney(journalEntries.reduce((s, j) => s + j.credits, 0)),
    journalCount: journalEntries.length,
    stockTotal: byType.opening_stock?.total ?? 0,
    paymentAccountsTotal: byType.opening_payment_account?.total ?? 0,
    receivablesTotal: byType.opening_receivable?.total ?? 0,
    payablesTotal: byType.opening_payable?.total ?? 0,
    fixedAssetsTotal: byType.opening_fixed_asset?.total ?? 0,
    liabilitiesTotal: byType.opening_liability?.total ?? 0,
    bulkTotal: byType.opening_bulk?.total ?? 0,
  };

  return {
    summary,
    byType: Object.values(byType),
    journalEntries,
  };
}
