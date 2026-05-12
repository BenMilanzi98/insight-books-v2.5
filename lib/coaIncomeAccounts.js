/**
 * Chart of Accounts rows that count as income/revenue for POS, sales, and invoices.
 * Many tenants store type only on `accountType`; older/imported data may use `type`,
 * or use non-canonical casing (e.g. INCOME, revenue).
 */
export const COA_INCOME_ACCOUNT_OR = [
  { accountType: { equals: 'Income', mode: 'insensitive' } },
  { accountType: { equals: 'Revenue', mode: 'insensitive' } },
  { type: { equals: 'Income', mode: 'insensitive' } },
  { type: { equals: 'Revenue', mode: 'insensitive' } },
];

/**
 * @param {string} tenantId
 * @param {Record<string, unknown>} [and] — merged into the where (e.g. { id: { in: [...] } })
 */
export function prismaWhereCoaIncomeAccounts(tenantId, and = {}) {
  return {
    tenantId,
    isActive: true,
    mergedIntoAccountId: null,
    ...and,
    OR: COA_INCOME_ACCOUNT_OR,
  };
}

/** Canonical revenue codes when `accountType` / `type` were never set to Income/Revenue (imports, old data). */
const LEGACY_INCOME_CODE_OR = [
  { accountCode: { in: ['4000', '4100', '4150', '4200'] } },
  { code: { in: ['4000', '4100', '4150', '4200'] } },
];

/**
 * Income rows for POS / sales defaulting: strict type match, plus legacy code-based rows if none matched.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {Record<string, unknown>} [select]
 */
export async function findCoaIncomeAccountsForTenant(prisma, tenantId, select = undefined) {
  const baseSelect = select ?? {
    id: true,
    accountCode: true,
    code: true,
    accountName: true,
    accountType: true,
    type: true,
    isActive: true,
  };
  const typed = await prisma.account.findMany({
    where: prismaWhereCoaIncomeAccounts(tenantId),
    select: baseSelect,
    orderBy: [{ accountCode: 'asc' }],
  });
  if (typed.length > 0) return typed;

  return prisma.account.findMany({
    where: {
      tenantId,
      isActive: true,
      mergedIntoAccountId: null,
      OR: LEGACY_INCOME_CODE_OR,
    },
    select: baseSelect,
    orderBy: [{ accountCode: 'asc' }],
  });
}
