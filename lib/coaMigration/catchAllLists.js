import prisma from '@/lib/prisma';

const CATCH_ALL_CODES = ['1999', '2999', '4900', '5900'];

/**
 * Accounts posted into catch-all GL codes (same code or flagged for reclassification).
 * @param {string} tenantId
 */
export async function listCatchAllOccupants(tenantId) {
  const byCode = await prisma.account.findMany({
    where: {
      tenantId,
      isActive: true,
      accountCode: { in: CATCH_ALL_CODES },
    },
    select: { id: true, accountCode: true, accountName: true, requiresReclassification: true, balance: true },
  });

  const flagged = await prisma.account.findMany({
    where: {
      tenantId,
      isActive: true,
      requiresReclassification: true,
      NOT: { accountCode: { in: CATCH_ALL_CODES } },
    },
    select: { id: true, accountCode: true, accountName: true, balance: true },
    take: 500,
  });

  return { catchAllAccounts: byCode, otherFlagged: flagged };
}
