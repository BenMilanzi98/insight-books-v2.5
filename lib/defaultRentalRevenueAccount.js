import {
  findCoaPostableIncomeAccountsForTenant,
  pickDefaultPostableIncomeAccount,
} from './coaIncomeAccounts.js';

/**
 * Rental / hiring invoices post to the tenant's default postable revenue leaf (e.g. 4100).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @returns {Promise<{ id: string, accountCode: string | null, accountName: string | null }>}
 */
export async function getDefaultRentalRevenueAccount(tx, tenantId) {
  const rows = await findCoaPostableIncomeAccountsForTenant(tx, tenantId, {
    id: true,
    accountCode: true,
    accountName: true,
    code: true,
    name: true,
    accountType: true,
    type: true,
  });

  const acc = pickDefaultPostableIncomeAccount(rows);

  if (!acc) {
    const err = new Error(
      'No postable revenue account found. Add a detail Income account (e.g. 4100 Product Sales) in Chart of Accounts.'
    );
    err.code = 'MISSING_4000';
    throw err;
  }

  return {
    id: acc.id,
    accountCode: acc.accountCode || acc.code || '4100',
    accountName: acc.accountName || acc.name || 'Product Sales',
  };
}
