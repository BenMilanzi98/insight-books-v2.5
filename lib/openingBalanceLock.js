/**
 * Opening balance immutability after first accounting period close.
 */
import prisma from '@/lib/prisma';

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function isOpeningBalancesLocked(tenantId, db = prisma) {
  const closed = await db.accountingPeriod.count({
    where: { tenantId, status: 'closed' },
  });
  return closed > 0;
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function assertOpeningBalancesEditable(tenantId, db = prisma) {
  if (await isOpeningBalancesLocked(tenantId, db)) {
    throw new Error(
      'Opening balances are locked because at least one accounting period has been closed. Use a manual journal entry or controlled period reopening to make corrections.',
    );
  }
}
