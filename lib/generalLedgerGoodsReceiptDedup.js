import prisma from '@/lib/prisma';

/**
 * Goods receipts historically posted both a Transaction + a JournalEntry linked via
 * journalEntry.transactionId. The general ledger merges TransactionLine and JournalEntryLine,
 * which double-counts. Exclude those Transaction rows when a GoodsReceipt JournalEntry still points at them.
 *
 * @param {string} tenantId
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]
 * @returns {Promise<string[]>} Transaction IDs to omit from TransactionLine queries
 */
export async function getParallelGoodsReceiptTransactionIds(tenantId, client = prisma) {
  const rows = await client.journalEntry.findMany({
    where: {
      tenantId,
      sourceType: 'GoodsReceipt',
      transactionId: { not: null },
    },
    select: { transactionId: true },
  });
  return [...new Set(rows.map((r) => r.transactionId).filter(Boolean))];
}
