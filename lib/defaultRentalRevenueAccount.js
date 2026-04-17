/**
 * Rental / hiring invoices always post to the tenant's standard revenue account **4000**
 * (same as core invoicing expectations for receivables).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @returns {Promise<{ id: string, accountCode: string | null, accountName: string | null }>}
 */
export async function getDefaultRentalRevenueAccount(tx, tenantId) {
  const norm = (c) => String(c ?? '').trim();

  const rows = await tx.account.findMany({
    where: {
      tenantId,
      isActive: true,
      mergedIntoAccountId: null,
      OR: [{ accountCode: '4000' }, { code: '4000' }],
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      code: true,
      name: true,
      accountType: true,
      type: true,
    },
  });

  const acc =
    rows.find((r) => norm(r.accountCode) === '4000') || rows.find((r) => norm(r.code) === '4000');

  if (!acc) {
    const err = new Error(
      'Revenue account 4000 not found for this business. Add or restore account 4000 in Chart of Accounts.'
    );
    err.code = 'MISSING_4000';
    throw err;
  }

  return {
    id: acc.id,
    accountCode: acc.accountCode || acc.code || '4000',
    accountName: acc.accountName || acc.name || 'Revenue',
  };
}
