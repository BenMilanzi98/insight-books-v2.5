/**
 * COGS / Cost of Sales account ids — single source for:
 * GET /api/expenses, export CSV, expense statistics, and dashboard COGS totals (net GL debits − credits).
 * Includes **5110–5199** expense leaves (standard postings use **5110 Purchases**, not the **5100** rollup).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string | Record<string, unknown>} tenantScope — `tenantId` string or tenant where fragment (e.g. `{ tenantId: { in: string[] } }` from `tenantWhereIn`)
 * @returns {Promise<string[]>}
 */
export async function getCogsAccountIdsForExpenseRegister(prisma, tenantScope) {
  const tw =
    typeof tenantScope === 'string'
      ? { tenantId: tenantScope }
      : tenantScope && typeof tenantScope === 'object'
        ? tenantScope
        : { tenantId: { in: [] } };

  /** Standard chart: Cost of Sales detail accounts **5100–5199** (COGS posts to 5110, not 5100, when children exist). */
  const costOfSalesExpenseCodeRange = {
    accountType: 'Expense',
    OR: [
      { accountCode: { gte: '5100', lte: '5199' } },
      { code: { gte: '5100', lte: '5199' } },
    ],
  };

  const cogsAccounts = await prisma.account.findMany({
    where: {
      ...tw,
      isActive: true,
      OR: [
        {
          accountType: 'Expense',
          OR: [
            { accountCode: '5000' },
            { code: '5000' },
            { accountCode: '5100' },
            { code: '5100' },
            { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
            { accountName: { contains: 'cost of sales', mode: 'insensitive' } },
            { accountName: { contains: 'cogs', mode: 'insensitive' } },
            { name: { contains: 'cost of goods', mode: 'insensitive' } },
            { name: { contains: 'cost of sales', mode: 'insensitive' } },
            { name: { contains: 'cogs', mode: 'insensitive' } },
          ],
        },
        { accountCode: '5100' },
        { code: '5100' },
        costOfSalesExpenseCodeRange,
      ],
    },
    select: { id: true },
  });
  return [...new Set(cogsAccounts.map((acc) => acc.id))];
}
