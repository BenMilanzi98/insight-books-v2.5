/**
 * Batch GL posting — runs multiple postGlEntry calls in a single database transaction.
 */

import prisma from '../prisma.js';
import { postGlEntry, AccountingEngineError } from './postGlEntry.js';

/**
 * Post multiple balanced GL entries atomically.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {Date|string} params.entryDate Default date when an entry omits entryDate
 * @param {string|null} [params.branchId] Default branch when an entry omits branchId
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [params.tx]
 * @param {Array<{ description: string, reference?: string, sourceType?: string, sourceId?: string, entryType?: string, entryDate?: Date|string, branchId?: string|null, lines: object[] }>} params.entries
 * @returns {Promise<import('@prisma/client').Transaction[]>}
 */
export async function postGlEntryBatch({
  tenantId,
  userId,
  entryDate,
  branchId = null,
  tx = null,
  entries,
}) {
  if (!tenantId || !userId) {
    throw new AccountingEngineError('tenantId and userId are required.');
  }
  if (!entries?.length) {
    throw new AccountingEngineError('At least one entry is required.');
  }

  const runBatch = async (client) => {
    const transactions = [];
    for (const entry of entries) {
      if (!entry.description?.trim()) {
        throw new AccountingEngineError('Each batch entry must include a description.');
      }
      if (!entry.lines?.length) {
        throw new AccountingEngineError('Each batch entry must include lines.');
      }

      const transaction = await postGlEntry({
        tenantId,
        userId,
        entryDate: entry.entryDate ?? entryDate,
        description: entry.description,
        reference: entry.reference,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        entryType: entry.entryType,
        branchId: entry.branchId ?? branchId,
        lines: entry.lines,
        tx: client,
      });
      transactions.push(transaction);
    }
    return transactions;
  };

  if (tx) {
    return runBatch(tx);
  }
  return prisma.$transaction(runBatch);
}
