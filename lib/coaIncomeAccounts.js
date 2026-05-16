import { accountBlocksDirectPosting } from './coaDirectPostingEligibility.js';

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

/** Detail revenue codes safe for AR / sales / invoice postings (never section root 4000). */
export const PREFERRED_POSTABLE_INCOME_CODES = [
  '4100',
  '4010',
  '4150',
  '4200',
  '4030',
  '4300',
];

/**
 * @param {object} account - row with accountCode/code and optional _count.childAccounts
 */
export function isCoaAccountPostableForIncome(account) {
  if (!account) return false;
  return !accountBlocksDirectPosting(account).blocked;
}

export function filterCoaPostableIncomeAccounts(accounts) {
  return (accounts || []).filter(isCoaAccountPostableForIncome);
}

/**
 * Pick a leaf income account for sales, invoices, and POS (skips 4000 section header and rollups).
 * @param {object[]} accounts
 */
export function pickDefaultPostableIncomeAccount(accounts) {
  const postable = filterCoaPostableIncomeAccounts(accounts);
  if (!postable.length) return null;

  const norm = (c) => String(c ?? '').trim();
  const codeEq = (acc, want) => norm(acc.accountCode) === want || norm(acc.code) === want;

  for (const code of PREFERRED_POSTABLE_INCOME_CODES) {
    const hit = postable.find((acc) => codeEq(acc, code));
    if (hit) return hit;
  }
  return postable[0];
}

/**
 * Active income/revenue rows that may receive GL postings (not 4000/5000 roots or parent rollups).
 */
export async function findCoaPostableIncomeAccountsForTenant(prisma, tenantId, select = undefined) {
  const baseSelect = {
    id: true,
    accountCode: true,
    code: true,
    accountName: true,
    accountType: true,
    type: true,
    isActive: true,
    acceptsNewTransactions: true,
    _count: {
      select: {
        childAccounts: { where: { isActive: true } },
      },
    },
    ...(select || {}),
  };
  const accounts = await findCoaIncomeAccountsForTenant(prisma, tenantId, baseSelect);
  return filterCoaPostableIncomeAccounts(accounts);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 */
export async function resolveDefaultPostableRevenueAccountId(prisma, tenantId) {
  const accounts = await findCoaPostableIncomeAccountsForTenant(prisma, tenantId);
  return pickDefaultPostableIncomeAccount(accounts)?.id ?? null;
}
