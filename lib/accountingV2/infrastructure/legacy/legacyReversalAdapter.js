/**
 * Accounting V2 — legacy reversal adapter (read-only in Phase 2).
 *
 * READS: reversal state of legacy `Transaction` rows.
 * WRITES: nothing. Phase 2 does not execute reversals through V2.
 *
 * Known inherited defects (documented): original transactions keep status 'posted'
 * after reversal (only `reversedAt` is set); some legacy reversal branches bypass
 * the engine. Phase 5/9 reimplement reversal execution.
 */

import prisma from '../../../prisma.js';
import { ReversalStatus } from '../../domain/enums.js';
import { assertSameBusiness } from '../../domain/accountingContext.js';

/**
 * Read the V2-normalized reversal state of a legacy transaction.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {string} transactionId
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<{status: string, original: object|null, reversals: object[]}>}
 */
export async function getLegacyReversalState(context, transactionId, db = prisma) {
  const original = await db.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      tenantId: true,
      status: true,
      isReversal: true,
      reversedAt: true,
      reversalReason: true,
    },
  });
  if (!original) return { status: ReversalStatus.NOT_REVERSED, original: null, reversals: [] };
  assertSameBusiness(context, original, 'transaction');

  const reversals = await db.transaction.findMany({
    where: {
      tenantId: context.businessId,
      isReversal: true,
      reversedTransactionId: transactionId,
    },
    select: { id: true, date: true, status: true, reference: true },
  });

  const status =
    reversals.length > 0 || original.reversedAt
      ? ReversalStatus.REVERSED
      : ReversalStatus.NOT_REVERSED;
  return { status, original, reversals };
}
