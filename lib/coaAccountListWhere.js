/**
 * Shared Prisma `where` for tenant GL rows — aligned with Chart of Accounts list filters
 * (before rollups / synthetic rows). Used by GET /api/chart-of-accounts and GET /api/chart-of-accounts/picker.
 */

export const COA_ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

/** @param {unknown} value */
export function normalizeCoaAccountType(value) {
  if (!value) return value;
  const normalized = value.toString().trim();
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return COA_ACCOUNT_TYPES.includes(upper) ? upper : normalized;
}

/**
 * @param {string} tenantId
 * @param {URLSearchParams} searchParams
 * @returns {Record<string, unknown>}
 */
export function buildCoaAccountListWhere(tenantId, searchParams) {
  const accountType = searchParams.get('accountType');
  const isActive = searchParams.get('isActive');
  const search = searchParams.get('search');
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const includeMergedSources = searchParams.get('includeMergedSources') === 'true';
  const includeChartHidden = searchParams.get('includeChartHidden') === 'true';

  const where = {
    tenantId,
  };

  if (!includeChartHidden) {
    where.visibleInChart = true;
  }

  if (!includeMergedSources) {
    where.mergedIntoAccountId = null;
  }

  const andBlocks = [];

  if (accountType && accountType !== 'All') {
    const fam = String(accountType).trim().toLowerCase();
    if (fam === 'income' || fam === 'revenue') {
      andBlocks.push({
        OR: [
          { accountType: { equals: 'Income', mode: 'insensitive' } },
          { accountType: { equals: 'Revenue', mode: 'insensitive' } },
          { type: { equals: 'Income', mode: 'insensitive' } },
          { type: { equals: 'Revenue', mode: 'insensitive' } },
        ],
      });
    } else {
      const normalized = normalizeCoaAccountType(accountType);
      andBlocks.push({
        OR: [
          { accountType: { equals: normalized, mode: 'insensitive' } },
          { type: { equals: normalized, mode: 'insensitive' } },
        ],
      });
    }
  }

  if (isActive === 'true' || (!includeInactive && isActive !== 'false')) {
    if (includeMergedSources) {
      andBlocks.push({
        OR: [{ isActive: true }, { mergedIntoAccountId: { not: null } }],
      });
    } else {
      andBlocks.push({ isActive: true });
    }
  } else if (isActive === 'false') {
    where.isActive = false;
  }

  if (search) {
    andBlocks.push({
      OR: [
        { accountCode: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (andBlocks.length) {
    where.AND = andBlocks;
  }

  return where;
}
