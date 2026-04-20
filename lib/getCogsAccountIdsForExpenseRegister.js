/**
 * COGS / Cost of Sales account ids — single source for:
 * GET /api/expenses, export CSV, and expense statistics (net COGS).
 * Must stay in sync with `app/api/expenses/route.js` policy.
 */
export async function getCogsAccountIdsForExpenseRegister(prisma, tenantId) {
  const cogsAccounts = await prisma.account.findMany({
    where: {
      tenantId,
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
            { name: { contains: 'cogs', mode: 'insensitive' } }
          ]
        },
        { accountCode: '5100' },
        { code: '5100' }
      ]
    },
    select: { id: true }
  });
  return [...new Set(cogsAccounts.map((acc) => acc.id))];
}
