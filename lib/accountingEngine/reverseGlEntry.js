/**
 * Reverse a posted GL transaction by swapping debits/credits via postGlEntry.
 */

import prisma from '../prisma.js';
import { postGlEntry, AccountingEngineError } from './postGlEntry.js';
import { POSTED_TRANSACTION_STATUSES } from './constants.js';

/**
 * Create a reversal transaction for a posted GL entry.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.originalTransactionId
 * @param {string} params.reason
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [params.tx]
 * @returns {Promise<import('@prisma/client').Transaction & { lines: import('@prisma/client').TransactionLine[] }>}
 */
export async function reverseGlEntry({
  tenantId,
  userId,
  originalTransactionId,
  reason,
  entryDate = null,
  tx = null,
}) {
  if (!tenantId || !userId || !originalTransactionId) {
    throw new AccountingEngineError('tenantId, userId, and originalTransactionId are required.');
  }
  if (!reason?.trim()) {
    throw new AccountingEngineError('A reason is required to reverse a GL entry.');
  }

  const db = tx || prisma;

  const original = await db.transaction.findFirst({
    where: { id: originalTransactionId, tenantId },
    include: { lines: true },
  });

  if (!original) {
    throw new AccountingEngineError('Original transaction not found.', 'NOT_FOUND');
  }
  if (original.isReversal) {
    throw new AccountingEngineError('Cannot reverse a reversal entry.');
  }
  if (!POSTED_TRANSACTION_STATUSES.includes(original.status)) {
    throw new AccountingEngineError('Only posted transactions can be reversed.');
  }

  const existingReversal = await db.transaction.findFirst({
    where: {
      tenantId,
      isReversal: true,
      reversedTransactionId: originalTransactionId,
    },
    select: { id: true },
  });
  if (existingReversal) {
    throw new AccountingEngineError('This transaction has already been reversed.', 'ALREADY_REVERSED');
  }

  const sortedLines = [...original.lines].sort(
    (a, b) => (a.lineNumber || 0) - (b.lineNumber || 0)
  );

  const reversalLines = sortedLines.map((line, idx) => {
    const origDebit = parseFloat(line.debitAmount ?? 0) || 0;
    const origCredit = parseFloat(line.creditAmount ?? 0) || 0;
    return {
      lineNumber: line.lineNumber ?? idx + 1,
      accountId: line.accountId,
      debitAmount: origCredit,
      creditAmount: origDebit,
      description: `REVERSAL: ${line.description || original.description}`,
    };
  });

  const sanitizedReason = reason.trim();
  const reversalDate =
    entryDate instanceof Date && !Number.isNaN(entryDate.getTime()) ? entryDate : new Date();

  return postGlEntry({
    tenantId,
    userId,
    entryDate: reversalDate,
    description: `REVERSAL: ${original.description}`,
    sourceType: 'Transaction',
    sourceId: originalTransactionId,
    entryType: 'Reversal',
    branchId: original.branchId,
    lines: reversalLines,
    isReversal: true,
    reversedTransactionId: originalTransactionId,
    reversalReason: sanitizedReason,
    reversedAt: reversalDate,
    reversedById: userId,
    allowBlockedAccountForReversal: true,
    tx,
  });
}
