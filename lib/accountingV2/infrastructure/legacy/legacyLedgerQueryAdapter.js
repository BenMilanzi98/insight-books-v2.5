/**
 * Accounting V2 — legacy ledger query adapter.
 *
 * READS: posted dual-ledger totals via `lib/officialLedgerEngine.js`
 *        (`TransactionLine` + non-mirrored `JournalEntryLine`, survivor rollup).
 * WRITES: nothing. This adapter is strictly read-only.
 *
 * Known inherited defects (documented, NOT corrected here — Phase 5/6):
 *  - Legacy header-amount `JournalEntry` rows (JRN-009) may distort balances.
 *  - Stored `Account.balance` drift is invisible to this adapter (it derives from lines).
 * Removal: Phase 5 replaces this with the V2 ledger read model.
 * Flag: consumers switch via `accountingV2NewLedgerQuery` (currently always legacy).
 */

import { buildOfficialLedgerTotals } from '../../../officialLedgerEngine.js';
import prisma from '../../../prisma.js';

/**
 * Account activity totals for a business over a date range, derived from posted
 * journal lines in the legacy dual-ledger system.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {{startDate: Date|string, endDate: Date|string, branchId?: string|null}} range
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<{totalsByAccountId: Map<string, object>, sourcePolicy: unknown}>}
 */
export async function getLegacyLedgerTotals(context, range, db = prisma) {
  return buildOfficialLedgerTotals({
    tenantId: context.businessId,
    branchId: range.branchId ?? null,
    startDate: range.startDate,
    endDate: range.endDate,
    prisma: db,
  });
}

/**
 * Raw posted lines for one account (drill-down lineage), tenant-scoped through the
 * parent journal. Read-only.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {string} accountId
 * @param {{startDate: Date|string, endDate: Date|string, take?: number, skip?: number}} range
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function getLegacyAccountLines(context, accountId, range, db = prisma) {
  return db.transactionLine.findMany({
    where: {
      accountId,
      transaction: {
        tenantId: context.businessId,
        status: { in: ['posted', 'Posted'] },
        date: { gte: new Date(range.startDate), lte: new Date(range.endDate) },
      },
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          reference: true,
          description: true,
          sourceType: true,
          sourceId: true,
          isReversal: true,
        },
      },
    },
    orderBy: { transaction: { date: 'asc' } },
    take: Math.min(range.take ?? 200, 1000),
    skip: range.skip ?? 0,
  });
}
