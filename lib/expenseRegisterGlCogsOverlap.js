/**
 * When combining the expense register with GL COGS, avoid double-counting rows that
 * already hit COGS in the ledger — including legacy rows with only a free-text category.
 *
 * We only apply legacy label dedup when there is GL COGS activity in the window, so
 * tenants that record COGS only on the register (no GL lines) are not understated.
 */

/**
 * @param {number} cogsTotal
 * @param {number} cogsTransactionCount
 */
export function isGlCogsWindowActive(cogsTotal, cogsTransactionCount) {
  const net = Math.abs(Number(cogsTotal) || 0);
  const n = Number(cogsTransactionCount) || 0;
  return net >= 1e-6 || n > 0;
}

/**
 * @param {string | null | undefined} categoryName
 */
export function expenseCategoryLabelLooksLikeCogs(categoryName) {
  const s = (categoryName || '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'cogs') return true;
  if (s === 'cost of sales') return true;
  if (s === 'cost of goods sold') return true;
  if (s.startsWith('cost of goods')) return true;
  return false;
}

/**
 * @param {{ expenseAccountId?: string | null, categoryId?: string | null, category?: string | null, expenseCategory?: { accountId?: string | null } | null }} expense
 * @param {Set<string>} cogsIdSet
 * @param {boolean} glCogsActive
 */
export function expenseOverlapsGlCogsForDedup(expense, cogsIdSet, glCogsActive) {
  if (!glCogsActive || !cogsIdSet?.size) return false;
  if (expense.expenseAccountId && cogsIdSet.has(expense.expenseAccountId)) return true;
  const catAcc = expense.expenseCategory?.accountId;
  if (catAcc && cogsIdSet.has(catAcc)) return true;
  if (expense.expenseAccountId != null && expense.expenseAccountId !== '') return false;
  if (expense.categoryId != null && expense.categoryId !== '') return false;
  return expenseCategoryLabelLooksLikeCogs(expense.category);
}

/**
 * Prisma `where` clause for expenses whose amounts are already represented in GL COGS
 * for the same analytics window (used for aggregate subtraction).
 *
 * @param {string[]} cogsAccountIds
 */
export function prismaWhereExpenseRegisterOverlapsGlCogs(cogsAccountIds) {
  if (!cogsAccountIds?.length) {
    return { id: { in: [] } };
  }
  return {
    OR: [
      { expenseAccountId: { in: cogsAccountIds } },
      { expenseCategory: { is: { accountId: { in: cogsAccountIds } } } },
      {
        AND: [
          { expenseAccountId: null },
          { categoryId: null },
          {
            OR: [
              { category: { equals: 'Cost of Goods Sold', mode: 'insensitive' } },
              { category: { equals: 'COGS', mode: 'insensitive' } },
              { category: { equals: 'Cost of Sales', mode: 'insensitive' } },
              { category: { startsWith: 'Cost of Goods', mode: 'insensitive' } },
            ],
          },
        ],
      },
    ],
  };
}
