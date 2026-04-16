/**
 * Canonical GL codes for postings (aligned with chartOfAccountsBlueprint).
 * Resolvers prefer new codes and fall back to legacy rows until migrations complete.
 */

import prisma from './prisma.js';

export const CODE_CASH_MAIN = '1110';
export const CODE_CASH_CUSTOM_GROUP = '1120';
export const CODE_ACCOUNTS_RECEIVABLE = '1200';
export const CODE_ACCOUNTS_PAYABLE = '2110';
export const CODE_CURRENT_LIABILITIES_GROUP = '2100';
export const CODE_PRODUCT_SALES = '4100';
export const CODE_SERVICE_REVENUE = '4150';
export const CODE_SERVICE_REVENUE_LEGACY = '4200';
export const CODE_COST_OF_SALES = '5100';
export const CODE_REVENUE_ROOT = '4000';

/**
 * Current Liabilities (2100) posting group — not trade payables.
 * @param {string} tenantId
 * @param {object} tx
 * @returns {Promise<string|null>}
 */
export async function findCurrentLiabilitiesGroupId(tenantId, tx = prisma) {
  const row = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_CURRENT_LIABILITIES_GROUP,
      accountType: 'Liability',
      isActive: true,
      OR: [
        { accountSubtype: 'Group' },
        { accountName: { contains: 'Current Liabilities', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Trade Accounts Payable GL (2110), with legacy 2100 AP fallback.
 * Never returns the 2100 "Current Liabilities" group row.
 * @param {string} tenantId
 * @param {object} tx
 */
export async function findAccountsPayableGlAccount(tenantId, tx = prisma) {
  const ap2110 = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_ACCOUNTS_PAYABLE,
      accountType: 'Liability',
      isActive: true,
    },
  });
  if (ap2110) return ap2110;

  const legacy2100 = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_CURRENT_LIABILITIES_GROUP,
      accountType: 'Liability',
      isActive: true,
      NOT: {
        OR: [
          { accountSubtype: 'Group' },
          { accountName: { contains: 'Current Liabilities', mode: 'insensitive' } },
        ],
      },
    },
  });
  if (legacy2100 && /payable|supplier|trade/i.test(legacy2100.accountName || '')) {
    return legacy2100;
  }

  return tx.account.findFirst({
    where: {
      tenantId,
      accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
      accountType: 'Liability',
      isActive: true,
    },
  });
}

/**
 * Liabilities root (2000) for attaching the current-liabilities group when missing.
 * @param {string} tenantId
 * @param {object} tx
 */
export async function findLiabilitiesRootId(tenantId, tx = prisma) {
  const root = await tx.account.findFirst({
    where: { tenantId, accountCode: '2000', accountType: 'Liability', isActive: true },
    select: { id: true },
  });
  return root?.id ?? null;
}
