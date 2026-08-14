/**
 * COGS / Cost of Goods account ids — single source for:
 * GET /api/expenses, export CSV, expense statistics, and dashboard COGS totals (net GL debits − credits).
 * Includes COGS detail leaves (standard postings use **5110 Cost of Goods Sold**, not the
 * **5000 Expenses** or **5100 Cost of Goods** structural rollups).
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

  /** Standard chart: Cost of Goods detail accounts **5110–5199**. */
  const costOfSalesExpenseCodeRange = {
    accountType: 'Expense',
    OR: [
      { accountCode: { gte: '5110', lte: '5199' } },
      { code: { gte: '5110', lte: '5199' } },
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
            { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
            { accountName: { contains: 'cost of sales', mode: 'insensitive' } },
            { accountName: { contains: 'cogs', mode: 'insensitive' } },
            { accountName: { contains: 'purchases', mode: 'insensitive' } },
            { name: { contains: 'cost of goods', mode: 'insensitive' } },
            { name: { contains: 'cost of sales', mode: 'insensitive' } },
            { name: { contains: 'cogs', mode: 'insensitive' } },
            { name: { contains: 'purchases', mode: 'insensitive' } },
          ],
        },
        costOfSalesExpenseCodeRange,
        { productsCogs: { some: {} } },
      ],
    },
    select: {
      id: true,
      accountCode: true,
      code: true,
      _count: { select: { childAccounts: true } },
    },
  });

  const structuralCodes = new Set(['5000', '5100']);
  const ids = new Set(
    cogsAccounts
      .filter((acc) => {
        const code = String(acc.accountCode || acc.code || '').trim();
        if (structuralCodes.has(code)) return acc._count.childAccounts === 0;
        return true;
      })
      .map((acc) => acc.id)
  );

  // Ensure the leaf used by V2 COST_OF_SALES purpose postings is always included.
  if (typeof tenantScope === 'string') {
    try {
      const { resolveCogsPostingLeafGlAccount } = await import('@/lib/cogsGlAccount');
      const leaf = await resolveCogsPostingLeafGlAccount(tenantScope, prisma);
      if (leaf?.id) ids.add(leaf.id);
    } catch {
      /* purpose leaf optional */
    }
  }

  return [...ids];
}
