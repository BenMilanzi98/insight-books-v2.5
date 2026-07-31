/**
 * Historical TaxTransaction backfill from posted V2 journals touching tax accounts.
 */

import prisma from '../prisma.js';
import { projectJournalToTaxSubledger } from './taxTransactionSubledger.js';

function subledgerEnabled(db = prisma) {
  return Boolean(db?.taxTransaction?.create);
}

/**
 * @returns {Promise<{ scannedJournals: number, writtenLines: number, skipped: boolean, message?: string }>}
 */
export async function backfillTaxTransactions({
  tenantId,
  startDate = null,
  endDate = null,
  limit = 500,
  db = prisma,
}) {
  if (!subledgerEnabled(db)) {
    return {
      scannedJournals: 0,
      writtenLines: 0,
      skipped: true,
      message: 'TaxTransaction model unavailable — run prisma generate and restart.',
    };
  }

  const taxTypes = await db.taxType.findMany({
    where: { tenantId },
    select: { accountId: true },
  });
  const accountIds = [...new Set(taxTypes.map((t) => t.accountId).filter(Boolean))];
  if (accountIds.length === 0) {
    return {
      scannedJournals: 0,
      writtenLines: 0,
      skipped: false,
      message: 'No tax-linked accounts found.',
    };
  }

  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const journals = await db.journalEntry.findMany({
    where: {
      tenantId,
      architectureVersion: 'ACCOUNTING_V2',
      status: 'Posted',
      ...(Object.keys(dateFilter).length
        ? {
            OR: [
              { postingDate: dateFilter },
              { entryDate: dateFilter },
            ],
          }
        : {}),
      lines: { some: { accountId: { in: accountIds } } },
    },
    include: {
      lines: true,
    },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Math.max(limit, 1), 2000),
  });

  let writtenLines = 0;
  for (const journal of journals) {
    const result = await projectJournalToTaxSubledger({
      tenantId,
      journalEntry: journal,
      lines: journal.lines || [],
      isReversal: Boolean(journal.originalJournalId || journal.reversalStatus === 'REVERSAL'),
      db,
    });
    writtenLines += result.written || 0;
  }

  return {
    scannedJournals: journals.length,
    writtenLines,
    skipped: false,
    message: `Projected ${writtenLines} line(s) from ${journals.length} journal(s).`,
  };
}
