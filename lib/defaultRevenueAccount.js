import { resolveDefaultPostableRevenueAccountId } from './coaIncomeAccounts.js';

/**
 * Resolve the tenant's default revenue / sales account for services and POS-style lines.
 * Uses a postable leaf (4100, etc.), never the 4000 Revenue section header.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<string|null>} account id
 */
export async function resolveDefaultRevenueAccountId(prisma, tenantId) {
  if (!tenantId) return null;
  return resolveDefaultPostableRevenueAccountId(prisma, tenantId);
}
