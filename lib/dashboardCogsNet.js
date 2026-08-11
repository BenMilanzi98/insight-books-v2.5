/**
 * Dashboard / P&L COGS should follow the GL: debits to COGS (expense) minus credits
 * (void/refund/sale reversal journals credit COGS). Summing debits only ignores returns.
 *
 * Includes:
 *   - legacy Transaction / TransactionLine (older postings)
 *   - Accounting V2 JournalEntry / JournalEntryLine (Sale-COGS / Invoice-COGS)
 */

import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import { buildV2CogsJournalEntryAnd } from '@/lib/fetchCogsExpenseRegisterRows';

/**
 * Map dashboard `transactionWhere` (legacy Transaction filters) onto V2 JournalEntry filters.
 * @param {Record<string, unknown>} transactionWhere
 */
function buildV2JournalWhereFromTransactionWhere(transactionWhere = {}) {
  const dateRange = transactionWhere.date || null;
  const dateFrom = dateRange?.gte ?? null;
  const dateTo = dateRange?.lte ?? null;

  const branchClause = {};
  if (transactionWhere.branchId) {
    branchClause.branchId = transactionWhere.branchId;
  } else if (Array.isArray(transactionWhere.OR)) {
    // Preserve `{ OR: [{ branchId }, { branchId: null }] }` style branch filters.
    Object.assign(branchClause, { OR: transactionWhere.OR });
  }

  const v2And = buildV2CogsJournalEntryAnd({
    branchClause,
    dateFrom,
    dateTo,
  });

  const tenantFilter = {};
  if (transactionWhere.tenantId != null) {
    tenantFilter.tenantId = transactionWhere.tenantId;
  }

  return {
    ...tenantFilter,
    status: { in: ['Posted', 'POSTED', 'posted'] },
    AND: v2And,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 * @param {{ cogsAccountIds: string[], transactionWhere: Record<string, unknown> }} args
 * @returns {Promise<number>}
 */
export async function sumNetCogsDebitMinusCredit(client, { cogsAccountIds, transactionWhere }) {
  if (!cogsAccountIds?.length) return 0;

  const legacyBase = {
    accountId: { in: cogsAccountIds },
    transaction: transactionWhere,
  };

  const v2JournalWhere = buildV2JournalWhereFromTransactionWhere(transactionWhere);
  const v2Base = {
    accountId: { in: cogsAccountIds },
    journalEntry: v2JournalWhere,
  };

  const [legacyDebits, legacyCredits, v2Debits, v2Credits] = await Promise.all([
    client.transactionLine.aggregate({
      where: { ...legacyBase, debitAmount: { gt: 0 } },
      _sum: { debitAmount: true },
    }),
    client.transactionLine.aggregate({
      where: { ...legacyBase, creditAmount: { gt: 0 } },
      _sum: { creditAmount: true },
    }),
    client.journalEntryLine.aggregate({
      where: { ...v2Base, debitAmount: { gt: 0 } },
      _sum: { debitAmount: true },
    }),
    client.journalEntryLine.aggregate({
      where: { ...v2Base, creditAmount: { gt: 0 } },
      _sum: { creditAmount: true },
    }),
  ]);

  const legacyNet = subtractMoney(
    parseMoney(legacyDebits._sum.debitAmount),
    parseMoney(legacyCredits._sum.creditAmount)
  );
  const v2Net = subtractMoney(
    parseMoney(v2Debits._sum.debitAmount),
    parseMoney(v2Credits._sum.creditAmount)
  );

  return addMoney(legacyNet, v2Net);
}
